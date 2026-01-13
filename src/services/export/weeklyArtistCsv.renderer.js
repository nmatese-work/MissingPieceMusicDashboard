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
  // Note: For tracks, additional columns (Listeners, Saves, Save %) are added after growth columns
  rows.push(
    row([
      '',
      '#',
      '7-day growth',
      '7-day change',
      '28-day growth',
      '28-day change',
      '', // Notes column (empty header)
      '', // Empty column
      'Listeners', // Track-specific: current listeners
      'Saves', // Track-specific: current saves
      'Save %', // Track-specific: save rate
      ...weeks.slice(1).map(w => w || ''), // ✅ ALL historical weeks
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

    // For tracks, include Listeners, Saves, Save % columns
    // For other metrics, these columns are empty
    const isTrack = r.currentListeners !== undefined || r.currentSaves !== undefined;
    
    rows.push(
      row([
        r.label,
        r.current,
        r.growth7d || '', // 7-day change (absolute)
        r.growth7dPct || '', // 7-day growth (percentage)
        r.growth28d || '', // 28-day change (absolute)
        r.growth28dPct || '', // 28-day growth (percentage)
        '', // Notes column (empty)
        '', // Empty column
        isTrack ? (r.currentListeners ?? '') : '', // Listeners (tracks only)
        isTrack ? (r.currentSaves ?? '') : '', // Saves (tracks only)
        isTrack ? (r.saveRate ? `${(r.saveRate * 100).toFixed(2)}%` : '') : '', // Save % (tracks only)
        ...(r.history || []), // ✅ FULL HISTORY
      ])
    );
  }

  return rows.join('\n');
}

module.exports = { renderWeeklyArtistCsv };
