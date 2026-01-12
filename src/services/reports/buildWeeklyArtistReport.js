// src/reports/buildWeeklyArtistReport.js
const { formatWeekLabel } = require('../lib/format');
const metricsConfig = require('../reports/metrics.config');

function buildMetric(values = []) {
  const padded = [...values];
  while (padded.length < 5) padded.push(null);

  const current = padded[0];
  const prev7 = padded[1];
  const prev28 = padded[4];

  const growth7d = (current != null && prev7 != null) ? (current - prev7) : null;
  const growth28d = (current != null && prev28 != null) ? (current - prev28) : null;

  const pct = (curr, prev) => {
    if (curr == null || prev == null || prev === 0) return '0.00%';
    return (((curr - prev) / prev) * 100).toFixed(2) + '%';
  };

  return {
    values: padded,
    current,
    growth7d,
    growth7dPct: pct(current, prev7),
    growth28d,
    growth28dPct: pct(current, prev28),
  };
}

function buildSection(title, metrics = [], snapshots = []) {
  return {
    title,
    metrics: metrics.map(m => {
      const values = snapshots.map(s => s?.[m.field] ?? null);
      return {
        label: m.label,
        field: m.field,
        ...buildMetric(values),
      };
    }),
    // optional: tracks
  };
}

function buildWeeklyArtistReport({ artistName, snapshots = [] }) {
  const orderedSnapshots = [...snapshots].sort(
    (a, b) => new Date(b.weekStartDate) - new Date(a.weekStartDate)
  );
  const weeks = orderedSnapshots.map(s => formatWeekLabel(s.weekStartDate));

  return {
    artistName,
    weeks,
    sections: [
      buildSection('Spotify', metricsConfig.spotify, orderedSnapshots),
      buildSection('Socials', metricsConfig.socials, orderedSnapshots),
    ],
  };
}

module.exports = { buildWeeklyArtistReport };
