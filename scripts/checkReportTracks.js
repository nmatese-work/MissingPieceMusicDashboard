require('dotenv').config();

(async () => {
  try {
    const db = require('../src/models');
    const { buildWeeklyArtistReport } = require('../src/reports/buildWeeklyArtistReport');

    await db.sequelize.authenticate();

    const artist = await db.Artist.findOne({ where: { name: 'Brian Dunne' } });
    if (!artist) {
      console.error('Artist not found');
      process.exit(1);
    }

    const snaps = await db.WeeklyArtistSnapshot.findAll({
      where: { artistId: artist.id },
      order: [['weekStartDate', 'DESC']],
      limit: 12,
      raw: true,
    });

    const tracks = await db.Track.findAll({
      where: { artistId: artist.id },
      raw: true,
    });

    const reportTracks = [];
    for (const t of tracks) {
      const ts = await db.TrackWeeklySnapshot.findAll({
        where: { trackId: t.id },
        order: [['weekStartDate', 'DESC']],
        limit: 12,
        raw: true,
      });

      reportTracks.push({
        title: t.title,
        currentListeners: ts[0]?.spotifyListeners ?? null,
        growth7d:
          ts[0] && ts[1]
            ? (ts[0].spotifyListeners ?? 0) - (ts[1].spotifyListeners ?? 0)
            : null,
        growth7dPct: null,
        growth28d: null,
        growth28dPct: null,
        currentSaves: ts[0]?.spotifySaves ?? null,
        saveRate: ts[0]?.spotifySaveRate ?? null,
        listenerHistory: ts.map(s => s.spotifyListeners ?? null),
      });
    }

    const report = buildWeeklyArtistReport({
      artistName: artist.name,
      snapshots: snaps,
      tracks: reportTracks,
    });

    const spotify = report.sections.find(s => s.title === 'Spotify');

    console.log('spotify tracks count:', spotify?.tracks?.length || 0);
    console.log('sample track:');
    console.dir(spotify?.tracks?.[0] ?? null, { depth: 3 });

    process.exit(0);
  } catch (err) {
    console.error(err.stack || err);
    process.exit(1);
  }
})();
