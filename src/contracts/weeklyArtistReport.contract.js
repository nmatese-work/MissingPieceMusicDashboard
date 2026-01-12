// src/contracts/weeklyArtistReport.contract.js

/**
 * This file defines the ONLY data required to generate the Weekly Artist CSV.
 * Any ingestion source (Chartmetric, Spotify, manual) must conform to this.
 */

module.exports = {
    artist: {
      name: 'string',
    },
  
    weeklySnapshot: {
      weekStartDate: 'YYYY-MM-DD',
  
      // Spotify
      spotifyFollowers: 'number|null',
      spotifyMonthlyListeners: 'number|null',
  
      // Socials
      instagramFollowers: 'number|null',
      tiktokFollowers: 'number|null',
      youtubeSubscribers: 'number|null',
  
      // Optional / future
      spotifyStreamsTotal: 'number|null',
      spotifyStreamsWeekly: 'number|null',
      spotifySavesTotal: 'number|null',
      spotifySaveRate: 'number|null',
    },
  
    track: {
      title: 'string',
      spotifyTrackId: 'string',
      chartmetricTrackId: 'string',
  
      currentListeners: 'number|null',
      currentSaves: 'number|null',
      saveRate: 'number|null',
  
      listenerHistory: 'number[]',
  
      playlistsAdded: [
        {
          playlistName: 'string',
          platform: 'spotify',
          followers: 'number|null',
          addedAt: 'YYYY-MM-DD',
        }
      ]
    }
  };
  