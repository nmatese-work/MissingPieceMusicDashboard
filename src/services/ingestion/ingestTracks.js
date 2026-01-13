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

    // If stats missing, fallback to track.cm_statistics or t.cm_statistics
    let currentListeners = null;
    let currentSaves = null;
    let saveRate = null;

    if (stats) {
      currentListeners = stats.currentListeners ?? null;
      currentSaves = stats.currentSaves ?? null;
      saveRate = stats.saveRate ?? null;
    } else {
      const cmstats = t.cm_statistics ?? t.cm_stats ?? t.cm_track_stats ?? null;
      if (cmstats) {
        // Chartmetric often exposes stream counts under sp_streams
        currentListeners = cmstats.sp_streams ?? cmstats.sp_playlist_total_reach ?? null;
        // saves may not be present; try other fields
        currentSaves = cmstats.sp_saves ?? cmstats.saves ?? null;
        // no save rate available reliably here
      }
    }

    // Upsert track weekly snapshot to guarantee it exists (idempotent)
    try {
      await db.TrackWeeklySnapshot.upsert({
        trackId: track.id,
        weekStartDate: weekStart,
        spotifyListeners: currentListeners,
        spotifySaves: currentSaves,
        spotifySaveRate: saveRate,
      });
    } catch (err) {
      console.warn('Failed to upsert TrackWeeklySnapshot for track', track.id, err?.message ?? err);
    }

    // Playlist placements
    try {
      // Fetch current playlists (most relevant)
      const playlists = await chartmetric.fetchTrackPlaylists(
        String(chartmetricTrackId), 
        'spotify', 
        'current',
        { editorial: true, limit: 100 } // Get editorial playlists, limit to avoid too much data
      );
      for (const entry of playlists) {
        // API response structure: { playlist: {...}, track: {...} }
        const playlist = entry.playlist || entry;
        const playlistName = playlist.name || playlist.playlist_name || 'Unknown';
        const addedAt = playlist.added_at || playlist.addedAt || null;
        const followers = playlist.followers || null;
        const curator = playlist.owner_name || playlist.curator_name || playlist.curator || null;

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
