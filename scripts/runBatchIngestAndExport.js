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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function runArtistCLI(name) {
  return new Promise((resolve, reject) => {
    const args = [
      'scripts/runIngestAndExport.js',
      name,
      `--weeks=${WEEKS}`,
      '--tracks',
    ];

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

  for (const artistName of artistNames) {
    console.log(`\n➡️ Ingesting ${artistName}`);
    await runArtistCLI(artistName);
    await sleep(DELAY_MS);

    const artist = await db.Artist.findOne({ where: { name: artistName } });
    if (!artist) continue;

    const snaps = await db.WeeklyArtistSnapshot.findAll({
      where: { artistId: artist.id },
      order: [['weekStartDate', 'DESC']],
      limit: WEEKS,
      raw: true,
    });

    const report = buildWeeklyArtistReport({
      artistName: artist.name,
      snapshots: snaps,
      tracks: [],
    });

    reports.push(report);
  }

  const outputPath = exportAllArtistsCsv(reports);
  console.log('\n✅ Exported:', outputPath);

  process.exit(0);
}

main();
