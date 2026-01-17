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
  const { artistName, weeks, weekDates, rows: reportRows } = report;
  
  // Use full dates if available, otherwise fall back to short week labels
  const dateColumns = weekDates && weekDates.length > 0 
    ? weekDates.slice(1) 
    : weeks.slice(1);

  // Artist title
  rows.push(row([artistName]));
  rows.push(row([]));

  // Header row (UNLIMITED HISTORY)
  // Note: For tracks, additional columns are added after growth columns
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
      'TikTok Videos', // Track-specific: number of TikTok videos
      'Spotify Playlists', // Track-specific: total Spotify playlists
      'Spotify Editorial', // Track-specific: Spotify editorial playlists
      'Apple Music Playlists', // Track-specific: Apple Music playlists
      'Apple Music Editorial', // Track-specific: Apple Music editorial playlists
      'Playlist Reach', // Track-specific: Spotify playlist total reach
      'Shazam Counts', // Track-specific: Shazam counts
      'YouTube Views', // Track-specific: YouTube views
      'Recent Playlist Adds', // Track-specific: recent playlist additions with dates
      ...dateColumns.map(d => d || ''), // ✅ ALL historical weeks with dates
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

    // For tracks, include additional metric columns
    // For other metrics, these columns are empty
    const isTrack = r.currentListeners !== undefined || r.currentSaves !== undefined;
    
    // Format recent playlist additions with dates (last 5, most recent first)
    let recentPlaylists = '';
    if (isTrack && r.playlistsAdded && Array.isArray(r.playlistsAdded) && r.playlistsAdded.length > 0) {
      const sorted = [...r.playlistsAdded]
        .filter(p => p.addedAt) // Only include playlists with dates
        .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
        .slice(0, 5); // Last 5 additions
      
      recentPlaylists = sorted
        .map(p => {
          const date = p.addedAt ? new Date(p.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
          const name = p.playlistName || 'Unknown';
          const followers = p.followers ? `(${p.followers.toLocaleString()})` : '';
          return `${name} ${followers} ${date}`.trim();
        })
        .join('; ');
    }
    
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
        isTrack ? (r.tiktokVideos ?? '') : '', // TikTok Videos (tracks only)
        isTrack ? (r.spotifyPlaylists ?? '') : '', // Spotify Playlists (tracks only)
        isTrack ? (r.spotifyEditorialPlaylists ?? '') : '', // Spotify Editorial (tracks only)
        isTrack ? (r.appleMusicPlaylists ?? '') : '', // Apple Music Playlists (tracks only)
        isTrack ? (r.appleMusicEditorialPlaylists ?? '') : '', // Apple Music Editorial (tracks only)
        isTrack ? (r.spotifyPlaylistReach ? r.spotifyPlaylistReach.toLocaleString() : '') : '', // Playlist Reach (tracks only)
        isTrack ? (r.shazamCounts ?? '') : '', // Shazam Counts (tracks only)
        isTrack ? (r.youtubeViews ?? '') : '', // YouTube Views (tracks only)
        isTrack ? recentPlaylists : '', // Recent Playlist Adds with dates (tracks only)
        ...(r.history || []), // ✅ FULL HISTORY
      ])
    );
  }

  return rows.join('\n');
}

module.exports = { renderWeeklyArtistCsv };
