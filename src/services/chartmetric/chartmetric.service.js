// src/services/chartmetric/chartmetric.service.js

const client = require('../../config/chartmetric.client');
const { throttle } = require('../../lib/chartmetricThrottle');

class ChartmetricService {
  constructor(axiosClient = client) {
    this.client = axiosClient;
  }

  /**
   * Robust artist search
   * Handles ALL known Chartmetric response shapes
   */
  async findArtistByName(name) {
    if (!name) return null;

    // throttle ALL Chartmetric calls (using default 5 seconds to avoid rate limiting)
    await throttle();

    try {
      const res = await this.client.get('/search', {
        params: {
          q: name,
          type: 'artist',
          limit: 5,
        },
      });

      const body = res.data;

      // Shape 1: { data: [...] }
      if (Array.isArray(body?.data)) {
        return body.data[0] ?? null;
      }

      // Shape 2: { data: { artists: { data: [...] } } }
      if (Array.isArray(body?.data?.artists?.data)) {
        return body.data.artists.data[0] ?? null;
      }

      // Shape 3: { artists: { data: [...] } }
      if (Array.isArray(body?.artists?.data)) {
        return body.artists.data[0] ?? null;
      }

      return null;
    } catch (err) {
      // fallback endpoint
      try {
        await throttle(); // Using default 5 seconds to avoid rate limiting

        const r2 = await this.client.get('/artist/search', {
          params: { q: name, limit: 5 },
        });

        const body = r2.data;

        if (Array.isArray(body?.data)) {
          return body.data[0] ?? null;
        }

        if (Array.isArray(body?.artists?.data)) {
          return body.artists.data[0] ?? null;
        }

        return null;
      } catch (_) {
        return null;
      }
    }
  }

  /**
   * Fetch the most recent social stat for a platform
   * platform: instagram | tiktok | youtube_channel | twitter | facebook
   * field: optional field name (e.g., 'followers', 'likes', 'subscribers')
   * 
   * Based on Chartmetric API docs:
   * - tiktok: fields are 'followers' or 'likes'
   * - twitter: fields are 'followers' or 'retweets'
   * - facebook: fields are 'likes' or 'talks'
   * - youtube_channel: fields are 'subscribers', 'views', 'comments', 'videos'
   * - instagram: field is 'followers'
   * - spotify: fields are 'followers', 'popularity', 'listeners'
   */
  async fetchLatestSocialStat(cmArtistId, platform, field = null) {
    if (!cmArtistId || !platform) return null;

    // Increased throttle to 5-10 seconds to avoid rate limiting
    await throttle(5000);

    try {
      const params = {};
      if (field) {
        params.field = field;
      }
      // Use latest=true to get most recent data point regardless of date
      params.latest = true;

      const res = await this.client.get(
        `/artist/${cmArtistId}/stat/${platform}`,
        { params }
      );

      const obj = res.data?.obj;
      if (!obj) return null;

      // Determine the key based on platform and field
      let key = field;
      if (!key) {
        // Default keys if no field specified
        if (platform === 'youtube_channel' || platform === 'youtube') {
          key = 'subscribers';
        } else if (platform === 'facebook') {
          key = 'likes'; // Facebook default is 'likes', not 'followers'
        } else {
          key = 'followers';
        }
      }

      const arr = obj[key];
      if (!Array.isArray(arr) || !arr.length) return null;

      // use the latest value (Chartmetric arrays are chronological)
      const last = arr[arr.length - 1];
      return last?.value ?? null;
    } catch (err) {
      console.warn(`Failed to fetch ${platform} stat for artist ${cmArtistId}:`, err.message);
      return null;
    }
  }

  /**
   * Fetch TikTok Likes (separate from followers)
   * Uses field parameter: /artist/:id/stat/tiktok?field=likes
   */
  async fetchTikTokLikes(cmArtistId) {
    return this.fetchLatestSocialStat(cmArtistId, 'tiktok', 'likes');
  }

  /**
   * Fetch TikTok Likes history (for backfills)
   */
  async fetchTikTokLikesHistory(cmArtistId, since = null, until = null) {
    if (!cmArtistId) return [];

    await throttle(5000);

    try {
      const params = { field: 'likes' };
      if (since) params.since = since;
      if (until) params.until = until;

      const res = await this.client.get(
        `/artist/${cmArtistId}/stat/tiktok`,
        { params }
      );

      const obj = res.data?.obj;
      if (!obj) return [];

      const arr = obj.likes || [];
      return Array.isArray(arr) ? arr : [];
    } catch (err) {
      console.warn(`Failed to fetch TikTok likes history for artist ${cmArtistId}:`, err.message);
      return [];
    }
  }

