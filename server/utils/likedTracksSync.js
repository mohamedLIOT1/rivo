const mongoose = require('mongoose');
const axios = require('axios');
const { Track, User } = require('../models');
const { classifyGenre } = require('./genreClassifier');
const { isQuranContent } = require('./helpers');

/**
 * Resolves an external YouTube track by video ID using YouTube's oEmbed endpoint
 * and saves it into the Track collection so it's permanently stored.
 */
async function resolveAndSaveYouTubeTrack(rawId) {
  try {
    const videoId = String(rawId).replace(/^yt[-_]/i, '').trim();
    if (!videoId || videoId.length < 10) return null;

    // Check if it already exists under any variant
    const existing = await Track.findOne({
      $or: [
        { id: rawId },
        { id: videoId },
        { youtubeId: videoId },
        { audioUrl: new RegExp(videoId, 'i') }
      ]
    }).lean();

    if (existing) {
      return {
        id: String(existing._id),
        _id: String(existing._id),
        title: existing.title,
        artist: existing.artist,
        album: existing.album || 'Single',
        cover: existing.cover,
        audioUrl: existing.audioUrl,
        duration: existing.duration || 180,
        genre: existing.genre || 'Other',
        source: 'YouTube',
        isQuran: Boolean(existing.isQuran),
        liked: true
      };
    }

    // Resolve metadata via YouTube oEmbed
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const resp = await axios.get(oembedUrl, { timeout: 4000 });
    const data = resp.data;
    if (!data || !data.title) return null;

    const title = data.title;
    const artist = data.author_name || 'YouTube Audio';
    const cover = data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const audioUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const cls = classifyGenre({ title, artist, genre: '' });
    const isQ = Boolean(cls.isQuran || isQuranContent(title, artist));

    const newTrack = await Track.create({
      id: rawId,
      youtubeId: videoId,
      title,
      artist,
      album: isQ ? 'Quran' : 'Single',
      cover,
      audioUrl,
      duration: 180,
      genre: cls.genre || (isQ ? 'Quran' : 'Other'),
      source: 'YouTube',
      isQuran: isQ,
      plays: 1
    });

    return {
      id: String(newTrack._id),
      _id: String(newTrack._id),
      title: newTrack.title,
      artist: newTrack.artist,
      album: newTrack.album,
      cover: newTrack.cover,
      audioUrl: newTrack.audioUrl,
      duration: newTrack.duration,
      genre: newTrack.genre,
      source: newTrack.source,
      isQuran: newTrack.isQuran,
      liked: true
    };
  } catch (e) {
    return null;
  }
}

/**
 * Synchronizes user's likedTrackIds against the database:
 * 1. Prunes dead ObjectIds that were permanently deleted from DB
 * 2. Resolves valid YouTube IDs that are not yet in Track collection
 * 3. Returns sanitized likedTrackIds and any newly resolved tracks
 */
async function syncUserLikedTracks(user, allTracks = []) {
  if (!user || !Array.isArray(user.likedTrackIds) || user.likedTrackIds.length === 0) {
    return { validLikedIds: [], extraTracks: [] };
  }

  const existingTrackIdSet = new Set(allTracks.map(t => String(t._id)));
  allTracks.forEach(t => {
    if (t.id) existingTrackIdSet.add(String(t.id));
    if (t.youtubeId) {
      existingTrackIdSet.add(String(t.youtubeId));
      existingTrackIdSet.add(`yt-${t.youtubeId}`);
      existingTrackIdSet.add(`yt_${t.youtubeId}`);
    }
  });

  const validLikedIds = [];
  const deadLikedIds = [];
  const extraTracks = [];

  for (const rawId of user.likedTrackIds) {
    const cleanId = String(rawId);
    const isYt = cleanId.startsWith('yt-') || cleanId.startsWith('yt_') || (cleanId.length === 11 && !mongoose.isValidObjectId(cleanId));

    if (existingTrackIdSet.has(cleanId)) {
      validLikedIds.push(cleanId);
    } else if (isYt) {
      // Attempt to resolve or locate YouTube track
      const resolved = await resolveAndSaveYouTubeTrack(cleanId);
      if (resolved) {
        validLikedIds.push(cleanId);
        extraTracks.push(resolved);
        existingTrackIdSet.add(cleanId);
        existingTrackIdSet.add(String(resolved._id));
      } else {
        // Keep in user list if YouTube link might be temporary or resolvable client-side
        validLikedIds.push(cleanId);
      }
    } else if (mongoose.isValidObjectId(cleanId)) {
      // Check if it exists in DB beyond the limit
      const existsInDb = await Track.exists({ _id: cleanId });
      if (existsInDb) {
        validLikedIds.push(cleanId);
      } else {
        deadLikedIds.push(cleanId);
      }
    } else {
      deadLikedIds.push(cleanId);
    }
  }

  // Prune dead deleted IDs from MongoDB User document asynchronously
  if (deadLikedIds.length > 0) {
    User.updateOne({ _id: user._id }, { $set: { likedTrackIds: validLikedIds } }).catch(() => {});
  }

  return { validLikedIds, extraTracks };
}

module.exports = {
  syncUserLikedTracks,
  resolveAndSaveYouTubeTrack
};
