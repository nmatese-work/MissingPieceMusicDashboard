function csvEscape(value) {
  if (value === null || value === undefined || value === '') return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(cells) {
  return cells.map(csvEscape).join(',');
}

function renderWeeklyArtistCsv(report) {
  const rows = [];
  const { artistName, weeks, rows: reportRows } = report;

  // Artist title
  rows.push(row([artistName]));
  rows.push(row([]));

  // Header row (UNLIMITED HISTORY)
  rows.push(
    row([
      '',
      'Current',
      '7 Day Change',
      '7 Day %',
      '28 Day Change',
      '28 Day %',
      ...weeks.slice(1), // ✅ ALL historical weeks
    ])
  );

  let started = false;

  for (const r of reportRows) {
    if (r.type === 'section') {
      if (started) rows.push(row([]));
      rows.push(row([r.title]));
      started = true;
      continue;
    }

    rows.push(
      row([
        r.label,
        r.current,
        r.growth7d,
        r.growth7dPct,
        r.growth28d,
        r.growth28dPct,
        ...(r.history || []), // ✅ FULL HISTORY
      ])
    );
  }

  return rows.join('\n');
}

module.exports = { renderWeeklyArtistCsv };
