require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const buildWeeklyArtistReport =
  require('../src/reports/buildWeeklyArtistReport').buildWeeklyArtistReport;
const { exportAllArtistsCsv } =
  require('../src/services/export/exportAllArtistsCsv');

const db = require('../src/models');

const ARTIST_FILE = path.join(__dirname, '..', 'artists.txt');
const WEEKS = 8;
const DELAY_MS = 3000;

// Check for interactive flag
const INTERACTIVE = process.argv.includes('--interactive') || process.argv.includes('-i');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function runArtistCLI(name, interactive = false) {
  return new Promise((resolve, reject) => {
    const args = [
      'scripts/runIngestAndExport.js',
      name,
      `--weeks=${WEEKS}`,
      '--tracks',
    ];
    
    if (interactive) {
      args.push('--interactive');
    }

    const child = spawn('node', args, { stdio: 'inherit' });

    child.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        console.warn(`⚠️ Artist failed, continuing batch`);
        resolve();
      }
      
    });
  });
}

async function main() {
  await db.sequelize.authenticate();

  const artistNames = fs
    .readFileSync(ARTIST_FILE, 'utf8')
    .split('\n')
    .map(l => l.replace(/\*$/, '').trim())
    .filter(Boolean);

  const reports = [];

  if (INTERACTIVE) {
    console.log('ℹ️  Interactive mode enabled - you will be prompted to confirm artist selection for each artist');
  }

  for (const artistName of artistNames) {
    console.log(`\n➡️ Ingesting ${artistName}`);
    await runArtistCLI(artistName, INTERACTIVE);
    await sleep(DELAY_MS);

    const artist = await db.Artist.findOne({ where: { name: artistName } });
    if (!artist) continue;

    const snaps = await db.WeeklyArtistSnapshot.findAll({
      where: { artistId: artist.id },
      order: [['weekStartDate', 'DESC']],
      limit: WEEKS,
      raw: true,
    });

    // Load tracks for report
    let tracksForReport = [];
    if (db.Track && db.TrackWeeklySnapshot) {
      const tracks = await db.Track.findAll({
        where: { artistId: artist.id },
        order: [['id', 'ASC']],
        raw: true,
      });

      for (const t of tracks) {
        const trackSnaps = await db.TrackWeeklySnapshot.findAll({
          where: { trackId: t.id },
          order: [['weekStartDate', 'DESC']],
          limit: Math.max(12, WEEKS),
          raw: true,
        });

        // Get playlist additions for this track
        const playlists = await db.TrackPlaylist.findAll({
          where: { trackId: t.id },
          order: [['addedAt', 'DESC']],
          limit: 20,
          raw: true,
        });

        const latestSnapshot = trackSnaps[0] || {};
        
        tracksForReport.push({
          title: t.title || t.name || 'Untitled',
          listenerHistory: trackSnaps.map(s => s.spotifyListeners ?? null),
          currentListeners: latestSnapshot.spotifyListeners ?? null,
          currentSaves: latestSnapshot.spotifySaves ?? null,
          saveRate: latestSnapshot.spotifySaveRate ?? null,
          tiktokVideos: latestSnapshot.tiktokVideos ?? null,
          spotifyPlaylists: latestSnapshot.spotifyPlaylists ?? null,
          spotifyEditorialPlaylists: latestSnapshot.spotifyEditorialPlaylists ?? null,
          appleMusicPlaylists: latestSnapshot.appleMusicPlaylists ?? null,
          appleMusicEditorialPlaylists: latestSnapshot.appleMusicEditorialPlaylists ?? null,
          spotifyPlaylistReach: latestSnapshot.spotifyPlaylistReach ?? null,
          shazamCounts: latestSnapshot.shazamCounts ?? null,
          youtubeViews: latestSnapshot.youtubeViews ?? null,
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

    const report = buildWeeklyArtistReport({
      artistName: artist.name,
      snapshots: snaps,
      tracks: tracksForReport,
    });

    reports.push(report);
  }

  const outputPath = exportAllArtistsCsv(reports);
  console.log('\n✅ Exported:', outputPath);

  process.exit(0);
}

main();
