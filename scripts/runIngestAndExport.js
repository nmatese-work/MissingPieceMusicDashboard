/**
 * scripts/runIngestAndExport.js
 *
 * Usage:
 *   node scripts/runIngestAndExport.js "Artist Name" [--weeks=8] [--tracks]
 *
 * Environment:
 *   OFFLINE=true  -> skip Chartmetric API calls and use only local DB values
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');

const db = require('../src/models');
const { buildWeeklyArtistReport } = require('../src/reports/buildWeeklyArtistReport');
const { renderWeeklyArtistCsv } = require('../src/services/export/weeklyArtistCsv.renderer');

// --------------------
// Optional ingestion modules (best-effort)
// --------------------
let ingestModule = {};
try {
  ingestModule = require('../src/services/ingestion/ingestChartmetric');
} catch (_) {}

const ingestArtistByName =
  ingestModule.ingestArtistByName || ingestModule.default || null;
// const backfillArtistWeeks =
//   ingestModule.backfillArtistWeeks || null;

// Optional track ingestion
let trackIngestModule = null;
try {
  trackIngestModule = require('../src/services/ingestion/ingestTracks');
} catch (_) {
  trackIngestModule = null;
}

// --------------------
// CLI args
// --------------------
const argv = process.argv.slice(2);
if (!argv.length) {
  console.error('Usage: node scripts/runIngestAndExport.js "Artist Name" [--weeks=8] [--tracks]');
  process.exit(1);
}

const artistName = argv[0];
const weeksFlag = argv.find(a => a.startsWith('--weeks=')) || '--weeks=8';
const weeks = Number(weeksFlag.split('=')[1] || 8);
const includeTracks = argv.includes('--tracks') || argv.includes('-t');

// --------------------
// Helpers
// --------------------
async function ensureDb() {
  await db.sequelize.authenticate();
  await db.sequelize.sync({ alter: true });
}

async function findLocalArtistByNameOrId(name) {
  let artist = await db.Artist.findOne({ where: { name } });
  if (!artist && /^\d+$/.test(name)) {
    artist = await db.Artist.findOne({ where: { chartmetricArtistId: name } });
  }
  return artist;
}

async function createLocalArtist(name) {
  return db.Artist.create({
    name,
    chartmetricArtistId: null,
    spotifyArtistId: null,
    meta: {},
  });
}

// --------------------
// Main
// --------------------
async function main() {
  await ensureDb();

  const offline = String(process.env.OFFLINE || '').toLowerCase() === 'true';
  let artist = null;
  let ingestResult = null;

  // Ingest artist (best-effort)
  if (!offline && typeof ingestArtistByName === 'function') {
    try {
      ingestResult = await ingestArtistByName({ name: artistName, weeks });
    } catch (err) {
      console.warn('Chartmetric ingestion failed, continuing offline:', err.message || err);
    }
  } else if (offline) {
    console.log('OFFLINE mode enabled — skipping Chartmetric ingestion.');
  }

  if (ingestResult?.artistId) {
    artist = await db.Artist.findByPk(ingestResult.artistId);
  } else {
    artist = await findLocalArtistByNameOrId(artistName);
  }

  if (!artist) {
    artist = await createLocalArtist(artistName);
    console.log('Created local placeholder artist:', artist.name);
  }

  // // Backfill weeks (best-effort)
  // if (!offline && typeof backfillArtistWeeks === 'function') {
  //   try {
  //     await backfillArtistWeeks({
  //       artist,
  //       cmArtistId: artist.chartmetricArtistId,
  //       weeks,
  //     });
  //   } catch (err) {
  //     console.warn('Backfill failed:', err.message || err);
  //   }
  // }

  // Track ingestion (optional)
  if (includeTracks && !offline && trackIngestModule?.ingestTracksForArtist) {
    try {
      await trackIngestModule.ingestTracksForArtist({
        artist,
        cmArtistId: artist.chartmetricArtistId,
      });
    } catch (err) {
      console.warn('Track ingestion failed:', err.message || err);
    }
  }

  // --------------------
  // Load snapshots
  // --------------------
  const snapshots = await db.WeeklyArtistSnapshot.findAll({
    where: { artistId: artist.id },
    order: [['weekStartDate', 'DESC']],
    limit: Math.max(12, weeks),
    raw: true,
  });

  // --------------------
  // Load tracks (for report only)
  // --------------------
  let tracksForReport = [];

  if (includeTracks && db.Track && db.TrackWeeklySnapshot) {
    const tracks = await db.Track.findAll({
      where: { artistId: artist.id },
      order: [['id', 'ASC']],
      raw: true,
    });

    for (const t of tracks) {
      const trackSnaps = await db.TrackWeeklySnapshot.findAll({
        where: { trackId: t.id },
        order: [['weekStartDate', 'DESC']],
        limit: Math.max(12, weeks),
        raw: true,
      });

      tracksForReport.push({
        title: t.title || t.name || 'Untitled',
        listenerHistory: trackSnaps.map(s => s.spotifyListeners ?? null),
      });
    }
  }

  // --------------------
  // Build + render CSV
  // --------------------
  const report = buildWeeklyArtistReport({
    artistName: artist.name,
    snapshots,
    tracks: tracksForReport,
  });

  const outputDir = process.env.OUTPUT_DIR || 'outputExports';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = `${artist.name} - Weekly Artist Tracking.csv`;
  const outputPath = path.join(outputDir, filename);

  const csv = renderWeeklyArtistCsv(report);
  fs.writeFileSync(outputPath, csv, 'utf8');

  console.log('Exported CSV →', outputPath);
  process.exit(0);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err.stack || err);
    process.exit(4);
  });
}

module.exports = main;
