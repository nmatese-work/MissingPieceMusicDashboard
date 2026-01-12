require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const db = require('../src/models');

const METRIC_MAP = {
  'Spotify followers': 'spotifyFollowers',
  'Spotify monthly listeners': 'spotifyMonthlyListeners',
  'Instagram Followers': 'instagramFollowers',
  'TikTok Followers': 'tiktokFollowers',
  'YouTube Subscribers': 'youtubeSubscribers',
};

function parseDateCell(cell) {
  if (!cell) return null;
  const d = new Date(cell);
  return isNaN(d) ? null : d;
}

async function run(csvFile, artistName) {
  const fullPath = path.resolve(csvFile);
  const raw = fs.readFileSync(fullPath, 'utf8');

  const rows = parse(raw, {
    relax_column_count: true,
    skip_empty_lines: false,
  });

  const artist = await db.Artist.findOne({ where: { name: artistName } });
  if (!artist) throw new Error(`Artist not found: ${artistName}`);

  // --- Find header row that contains dates ---
  const headerRowIndex = rows.findIndex(r =>
    r.some(c => parseDateCell(c))
  );

  if (headerRowIndex === -1) {
    throw new Error('Could not locate date header row');
  }

  const headerRow = rows[headerRowIndex];

  // Date columns start where first parsable date appears
  const dateStartCol = headerRow.findIndex(c => parseDateCell(c));
  const weeks = headerRow
    .slice(dateStartCol)
    .map(parseDateCell)
    .filter(Boolean);

  if (!weeks.length) {
    throw new Error('No valid week dates found');
  }

  console.log(`Detected ${weeks.length} historical weeks`);

  // --- Walk metric rows ---
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const label = row[0]?.trim();

    if (!METRIC_MAP[label]) continue;
    const field = METRIC_MAP[label];

    for (let w = 0; w < weeks.length; w++) {
      const value = Number(row[dateStartCol + w]);
      if (Number.isNaN(value)) continue;

      const weekStartDate = weeks[w]
        .toISOString()
        .slice(0, 10);

      await db.WeeklyArtistSnapshot.upsert({
        artistId: artist.id,
        weekStartDate,
        [field]: value,
      });
    }
  }

  console.log('✅ Historical CSV import COMPLETE');
  process.exit(0);
}

const [, , csvFile, artistName] = process.argv;

if (!csvFile || !artistName) {
  console.error(
    'Usage: node scripts/importHistoricalCsv.js <csvFile> <Artist Name>'
  );
  process.exit(1);
}

run(csvFile, artistName).catch(err => {
  console.error('Import failed:', err.message);
  process.exit(2);
});
