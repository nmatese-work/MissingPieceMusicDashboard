// src/services/ingestion/trackPlaylists.js
const cmService = require('../chartmetric/chartmetric.service')();
const db = require('../../models');
const dayjs = require('dayjs');

async function ingestTrackPlaylistsForTrack(trackChartmetricId, { since, until, minFollowers = 150 } = {}) {
  // returns array of playlist add objects { playlistName, addDate, followers, spotifyUrl, curator }
  const raw = await (new (require('../chartmetric/chartmetric.service'))()).fetchTrackPlaylists(trackChartmetricId, {
    platform: 'spotify',
    status: 'past',
    since,
    until,
    minPlaylistFollowers: minFollowers,
  });

  // normalise playlist entries
  const entries = (raw || []).map(p => {
    return {
      playlistName: p.playlist?.name ?? p.name ?? p.playlist_name ?? null,
      addDate: p.added_at ?? p.date ?? p.created_at ?? p.added_on ?? null,
      followers: p.followers ?? p.playlist?.followers ?? null,
      url: p.playlist?.external_urls?.spotify ?? p.url ?? null,
      curator: p.playlist?.owner?.display_name ?? p.owner ?? null,
      raw: p,
    };
  });

  return entries;
}

module.exports = { ingestTrackPlaylistsForTrack };
