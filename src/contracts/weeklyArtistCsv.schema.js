// src/contracts/weeklyArtistCsv.schema.js

/**
 * Defines the EXACT layout and ordering of the Weekly Artist Tracking CSV.
 * This file is the single source of truth for CSV structure.
 *
 * - Order matters
 * - Labels must match exactly
 * - Renderer must NOT infer anything
 */

module.exports = {
    header: {
      includeArtistNameRow: true,
      includeBlankRowAfterTitle: true,
      includeWeekHeaderRow: true,
    },
  
    growthColumns: {
      include7d: true,
      include28d: true,
      percentPrecision: 2,
    },
  
    sections: [
      {
        title: 'Spotify',
        rows: [
          {
            label: 'Spotify followers',
            field: 'spotifyFollowers',
            source: 'weeklySnapshot',
            format: 'integer',
          },
          {
            label: 'Spotify monthly listeners',
            field: 'spotifyMonthlyListeners',
            source: 'weeklySnapshot',
            format: 'integer',
          },
        ],
      },
  
      {
        title: 'Tracks',
        optional: true, // omit entire section if no tracks
        rows: [
          {
            labelFrom: 'track.title', // dynamic per track
            field: 'listenerHistory',
            source: 'track',
            format: 'integer',
          },
        ],
      },
  
      {
        title: 'Socials',
        rows: [
          {
            label: 'Instagram Followers',
            field: 'instagramFollowers',
            source: 'weeklySnapshot',
            format: 'integer',
          },
          {
            label: 'TikTok Followers',
            field: 'tiktokFollowers',
            source: 'weeklySnapshot',
            format: 'integer',
          },
          {
            label: 'YouTube Subscribers',
            field: 'youtubeSubscribers',
            source: 'weeklySnapshot',
            format: 'integer',
          },
        ],
      },
    ],
  };
  