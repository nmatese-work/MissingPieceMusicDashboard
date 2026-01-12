// scripts/testChartmetricAuth.js

require('dotenv').config();
const client = require('../src/config/chartmetric.client');

/**
 * Choose the best artist match from Chartmetric search results
 * Priority:
 * 1) Exact name match (case-insensitive)
 * 2) Highest Spotify followers
 * 3) Verified (tiebreaker only)
 */
function chooseBestArtist(artists, targetName) {
  const normalizedTarget = targetName.toLowerCase();

  return artists
    .map(a => ({
      ...a,
      nameScore: a.name?.toLowerCase() === normalizedTarget ? 1 : 0,
      followersScore: a.sp_followers ?? 0,
      verifiedScore: a.verified ? 1 : 0,
    }))
    .sort((a, b) => {
      // 1️⃣ exact name match
      if (b.nameScore !== a.nameScore) return b.nameScore - a.nameScore;
      // 2️⃣ spotify followers
      if (b.followersScore !== a.followersScore) {
        return b.followersScore - a.followersScore;
      }
      // 3️⃣ verified (tiebreaker)
      return b.verifiedScore - a.verifiedScore;
    })[0];
}

(async () => {
  try {
    const artistName = 'Brian Dunne';

    const res = await client.get('/search', {
      params: {
        q: artistName,
        type: 'all',
        limit: 10,
      },
    });

    // Chartmetric response shape (confirmed)
    const raw = res.data;
    console.log('RAW KEYS:', Object.keys(raw));

    const artists = raw?.obj?.artists || [];
    console.log('Artists found:', artists.length);

    if (!artists.length) {
      console.error('No artist results found');
      console.dir(raw, { depth: 3 });
      process.exit(1);
    }

    const artist = chooseBestArtist(artists, artistName);

    console.log('Chartmetric auth + search OK');
    console.log('Selected artist:');
    console.log({
      id: artist.id,
      name: artist.name,
      verified: artist.verified,
      spotifyFollowers: artist.sp_followers,
      spotifyMonthlyListeners: artist.sp_monthly_listeners,
      chartmetricScore: artist.cm_artist_score,
    });

    process.exit(0);
  } catch (err) {
    console.error('Chartmetric auth FAILED');
    console.error(err.response?.data || err.message);
    process.exit(1);
  }
})();
