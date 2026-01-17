const db = require('../../models');
const cmService = require('../chartmetric/chartmetric.service');
const dayjs = require('dayjs');
const { assertChartmetricEnabled } =
  require('../../config/chartmetric.guard');

/**
 * Upsert a weekly snapshot row (idempotent)
 */
async function upsertWeeklySnapshot(row) {
  try {
    await db.WeeklyArtistSnapshot.upsert(row);
    return true;
  } catch (err) {
    console.error('upsertWeeklySnapshot failed:', err?.message || err);
    throw err;
  }
}

/**
 * Ingest a single artist by name
 *
 * IMPORTANT:
 * - Search failure must NOT abort ingestion
 * - Existing DB artist MUST be reused
 * 
 * @param {Object} options
 * @param {string} options.name - Artist name
 * @param {number} options.weeks - Number of weeks of historical data to fetch (default: 1)
 */
async function ingestArtistByName({ name, weeks = 1 }) {
  assertChartmetricEnabled();
  if (!name) throw new Error('Artist name required');

  let cmArtist = null;
  let artist = null;

  // 1️⃣ Try Chartmetric search (non-fatal)
  // Check if we should use interactive selection (set via env var or default to false for batch)
  const useInteractiveSelection = process.env.INTERACTIVE_ARTIST_SELECTION === 'true';
  
  try {
    if (useInteractiveSelection) {
      // Search for multiple results and let user choose
      const results = await cmService.searchArtistsByName(name, 10);
      if (results && results.length > 0) {
        const { promptUserForArtistSelection } = require('../../lib/artistSelection');
        cmArtist = await promptUserForArtistSelection(results, name);
      }
    } else {
      // Auto-select first result (backward compatible)
      cmArtist = await cmService.findArtistByName(name);
      if (cmArtist) {
        console.log(`Found Chartmetric artist: ${cmArtist.name} (${cmArtist.id})`);
      }
    }
  } catch (err) {
    console.warn(`Chartmetric search error for "${name}":`, err.message);
  }

  // 2️⃣ Fallback: existing Artist by name
  if (!cmArtist) {
    console.warn(`Chartmetric search failed for "${name}", falling back to DB`);

    artist = await db.Artist.findOne({ where: { name } });

    if (!artist || !artist.chartmetricArtistId) {
      throw new Error(`No Chartmetric artist found for "${name}"`);
    }

    cmArtist = {
      id: artist.chartmetricArtistId,
      name: artist.name,
    };
  }

  // 3️⃣ Find or create Artist
  if (!artist) {
    [artist] = await db.Artist.findOrCreate({
      where: { chartmetricArtistId: String(cmArtist.id) },
      defaults: {
        name: cmArtist.name,
        chartmetricArtistId: String(cmArtist.id),
        spotifyArtistId: cmArtist.spotify_id ?? null,
        spotifyFollowers: cmArtist.sp_followers ?? null,
        spotifyMonthlyListeners: cmArtist.sp_monthly_listeners ?? null,
        meta: cmArtist ?? null,
      },
    });
  }

  // 4️⃣ Pull socials safely (non-fatal)
  // Using correct field parameters based on Chartmetric API docs
  // Add delays between calls to avoid rate limiting
  const { sleep } = require('../../lib/chartmetricThrottle');
  
  const instagramFollowers =
    await cmService.fetchLatestSocialStat(cmArtist.id, 'instagram', 'followers');
  await sleep(10000);
  
  const tiktokFollowers =
    await cmService.fetchLatestSocialStat(cmArtist.id, 'tiktok', 'followers');
  await sleep(10000);
  
  const tiktokLikes =
    await cmService.fetchTikTokLikes(cmArtist.id); // Uses field=likes internally
  await sleep(10000);
  
  const twitterFollowers =
    await cmService.fetchLatestSocialStat(cmArtist.id, 'twitter', 'followers');
  await sleep(10000);
  
  const facebookFollowers =
    await cmService.fetchLatestSocialStat(cmArtist.id, 'facebook', 'likes'); // Facebook uses 'likes', not 'followers'
  await sleep(10000);
  
  const youtubeSubscribers =
    await cmService.fetchLatestSocialStat(cmArtist.id, 'youtube_channel', 'subscribers');

  // 4b️⃣ Pull Apple Music stats (if available)
  // Note: Based on Chartmetric API docs, Apple Music metrics are NOT available
  // at the artist level via /artist/:id/stat/:source endpoint.
  // Apple Music data is only available at track level (num_am_playlists in track cm_statistics)
  // For now, we'll leave these as null - they can be aggregated from track data if needed
  const appleMusicFollowers = null;
  const appleMusicListeners = null;

  // 5️⃣ Update artist row (best-effort)
  try {
    await artist.update({
      spotifyFollowers:
        cmArtist.sp_followers ?? artist.spotifyFollowers,
      spotifyMonthlyListeners:
        cmArtist.sp_monthly_listeners ?? artist.spotifyMonthlyListeners,
    });
  } catch (_) {}

  // 6️⃣ Calculate week start dates for historical data
  const weekDates = [];
  for (let i = 0; i < weeks; i++) {
    const weekDate = dayjs().startOf('week').subtract(i, 'week');
    weekDates.push(weekDate.format('YYYY-MM-DD'));
  }

  // 7️⃣ Fetch historical data for each week
  console.log(`Fetching historical data for ${weeks} weeks (${weekDates[weekDates.length - 1]} to ${weekDates[0]})...`);
  
  // Fetch historical data for each platform
  // Note: Chartmetric API uses ISO date format (YYYY-MM-DD)
  const since = weekDates[weekDates.length - 1]; // Oldest week
  const until = weekDates[0]; // Most recent week

  const { retryWithBackoff, sleep } = require('../../lib/chartmetricThrottle');

  // Fetch historical stats for each platform with retry logic and delays
  // Each call is wrapped in retryWithBackoff to handle 429 errors
  console.log('Fetching Spotify followers history...');
  const spotifyHistory = await retryWithBackoff(
    () => cmService.fetchArtistStatHistory(cmArtist.id, 'spotify', 'followers', since, until)
  ).catch(() => {
    console.warn('Failed to fetch Spotify followers history after retries');
    return [];
  });

  await sleep(10000); // Additional delay between platform fetches

  console.log('Fetching Spotify listeners history...');
  const spotifyListenersHistory = await retryWithBackoff(
    () => cmService.fetchArtistStatHistory(cmArtist.id, 'spotify', 'listeners', since, until)
  ).catch(() => {
    console.warn('Failed to fetch Spotify listeners history after retries');
    return [];
  });

  await sleep(10000);

  console.log('Fetching Instagram history...');
  const instagramHistory = await retryWithBackoff(
    () => cmService.fetchArtistStatHistory(cmArtist.id, 'instagram', 'followers', since, until)
  ).catch(() => {
    console.warn('Failed to fetch Instagram history after retries');
    return [];
  });

  await sleep(10000);

  console.log('Fetching TikTok followers history...');
  const tiktokHistory = await retryWithBackoff(
    () => cmService.fetchArtistStatHistory(cmArtist.id, 'tiktok', 'followers', since, until)
  ).catch(() => {
    console.warn('Failed to fetch TikTok followers history after retries');
    return [];
  });

  await sleep(10000);

  console.log('Fetching TikTok likes history...');
  const tiktokLikesHistory = await retryWithBackoff(
    () => cmService.fetchTikTokLikesHistory(cmArtist.id, since, until)
  ).catch(() => {
    console.warn('Failed to fetch TikTok likes history after retries');
    return [];
  });

  await sleep(10000);

  console.log('Fetching Twitter history...');
  const twitterHistory = await retryWithBackoff(
    () => cmService.fetchArtistStatHistory(cmArtist.id, 'twitter', 'followers', since, until)
  ).catch(() => {
    console.warn('Failed to fetch Twitter history after retries');
    return [];
  });

  await sleep(10000);

  console.log('Fetching Facebook history...');
  const facebookHistory = await retryWithBackoff(
    () => cmService.fetchArtistStatHistory(cmArtist.id, 'facebook', 'likes', since, until)
  ).catch(() => {
    console.warn('Failed to fetch Facebook history after retries');
    return [];
  });

  await sleep(10000);

  console.log('Fetching YouTube history...');
  const youtubeHistory = await retryWithBackoff(
    () => cmService.fetchArtistStatHistory(cmArtist.id, 'youtube_channel', 'subscribers', since, until)
  ).catch(() => {
    console.warn('Failed to fetch YouTube history after retries');
    return [];
  });

  // Helper function to find value for a specific week
  function findValueForWeek(historyArray, weekDate) {
    if (!Array.isArray(historyArray) || historyArray.length === 0) return null;
    
    // Find the closest date that's <= weekDate (within 7 days)
    const weekTimestamp = new Date(weekDate).getTime();
    const weekEndTimestamp = weekTimestamp + (7 * 24 * 60 * 60 * 1000); // Add 7 days
    let closest = null;
    let closestDiff = Infinity;
    
    for (const point of historyArray) {
      const pointDate = point.date || point.timestp || point.timestamp || point.dateISO || point.start;
      if (!pointDate) continue;
      
      let pointTimestamp;
      try {
        pointTimestamp = new Date(pointDate).getTime();
        if (isNaN(pointTimestamp)) continue;
      } catch (e) {
        continue;
      }
      
      // Find points within the week range (weekDate to weekDate + 7 days)
      if (pointTimestamp >= weekTimestamp && pointTimestamp <= weekEndTimestamp) {
        const diff = Math.abs(pointTimestamp - weekTimestamp);
        if (diff < closestDiff) {
          closestDiff = diff;
          closest = point;
        }
      }
    }
    
    // If no point found in the week, try to find the closest point before the week
    if (!closest) {
      for (const point of historyArray) {
        const pointDate = point.date || point.timestp || point.timestamp || point.dateISO || point.start;
        if (!pointDate) continue;
        
        let pointTimestamp;
        try {
          pointTimestamp = new Date(pointDate).getTime();
          if (isNaN(pointTimestamp)) continue;
        } catch (e) {
          continue;
        }
        
        const diff = weekTimestamp - pointTimestamp;
        if (diff >= 0 && diff < closestDiff) {
          closestDiff = diff;
          closest = point;
        }
      }
    }
    
    return closest?.value ?? null;
  }

  // 8️⃣ Create snapshots for each week
  for (const weekStart of weekDates) {
    const snapshot = {
      artistId: artist.id,
      weekStartDate: weekStart,
      
      // Use current values for most recent week, historical for others
      spotifyFollowers: weekStart === weekDates[0] 
        ? (cmArtist.sp_followers ?? null)
        : findValueForWeek(spotifyHistory, weekStart),
      
      spotifyMonthlyListeners: weekStart === weekDates[0]
        ? (cmArtist.sp_monthly_listeners ?? null)
        : findValueForWeek(spotifyListenersHistory, weekStart),
      
      instagramFollowers: weekStart === weekDates[0]
        ? instagramFollowers
        : findValueForWeek(instagramHistory, weekStart),
      
      tiktokFollowers: weekStart === weekDates[0]
        ? tiktokFollowers
        : findValueForWeek(tiktokHistory, weekStart),
      
      tiktokLikes: weekStart === weekDates[0]
        ? tiktokLikes
        : findValueForWeek(tiktokLikesHistory, weekStart),
      
      twitterFollowers: weekStart === weekDates[0]
        ? twitterFollowers
        : findValueForWeek(twitterHistory, weekStart),
      
      facebookFollowers: weekStart === weekDates[0]
        ? facebookFollowers
        : findValueForWeek(facebookHistory, weekStart),
      
      youtubeSubscribers: weekStart === weekDates[0]
        ? youtubeSubscribers
        : findValueForWeek(youtubeHistory, weekStart),
      
      appleMusicFollowers,
      appleMusicListeners,
    };

    await upsertWeeklySnapshot(snapshot);
  }

  console.log(`✅ Upserted ${weekDates.length} weekly snapshots (${weekDates[0]} to ${weekDates[weekDates.length - 1]})`);

  return {
    artistId: artist.id,
    chartmetricArtistId: cmArtist.id,
  };
}

module.exports = {
  ingestArtistByName,
  upsertWeeklySnapshot,
};
