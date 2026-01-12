const fs = require('fs');
const path = require('path');
const { renderWeeklyArtistCsv } = require('./weeklyArtistCsv.renderer');

function exportAllArtistsCsv(reports, outputDir = 'outputExports') {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const rows = [];

  for (let i = 0; i < reports.length; i++) {
    const report = reports[i];
    const csv = renderWeeklyArtistCsv(report);

    rows.push(csv);

    // Spacer between artists
    if (i < reports.length - 1) {
      rows.push('');
      rows.push('');
    }
  }

  const outputPath = path.join(
    outputDir,
    'Weekly Artist Tracking - All Artists.csv'
  );

  fs.writeFileSync(outputPath, rows.join('\n'), 'utf8');

  return outputPath;
}

module.exports = { exportAllArtistsCsv };
