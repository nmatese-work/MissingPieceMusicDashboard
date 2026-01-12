// src/services/ingestion/ingestWeeklySnapshots.js
const db = require('../../models'); // Sequelize models index
const ChartmetricService = require('../chartmetric/chartmetric.client');
const { calculateSaveRate } = require('../../lib/math'); // small util
const dayjs = require('dayjs');

async function ingestArtistSnapshots({ artistId, spotifyArtistId, chartmetricArtistId, chartmetricToken }) {
  const cm = new ChartmetricService(chartmetricToken);

  // fetch data from Chartmetric - adapt to docs
  const metrics = await cm.fetchArtistMetrics(chartmetricArtistId, { range: '90d' });

  // Example: metrics.weekly might be an array of week snapshots with a weekStart date
  const snapshots = (metrics.weeks || []).map(w => ({
    weekStartDate: dayjs(w.start).format('YYYY-MM-DD'),
    spotifyStreamsTotal: w.spotify_streams_total ?? null,
    spotifyStreamsWeekly: w.spotify_streams_weekly ?? null,
    spotifySavesTotal: w.spotify_saves_total ?? null,
    spotifySaveRate: w.spotify_save_rate ?? null,
    spotifyMonthlyListeners: w.spotify_monthly_listeners ?? null,
    spotifyFollowers: w.spotify_followers ?? null,
    tiktokFollowers: w.tiktok_followers ?? null,
    instagramFollowers: w.instagram_followers ?? null,
    youtubeSubscribers: w.youtube_subscribers ?? null,
  }));

  // Upsert into DB inside transaction
  const trx = await db.sequelize.transaction();
  try {
    const artist = await db.Artist.findByPk(artistId, { transaction: trx });
    if (!artist) throw new Error('Artist not found');

    for (const snap of snapshots) {
      // compute derived if missing
      if ((snap.spotifySaveRate === null || snap.spotifySaveRate === undefined) && snap.spotifySavesTotal != null && snap.spotifyStreamsTotal != null) {
        snap.spotifySaveRate = await calculateSaveRate({
          totalSaves: snap.spotifySavesTotal,
          totalStreams: snap.spotifyStreamsTotal
        });
      }

      await db.WeeklyArtistSnapshot.upsert({
        artistId: artist.id,
        ...snap,
      }, { transaction: trx });
    }

    await trx.commit();
    return { inserted: snapshots.length };
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

module.exports = { ingestArtistSnapshots };
