const db = require('../../models');
const cmService = require('../chartmetric/chartmetric.service');
const dayjs = require('dayjs');
const { assertChartmetricEnabled } =
  require('../../config/chartmetric.guard');

/**
 * Upsert a weekly snapshot row (idempotent)
 */
async function upsertWeeklySnapshot(row) {
  try {
    await db.WeeklyArtistSnapshot.upsert(row);
    return true;
  } catch (err) {
    console.error('upsertWeeklySnapshot failed:', err?.message || err);
    throw err;
  }
}

/**
 * Ingest a single artist by name
 *
 * IMPORTANT:
 * - Search failure must NOT abort ingestion
 * - Existing DB artist MUST be reused
 */
async function ingestArtistByName({ name }) {
  assertChartmetricEnabled();
  if (!name) throw new Error('Artist name required');

  let cmArtist = null;
  let artist = null;

  // 1️⃣ Try Chartmetric search (non-fatal)
  try {
    cmArtist = await cmService.findArtistByName(name);
    if (cmArtist) {
      console.log(`Found Chartmetric artist: ${cmArtist.name} (${cmArtist.id})`);
    }
  } catch (_) {}

  // 2️⃣ Fallback: existing Artist by name
  if (!cmArtist) {
    console.warn(`Chartmetric search failed for "${name}", falling back to DB`);

    artist = await db.Artist.findOne({ where: { name } });

    if (!artist || !artist.chartmetricArtistId) {
      throw new Error(`No Chartmetric artist found for "${name}"`);
    }

    cmArtist = {
      id: artist.chartmetricArtistId,
      name: artist.name,
    };
  }

  // 3️⃣ Find or create Artist
  if (!artist) {
    [artist] = await db.Artist.findOrCreate({
      where: { chartmetricArtistId: String(cmArtist.id) },
      defaults: {
        name: cmArtist.name,
        chartmetricArtistId: String(cmArtist.id),
        spotifyArtistId: cmArtist.spotify_id ?? null,
        spotifyFollowers: cmArtist.sp_followers ?? null,
        spotifyMonthlyListeners: cmArtist.sp_monthly_listeners ?? null,
        meta: cmArtist ?? null,
      },
    });
  }

  // 4️⃣ Pull socials safely (non-fatal)
  const instagramFollowers =
    await cmService.fetchLatestSocialStat(cmArtist.id, 'instagram');
  const tiktokFollowers =
    await cmService.fetchLatestSocialStat(cmArtist.id, 'tiktok');
  const youtubeSubscribers =
    await cmService.fetchLatestSocialStat(cmArtist.id, 'youtube');

  // 5️⃣ Update artist row (best-effort)
  try {
    await artist.update({
      spotifyFollowers:
        cmArtist.sp_followers ?? artist.spotifyFollowers,
      spotifyMonthlyListeners:
        cmArtist.sp_monthly_listeners ?? artist.spotifyMonthlyListeners,
    });
  } catch (_) {}

  // 6️⃣ Upsert weekly snapshot
  const weekStart = dayjs().startOf('week').format('YYYY-MM-DD');

  await upsertWeeklySnapshot({
    artistId: artist.id,
    weekStartDate: weekStart,

    spotifyFollowers: cmArtist.sp_followers ?? null,
    spotifyMonthlyListeners: cmArtist.sp_monthly_listeners ?? null,

    instagramFollowers,
    tiktokFollowers,
    youtubeSubscribers,
  });

  console.log('Weekly snapshot upserted:', weekStart);

  return {
    artistId: artist.id,
    chartmetricArtistId: cmArtist.id,
  };
}

module.exports = {
  ingestArtistByName,
  upsertWeeklySnapshot,
};
