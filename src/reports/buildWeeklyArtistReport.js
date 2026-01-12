const schema = require('../contracts/weeklyArtistCsv.schema');

function formatWeekLabel(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function pct(curr, prev, precision = 2) {
  if (curr == null || prev == null || prev === 0) return '';
  return (((curr - prev) / prev) * 100).toFixed(precision) + '%';
}

function buildMetric(values, precision) {
  const padded = [...values];
  while (padded.length < 5) padded.push(null);

  const current = padded[0];
  const prev7 = padded[1];
  const prev28 = padded[4];

  return {
    current,
    history: padded.slice(1),
    growth7d: current != null && prev7 != null ? current - prev7 : '',
    growth7dPct: pct(current, prev7, precision),
    growth28d: current != null && prev28 != null ? current - prev28 : '',
    growth28dPct: pct(current, prev28, precision),
  };
}

function buildWeeklyArtistReport({ artistName, snapshots = [], tracks = [] }) {
  const orderedSnapshots = [...snapshots].sort(
    (a, b) => new Date(b.weekStartDate) - new Date(a.weekStartDate)
  );

  const weeks = orderedSnapshots.map(s =>
    formatWeekLabel(s.weekStartDate)
  );

  const rows = [];
  const precision = schema.growthColumns.percentPrecision;

  for (const section of schema.sections) {
    // ---------- TRACKS ----------
    if (section.title === 'Tracks') {
      if (!tracks || tracks.length === 0) {
        if (section.optional) continue;
      }

      rows.push({ type: 'section', title: section.title });

      for (const track of tracks) {
        const metric = buildMetric(
          track.listenerHistory || [],
          precision
        );

        rows.push({
          type: 'metric',
          label: track.title,
          ...metric,
        });
      }

      continue;
    }

    // ---------- NORMAL SECTIONS ----------
    rows.push({ type: 'section', title: section.title });

    for (const rowDef of section.rows) {
      const values = orderedSnapshots.map(
        s => s?.[rowDef.field] ?? null
      );

      const metric = buildMetric(values, precision);

      rows.push({
        type: 'metric',
        label: rowDef.label,
        ...metric,
      });
    }
  }

  return {
    artistName,
    weeks,
    rows,
  };
}

module.exports = { buildWeeklyArtistReport };
