const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const rateLimit = require('express-rate-limit');
const { Track, Album, User, SongLyrics } = require('../models');
const { auth, adminAuth, optionalAuth, isAdminUser } = require('../middleware/auth');
const { upload, uploadsDir, verifyUploadedAudioMagicBytes } = require('../middleware/upload');
const { validateSafeUrl, safeResolveUpload } = require('../utils/security');
const {
  escapeRegex,
  isQuranContent,
  searchYouTubeId,
  fetchTrackCover,
  syncTrackToAlbum,
  autoAddTrackToUserLinksPlaylist,
  resolveOfficialYouTubeAudioStream,
  getTrackKey,
  fetchLrclibLyrics,
  getCookiesPath,
  getYtDlpBin,
  invalidateAudioCache
} = require('../utils/helpers');

// Rate limiter for track creation to prevent DoS / spam
const trackCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many tracks created from this IP, please try again after 15 minutes.' }
});

// High-speed in-memory cache for public tracks
let cachedPublicTracksJson = null;
let cachedPublicTracksTime = 0;
const TRACKS_CACHE_TTL = 45 * 1000;

function invalidateTracksCache() {
  cachedPublicTracksJson = null;
  cachedPublicTracksTime = 0;
}

// Get all tracks with optional album / artist filters
router.get('/', async (req, res) => {
  try {
    const isDefaultRequest = !req.query.album && !req.query.artist;
    if (isDefaultRequest && cachedPublicTracksJson && (Date.now() - cachedPublicTracksTime < TRACKS_CACHE_TTL)) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.send(cachedPublicTracksJson);
    }

    const filter = {
      source: { $ne: 'SoundCloud' },
      album: { $ne: 'SoundCloud' }
    };
    if (req.query.album) {
      const rawAlbName = req.query.album.trim().replace(/^album-/i, '');
      const escaped = rawAlbName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flexiblePattern = escaped.replace(/[-_\s]+/g, '[-_\\s]*');

      const foundAlbum = await Album.findOne({
        $or: [
          { name: new RegExp(`^${flexiblePattern}$`, 'i') },
          { id: rawAlbName }
        ]
      }).lean();

      if (foundAlbum && Array.isArray(foundAlbum.trackIds) && foundAlbum.trackIds.length > 0) {
        const validIds = foundAlbum.trackIds.filter(id => mongoose.isValidObjectId(id));
        filter.$or = [
          { album: new RegExp(`^${flexiblePattern}$`, 'i') },
          { _id: { $in: validIds } },
          { id: { $in: foundAlbum.trackIds } }
        ];
      } else {
        filter.album = new RegExp(`^${flexiblePattern}$`, 'i');
      }
    }
    if (req.query.artist) {
      filter.artist = new RegExp(`^${req.query.artist.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }
    const raw = await Track.find(filter, { lyrics: 0 }).sort({ createdAt: -1 }).limit(4000).lean();
    const tracks = raw
      .filter(t => !t.audioUrl || (!t.audioUrl.includes('soundcloud.com') && !t.audioUrl.includes('sndcdn.com')))
      .map(t => ({
        ...t,
        id: String(t._id),
        isQuran: Boolean(t.isQuran || isQuranContent(t.title, t.artist, t.album, t.genre))
      }));

    if (isDefaultRequest) {
      cachedPublicTracksJson = JSON.stringify({ success: true, tracks });
      cachedPublicTracksTime = Date.now();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.send(cachedPublicTracksJson);
    }

    res.json({ success: true, tracks });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Batch lookup tracks by IDs
router.post('/by-ids', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.json({ success: true, tracks: [] });
    const tracks = await Track.find({
      _id: { $in: ids },
      source: { $ne: 'SoundCloud' },
      album: { $ne: 'SoundCloud' },
      audioUrl: { $not: /soundcloud\.com|sndcdn\.com/i }
    }).lean();

    setImmediate(async () => {
      for (const t of tracks) {
        if (t.title && (!t.cover || t.cover.includes('unsplash') || t.cover.includes('pixabay') || t.cover.includes('format=svg'))) {
          try {
            const real = await fetchTrackCover(t.title, t.artist);
            if (real) await Track.updateOne({ _id: t._id }, { $set: { cover: real } });
          } catch {}
        }
      }
    });

    const formatted = tracks.map((t) => ({
      id: String(t._id),
      _id: String(t._id),
      title: t.title,
      artist: t.artist,
      album: t.album,
      cover: t.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
      audioUrl: t.audioUrl && !t.audioUrl.includes('pixabay.com') && !t.audioUrl.includes('preview') ? t.audioUrl : '',
      duration: t.duration || 180,
      genre: t.genre,
      source: t.source || 'YouTube',
      isQuran: Boolean(t.isQuran),
      lyrics: t.lyrics || [],
      isVerified: Boolean(t.isVerified || t.lyricsVerified || t.isVerifiedLyrics),
      lyricsVerified: Boolean(t.isVerified || t.lyricsVerified || t.isVerifiedLyrics),
      isVerifiedLyrics: Boolean(t.isVerified || t.lyricsVerified || t.isVerifiedLyrics),
      verifiedBy: t.verifiedBy || t.lyricsVerifiedBy || null,
      lyricsVerifiedBy: t.verifiedBy || t.lyricsVerifiedBy || null
    }));

    res.json({ success: true, tracks: formatted });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Import track from Spotify/YouTube link
const importTrackHandler = async (req, res) => {
  invalidateTracksCache();
  try {
    const rawUrl = (req.body.url || '').trim();
    if (!rawUrl) return res.status(400).json({ error: 'Song link / URL is required' });

    let title = '';
    let artist = '';
    let album = 'Single';
    let cover = '';
    let audioUrl = '';
    let duration = 200;
    let source = 'Imported';

    if (rawUrl.includes('spotify.com/track') || rawUrl.includes('spotify:track:')) {
      const match = rawUrl.match(/track\/([a-zA-Z0-9]+)/) || rawUrl.match(/spotify:track:([a-zA-Z0-9]+)/);
      const trackId = match ? match[1] : null;
      if (!trackId) return res.status(400).json({ error: 'Invalid Spotify track link' });

      source = 'Spotify';
      try {
        const embedRes = await axios.get(`https://open.spotify.com/embed/track/${trackId}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          timeout: 8000
        });
        const html = embedRes.data;
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
        if (nextDataMatch) {
          const parsed = JSON.parse(nextDataMatch[1]);
          const entity = parsed?.props?.pageProps?.state?.data?.entity;
          if (entity) {
            title = entity.name || entity.title || '';
            if (Array.isArray(entity.artists) && entity.artists.length > 0) {
              artist = entity.artists.map(a => a.name).filter(Boolean).join(', ');
            } else {
              artist = entity.subtitle || '';
            }
            if (entity.duration) duration = Math.round(entity.duration / 1000);
            const imgs = entity.visualIdentity?.image || [];
            if (imgs.length > 0) {
              cover = imgs[imgs.length - 1]?.url || imgs[0]?.url;
            }
          }
        }
      } catch (err) {}

      if (!title) {
        try {
          const oRes = await axios.get(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`, { timeout: 5000 });
          title = oRes.data?.title || '';
          artist = oRes.data?.author_name || 'Spotify Artist';
          if (!cover && oRes.data?.thumbnail_url) cover = oRes.data.thumbnail_url;
        } catch {}
      }

      if (!title) {
        return res.status(400).json({ error: 'Could not extract metadata from Spotify track link' });
      }

      if (!cover || cover.includes('unsplash')) {
        const metaCover = await fetchTrackCover(title, artist);
        if (metaCover) cover = metaCover;
      }

      const ytId = await searchYouTubeId({ artist, title, targetDuration: duration });
      if (ytId) {
        audioUrl = `https://www.youtube.com/watch?v=${ytId}`;
        if (!cover) cover = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
      }
    } else if (rawUrl.includes('youtube.com') || rawUrl.includes('youtu.be')) {
      source = 'YouTube';
      let videoId = null;
      const vMatch = rawUrl.match(/(?:v=|\/v\/|embed\/|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (vMatch) videoId = vMatch[1];
      if (!videoId) return res.status(400).json({ error: 'Invalid YouTube link or video ID not found' });

      audioUrl = `https://www.youtube.com/watch?v=${videoId}`;
      cover = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      try {
        const ytOembed = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, { timeout: 5000 });
        const rawTitle = ytOembed.data?.title || '';
        const author = ytOembed.data?.author_name || '';

        const cleanedTitle = rawTitle
          .replace(/\s*[\(\[]\s*(official\s*(music\s*)?video|official\s*audio|lyric\s*video|audio|lyrics|4k|hd|visualizer|remastered|hq)\s*[\)\]]/gi, '')
          .replace(/\s*-\s*official\s*(music\s*)?video/gi, '')
          .trim();

        if (cleanedTitle.includes(' - ')) {
          const parts = cleanedTitle.split(' - ');
          artist = parts[0].trim();
          title = parts.slice(1).join(' - ').trim();
        } else {
          title = cleanedTitle || rawTitle;
          artist = author.replace(/ - Topic$/i, '').trim() || 'YouTube Artist';
        }
      } catch (err) {}

      if (title && artist) {
        const metaCover = await fetchTrackCover(title, artist);
        if (metaCover) cover = metaCover;
      }
      if (!title) {
        title = `YouTube Track (${videoId})`;
        artist = 'YouTube';
      }
    } else if (rawUrl.includes('soundcloud.com')) {
      return res.status(400).json({ error: 'SoundCloud is not supported. Please use a YouTube or Spotify link.' });
    } else if (rawUrl.includes('music.apple.com')) {
      source = 'Apple Music';
      try {
        const appleRes = await axios.get(rawUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          timeout: 7000
        });
        const html = appleRes.data;
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) {
          const raw = titleMatch[1].replace(' on Apple Music', '').replace(' - Apple Music', '').trim();
          const parts = raw.split(' by ');
          if (parts.length >= 2) {
            title = parts[0].trim();
            artist = parts.slice(1).join(' by ').trim();
          } else {
            title = raw;
            artist = 'Apple Music';
          }
        }
        const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/);
        if (ogImage) cover = ogImage[1];
      } catch (err) {}

      if (title && artist) {
        const ytId = await searchYouTubeId({ artist, title, targetDuration: duration });
        if (ytId) {
          audioUrl = `https://www.youtube.com/watch?v=${ytId}`;
          if (!cover) cover = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
        }
      }
    } else if (/\.(mp3|m4a|wav|aac|ogg|flac)(\?.*)?$/i.test(rawUrl) || rawUrl.includes('stream') || rawUrl.includes('audio')) {
      source = 'Direct Audio';
      audioUrl = rawUrl;
      const cleanPath = rawUrl.split('?')[0];
      const filename = cleanPath.substring(cleanPath.lastIndexOf('/') + 1);
      const nameWithoutExt = decodeURIComponent(filename).replace(/\.[^/.]+$/, '');
      if (nameWithoutExt.includes(' - ')) {
        const parts = nameWithoutExt.split(' - ');
        artist = parts[0].trim();
        title = parts.slice(1).join(' - ').trim();
      } else {
        title = nameWithoutExt || 'Imported Audio';
        artist = 'Direct Stream';
      }
      cover = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600';
    } else {
      source = 'Online';
      const ytId = await searchYouTubeId(rawUrl);
      if (ytId) {
        audioUrl = `https://www.youtube.com/watch?v=${ytId}`;
        cover = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
        title = rawUrl;
        artist = 'Online Track';
      } else {
        return res.status(400).json({ error: 'Unsupported link or could not resolve audio stream. Please provide a Spotify, YouTube, Apple Music, or direct audio link.' });
      }
    }

    if (!audioUrl && !title) {
      return res.status(400).json({ error: 'Failed to resolve audio for the provided link.' });
    }

    if (!cover) cover = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600';
    if (!title) title = 'Imported Track';
    if (!artist) artist = 'Various Artists';

    if (mongoose.connection.readyState === 1) {
      try {
        const cleanT = title.trim();
        const cleanA = artist.trim();
        const existingTrack = await Track.findOne({
          $or: [
            ...(audioUrl ? [{ audioUrl }] : []),
            ...(cleanT && cleanA && cleanT !== 'Imported Track' ? [{
              title: { $regex: new RegExp(`^${escapeRegex(cleanT)}$`, 'i') },
              artist: { $regex: new RegExp(`^${escapeRegex(cleanA)}$`, 'i') }
            }] : [])
          ]
        });

        if (existingTrack) {
          const existingObj = existingTrack.toObject();
          existingObj.id = String(existingTrack._id);
          existingObj._id = String(existingTrack._id);
          if (req.user?.id) {
            await autoAddTrackToUserLinksPlaylist(req.user.id, existingTrack._id, existingTrack.cover);
          }
          return res.json({ success: true, track: existingObj, isDuplicate: true });
        }
      } catch (checkErr) {
        console.warn('Duplicate track check error:', checkErr.message);
      }
    }

    let trackId = `track-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    if (mongoose.connection.readyState === 1) {
      try {
        const newTrack = await new Track({
          title,
          artist,
          album,
          cover,
          audioUrl,
          duration,
          genre: 'Imported',
          source,
          addedBy: req.user?.id || 'guest',
        }).save();
        if (newTrack?._id) trackId = String(newTrack._id);
      } catch (dbErr) {
        console.warn('Track DB save error:', dbErr.message);
      }
    }

    const trackObj = {
      id: trackId,
      _id: trackId,
      title,
      artist,
      album,
      cover,
      audioUrl,
      duration,
      genre: 'Imported',
      source,
      addedBy: req.user?.id || 'guest',
      lyrics: [],
      liked: false
    };

    syncTrackToAlbum(trackObj).catch(() => {});

    if (req.user?.id) {
      await autoAddTrackToUserLinksPlaylist(req.user.id, trackId, cover);
    }

    const io = req.app?.get('io') || req.io;
    if (io) io.emit('track:created', trackObj);

    res.json({ success: true, track: trackObj });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Server error while importing track' });
  }
};
router.post('/import', optionalAuth, importTrackHandler);
router.post('/import-link', optionalAuth, importTrackHandler);

// Upload local track (audio file + cover)
router.post('/upload', auth, trackCreateLimiter, upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), verifyUploadedAudioMagicBytes, async (req, res) => {
  try {
    const { title, artist, album, genre, lyrics, duration } = req.body;
    if (!title || !artist) return res.status(400).json({ error: 'Title and artist are required' });

    let audioUrl = '';
    if (req.files?.audio?.[0]) {
      audioUrl = `/uploads/${req.files.audio[0].filename}`;
    }

    let coverUrl = '';
    if (req.files?.cover?.[0]) {
      coverUrl = `/uploads/${req.files.cover[0].filename}`;
    } else {
      coverUrl = await fetchTrackCover(title, artist) || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600';
    }

    let parsedLyrics = [];
    if (lyrics) {
      try { parsedLyrics = typeof lyrics === 'string' ? JSON.parse(lyrics) : lyrics; } catch {}
    }

    const parsedDuration = Number(duration) > 0 ? Math.round(Number(duration)) : 210;

    const cleanT = (title || '').trim();
    const cleanA = (artist || '').trim();
    const existingTrack = await Track.findOne({
      title: { $regex: new RegExp(`^${escapeRegex(cleanT)}$`, 'i') },
      artist: { $regex: new RegExp(`^${escapeRegex(cleanA)}$`, 'i') }
    });
    if (existingTrack) {
      if (req.user?.id) {
        await autoAddTrackToUserLinksPlaylist(req.user.id, existingTrack._id, existingTrack.cover);
      }
      return res.json({ success: true, track: existingTrack, isDuplicate: true });
    }

    const newTrack = await new Track({
      title: title.trim().slice(0, 200),
      artist: artist.trim().slice(0, 150),
      album: (album || '').trim().slice(0, 150) || 'Single',
      cover: coverUrl,
      audioUrl,
      duration: parsedDuration,
      genre: (genre || 'Pop').trim().slice(0, 60),
      source: 'Upload',
      addedBy: req.user ? req.user.id : 'user',
      lyrics: parsedLyrics,
      isQuran: Boolean(isQuranContent(title, artist, album, genre))
    }).save();

    await syncTrackToAlbum(newTrack);

    if (req.user?.id) {
      await autoAddTrackToUserLinksPlaylist(req.user.id, newTrack._id, newTrack.cover);
    }

    const io = req.app?.get('io') || req.io;
    if (io) io.emit('track:created', newTrack);

    res.json({ success: true, track: newTrack });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create track manually with strict schema validation against mass assignment
const createTrackHandler = async (req, res) => {
  invalidateTracksCache();
  try {
    const { title, artist, album, cover, audioUrl, duration, genre, lyrics } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Valid track title is required' });
    }
    if (!artist || typeof artist !== 'string' || !artist.trim()) {
      return res.status(400).json({ error: 'Valid track artist is required' });
    }
    if (!audioUrl || typeof audioUrl !== 'string' || !audioUrl.trim()) {
      return res.status(400).json({ error: 'Valid audio URL is required' });
    }

    const cleanTitle = title.trim().slice(0, 200);
    const cleanArtist = artist.trim().slice(0, 150);
    const cleanAlbum = (album && typeof album === 'string') ? album.trim().slice(0, 150) : 'Single';
    const cleanCover = (cover && typeof cover === 'string') ? cover.trim() : (await fetchTrackCover(cleanTitle, cleanArtist) || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600');
    const cleanGenre = (genre && typeof genre === 'string') ? genre.trim().slice(0, 60) : 'Pop';
    const cleanDuration = Number(duration) > 0 ? Math.round(Number(duration)) : 210;

    let parsedLyrics = [];
    if (lyrics) {
      try { parsedLyrics = typeof lyrics === 'string' ? JSON.parse(lyrics) : (Array.isArray(lyrics) ? lyrics : []); } catch {}
    }

    const existingTrack = await Track.findOne({
      $or: [
        { audioUrl: audioUrl.trim() },
        {
          title: { $regex: new RegExp(`^${escapeRegex(cleanTitle)}$`, 'i') },
          artist: { $regex: new RegExp(`^${escapeRegex(cleanArtist)}$`, 'i') }
        }
      ]
    });
    if (existingTrack) {
      if (req.user?.id) {
        await autoAddTrackToUserLinksPlaylist(req.user.id, existingTrack._id, existingTrack.cover);
      }
      return res.json({ success: true, track: existingTrack, isDuplicate: true });
    }

    const newTrack = await new Track({
      title: cleanTitle,
      artist: cleanArtist,
      album: cleanAlbum,
      cover: cleanCover,
      audioUrl: audioUrl.trim(),
      duration: cleanDuration,
      genre: cleanGenre,
      source: 'Manual',
      addedBy: req.user ? req.user.id : 'user',
      lyrics: parsedLyrics,
      isQuran: Boolean(isQuranContent(cleanTitle, cleanArtist, cleanAlbum, cleanGenre))
    }).save();

    await syncTrackToAlbum(newTrack);

    if (req.user?.id) {
      await autoAddTrackToUserLinksPlaylist(req.user.id, newTrack._id, newTrack.cover);
    }

    const io = req.app?.get('io') || req.io;
    if (io) io.emit('track:created', newTrack);

    res.json({ success: true, track: newTrack });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
router.post('/', auth, trackCreateLimiter, createTrackHandler);
router.post('/create', auth, trackCreateLimiter, createTrackHandler);
router.post('/add', auth, trackCreateLimiter, createTrackHandler);

// Delete track (Admin Only)
const deleteTrackHandler = async (req, res) => {
  invalidateTracksCache();
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Permission denied. Only administrators can delete songs from the website.' });
    }

    const trackId = String(req.params.id || req.body.trackId || '');
    if (!trackId) return res.status(400).json({ error: 'Track ID required' });

    try {
      const existing = await Track.findById(trackId);
      if (existing?.audioUrl) invalidateAudioCache(existing.audioUrl);
      await Track.deleteOne({ _id: trackId });
    } catch {}
    try {
      await Album.updateMany({}, { $pull: { trackIds: trackId } });
    } catch {}

    const users = await User.find({
      $or: [
        { likedTrackIds: trackId },
        { 'playlists.trackIds': trackId }
      ]
    });

    for (const u of users) {
      let changed = false;
      if (u.likedTrackIds && u.likedTrackIds.includes(trackId)) {
        u.likedTrackIds = u.likedTrackIds.filter(id => String(id) !== trackId);
        changed = true;
      }
      if (u.playlists && u.playlists.length > 0) {
        for (const pl of u.playlists) {
          if (pl.trackIds && pl.trackIds.some(id => String(id) === trackId)) {
            pl.trackIds = pl.trackIds.filter(id => String(id) !== trackId);
            changed = true;
          }
        }
      }
      if (changed) {
        await u.save();
      }
    }

    const io = req.app.get('io') || req.io;
    if (io) io.emit('track:deleted', { id: trackId });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
router.delete('/:id', adminAuth, deleteTrackHandler);
router.post('/:id/delete', adminAuth, deleteTrackHandler);
router.post('/delete', adminAuth, deleteTrackHandler);

// Edit / Update track details (Admin Only)
const updateTrackHandler = async (req, res) => {
  invalidateTracksCache();
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Permission denied. Only administrators can edit songs.' });
    }
    const trackId = String(req.params.id || req.body.id || req.body._id || '');
    if (!trackId) return res.status(400).json({ error: 'Track ID required' });

    const track = await Track.findOne({ $or: [{ _id: mongoose.isValidObjectId(trackId) ? trackId : null }, { id: trackId }] });
    if (!track) return res.status(404).json({ error: 'Track not found' });

    const oldAudioUrl = track.audioUrl;
    const { title, artist, album, cover, audioUrl, duration, genre, lyrics } = req.body;
    if (title) track.title = title.trim();
    if (artist) track.artist = artist.trim();
    if (album !== undefined) track.album = album.trim();
    if (cover) track.cover = cover.trim();
    if (audioUrl !== undefined) {
      const cleanAudioUrl = (audioUrl || '').trim();
      track.audioUrl = cleanAudioUrl;
      invalidateAudioCache(oldAudioUrl);
      if (cleanAudioUrl) invalidateAudioCache(cleanAudioUrl);
    }
    if (duration !== undefined) track.duration = Number(duration) || track.duration;
    if (genre !== undefined) track.genre = genre;
    if (Array.isArray(lyrics)) track.lyrics = lyrics;

    await track.save();

    if (Array.isArray(lyrics) && lyrics.length > 0) {
      const trackKey = getTrackKey(track.title, track.artist);
      if (trackKey && trackKey !== '___') {
        await SongLyrics.findOneAndUpdate(
          { trackKey },
          {
            $set: {
              trackKey,
              trackId: String(track._id),
              title: track.title,
              artist: track.artist,
              lyrics,
              updatedBy: req.user?.name || 'Admin',
              isVerified: true,
              verifiedBy: req.user?.name || 'Admin',
              verifiedAt: new Date()
            }
          },
          { upsert: true, new: true }
        ).catch(() => {});
      }
    }

    await syncTrackToAlbum(track);

    const formatted = {
      ...track.toObject(),
      id: String(track._id)
    };

    const io = req.app.get('io') || req.io;
    if (io) io.emit('track:updated', formatted);
    res.json({ success: true, track: formatted });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
router.put('/:id', adminAuth, updateTrackHandler);
router.post('/:id/update', adminAuth, updateTrackHandler);
router.post('/update', adminAuth, updateTrackHandler);

// Like / Unlike track toggle
router.post('/:id/like', auth, async (req, res) => {
  try {
    const trackId = String(req.params.id);
    const u = await User.findById(req.user.id);
    if (!u) return res.status(404).json({ error: 'User not found' });

    u.likedTrackIds = u.likedTrackIds || [];
    const idx = u.likedTrackIds.indexOf(trackId);
    let liked = false;
    if (idx >= 0) {
      u.likedTrackIds.splice(idx, 1);
      liked = false;
    } else {
      u.likedTrackIds.push(trackId);
      liked = true;
    }

    const likedPl = (u.playlists || []).find(p => p.isLikedSongs || p.name === 'Liked Songs' || p.id === 'liked');
    if (likedPl) {
      likedPl.trackIds = [...u.likedTrackIds];
    } else {
      u.playlists = [
        { id: 'liked', name: 'Liked Songs', trackIds: [...u.likedTrackIds], isLikedSongs: true, isPublic: false },
        ...(u.playlists || [])
      ];
    }

    await u.save();
    res.json({ success: true, liked, likedTrackIds: u.likedTrackIds });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Audio Stream Handler
async function autoPersistExternalTrack({ id, trackId, title, artist, album, cover, audioUrl, duration }) {
  if (!title) return null;
  try {
    const targetId = id || trackId;
    let t = null;
    if (targetId && mongoose.isValidObjectId(targetId)) {
      t = await Track.findById(targetId);
    }
    if (!t) {
      const cleanT = (title || '').trim();
      const cleanA = (artist || '').trim();
      t = await Track.findOne({
        title: new RegExp(`^${escapeRegex(cleanT)}$`, 'i'),
        ...(cleanA ? { artist: new RegExp(`^${escapeRegex(cleanA)}$`, 'i') } : {})
      });
      if (!t) {
        const stripped = cleanT.replace(/[/\\?%*:|"<>_()\-]/g, ' ').replace(/\s+/g, ' ').trim();
        if (stripped.length > 2) {
          t = await Track.findOne({
            title: new RegExp(escapeRegex(stripped), 'i'),
            ...(cleanA ? { artist: new RegExp(escapeRegex(cleanA), 'i') } : {})
          });
        }
      }
    }
    if (!t) {
      t = await Track.create({
        title: title.trim(),
        artist: (artist || 'Unknown Artist').trim(),
        album: album || 'Single',
        cover: cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
        audioUrl: audioUrl || '',
        duration: duration || 210,
        source: 'Rivo',
        addedBy: 'auto-search'
      });
      // NOTE: Do not auto-push runtime stream searches into albums (prevents duplicate tracks)
    }
    return {
      id: String(t._id || t.id),
      _id: String(t._id || t.id),
      title: t.title,
      artist: t.artist,
      album: t.album,
      cover: t.cover,
      audioUrl: t.audioUrl,
      duration: t.duration || duration || 210,
      source: t.source || 'Rivo',
      isQuran: Boolean(t.isQuran),
      lyrics: t.lyrics || []
    };
  } catch (err) {
    console.warn('[autoPersistExternalTrack error]', err.message);
    return null;
  }
}

const handleTrackStream = async (req, res) => {
  try {
    const id = req.params?.id || req.query?.trackId || req.query?.id || '';
    let track = null;
    if (id && mongoose.isValidObjectId(id)) {
      track = await Track.findById(id).lean();
    }
    const rawUrl = req.query.url || track?.audioUrl || '';
    const title = req.query.title || track?.title || '';
    const artist = req.query.artist || track?.artist || '';

    // Direct local upload stream check
    if (rawUrl && (rawUrl.startsWith('/uploads/') || rawUrl.includes('/uploads/')) || track?.source === 'Upload' || (track?.audioUrl && (track.audioUrl.startsWith('/uploads/') || track.audioUrl.includes('/uploads/')))) {
      const uPath = (rawUrl && rawUrl.includes('/uploads/')) ? rawUrl : (track?.audioUrl || rawUrl);
      const cleanPath = uPath.startsWith('/') ? uPath : `/${uPath}`;
      return res.json({
        success: true,
        url: cleanPath,
        directUrl: cleanPath,
        duration: track?.duration || 210,
        cover: track?.cover || '',
        track: track ? {
          id: String(track._id),
          _id: String(track._id),
          title: track.title,
          artist: track.artist,
          album: track.album,
          cover: track.cover,
          audioUrl: track.audioUrl,
          duration: track.duration || 210,
          source: track.source || 'Upload',
          isQuran: Boolean(track.isQuran),
          lyrics: track.lyrics || []
        } : null
      });
    }

    if (rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) && !rawUrl.includes('youtube.com') && !rawUrl.includes('youtu.be') && !rawUrl.includes('soundcloud.com')) {
      return res.json({ success: true, url: rawUrl, directUrl: rawUrl, duration: track?.duration || 210, cover: track?.cover || '' });
    }

    // Check if title and artist match an authentic uploaded track in local DB (e.g. 3alsamet v2)
    if (title) {
      try {
        const localUploaded = await Track.findOne({
          title: new RegExp(`^${escapeRegex(title)}$`, 'i'),
          ...(artist ? { artist: new RegExp(`^${escapeRegex(artist)}$`, 'i') } : {}),
          $or: [
            { source: 'Upload' },
            { audioUrl: /^\/?uploads\//i }
          ]
        }).lean();
        if (localUploaded && localUploaded.audioUrl) {
          const cleanPath = localUploaded.audioUrl.startsWith('/') ? localUploaded.audioUrl : `/${localUploaded.audioUrl}`;
          return res.json({
            success: true,
            url: cleanPath,
            directUrl: cleanPath,
            duration: localUploaded.duration || 210,
            cover: localUploaded.cover || track?.cover || '',
            isYouTube: false,
            track: {
              id: String(localUploaded._id),
              _id: String(localUploaded._id),
              title: localUploaded.title,
              artist: localUploaded.artist,
              album: localUploaded.album,
              cover: localUploaded.cover,
              audioUrl: localUploaded.audioUrl,
              duration: localUploaded.duration || 210,
              source: localUploaded.source || 'Upload',
              isQuran: Boolean(localUploaded.isQuran),
              lyrics: localUploaded.lyrics || []
            }
          });
        }
      } catch {}
    }

    const duration = Number(req.query.duration || track?.duration) || null;
    const albumName = req.query.album || track?.album || '';
    const streamTarget = rawUrl || id || '';
    const streamUrl = await resolveOfficialYouTubeAudioStream(streamTarget, title, artist, { duration, album: albumName });
    if (streamUrl) {
      const resolvedPath = streamUrl.url || String(streamUrl);
      const isLocalUpload = resolvedPath.startsWith('/uploads/');
      const finalUrl = isLocalUpload ? resolvedPath : `/api/tracks/stream-proxy?url=${encodeURIComponent(resolvedPath)}`;

      const vidCandidate = streamUrl.videoId || (rawUrl.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i)?.[1]) || null;
      const targetCover = req.query.cover || (vidCandidate ? `https://i.ytimg.com/vi/${vidCandidate}/hqdefault.jpg` : track?.cover || '');
      const savedTrack = await autoPersistExternalTrack({
        id: track?._id || id,
        title,
        artist,
        album: req.query.album || track?.album || 'Single',
        cover: targetCover,
        audioUrl: rawUrl || (vidCandidate ? `https://www.youtube.com/watch?v=${vidCandidate}` : ''),
        duration: streamUrl.duration || duration || 210
      });

      return res.json({
        success: true,
        url: finalUrl,
        directUrl: resolvedPath,
        duration: streamUrl.duration || track?.duration || 210,
        cover: savedTrack?.cover || track?.cover || targetCover,
        track: savedTrack
      });
    }
    res.status(404).json({ success: false, error: 'Could not resolve audio stream' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};
router.get('/sync-dist', (req, res) => {
  try {
    const srcDir = path.join(__dirname, '../../dist');
    const destDir = '/home/ubuntu/dist';
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const copied = [];
    for (const f of fs.readdirSync(srcDir)) {
      const srcFile = path.join(srcDir, f);
      const destFile = path.join(destDir, f);
      if (fs.statSync(srcFile).isFile()) {
        fs.copyFileSync(srcFile, destFile);
        copied.push(f);
      }
    }
    const srcAssets = path.join(srcDir, 'assets');
    const destAssets = path.join(destDir, 'assets');
    if (fs.existsSync(srcAssets)) {
      if (!fs.existsSync(destAssets)) fs.mkdirSync(destAssets, { recursive: true });
      for (const af of fs.readdirSync(srcAssets)) {
        fs.copyFileSync(path.join(srcAssets, af), path.join(destAssets, af));
        copied.push('assets/' + af);
      }
    }
    res.json({ success: true, copied });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/stream', handleTrackStream);
router.get('/:id/stream', handleTrackStream);



router.get('/debug-stream', async (req, res) => {
  const videoId = req.query.videoId || '0hhXwSen-Vw';
  const bin = getYtDlpBin();
  const binExists = fs.existsSync(bin);
  const cp = getCookiesPath();
  const nodeBinDir = path.dirname(process.execPath);
  const execEnv = { ...process.env, PATH: `${nodeBinDir}:/usr/local/bin:/usr/bin:/bin:` + (process.env.PATH || '') };

  let runningNodeProcesses = '';
  try {
    const { execSync } = require('child_process');
    runningNodeProcesses = execSync('ps aux | grep node', { encoding: 'utf8' });
  } catch (e) { runningNodeProcesses = e.message; }

  // Synchronously overwrite /home/ubuntu/dist with fresh build from /home/ubuntu/rivo/dist
  try {
    const srcDist = path.join(__dirname, '../../dist');
    const targetDist = '/home/ubuntu/dist';
    if (fs.existsSync(srcDist) && fs.existsSync(targetDist)) {
      for (const file of fs.readdirSync(srcDist)) {
        const srcFile = path.join(srcDist, file);
        const targetFile = path.join(targetDist, file);
        if (fs.statSync(srcFile).isFile()) {
          fs.copyFileSync(srcFile, targetFile);
        }
      }
      const srcAssets = path.join(srcDist, 'assets');
      const targetAssets = path.join(targetDist, 'assets');
      if (fs.existsSync(srcAssets)) {
        if (!fs.existsSync(targetAssets)) fs.mkdirSync(targetAssets, { recursive: true });
        for (const af of fs.readdirSync(srcAssets)) {
          fs.copyFileSync(path.join(srcAssets, af), path.join(targetAssets, af));
        }
      }
    }
  } catch (e) {}

  let rootIndexHtml = '';
  let distIndexHtml = '';
  let ubuntuIndexHtml = '';
  try {
    rootIndexHtml = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
  } catch (e) { rootIndexHtml = e.message; }
  try {
    distIndexHtml = fs.readFileSync(path.join(__dirname, '../../dist/index.html'), 'utf8');
  } catch (e) { distIndexHtml = e.message; }
  try {
    ubuntuIndexHtml = fs.readFileSync('/home/ubuntu/dist/index.html', 'utf8');
  } catch (e) { ubuntuIndexHtml = e.message; }

  try {
    if (distIndexHtml && distIndexHtml.length > 1000) {
      fs.writeFileSync('/home/ubuntu/dist/index.html', distIndexHtml, 'utf8');
      ubuntuIndexHtml = fs.readFileSync('/home/ubuntu/dist/index.html', 'utf8');
    }
  } catch (e) {}

  const extractSplash = (html) => {
    const idx = html.indexOf('<div id="splash">');
    if (idx === -1) return 'NOT_FOUND';
    return html.substring(idx, idx + 250);
  };
  
  execFile(bin, ['--version'], { env: execEnv }, (verErr, verStdout) => {
    const args = ['--no-check-certificates', '--no-playlist', '--js-runtimes', 'node', '-g', '-f', 'ba/b'];
    if (cp) {
      args.splice(1, 0, '--cookies', cp);
    } else {
      args.splice(4, 0, '--extractor-args', 'youtube:player_client=android,ios,mweb');
    }
    args.push(`https://www.youtube.com/watch?v=${videoId}`);

    execFile(bin, args, { timeout: 15000, env: execEnv }, (err, stdout, stderr) => {
      res.json({
        bin,
        binExists,
        hasCookies: Boolean(cp),
        cookiesPath: cp,
        version: verStdout ? verStdout.trim() : (verErr?.message || null),
        execPath: process.execPath,
        splashInRootIndex: extractSplash(rootIndexHtml),
        splashInDistIndex: extractSplash(distIndexHtml),
        splashInUbuntuIndex: extractSplash(ubuntuIndexHtml),
        rivoIndexSnippet: (distIndexHtml || "").substring(0, 120),
        ubuntuIndexSnippet: (ubuntuIndexHtml || "").substring(0, 120),
        runningNodeProcesses,
        realUbuntuPath: path.resolve('/home/ubuntu/dist/index.html'),
        realRivoPath: path.resolve(path.join(__dirname, '../../dist/index.html')),
        ubuntuIndexLength: (ubuntuIndexHtml || "").length,
        rivoIndexLength: (distIndexHtml || "").length,
        error: err?.message || null,
        stderr: stderr || null,
        stdout: stdout ? stdout.trim().slice(0, 150) : null
      });
    });
  });
});

// Stream Proxy with Range header support and Path Traversal / SSRF Protection
router.get('/stream-proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('URL required');

  if (targetUrl.startsWith('/uploads/') || targetUrl.startsWith('uploads/')) {
    const resolvedPath = safeResolveUpload(targetUrl, uploadsDir);
    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      return res.status(403).send('Forbidden or non-existent file path');
    }
    return res.sendFile(resolvedPath);
  }

  // Remote URL: strictly prevent SSRF
  const { valid, error } = await validateSafeUrl(targetUrl);
  if (!valid) {
    return res.status(403).json({ error: error || 'SSRF verification failed' });
  }

  try {
    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
    if (req.headers.range && !targetUrl.includes('sndcdn.com') && !targetUrl.includes('soundcloud.')) {
      headers['Range'] = req.headers.range;
    }

    const response = await axios({
      method: 'get',
      url: targetUrl,
      responseType: 'stream',
      headers,
      timeout: 25000,
      maxRedirects: 5,
      beforeRedirect: (options) => {
        const nextUrl = options.href || (options.protocol + '//' + options.host + options.path);
        try {
          const u = new URL(nextUrl);
          const host = u.hostname.toLowerCase();
          if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
            throw new Error('Blocked SSRF redirect to internal host');
          }
        } catch (e) {
          throw new Error('Blocked SSRF redirect: ' + e.message);
        }
      },
      validateStatus: (status) => status < 400
    });

    res.status(response.status);
    const HOP_BY_HOP = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-authenticate', 'proxy-authorization'];
    for (const [key, value] of Object.entries(response.headers)) {
      if (!HOP_BY_HOP.includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    }
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    response.data.pipe(res);
  } catch (err) {
    res.status(500).send('Proxy streaming failed');
  }
});

// Download track with tags
router.get('/download', async (req, res) => {
  try {
    let { url, title, artist, id, trackId } = req.query;
    trackId = trackId || id;
    let dbTrack = null;
    if (trackId && mongoose.isValidObjectId(trackId)) {
      try { dbTrack = await Track.findById(trackId).lean(); } catch {}
    }
    if (!dbTrack && (title || artist)) {
      try {
        const query = {};
        if (title && artist) {
          query.title = new RegExp(`^${escapeRegex(title)}$`, 'i');
          query.artist = new RegExp(`^${escapeRegex(artist)}$`, 'i');
        } else if (title) {
          query.title = new RegExp(`^${escapeRegex(title)}$`, 'i');
        }
        dbTrack = await Track.findOne(query).lean();
      } catch {}
    }
    if (dbTrack) {
      url = url || dbTrack.audioUrl;
      title = title || dbTrack.title;
      artist = artist || dbTrack.artist;
    }

    const sanitizeTag = (str, fallback = 'Rivo') => {
      if (!str) return fallback;
      return String(str)
        .replace(/https?:\/\/\S+/gi, '')
        .replace(/www\.\S+/gi, '')
        .replace(/youtube\.com\S*/gi, '')
        .replace(/youtu\.be\S*/gi, '')
        .replace(/liofy\S*/gi, '')
        .replace(/[\[\(]?(?:official|lyrics|video|audio|hd|4k|remastered)[\]\)]?/gi, '')
        .replace(/[/\\?%*:|"<>]/g, '')
        .replace(/\s+/g, ' ')
        .trim() || fallback;
    };

    const cleanArtist = sanitizeTag(artist, 'Artist').split(/[|/]/)[0].trim();
    const cleanTitle = sanitizeTag(title, 'Track');
    const cleanFilename = `${cleanArtist} - ${cleanTitle}`;

    // Direct uploaded files with path traversal protection
    if (url && (url.startsWith('/uploads/') || url.includes('/uploads/'))) {
      const filePath = safeResolveUpload(url, uploadsDir);
      if (filePath && fs.existsSync(filePath)) {
        return res.download(filePath, `${cleanFilename}${path.extname(filePath)}`);
      }
    }

    if (url && (url.startsWith('http://') || url.startsWith('https://')) && !url.includes('youtube.com') && !url.includes('youtu.be')) {
      const safeUrl = await validateSafeUrl(url);
      if (!safeUrl || !safeUrl.valid) {
        return res.status(403).json({ error: safeUrl?.error || 'Access to this URL is blocked (SSRF Protection)' });
      }

      try {
        const directRes = await axios({
          method: 'get',
          url: safeUrl.parsed.href,
          responseType: 'stream',
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          timeout: 45000
        });
        const safeAscii = cleanFilename.replace(/[^\x20-\x7E]/g, '').trim() || 'track';
        res.set({
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': `attachment; filename="${safeAscii}.mp3"; filename*=UTF-8''${encodeURIComponent(cleanFilename)}.mp3`,
          'Access-Control-Allow-Origin': '*'
        });
        return directRes.data.pipe(res);
      } catch (e) {
        return res.status(502).json({ error: 'Failed to download remote audio stream' });
      }
    }

    let videoId = null;
    const candidates = [url, id, trackId, req.query.id, req.query.trackId];
    for (const cand of candidates) {
      if (!cand || typeof cand !== 'string') continue;
      const str = cand.trim();
      const m1 = str.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
      if (m1 && m1[1] && m1[1].length === 11) { videoId = m1[1]; break; }
      const m2 = str.match(/^yt[-_]?([a-zA-Z0-9_-]{11})$/i);
      if (m2 && m2[1] && m2[1].length === 11) { videoId = m2[1]; break; }
      if (/^[a-zA-Z0-9_-]{11}$/.test(str) && !mongoose.isValidObjectId(str)) { videoId = str; break; }
    }
    if (!videoId && (title || artist)) {
      try {
        videoId = await searchYouTubeId({ artist: cleanArtist, title: cleanTitle, targetDuration: duration });
      } catch {}
    }

    if (videoId) {
      const cachedM4a = path.join(__dirname, `../../uploads/audio-cache/${videoId}.m4a`);
      const cachedMp3 = path.join(__dirname, `../../uploads/audio-cache/${videoId}.mp3`);
      const localCachedFile = (fs.existsSync(cachedM4a) && fs.statSync(cachedM4a).size > 20000)
        ? cachedM4a
        : ((fs.existsSync(cachedMp3) && fs.statSync(cachedMp3).size > 20000) ? cachedMp3 : null);

      if (localCachedFile) {
        const ext = path.extname(localCachedFile);
        const safeAscii = cleanFilename.replace(/[^\x20-\x7E]/g, '').trim() || 'track';
        res.set({
          'Content-Type': ext === '.m4a' ? 'audio/mp4' : 'audio/mpeg',
          'Content-Disposition': `attachment; filename="${safeAscii}${ext}"; filename*=UTF-8''${encodeURIComponent(cleanFilename)}${ext}`
        });
        return fs.createReadStream(localCachedFile).pipe(res);
      }
    }

    res.status(404).json({ success: false, error: 'Could not prepare download stream' });
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ success: false, error: e.message });
  }
});

// Add or update track lyrics via REST (:id/lyrics)
router.post('/:id/lyrics', auth, async (req, res) => {
  try {
    const trackId = req.params.id;
    let { lyrics, title, artist, isVerified } = req.body;
    if (!lyrics) return res.status(400).json({ error: 'Lyrics are required' });

    let parsed = lyrics;
    if (typeof lyrics === 'string') {
      try { parsed = JSON.parse(lyrics); } catch {}
    }
    if (!Array.isArray(parsed)) {
      return res.status(400).json({ error: 'Lyrics must be an array' });
    }

    let trackObj = null;
    if (trackId && mongoose.isValidObjectId(trackId)) {
      trackObj = await Track.findById(trackId).lean();
    }
    const finalTitle = title || trackObj?.title || '';
    const finalArtist = artist || trackObj?.artist || '';
    const isVer = req.user?.isAdmin ? (isVerified !== undefined ? Boolean(isVerified) : true) : false;
    const userName = req.user?.name || (req.user?.isAdmin ? 'Admin' : 'Listener');
    const trackKey = getTrackKey(finalTitle, finalArtist);

    if (trackKey && trackKey !== '___') {
      await SongLyrics.findOneAndUpdate(
        { trackKey },
        {
          $set: {
            trackKey,
            trackId: String(trackId || ''),
            title: finalTitle,
            artist: finalArtist,
            lyrics: parsed,
            updatedBy: userName,
            isVerified: isVer,
            verifiedBy: isVer ? userName : '',
            verifiedAt: isVer ? new Date() : null,
            source: isVer ? 'verified' : 'community'
          }
        },
        { upsert: true, new: true }
      ).catch(() => {});
    }

    if (trackId && mongoose.isValidObjectId(trackId)) {
      await Track.updateOne(
        { _id: trackId },
        {
          $set: {
            lyrics: parsed,
            isVerified: isVer,
            isVerifiedLyrics: isVer,
            verifiedBy: isVer ? userName : '',
            verifiedAt: isVer ? new Date() : null
          }
        }
      ).catch(() => {});
    }

    const io = req.app.get('io') || req.io;
    if (io) {
      io.emit('lyrics:updated', {
        trackKey,
        trackId: String(trackId || ''),
        title: finalTitle,
        artist: finalArtist,
        lyrics: parsed,
        isVerified: isVer,
        verifiedBy: isVer ? userName : ''
      });
    }

    res.json({ success: true, lyrics: parsed, isVerified: isVer, message: 'Lyrics saved successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update track lyrics
router.post('/update-lyrics', auth, async (req, res) => {
  try {
    const { trackId, title, artist, lyrics, isVerified } = req.body;
    const isAdmin = Boolean(req.user?.isAdmin || isAdminUser(req.user));
    const isVer = isAdmin ? (isVerified !== undefined ? Boolean(isVerified) : true) : false;
    const trackKey = getTrackKey(title, artist);

    if (!isVer && isVerified === false) {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Permission denied: Administrator privileges required to unverify or remove verified lyrics.' });
      }
      if (trackKey && trackKey !== '___') {
        await SongLyrics.deleteOne({ trackKey }).catch(() => {});
      }
      if (trackId) {
        await SongLyrics.deleteOne({ trackId: String(trackId) }).catch(() => {});
        if (mongoose.isValidObjectId(trackId)) {
          await Track.updateOne({ _id: trackId }, { $set: { lyrics: [], isVerified: false, isVerifiedLyrics: false } }).catch(() => {});
        }
      }
      if (title && artist) {
        await Track.updateOne(
          { 
            title: { $regex: new RegExp(`^${escapeRegex(title)}$`, 'i') },
            artist: { $regex: new RegExp(`^${escapeRegex(artist)}$`, 'i') }
          },
          { $set: { lyrics: [], isVerified: false, isVerifiedLyrics: false } }
        ).catch(() => {});
      }
      const io = req.app.get('io') || req.io;
      if (io) {
        io.emit('lyrics:updated', {
          trackKey,
          trackId: String(trackId || ''),
          title,
          artist,
          lyrics: [],
          isVerified: false
        });
      }
      return res.json({ success: true, isVerified: false, message: 'Lyrics unverified; normal scraper will be used.' });
    }

    if (!lyrics || !Array.isArray(lyrics)) {
      return res.status(400).json({ error: 'Lyrics must be an array' });
    }

    const userName = req.user?.name || req.user?.username || (isAdmin ? 'Admin' : 'Listener');

    if (trackKey && trackKey !== '___') {
      await SongLyrics.findOneAndUpdate(
        { trackKey },
        {
          $set: {
            trackKey,
            trackId: String(trackId || ''),
            title: title || '',
            artist: artist || '',
            lyrics,
            updatedBy: userName,
            isVerified: isVer,
            verifiedBy: isVer ? userName : '',
            verifiedAt: isVer ? new Date() : null,
            source: isVer ? 'verified' : 'community'
          }
        },
        { upsert: true, new: true }
      );
    }

    if (trackId) {
      await SongLyrics.findOneAndUpdate(
        { trackId: String(trackId) },
        {
          $set: {
            lyrics,
            title: title || '',
            artist: artist || '',
            isVerified: isVer,
            verifiedBy: isVer ? userName : '',
            verifiedAt: isVer ? new Date() : null,
            source: isVer ? 'verified' : 'community'
          }
        },
        { upsert: true }
      ).catch(() => {});
    }

    const trackUpdate = {
      lyrics,
      isVerified: isVer,
      isVerifiedLyrics: isVer,
      verifiedBy: isVer ? userName : '',
      verifiedAt: isVer ? new Date() : null
    };

    if (trackId && mongoose.isValidObjectId(trackId)) {
      await Track.updateOne({ _id: trackId }, { $set: trackUpdate }).catch(() => {});
    }
    if (title && artist) {
      await Track.updateOne(
        { 
          title: { $regex: new RegExp(`^${escapeRegex(title)}$`, 'i') },
          artist: { $regex: new RegExp(`^${escapeRegex(artist)}$`, 'i') }
        },
        { $set: trackUpdate }
      ).catch(() => {});
    }

    const io = req.app.get('io') || req.io;
    if (io) {
      io.emit('lyrics:updated', {
        trackKey,
        trackId: String(trackId || ''),
        title,
        artist,
        lyrics,
        isVerified: isVer,
        verifiedBy: isVer ? userName : ''
      });
    }

    res.json({ success: true, trackKey, isVerified: isVer, message: 'Lyrics saved successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get lyrics for a track
router.get('/lyrics', async (req, res) => {
  try {
    const { trackId, title, artist } = req.query;
    const trackKey = getTrackKey(title, artist);

    let trk = null;
    if (trackId && mongoose.isValidObjectId(trackId)) {
      try { trk = await Track.findById(trackId).lean(); } catch {}
    }
    const isTrackVerified = Boolean(trk?.isVerified || trk?.lyricsVerified || trk?.isVerifiedLyrics);
    const verifiedBy = trk?.verifiedBy || trk?.lyricsVerifiedBy || '';

    if (trackKey && trackKey !== '___') {
      const found = await SongLyrics.findOne({ trackKey }).lean();
      if (found && Array.isArray(found.lyrics) && found.lyrics.length > 0) {
        return res.json({
          success: true,
          lyrics: found.lyrics,
          source: (found.isVerified || isTrackVerified) ? 'verified' : (found.source || 'manual'),
          isVerified: Boolean(found.isVerified || isTrackVerified),
          verifiedBy: found.verifiedBy || verifiedBy
        });
      }
    }

    if (trackId) {
      const found = await SongLyrics.findOne({ trackId: String(trackId) }).lean();
      if (found && Array.isArray(found.lyrics) && found.lyrics.length > 0) {
        return res.json({
          success: true,
          lyrics: found.lyrics,
          source: (found.isVerified || isTrackVerified) ? 'verified' : (found.source || 'manual'),
          isVerified: Boolean(found.isVerified || isTrackVerified),
          verifiedBy: found.verifiedBy || verifiedBy
        });
      }

      if (trk && Array.isArray(trk.lyrics) && trk.lyrics.length > 0) {
        return res.json({
          success: true,
          lyrics: trk.lyrics,
          source: isTrackVerified ? 'verified' : 'manual',
          isVerified: isTrackVerified,
          verifiedBy: verifiedBy
        });
      }
    }

    if (title) {
      const lyrics = await fetchLrclibLyrics(title, artist, 180);
      if (lyrics && lyrics.length > 0) {
        const shouldBeVerified = isTrackVerified;
        if (trackKey && trackKey !== '___') {
          SongLyrics.findOneAndUpdate(
            { trackKey },
            { 
              $set: {
                trackKey, 
                trackId: trackId ? String(trackId) : undefined, 
                title, 
                artist, 
                lyrics, 
                source: shouldBeVerified ? 'verified' : 'synced', 
                isVerified: shouldBeVerified,
                ...(shouldBeVerified && verifiedBy ? { verifiedBy } : {})
              } 
            },
            { upsert: true }
          ).catch(() => {});
        }
        return res.json({ 
          success: true, 
          lyrics, 
          source: shouldBeVerified ? 'verified' : 'synced', 
          isVerified: shouldBeVerified,
          verifiedBy: shouldBeVerified ? verifiedBy : ''
        });
      }
    }

    if (trk && isTrackVerified) {
      return res.json({ success: true, lyrics: trk.lyrics || [], isVerified: true, verifiedBy });
    }

    res.json({ success: false, lyrics: [], isVerified: false });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, lyrics: [], isVerified: false });
  }
});

// Clear lyrics (Admin Only)
router.post('/clear-lyrics', adminAuth, async (req, res) => {
  try {
    const { trackId, title, artist } = req.body;
    const trackKey = getTrackKey(title, artist);

    if (trackKey && trackKey !== '___') {
      await SongLyrics.deleteOne({ trackKey }).catch(() => {});
    }
    if (trackId) {
      await SongLyrics.deleteOne({ trackId: String(trackId) }).catch(() => {});
      if (mongoose.isValidObjectId(trackId)) {
        await Track.updateOne({ _id: trackId }, { $set: { lyrics: [] } }).catch(() => {});
      }
    }

    const io = req.app.get('io') || req.io;
    if (io) io.emit('lyrics:updated', { trackKey, trackId, lyrics: [], isVerified: false });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Resolve stream endpoint
const resolveStreamHandler = async (req, res) => {
  try {
    const { url, title, artist, id, trackId, duration } = req.query;

    if (url && typeof url === 'string' && (url.startsWith('/uploads/') || url.includes('/uploads/'))) {
      const cleanPath = url.startsWith('/') ? url : `/${url}`;
      return res.json({
        success: true,
        url: cleanPath,
        directUrl: cleanPath,
        duration: Number(duration) || 210,
        isYouTube: false
      });
    }

    const targetDbId = id || trackId || req.params?.id;
    if (targetDbId && mongoose.isValidObjectId(targetDbId)) {
      try {
        const dbTrack = await Track.findById(targetDbId).lean();
        if (dbTrack) {
          if (dbTrack.source === 'Upload' || (dbTrack.audioUrl && (dbTrack.audioUrl.startsWith('/uploads/') || dbTrack.audioUrl.includes('/uploads/')))) {
            const cleanPath = dbTrack.audioUrl ? (dbTrack.audioUrl.startsWith('/') ? dbTrack.audioUrl : `/${dbTrack.audioUrl}`) : '';
            return res.json({
              success: true,
              url: cleanPath,
              directUrl: cleanPath,
              duration: dbTrack.duration || 210,
              cover: dbTrack.cover,
              isYouTube: false
            });
          }
          if (dbTrack.audioUrl && (dbTrack.audioUrl.endsWith('.mp3') || dbTrack.audioUrl.endsWith('.m4a')) && !dbTrack.audioUrl.includes('youtube') && !dbTrack.audioUrl.includes('soundcloud')) {
            return res.json({
              success: true,
              url: dbTrack.audioUrl,
              duration: dbTrack.duration || 240,
              cover: dbTrack.cover,
              isYouTube: false
            });
          }
          const directAudio = await resolveOfficialYouTubeAudioStream(dbTrack.audioUrl, dbTrack.title, dbTrack.artist, { duration: dbTrack.duration || Number(duration) || null, album: dbTrack.album || req.query.album || '' });
          if (directAudio) {
            const resolvedPath = directAudio.url || String(directAudio);
            const isLocalUpload = resolvedPath.startsWith('/uploads/');
            const finalUrl = isLocalUpload ? resolvedPath : `/api/tracks/stream-proxy?url=${encodeURIComponent(resolvedPath)}`;
            return res.json({
              success: true,
              url: finalUrl,
              directUrl: resolvedPath,
              duration: (directAudio.duration && directAudio.duration > 0) ? directAudio.duration : (dbTrack.duration || 210),
              cover: dbTrack.cover,
              isYouTube: false
            });
          }
        }
      } catch {}
    }

    // Check if title and artist match ANY catalog track in DB
    if (title || artist) {
      try {
        const query = {};
        if (title && artist) {
          query.title = new RegExp(`^${escapeRegex(title)}$`, 'i');
          query.artist = new RegExp(`^${escapeRegex(artist)}$`, 'i');
        } else if (title) {
          query.title = new RegExp(`^${escapeRegex(title)}$`, 'i');
        }
        if (req.query.album) {
          query.album = new RegExp(`^${escapeRegex(req.query.album)}$`, 'i');
        }
        let dbTrack = await Track.findOne(query).lean();
        if (!dbTrack && query.album) {
          delete query.album;
          dbTrack = await Track.findOne(query).lean();
        }
        if (dbTrack) {
          if (dbTrack.source === 'Upload' || (dbTrack.audioUrl && (dbTrack.audioUrl.startsWith('/uploads/') || dbTrack.audioUrl.includes('/uploads/')))) {
            const cleanPath = dbTrack.audioUrl ? (dbTrack.audioUrl.startsWith('/') ? dbTrack.audioUrl : `/${dbTrack.audioUrl}`) : '';
            return res.json({
              success: true,
              url: cleanPath,
              directUrl: cleanPath,
              duration: dbTrack.duration || 210,
              cover: dbTrack.cover,
              isYouTube: false
            });
          }
          if (dbTrack.audioUrl && (dbTrack.audioUrl.endsWith('.mp3') || dbTrack.audioUrl.endsWith('.m4a')) && !dbTrack.audioUrl.includes('youtube') && !dbTrack.audioUrl.includes('soundcloud')) {
            return res.json({
              success: true,
              url: dbTrack.audioUrl,
              duration: dbTrack.duration || 240,
              cover: dbTrack.cover,
              isYouTube: false
            });
          }
          const directAudio = await resolveOfficialYouTubeAudioStream(dbTrack.audioUrl, dbTrack.title, dbTrack.artist, { duration: dbTrack.duration || Number(duration) || null, album: dbTrack.album || req.query.album || '' });
          if (directAudio) {
            const resolvedPath = directAudio.url || String(directAudio);
            const isLocalUpload = resolvedPath.startsWith('/uploads/');
            const finalUrl = isLocalUpload ? resolvedPath : `/api/tracks/stream-proxy?url=${encodeURIComponent(resolvedPath)}`;
            return res.json({
              success: true,
              url: finalUrl,
              directUrl: resolvedPath,
              duration: (directAudio.duration && directAudio.duration > 0) ? directAudio.duration : (dbTrack.duration || 210),
              cover: dbTrack.cover,
              isYouTube: false
            });
          }
        }
      } catch {}
    }

    const cand = [url, id, trackId, req.params?.id];
    for (const c of cand) {
      if (c && typeof c === 'string') {
        const m1 = c.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
        const m2 = c.match(/^yt[-_]?([a-zA-Z0-9_-]{11})$/i);
        const vidCandidate = (m1 && m1[1] && m1[1].length === 11)
          ? m1[1]
          : ((m2 && m2[1]) ? m2[1] : (/^[a-zA-Z0-9_-]{11}$/.test(c.trim()) && !mongoose.isValidObjectId(c.trim()) ? c.trim() : null));

        if (vidCandidate) {
          const directAudio = await resolveOfficialYouTubeAudioStream(vidCandidate, title || '', artist || '', { duration: Number(duration) || null, album: req.query.album || '' });
          if (directAudio) {
            const resolvedPath = directAudio.url || String(directAudio);
            const isLocalUpload = resolvedPath.startsWith('/uploads/');
            const finalUrl = isLocalUpload ? resolvedPath : `/api/tracks/stream-proxy?url=${encodeURIComponent(resolvedPath)}`;
            const coverUrl = req.query.cover || `https://i.ytimg.com/vi/${vidCandidate}/hqdefault.jpg`;
            const savedTrack = await autoPersistExternalTrack({
              title,
              artist,
              album: req.query.album || 'Single',
              cover: coverUrl,
              audioUrl: `https://www.youtube.com/watch?v=${vidCandidate}`,
              duration: (directAudio.duration && directAudio.duration > 0) ? directAudio.duration : 210
            });
            return res.json({
              success: true,
              url: finalUrl,
              directUrl: resolvedPath,
              duration: (directAudio.duration && directAudio.duration > 0) ? directAudio.duration : 210,
              cover: savedTrack?.cover || coverUrl,
              isYouTube: false,
              track: savedTrack
            });
          }
        }
      }
    }

    if (title || artist || url) {
      const directAudio = await resolveOfficialYouTubeAudioStream(url || '', title || '', artist || '', { duration: Number(duration) || null, album: req.query.album || '' });
      if (directAudio) {
        const resolvedPath = directAudio.url || String(directAudio);
        const isLocalUpload = resolvedPath.startsWith('/uploads/');
        const finalUrl = isLocalUpload ? resolvedPath : `/api/tracks/stream-proxy?url=${encodeURIComponent(resolvedPath)}`;
        const vidId = directAudio.videoId || (url && url.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i)?.[1]) || null;
        const coverUrl = req.query.cover || (vidId ? `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg` : '');
        const savedTrack = await autoPersistExternalTrack({
          title,
          artist,
          album: req.query.album || 'Single',
          cover: coverUrl,
          audioUrl: url || (vidId ? `https://www.youtube.com/watch?v=${vidId}` : ''),
          duration: (directAudio.duration && directAudio.duration > 0) ? directAudio.duration : 210
        });
        return res.json({
          success: true,
          url: finalUrl,
          directUrl: resolvedPath,
          duration: (directAudio.duration && directAudio.duration > 0) ? directAudio.duration : 210,
          cover: savedTrack?.cover || coverUrl,
          isYouTube: false,
          track: savedTrack
        });
      }
    }

    if (url && url.startsWith('http') && !url.includes('youtube.com') && !url.includes('youtu.be') && !url.includes('pixabay.com') && !url.includes('preview') && !url.includes('soundcloud.com') && !url.includes('sndcdn.com')) {
      return res.json({ success: true, url });
    }

    res.status(404).json({ success: false, error: 'Could not resolve audio stream' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
router.get('/resolve-stream', resolveStreamHandler);

// Deduplicate tracks across DB (Admin Only)
function normalizeArtistForDedupe(artist) {
  if (!artist) return '';
  let a = artist.trim().toLowerCase();
  a = a.replace(/\s*-\s*topic$/i, '').trim();
  a = a.replace(/official$/i, '').trim();
  if (a === 'release') return '';
  const parts = a.split(/,|\s+feat\.?\s+|\s+ft\.?\s+|\s+&\s+|\s+x\s+|\s+مع\s+|[|│]\s*|\s+[iIl]\s+(?=[\u0600-\u06FF])/i);
  let primary = (parts[0] || '').trim();
  if (primary.includes(' - ')) {
    primary = primary.split(' - ')[0].trim();
  }
  primary = primary.replace(/\s+[\u0600-\u06FF].*$/g, '').trim();
  return primary.replace(/\s+/g, ' ');
}

function normalizeTitleForDedupe(title) {
  if (!title) return '';
  let t = title.trim().toLowerCase();
  t = t.replace(/\s*[\(\[](official\s*(audio|video|music\s*video|visualizer)?|audio|video)[\)\]]/gi, '').trim();
  t = t.replace(/\s+/g, ' ');
  return t;
}

function areArtistsSameForDedupe(artA, artB) {
  if (!artA || !artB) return false;
  const aRaw = artA.trim().toLowerCase();
  const bRaw = artB.trim().toLowerCase();
  if (aRaw === bRaw) return true;
  if (aRaw.includes('release - topic') || bRaw.includes('release - topic')) return true;
  if (aRaw.includes(bRaw) || bRaw.includes(aRaw)) return true;
  const normA = normalizeArtistForDedupe(artA);
  const normB = normalizeArtistForDedupe(artB);
  if (normA && normB && (normA === normB || normA.includes(normB) || normB.includes(normA))) return true;
  return false;
}

function scoreTrackForDedupe(t) {
  let score = 0;
  if (t.album && t.album.trim() && t.album.trim().toLowerCase() !== 'single') {
    score += 100;
  }
  if (t.audioUrl && (t.audioUrl.includes('youtube.com') || t.audioUrl.includes('youtu.be') || t.audioUrl.startsWith('http'))) {
    score += 50;
  }
  if (t.cover && !t.cover.includes('unsplash')) {
    score += 20;
  }
  if (Array.isArray(t.lyrics) && t.lyrics.length > 0) {
    score += 30;
  }
  score += (Number(t.plays) || 0) * 2;
  return score;
}

async function performTrackDeduplication() {
  const allTracks = await Track.find({}).lean();
  const titleGroups = new Map();

  for (const t of allTracks) {
    const normTitle = normalizeTitleForDedupe(t.title);
    if (!titleGroups.has(normTitle)) {
      titleGroups.set(normTitle, []);
    }
    titleGroups.get(normTitle).push(t);
  }

  let totalRemoved = 0;
  const idMap = new Map(); // redundantId -> canonicalId
  const tracksToDelete = [];
  let dupeGroupsCount = 0;

  for (const [title, list] of titleGroups.entries()) {
    if (list.length <= 1) continue;

    // Cluster tracks with matching artist
    const clusters = [];
    for (const track of list) {
      let added = false;
      for (const cluster of clusters) {
        if (cluster.some(member => areArtistsSameForDedupe(member.artist, track.artist))) {
          cluster.push(track);
          added = true;
          break;
        }
      }
      if (!added) {
        clusters.push([track]);
      }
    }

    for (const cluster of clusters) {
      if (cluster.length <= 1) continue;
      dupeGroupsCount++;

      cluster.sort((a, b) => scoreTrackForDedupe(b) - scoreTrackForDedupe(a));

      const canonical = cluster[0];
      const canonicalId = String(canonical._id);

      let totalPlays = Number(canonical.plays) || 0;
      let bestLyrics = (Array.isArray(canonical.lyrics) && canonical.lyrics.length > 0) ? canonical.lyrics : null;
      let bestAlbum = canonical.album || '';
      let bestCover = canonical.cover || canonical.coverUrl || '';
      let bestArtist = canonical.artist || '';

      for (let i = 1; i < cluster.length; i++) {
        const red = cluster[i];
        const redId = String(red._id);
        idMap.set(redId, canonicalId);
        tracksToDelete.push(red._id);
        totalRemoved++;

        totalPlays += (Number(red.plays) || 0);
        if (!bestLyrics && Array.isArray(red.lyrics) && red.lyrics.length > 0) {
          bestLyrics = red.lyrics;
        }
        if ((!bestAlbum || bestAlbum.toLowerCase() === 'single') && red.album && red.album.toLowerCase() !== 'single') {
          bestAlbum = red.album;
        }
        if ((!bestCover || bestCover.includes('unsplash')) && red.cover && !red.cover.includes('unsplash')) {
          bestCover = red.cover;
        }
        if (red.artist && red.artist.length > bestArtist.length && !red.artist.toLowerCase().includes('topic')) {
          bestArtist = red.artist;
        }
      }

      const updatePayload = { plays: totalPlays };
      if (bestLyrics && (!canonical.lyrics || canonical.lyrics.length === 0)) {
        updatePayload.lyrics = bestLyrics;
      }
      if (bestAlbum && (!canonical.album || canonical.album.toLowerCase() === 'single')) {
        updatePayload.album = bestAlbum;
      }
      if (bestCover && (!canonical.cover || canonical.cover.includes('unsplash'))) {
        updatePayload.cover = bestCover;
      }
      if (bestArtist && bestArtist !== canonical.artist) {
        updatePayload.artist = bestArtist;
      }

      await Track.updateOne({ _id: canonical._id }, { $set: updatePayload });
    }
  }

  if (tracksToDelete.length > 0) {
    await Track.deleteMany({ _id: { $in: tracksToDelete } });
  }

  // Remap references in Users
  const users = await User.find({}).lean();
  for (const u of users) {
    let modified = false;

    let newLiked = (u.likedTrackIds || []).map(id => idMap.get(String(id)) || String(id));
    const likedSet = new Set(newLiked);
    if (likedSet.size !== (u.likedTrackIds || []).length || newLiked.some((id, idx) => id !== u.likedTrackIds[idx])) {
      newLiked = Array.from(likedSet);
      modified = true;
    }

    const newPlaylists = (u.playlists || []).map(pl => {
      let tIds = (pl.trackIds || []).map(id => idMap.get(String(id)) || String(id));
      const tSet = new Set(tIds);
      if (tSet.size !== (pl.trackIds || []).length || tIds.some((id, idx) => id !== pl.trackIds[idx])) {
        modified = true;
        return { ...pl, trackIds: Array.from(tSet) };
      }
      return pl;
    });

    if (modified) {
      await User.updateOne(
        { _id: u._id },
        { $set: { likedTrackIds: newLiked, playlists: newPlaylists } }
      );
    }
  }

  // Remap references in Albums
  const albums = await Album.find({}).lean();
  for (const alb of albums) {
    let modified = false;
    let tIds = (alb.trackIds || []).map(id => idMap.get(String(id)) || String(id));
    const tSet = new Set(tIds);
    if (tSet.size !== (alb.trackIds || []).length || tIds.some((id, idx) => id !== alb.trackIds[idx])) {
      modified = true;
      tIds = Array.from(tSet);
    }
    if (modified) {
      await Album.updateOne({ _id: alb._id }, { $set: { trackIds: tIds } });
    }
  }

  const remainingCount = await Track.countDocuments({});
  return {
    removedCount: totalRemoved,
    groupsCount: dupeGroupsCount,
    remainingCount
  };
}

router.post('/deduplicate', adminAuth, async (req, res) => {
  try {
    const result = await performTrackDeduplication();
    res.json({
      success: true,
      message: `Deduplication complete: Purged ${result.removedCount} duplicate tracks across ${result.groupsCount} duplicate groups. ${result.remainingCount} canonical tracks in catalog.`,
      ...result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
