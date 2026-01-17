// src/services/ingestion/ingestTracks.js
const db = require('../../models');
const chartmetric = require('../chartmetric/chartmetric.service');

/**
 * Ingest tracks + weekly stats + playlists for a given Artist.
 * Accepts both (artist, opts) and ({ artist, cmArtistId }) call styles.
 */
async function ingestTracksForArtist(arg1, arg2 = {}) {
  let artist = null;
  let opts = {};

  if (arg1 && arg1.artist !== undefined) {
    ({ artist, cmArtistId: opts.cmArtistId, weeks: opts.weeks = 5 } = arg1);
  } else {
    artist = arg1;
    opts = arg2 || {};
  }

  const cmArtistId = opts.cmArtistId || (artist && artist.chartmetricArtistId);
  if (!artist && !cmArtistId) throw new Error('Artist missing chartmetricArtistId');
  if (!artist) {
    artist = await db.Artist.findOne({ where: { chartmetricArtistId: String(cmArtistId) } });
    if (!artist) throw new Error('Could not find local artist for given chartmetric id');
  }

  console.log(`→ Fetching tracks for ${artist.name} (cmId=${cmArtistId})`);

  // fetch track list (try several endpoints)
  let tracks = [];
  try {
    const res = await chartmetric.client.get(`/artist/${cmArtistId}/tracks`);
    tracks = res.data?.obj ?? res.data?.data ?? [];
  } catch (err) {
    console.warn('Track list fetch failed:', err?.message ?? err);
    tracks = [];
  }

  if (!Array.isArray(tracks) || tracks.length === 0) {
    console.log('No tracks found for artist.');
    return [];
  }

  const results = [];
  const weekDate = new Date();
  weekDate.setUTCHours(0,0,0,0);
  const weekStart = weekDate.toISOString().slice(0,10);

  for (const t of tracks) {
    const chartmetricTrackId = t.id || t.cm_track || t.cm_track_id;
    if (!chartmetricTrackId) continue;

    const [track] = await db.Track.findOrCreate({
      where: { chartmetricTrackId: String(chartmetricTrackId) },
      defaults: {
        artistId: artist.id,
        title: t.name || t.title || 'Untitled',
        spotifyTrackId: (t.spotify_track_ids && t.spotify_track_ids[0]) || t.spotify_track_id || null,
        meta: t,
      },
    });

    // Try track stats endpoint first
    let stats = null;
    try {
      stats = await chartmetric.fetchTrackStats(chartmetricTrackId);
    } catch (e) {
      stats = null;
    }

    // Get track metadata to extract cm_statistics with all metrics
    let trackMetadata = null;
    try {
      // Fetch full track metadata for cm_statistics (includes TikTok videos, playlist counts, etc.)
      trackMetadata = await chartmetric.fetchTrackMetadata(chartmetricTrackId);
      if (!trackMetadata) {
        // Fallback to track data from artist tracks endpoint
        trackMetadata = t;
      }
    } catch (err) {
      // Fallback to track data from artist tracks endpoint
      trackMetadata = t;
    }

    const cmstats = trackMetadata?.cm_statistics ?? t.cm_statistics ?? t.cm_stats ?? t.cm_track_stats ?? null;

    // If stats missing, fallback to track.cm_statistics or t.cm_statistics
    let currentListeners = null;
    let currentSaves = null;
    let saveRate = null;

    if (stats) {
      currentListeners = stats.currentListeners ?? null;
      currentSaves = stats.currentSaves ?? null;
      saveRate = stats.saveRate ?? null;
    } else if (cmstats) {
      // Chartmetric often exposes stream counts under sp_streams
      currentListeners = cmstats.sp_streams ?? cmstats.sp_playlist_total_reach ?? null;
      // saves may not be present; try other fields
      currentSaves = cmstats.sp_saves ?? cmstats.saves ?? null;
      // no save rate available reliably here
    }

    // Extract additional metrics from cm_statistics
    const tiktokVideos = cmstats?.num_tt_videos ?? cmstats?.tiktok_counts ?? null;
    const spotifyPlaylists = cmstats?.num_sp_playlists ?? null;
    const spotifyEditorialPlaylists = cmstats?.num_sp_editorial_playlists ?? null;
    const appleMusicPlaylists = cmstats?.num_am_playlists ?? null;
    const appleMusicEditorialPlaylists = cmstats?.num_am_editorial_playlists ?? null;
    const spotifyPlaylistReach = cmstats?.sp_playlist_total_reach 
      ? parseInt(String(cmstats.sp_playlist_total_reach), 10) 
      : null;
    const shazamCounts = cmstats?.shazam_counts ?? null;
    const youtubeViews = cmstats?.youtube_views 
      ? parseInt(String(cmstats.youtube_views), 10) 
      : null;

    // Upsert track weekly snapshot to guarantee it exists (idempotent)
    try {
      await db.TrackWeeklySnapshot.upsert({
        trackId: track.id,
        weekStartDate: weekStart,
        spotifyListeners: currentListeners,
        spotifySaves: currentSaves,
        spotifySaveRate: saveRate,
        youtubeViews: youtubeViews,
        tiktokVideos: tiktokVideos,
        spotifyPlaylists: spotifyPlaylists,
        spotifyEditorialPlaylists: spotifyEditorialPlaylists,
        appleMusicPlaylists: appleMusicPlaylists,
        appleMusicEditorialPlaylists: appleMusicEditorialPlaylists,
        spotifyPlaylistReach: spotifyPlaylistReach,
        shazamCounts: shazamCounts,
      });
    } catch (err) {
      console.warn('Failed to upsert TrackWeeklySnapshot for track', track.id, err?.message ?? err);
    }

    // Playlist placements - fetch both Spotify and Apple Music
    try {
      const allPlaylists = [];
      
      // Fetch Spotify playlists (current)
      const spotifyPlaylists = await chartmetric.fetchTrackPlaylists(
        String(chartmetricTrackId), 
        'spotify', 
        'current',
        { editorial: true, limit: 100 }
      );
      allPlaylists.push(...spotifyPlaylists.map(p => ({ ...p, platform: 'spotify' })));
      
      // Fetch recent past Spotify playlists to catch recent additions (last 90 days)
      const sinceDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const spotifyPastPlaylists = await chartmetric.fetchTrackPlaylists(
        String(chartmetricTrackId),
        'spotify',
        'past',
        { since: sinceDate, editorial: true, limit: 50 }
      );
      allPlaylists.push(...spotifyPastPlaylists.map(p => ({ ...p, platform: 'spotify' })));
      
      // Fetch Apple Music playlists
      try {
        const appleMusicPlaylists = await chartmetric.fetchTrackPlaylists(
          String(chartmetricTrackId),
          'applemusic',
          'current',
          { editorial: true, limit: 100 }
        );
        allPlaylists.push(...appleMusicPlaylists.map(p => ({ ...p, platform: 'applemusic' })));
      } catch (err) {
        // Apple Music might not be available for all tracks
        console.warn(`Apple Music playlists not available for track ${chartmetricTrackId}`);
      }
      for (const entry of allPlaylists) {
        // API response structure: { playlist: {...}, track: {...} }
        const playlist = entry.playlist || entry;
        const playlistName = playlist.name || playlist.playlist_name || 'Unknown';
        const addedAt = playlist.added_at || playlist.addedAt || null;
        const followers = playlist.followers || null;
        const curator = playlist.owner_name || playlist.curator_name || playlist.curator || null;
        
        // Platform is already set in the entry from above
        const platform = entry.platform || 'spotify';

        await db.TrackPlaylist.findOrCreate({
          where: {
            trackId: track.id,
            playlistName: playlistName,
            addedAt: addedAt ? new Date(addedAt) : null,
          },
          defaults: {
            trackId: track.id,
            playlistName: playlistName,
            followers: followers,
            addedAt: addedAt ? new Date(addedAt) : null,
            curator: curator,
            platform: platform,
            meta: entry, // Store full entry for reference
          },
        });
      }
    } catch (err) {
      // non-fatal
    }

    results.push(track);
  }

  console.log(`✓ Ingested ${results.length} tracks for ${artist.name}`);
  return results;
}

module.exports = { ingestTracksForArtist };
