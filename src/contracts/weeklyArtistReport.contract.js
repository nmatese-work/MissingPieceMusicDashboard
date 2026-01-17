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
      twitterFollowers: 'number|null',
      facebookFollowers: 'number|null',
      instagramFollowers: 'number|null',
      tiktokFollowers: 'number|null',
      tiktokLikes: 'number|null',
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
  
      // Additional track metrics
      tiktokVideos: 'number|null',
      spotifyPlaylists: 'number|null',
      spotifyEditorialPlaylists: 'number|null',
      appleMusicPlaylists: 'number|null',
      appleMusicEditorialPlaylists: 'number|null',
      spotifyPlaylistReach: 'number|null',
      shazamCounts: 'number|null',
      youtubeViews: 'number|null',
  
      playlistsAdded: [
        {
          playlistName: 'string',
          platform: 'spotify|applemusic',
          followers: 'number|null',
          addedAt: 'YYYY-MM-DD',
          curator: 'string|null',
        }
      ]
    }
  };
  