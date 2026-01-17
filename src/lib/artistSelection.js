// src/lib/artistSelection.js
const readline = require('readline');

/**
 * Create readline interface for user input
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt user to select an artist from search results
 * Returns the selected artist object or null if cancelled
 */
async function promptUserForArtistSelection(artists, searchName) {
  if (!artists || artists.length === 0) {
    return null;
  }

  // If only one result, return it automatically
  if (artists.length === 1) {
    console.log(`✓ Found exact match: ${artists[0].name} (ID: ${artists[0].id})`);
    return artists[0];
  }

  // Multiple results - show options
  console.log(`\nFound ${artists.length} artists matching "${searchName}":\n`);
  
  artists.forEach((artist, index) => {
    const verified = artist.verified ? '✓ Verified' : '';
    const followers = artist.sp_followers 
      ? `Spotify: ${artist.sp_followers.toLocaleString()} followers` 
      : '';
    const listeners = artist.sp_monthly_listeners
      ? `${artist.sp_monthly_listeners.toLocaleString()} monthly listeners`
      : '';
    
    console.log(`${index + 1}. ${artist.name} (ID: ${artist.id})`);
    if (verified) console.log(`   ${verified}`);
    if (followers) console.log(`   ${followers}`);
    if (listeners) console.log(`   ${listeners}`);
    console.log('');
  });

  const rl = createReadlineInterface();

  return new Promise((resolve) => {
    rl.question('Select artist number (or press Enter to use first result): ', (answer) => {
      rl.close();

      if (!answer || answer.trim() === '') {
        // Default to first result
        console.log(`✓ Using first result: ${artists[0].name}`);
        resolve(artists[0]);
        return;
      }

      const selection = parseInt(answer.trim(), 10);
      
      if (isNaN(selection) || selection < 1 || selection > artists.length) {
        console.log(`⚠ Invalid selection. Using first result: ${artists[0].name}`);
        resolve(artists[0]);
        return;
      }

      const selected = artists[selection - 1];
      console.log(`✓ Selected: ${selected.name} (ID: ${selected.id})`);
      resolve(selected);
    });
  });
}

module.exports = {
  promptUserForArtistSelection,
  createReadlineInterface,
};
