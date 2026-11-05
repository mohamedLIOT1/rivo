const mongoose = require('mongoose');
const { User, Track } = require('../../models');
const { classifyGenre } = require('../../utils/genreClassifier');
const {
  scrapePlaylistOrAlbum,
  isQuranContent,
  detectQuranReciter,
  searchYouTubeId,
  fetchTrackCover
} = require('../../utils/helpers');

/**
 * Imports a playlist from a remote URL (YouTube, Spotify, etc.)
 */
async function importPlaylistFromUrl({ url, isQuran, userId }) {
  if (!url) {
    return { status: 400, data: { error: 'Playlist URL is required' } };
  }

  let scraped;
  try {
    scraped = await scrapePlaylistOrAlbum(url);
  } catch (err) {
    return { status: 400, data: { error: err.message || 'Failed to scrape playlist link' } };
  }

  if (!scraped || !scraped.items || scraped.items.length === 0) {
    return { status: 400, data: { error: 'Could not extract tracks from playlist. Please verify the link is public.' } };
  }

  const playlistTitle = scraped.title || 'Imported Playlist';
  const playlistCover = scraped.cover;
  const isAlbum = scraped.isAlbum;
  const rawItems = scraped.items;

  const finalIsQuran = Boolean(isQuran || isQuranContent(playlistTitle, '', '', ''));
  const detectedPlaylistReciter = finalIsQuran ? detectQuranReciter(playlistTitle, scraped.artist, '', '') : null;
  const trackIds = [];
  const createdTracks = [];
  const tracksToInsert = [];

  for (const item of rawItems) {
    try {
      const duration = item.duration || 180;
      const ytId = item.videoId || (item.audioUrl ? null : await searchYouTubeId(`${item.artist} - ${item.title}`));
      let trackCover = item.cover || (item.videoId ? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` : null);
      if (!trackCover && !item.videoId) trackCover = await fetchTrackCover(item.title, item.artist);
      if (!trackCover && ytId) trackCover = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
      if (!trackCover) trackCover = playlistCover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600';

      const audioUrl = item.audioUrl || (ytId ? `https://www.youtube.com/watch?v=${ytId}` : '');
      const itemIsQuran = Boolean(finalIsQuran || isQuranContent(item.title, item.artist, playlistTitle, ''));
      const finalAlbumName = isAlbum ? playlistTitle : (item.album || '');

      let trackArtist = item.artist;
      if (itemIsQuran) {
        const itemReciter = detectQuranReciter(item.title, item.artist, finalAlbumName) || detectedPlaylistReciter;
        if (itemReciter) {
          trackArtist = itemReciter;
        }
      }

      tracksToInsert.push({
        title: item.title,
        artist: trackArtist,
        album: finalAlbumName,
        cover: trackCover,
        audioUrl,
        duration,
        genre: itemIsQuran ? 'Holy Quran' : classifyGenre({ title: item.title, artist: trackArtist, album: finalAlbumName }).genre,
        source: item.videoId ? 'YouTube' : 'Spotify',
        addedBy: userId,
        isQuran: itemIsQuran
      });
    } catch (itemErr) {
      console.warn('Playlist item import error:', itemErr.message);
    }
  }

  if (mongoose.connection.readyState === 1 && tracksToInsert.length > 0) {
    try {
      const inserted = await Track.insertMany(tracksToInsert, { ordered: false });
      for (const t of inserted) {
        const tid = String(t._id);
        trackIds.push(tid);
        createdTracks.push({
          id: tid,
          _id: tid,
          title: t.title,
          artist: t.artist,
          album: t.album,
          cover: t.cover,
          audioUrl: t.audioUrl,
          duration: t.duration,
          genre: t.genre,
          source: t.source,
          isQuran: t.isQuran
        });
      }
    } catch (insertErr) {
      if (insertErr.insertedDocs && insertErr.insertedDocs.length > 0) {
        for (const t of insertErr.insertedDocs) {
          const tid = String(t._id);
          trackIds.push(tid);
          createdTracks.push({
            id: tid,
            _id: tid,
            title: t.title,
            artist: t.artist,
            album: t.album,
            cover: t.cover,
            audioUrl: t.audioUrl,
            duration: t.duration,
            genre: t.genre,
            source: t.source,
            isQuran: t.isQuran
          });
        }
      }
    }
  }

  if (createdTracks.length === 0) {
    for (const t of tracksToInsert) {
      const tid = `track-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      trackIds.push(tid);
      createdTracks.push({ id: tid, _id: tid, ...t });
    }
  }

  const playlistId = `pl-${Date.now()}`;
  const user = await User.findById(userId);
  if (!user) return { status: 404, data: { error: 'User not found' } };

  const newPlaylist = {
    id: playlistId,
    name: playlistTitle,
    cover: playlistCover || createdTracks[0]?.cover || '',
    trackIds,
    isLikedSongs: false,
    isPublic: true,
    isQuran: finalIsQuran
  };

  user.playlists.push(newPlaylist);
  await user.save();

  return {
    status: 200,
    data: {
      success: true,
      playlist: {
        ...newPlaylist,
        tracks: createdTracks
      }
    }
  };
}

module.exports = {
  importPlaylistFromUrl
};
