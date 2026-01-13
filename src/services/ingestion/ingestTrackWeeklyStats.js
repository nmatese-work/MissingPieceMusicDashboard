// src/services/ingestion/ingestTrackWeeklyStats.js
const dayjs = require('dayjs');
const cmClient = require('../../config/chartmetric.client');
const db = require('../../models');

function normalizePoint(p) {
  // Updated to handle new track stats API response format
  // Response: { value: Integer, timestp: Date, daily_diff?: Integer, interpolated?: Boolean }
  const date = p.timestp ?? p.date ?? p.start ?? p.week ?? p.datetime ?? p.t ?? null;
  const value = p.value ?? p.value_int ?? p.value_number ?? p.v ?? p.val ?? p.listeners ?? p.followers ?? null;
  const isInterpolated = p.interpolated === true || p.interpolated === 'true' || p.interpolated === 1 || p.interpolated === '1' 
    ? true 
    : (p.interpolated === false || p.interpolated === 0 || p.interpolated === '0' ? false : undefined);
  return { dateISO: date, value: value == null ? null : Number(value), isInterpolated };
}

function choosePoint(points) {
  if (!points || !points.length) return null;
  const sorted = points.filter(p=>p && p.dateISO).sort((a,b)=> new Date(a.dateISO) - new Date(b.dateISO));
  if (!sorted.length) return null;
  for (let i = sorted.length -1; i>=0; i--) if (sorted[i].isInterpolated === false) return sorted[i].value;
  return sorted[sorted.length-1].value;
}

async function ingestTrackWeeklyStats({ artistId, weeks = 12 }) {
  const tracks = await db.Track.findAll({ where: { artistId }, raw: true });
  let upserted = 0;

  for (const t of tracks) {
    const cmId = t.chartmetricTrackId;
    if (!cmId) continue;

    // try track stat endpoint using new API: /track/:id/spotify/stats/:mode
    let points = [];
    try {
      // Use the new track stats endpoint with type=streams
      const res = await cmClient.get(`/track/${cmId}/spotify/stats/highest-playcounts`, {
        params: { type: 'streams' }
      });
      const obj = res.data?.obj ?? res.data ?? null;
      // Response structure: [{ domain: "spotify", data: [{ value, timestp }] }]
      if (Array.isArray(obj) && obj.length > 0) {
        const trackData = obj[0];
        if (Array.isArray(trackData.data)) {
          points = trackData.data;
        }
      }
    } catch (err) {
      // ignore - will fallback to metadata
    }

    // fallback: try /track/{id} cm_statistics (single totals)
    if ((!Array.isArray(points) || points.length === 0)) {
      try {
        const res = await cmClient.get(`/track/${cmId}`);
        const tObj = res.data?.obj ?? res.data ?? null;
        // Try to extract summary values and write a single-week snapshot (current time)
        const stat = tObj?.cm_statistics ?? tObj?.cm_track_statistics ?? null;
        if (stat) {
          const row = {
            trackId: t.id,
            weekStartDate: dayjs().startOf('week').format('YYYY-MM-DD'),
            spotifyListeners: stat.sp_streams ?? stat.sp_playlist_total_reach ?? null,
            spotifySaves: stat.sp_saves ?? null,
            spotifySaveRate: null,
          };
          await db.TrackWeeklySnapshot.upsert(row);
          upserted++;
          continue;
        }
      } catch (err) {
        // ignore
      }
    }

    // If we have points, group by week and choose last non-interpolated point
    const weekMap = {};
    for (const raw of points) {
      const n = normalizePoint(raw);
      if (!n.dateISO) continue;
      const wk = dayjs(n.dateISO).startOf('week').format('YYYY-MM-DD');
      weekMap[wk] = weekMap[wk] || [];
      weekMap[wk].push(n);
    }

    const dates = Object.keys(weekMap).sort((a,b)=> new Date(b) - new Date(a)).slice(0, weeks);
    for (const d of dates) {
      const val = choosePoint(weekMap[d]);
      const row = {
        trackId: t.id,
        weekStartDate: d,
        spotifyListeners: val ?? null,
        spotifySaves: null,
        spotifySaveRate: null,
      };
      await db.TrackWeeklySnapshot.upsert(row);
      upserted++;
    }
  }

  console.log(`Ingested/Upserted ${upserted} track weekly snapshot rows for artist ${artistId}`);
  return upserted;
}

module.exports = { ingestTrackWeeklyStats };
