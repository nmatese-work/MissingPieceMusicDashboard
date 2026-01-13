// src/services/ingestion/trackPlaylists.js
const cmService = require('../chartmetric/chartmetric.service')();
const db = require('../../models');
const dayjs = require('dayjs');

async function ingestTrackPlaylistsForTrack(trackChartmetricId, { since, until, minFollowers = 150 } = {}) {
  // returns array of playlist add objects { playlistName, addDate, followers, spotifyUrl, curator }
  const cmService = require('../chartmetric/chartmetric.service');
  const opts = {
    since,
    until,
    editorial: true, // Include editorial playlists
    limit: 100, // Reasonable limit
  };
  const raw = await cmService.fetchTrackPlaylists(
    trackChartmetricId,
    'spotify',
    'past',
    opts
  );

  // normalise playlist entries
  // API response structure: [{ playlist: {...}, track: {...} }]
  const entries = (raw || []).map(entry => {
    const playlist = entry.playlist || entry;
    return {
      playlistName: playlist.name ?? playlist.playlist_name ?? null,
      addDate: playlist.added_at ?? playlist.date ?? playlist.created_at ?? playlist.added_on ?? null,
      followers: playlist.followers ?? null,
      url: playlist.external_urls?.spotify ?? playlist.url ?? null,
      curator: playlist.owner_name ?? playlist.curator_name ?? playlist.owner?.display_name ?? playlist.owner ?? null,
      raw: entry, // Store full entry including track data
    };
  });

  return entries;
}

module.exports = { ingestTrackPlaylistsForTrack };
