/**
 * scripts/runIngestAndExport.js
 *
 * Usage:
 *   node scripts/runIngestAndExport.js "Artist Name" [--weeks=8] [--tracks] [--interactive]
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
  console.error('Usage: node scripts/runIngestAndExport.js "Artist Name" [--weeks=8] [--tracks] [--interactive]');
  console.error('  --weeks=N     Number of weeks of history to include (default: 8)');
  console.error('  --tracks      Include track data in the report');
  console.error('  --interactive Prompt to confirm artist selection when multiple matches found');
  process.exit(1);
}

const artistName = argv[0];
const weeksFlag = argv.find(a => a.startsWith('--weeks=')) || '--weeks=8';
const interactiveFlag = argv.find(a => a === '--interactive' || a === '-i');
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
      // Enable interactive selection if flag is set
      if (interactiveFlag) {
        process.env.INTERACTIVE_ARTIST_SELECTION = 'true';
      }
      ingestResult = await ingestArtistByName({ name: artistName, weeks });
    } catch (err) {
      console.warn('Chartmetric ingestion failed, continuing offline:', err.message || err);
    } finally {
      // Clean up env var
      delete process.env.INTERACTIVE_ARTIST_SELECTION;
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
    limit: weeks,
    raw: true,
  });
  
  console.log(`Loaded ${snapshots.length} snapshots for report (requested ${weeks} weeks)`);
  if (snapshots.length > 0) {
    console.log(`Date range: ${snapshots[snapshots.length - 1].weekStartDate} to ${snapshots[0].weekStartDate}`);
  }

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

      // Get playlist additions for this track
      const playlists = await db.TrackPlaylist.findAll({
        where: { trackId: t.id },
        order: [['addedAt', 'DESC']],
        limit: 20, // Get recent playlist additions
        raw: true,
      });

      const latestSnapshot = trackSnaps[0] || {};
      
      tracksForReport.push({
        title: t.title || t.name || 'Untitled',
        listenerHistory: trackSnaps.map(s => s.spotifyListeners ?? null),
        currentListeners: latestSnapshot.spotifyListeners ?? null,
        currentSaves: latestSnapshot.spotifySaves ?? null,
        saveRate: latestSnapshot.spotifySaveRate ?? null,
        // Additional track metrics
        tiktokVideos: latestSnapshot.tiktokVideos ?? null,
        spotifyPlaylists: latestSnapshot.spotifyPlaylists ?? null,
        spotifyEditorialPlaylists: latestSnapshot.spotifyEditorialPlaylists ?? null,
        appleMusicPlaylists: latestSnapshot.appleMusicPlaylists ?? null,
        appleMusicEditorialPlaylists: latestSnapshot.appleMusicEditorialPlaylists ?? null,
        spotifyPlaylistReach: latestSnapshot.spotifyPlaylistReach ?? null,
        shazamCounts: latestSnapshot.shazamCounts ?? null,
        youtubeViews: latestSnapshot.youtubeViews ?? null,
        // Playlist additions with dates
        playlistsAdded: playlists.map(p => ({
          playlistName: p.playlistName,
          platform: p.platform || p.meta?.platform || 'spotify',
          followers: p.followers,
          addedAt: p.addedAt ? new Date(p.addedAt).toISOString().split('T')[0] : null,
          curator: p.curator,
        })),
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
