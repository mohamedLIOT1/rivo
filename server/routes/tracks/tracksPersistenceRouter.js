const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { Track } = require('../../models');
const { optionalAuth } = require('../../middleware/auth');
const { escapeRegex, searchYouTubeId, fetchTrackCover } = require('../../utils/helpers');
const { invalidateTracksCache } = require('./tracksCache');
const { classifyGenre, isQuranContent } = require('../../utils/genreClassifier');
const { resolveAndSaveYouTubeTrack } = require('../../utils/likedTracksSync');

// Batch lookup tracks by IDs
router.post('/by-ids', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.json({ success: true, tracks: [] });
    const validObjectIds = ids.filter(id => id && mongoose.isValidObjectId(id)).map(id => new mongoose.Types.ObjectId(id));
    const stringIds = ids.map(String).filter(Boolean);
    const orConditions = [];
    if (validObjectIds.length > 0) orConditions.push({ _id: { $in: validObjectIds } });
    if (stringIds.length > 0) {
      orConditions.push({ id: { $in: stringIds } });
      const rawYtIds = stringIds.map(s => s.replace(/^yt[-_]/i, '')).filter(s => s.length >= 10);
      if (rawYtIds.length > 0) {
        orConditions.push({ youtubeId: { $in: rawYtIds } });
        orConditions.push({ id: { $in: rawYtIds } });
      }
    }
    const tracks = orConditions.length > 0 ? await Track.find({
      $or: orConditions,
      source: { $ne: 'SoundCloud' },
      album: { $ne: 'SoundCloud' },
      audioUrl: { $not: /soundcloud.com|sndcdn.com/i }
    }).lean() : [];

    // Attempt to resolve any missing YouTube tracks on the fly
    const foundIds = new Set(tracks.map(t => String(t._id)));
    tracks.forEach(t => {
      if (t.id) foundIds.add(String(t.id));
      if (t.youtubeId) {
        foundIds.add(String(t.youtubeId));
        foundIds.add(`yt-${t.youtubeId}`);
        foundIds.add(`yt_${t.youtubeId}`);
      }
    });

    const missingIds = stringIds.filter(id => !foundIds.has(id));
    for (const mId of missingIds) {
      if (mId.startsWith('yt-') || mId.startsWith('yt_') || (mId.length === 11 && !mongoose.isValidObjectId(mId))) {
        try {
          const resolved = await resolveAndSaveYouTubeTrack(mId);
          if (resolved) tracks.push(resolved);
        } catch {}
      }
    }

    setImmediate(async () => {
      try {
        for (const t of tracks) {
          if (t.title && (!t.cover || t.cover.includes('unsplash') || t.cover.includes('pixabay') || t.cover.includes('format=svg'))) {
            try {
              const real = await fetchTrackCover(t.title, t.artist);
              if (real) await Track.updateOne({ _id: t._id }, { $set: { cover: real } });
            } catch {}
          }
        }
      } catch {}
    });

    const formatted = tracks.map((t) => {
      const cls = classifyGenre({
        title: t.title,
        artist: t.artist,
        album: t.album,
        genre: t.genre,
        tags: t.tags,
        description: t.description
      });
      return {
        id: String(t._id),
        _id: String(t._id),
        title: t.title,
        artist: t.artist,
        album: t.album,
        cover: t.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
        audioUrl: t.audioUrl && !t.audioUrl.includes('pixabay.com') && !t.audioUrl.includes('preview') ? t.audioUrl : '',
        duration: t.duration || 180,
        genre: cls.genre,
        source: t.source || 'YouTube',
        isQuran: Boolean(t.isQuran || cls.isQuran),
        lyrics: t.lyrics || [],
        isVerified: Boolean(t.isVerified || t.lyricsVerified || t.isVerifiedLyrics),
        lyricsVerified: Boolean(t.isVerified || t.lyricsVerified || t.isVerifiedLyrics),
        isVerifiedLyrics: Boolean(t.isVerified || t.lyricsVerified || t.isVerifiedLyrics),
        verifiedBy: t.verifiedBy || t.lyricsVerifiedBy || null,
        lyricsVerifiedBy: t.verifiedBy || t.lyricsVerifiedBy || null
      };
    });

    res.json({ success: true, tracks: formatted });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Auto-persist fully listened external song into database
const autoPersistTrackHandler = async (req, res) => {
  try {
    const { id, trackId, title, artist, album, cover, coverUrl, audioUrl, streamUrl, duration, youtubeId, source, genre, tags, description } = req.body || {};
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const cleanTitle = title.trim();
    const cleanArtist = (artist || 'Unknown Artist').trim();
    const cleanAlbum = (album && album !== 'YouTube' && album !== 'SoundCloud' && album !== 'Direct Stream') ? album.trim() : 'Single';
    const targetUrl = audioUrl || streamUrl || (youtubeId ? ('https://www.youtube.com/watch?v=' + youtubeId) : '');
    const targetCover = cover || coverUrl || (youtubeId ? ('https://i.ytimg.com/vi/' + youtubeId + '/hqdefault.jpg') : '');

    const targetId = id || trackId;
    let existing = null;
    if (targetId && mongoose.isValidObjectId(targetId)) {
      existing = await Track.findById(targetId);
    }
    if (!existing) {
      existing = await Track.findOne({
        title: new RegExp('^' + escapeRegex(cleanTitle) + '$', 'i'),
        ...(cleanArtist && cleanArtist !== 'Unknown Artist' ? { artist: new RegExp('^' + escapeRegex(cleanArtist) + '$', 'i') } : {})
      });
    }
    if (!existing && targetUrl && (targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be'))) {
      const vidMatch = targetUrl.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
      if (vidMatch) {
        existing = await Track.findOne({ audioUrl: new RegExp(vidMatch[1], 'i') });
      }
    }

    if (existing) {
      return res.json({ success: true, track: existing, alreadyExisted: true });
    }

    // Resolve audioUrl fallback to satisfy Mongoose validation
    let finalAudioUrl = targetUrl;
    if (!finalAudioUrl) {
      try {
        const foundYtId = await searchYouTubeId(cleanTitle, cleanArtist);
        if (foundYtId) {
          finalAudioUrl = 'https://www.youtube.com/watch?v=' + foundYtId;
        }
      } catch {}
    }
    if (!finalAudioUrl) {
      finalAudioUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(cleanTitle + ' ' + cleanArtist);
    }

    // Resolve cover fallback
    let finalCover = targetCover;
    if (!finalCover) {
      try {
        finalCover = await fetchTrackCover(cleanTitle, cleanArtist);
      } catch {}
    }
    if (!finalCover) {
      finalCover = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600';
    }

    // Create new track entry with intelligent genre classification
    const classification = classifyGenre({
      title: cleanTitle,
      artist: cleanArtist,
      album: cleanAlbum,
      genre,
      tags,
      description
    });
    const finalGenre = classification.genre;
    const finalIsQuran = Boolean(classification.isQuran || isQuranContent(cleanTitle, cleanArtist, cleanAlbum, finalGenre));

    const newTrack = await Track.create({
      title: cleanTitle,
      artist: cleanArtist,
      album: cleanAlbum,
      cover: finalCover,
      audioUrl: finalAudioUrl,
      duration: Math.round(Number(duration)) || 210,
      genre: finalGenre,
      isQuran: finalIsQuran,
      source: source || 'Rivo',
      addedBy: 'auto-listened'
    });

    invalidateTracksCache();

    // Broadcast track:created to all live clients
    if (req.io) {
      req.io.emit('track:created', newTrack);
    }

    return res.status(201).json({ success: true, track: newTrack, created: true });
  } catch (err) {
    console.error('[autoPersistTrackHandler error]', err.message);
    return res.status(500).json({ error: err.message });
  }
};

router.post('/auto-persist', optionalAuth, autoPersistTrackHandler);
router.post('/persist-listened', optionalAuth, autoPersistTrackHandler);

module.exports = router;