  /**
   * Fetch full stat history (used for backfills)
   * platform: instagram | tiktok | youtube_channel | twitter | facebook | spotify
   * field: optional field name (e.g., 'followers', 'likes', 'listeners')
   */
  async fetchArtistStatHistory(cmArtistId, platform, field = null, since = null, until = null) {
    if (!cmArtistId || !platform) return [];

    await throttle(5000);

    try {
      const params = {};
      if (field) {
        params.field = field;
      }
      if (since) params.since = since;
      if (until) params.until = until;

      const res = await this.client.get(
        `/artist/${cmArtistId}/stat/${platform}`,
        { params }
      );

      const obj = res.data?.obj;
      if (!obj) return [];

      // Determine the key based on platform and field
      let key = field;
      if (!key) {
        if (platform === 'youtube_channel' || platform === 'youtube') {
          key = 'subscribers';
        } else if (platform === 'facebook') {
          key = 'likes';
        } else {
          key = 'followers';
        }
      }

      const arr = obj[key];
      return Array.isArray(arr) ? arr : [];
    } catch (err) {
      console.warn(`Failed to fetch ${platform} stat history for artist ${cmArtistId}:`, err.message);
      return [];
    }
  }

  /**
   * Fetch track stats including listeners, saves, and save rate
   * Uses /track/:id/:platform/stats/:mode endpoint
   * 
   * Note: Track-level "saves" are not available in Chartmetric API.
   * The CSV shows "Listeners" and "Saves" for tracks, but Chartmetric only provides:
   * - Streams (via /track/:id/spotify/stats/:mode?type=streams)
   * - Playlist total reach (via /track/:id metadata)
   * 
   * We'll use streams as "listeners" and note that saves are not available.
   */
  async fetchTrackStats(cmTrackId, mode = 'highest-playcounts') {
    if (!cmTrackId) return null;

    await throttle(5000);

    try {
      // Get track metadata first (includes cm_statistics with playlist reach)
      const metadataRes = await this.client.get(`/track/${cmTrackId}`);
      const metadata = metadataRes.data?.obj ?? metadataRes.data ?? null;
      const cmStats = metadata?.cm_statistics ?? null;

      // Get Spotify streams stats
      await throttle(5000); // Additional throttle between calls
      const streamsRes = await this.client.get(
        `/track/${cmTrackId}/spotify/stats/${mode}`,
        { params: { type: 'streams', latest: true } }
      );

      const streamsData = streamsRes.data?.obj;
      let currentStreams = null;
      
      if (Array.isArray(streamsData) && streamsData.length > 0) {
        const trackData = streamsData[0];
        if (Array.isArray(trackData.data) && trackData.data.length > 0) {
          // Get the latest value
          currentStreams = trackData.data[trackData.data.length - 1]?.value ?? null;
        }
      }

      // Use playlist total reach as "listeners" (represents potential audience)
      // Fallback to streams if playlist reach not available
      const listeners = cmStats?.sp_playlist_total_reach 
        ? parseInt(String(cmStats.sp_playlist_total_reach), 10) 
        : currentStreams;

      // Note: Track-level saves are not available in Chartmetric API
      // The CSV shows saves, but this data is not provided by Chartmetric
      const saves = null;
      const saveRate = null;

      return {
        currentListeners: listeners,
        currentSaves: saves,
        saveRate: saveRate,
        // Additional data for reference
        currentStreams: currentStreams,
        playlistReach: cmStats?.sp_playlist_total_reach 
          ? parseInt(String(cmStats.sp_playlist_total_reach), 10) 
          : null,
      };
    } catch (err) {
      console.warn(`Failed to fetch track stats for track ${cmTrackId}:`, err.message);
      return null;
    }
  }

  /**
   * Fetch track playlist placements
   * Based on API docs: /track/:id/:platform/:status/playlists
   * platform: spotify, applemusic, deezer, amazon
   * status: current, past
   */
  async fetchTrackPlaylists(cmTrackId, platform = 'spotify', status = 'current', opts = {}) {
    if (!cmTrackId) return [];

    await throttle(5000);

    try {
      const res = await this.client.get(
        `/track/${cmTrackId}/${platform}/${status}/playlists`,
        { params: opts }
      );

      const data = res.data?.obj ?? res.data?.data ?? [];
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn(`Failed to fetch playlists for track ${cmTrackId}:`, err.message);
      return [];
    }
  }
}

/**
 * IMPORTANT:
 * Export a SINGLE instance.
 * This prevents accidental multiple throttles / token misuse.
 */
module.exports = new ChartmetricService();
