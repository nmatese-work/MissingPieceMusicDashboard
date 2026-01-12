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

    // throttle ALL Chartmetric calls
    await throttle(2000);

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
        await throttle(2000);

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
   * platform: instagram | tiktok | youtube
   */
  async fetchLatestSocialStat(cmArtistId, platform) {
    if (!cmArtistId || !platform) return null;

    await throttle(2000);

    try {
      const res = await this.client.get(
        `/artist/${cmArtistId}/stat/${platform}`
      );

      const obj = res.data?.obj;
      if (!obj) return null;

      const key =
        platform === 'youtube'
          ? 'subscribers'
          : 'followers';

      const arr = obj[key];
      if (!Array.isArray(arr) || !arr.length) return null;

      // use the latest value (Chartmetric arrays are chronological)
      const last = arr[arr.length - 1];
      return last?.value ?? null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Fetch full stat history (used for backfills)
   */
  async fetchArtistStatHistory(cmArtistId, platform) {
    if (!cmArtistId || !platform) return [];

    await throttle(2000);

    try {
      const res = await this.client.get(
        `/artist/${cmArtistId}/stat/${platform}`
      );

      const obj = res.data?.obj;
      if (!obj) return [];

      const key =
        platform === 'youtube'
          ? 'subscribers'
          : 'followers';

      const arr = obj[key];
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
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
