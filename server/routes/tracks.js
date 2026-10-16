const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
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
  fetchLrclibLyrics
} = require('../utils/helpers');

// Rate limiter for track creation to prevent DoS / spam
const trackCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many tracks created from this IP, please try again after 15 minutes.' }
});

// Get all tracks with optional album / artist filters
router.get('/', async (req, res) => {
  try {
    const filter = {
      source: { $ne: 'SoundCloud' },
      album: { $ne: 'SoundCloud' },
      audioUrl: { $not: /soundcloud\.com|sndcdn\.com/i }
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
    const tracks = raw.map(t => ({
      ...t,
      id: String(t._id),
      isQuran: Boolean(t.isQuran || isQuranContent(t.title, t.artist, t.album, t.genre))
    }));
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
      lyrics: t.lyrics || []
    }));

    res.json({ success: true, tracks: formatted });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Import track from Spotify/YouTube link
const importTrackHandler = async (req, res) => {
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

      const ytId = await searchYouTubeId(`${artist} - ${title}`);
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
        const ytId = await searchYouTubeId(`${artist} - ${title}`);
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

    res.json({ success: true, track: newTrack });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create track manually with strict schema validation against mass assignment
const createTrackHandler = async (req, res) => {
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
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Permission denied. Only administrators can delete songs from the website.' });
    }

    const trackId = String(req.params.id || req.body.trackId || '');
    if (!trackId) return res.status(400).json({ error: 'Track ID required' });

    try {
      await Track.deleteOne({ _id: trackId });
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
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Permission denied. Only administrators can edit songs.' });
    }
    const trackId = String(req.params.id || req.body.id || req.body._id || '');
    if (!trackId) return res.status(400).json({ error: 'Track ID required' });

    const track = await Track.findOne({ $or: [{ _id: mongoose.isValidObjectId(trackId) ? trackId : null }, { id: trackId }] });
    if (!track) return res.status(404).json({ error: 'Track not found' });

    const { title, artist, album, cover, audioUrl, duration, genre, lyrics } = req.body;
    if (title) track.title = title.trim();
    if (artist) track.artist = artist.trim();
    if (album !== undefined) track.album = album.trim();
    if (cover) track.cover = cover.trim();
    if (audioUrl) track.audioUrl = audioUrl.trim();
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
        cover: track?.cover || ''
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
            isYouTube: false
          });
        }
      } catch {}
    }

    const streamTarget = rawUrl || id || '';
    const streamUrl = await resolveOfficialYouTubeAudioStream(streamTarget, title, artist);
    if (streamUrl) {
      const resolvedPath = streamUrl.url || String(streamUrl);
      const isLocalUpload = resolvedPath.startsWith('/uploads/');
      const finalUrl = isLocalUpload ? resolvedPath : `/api/tracks/stream-proxy?url=${encodeURIComponent(resolvedPath)}`;
      return res.json({
        success: true,
        url: finalUrl,
        directUrl: resolvedPath,
        duration: streamUrl.duration || track?.duration || 210
      });
    }
    res.status(404).json({ success: false, error: 'Could not resolve audio stream' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};
router.get('/stream', handleTrackStream);
router.get('/:id/stream', handleTrackStream);

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
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const response = await axios({
      method: 'get',
      url: targetUrl,
      responseType: 'stream',
      headers,
      timeout: 25000,
      maxRedirects: 0,
      validateStatus: (status) => status < 400
    });

    res.status(response.status);
    for (const [key, value] of Object.entries(response.headers)) {
      res.setHeader(key, value);
    }
    res.setHeader('Accept-Ranges', 'bytes');
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
    if (trackId && (!url || !title)) {
      try {
        if (mongoose.isValidObjectId(id)) {
          const dbTrack = await Track.findById(id).lean();
          if (dbTrack) {
            url = url || dbTrack.audioUrl;
            title = title || dbTrack.title;
            artist = artist || dbTrack.artist;
          }
        }
      } catch {}
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

    // Direct uploaded files
    if (url && (url.startsWith('/uploads/') || url.includes('/uploads/'))) {
      const filePath = path.join(__dirname, '../../', url.startsWith('/') ? url : `/${url}`);
      if (fs.existsSync(filePath)) {
        return res.download(filePath, `${cleanFilename}${path.extname(filePath)}`);
      }
    }

    if (url && (url.startsWith('http://') || url.startsWith('https://')) && !url.includes('youtube.com') && !url.includes('youtu.be')) {
      try {
        const directRes = await axios({
          method: 'get',
          url: url,
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
      } catch (e) {}
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
        videoId = await searchYouTubeId(`${cleanArtist} ${cleanTitle}`.trim());
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

// Update track lyrics (Admin Only)
router.post('/update-lyrics', adminAuth, async (req, res) => {
  try {
    const { trackId, title, artist, lyrics, isVerified } = req.body;
    const isAdmin = true;
    const isVer = isVerified !== undefined ? Boolean(isVerified) : true;
    const trackKey = getTrackKey(title, artist);

    if (!isVer && isVerified === false) {
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

    if (trackKey && trackKey !== '___') {
      const found = await SongLyrics.findOne({ trackKey }).lean();
      if (found && Array.isArray(found.lyrics) && found.lyrics.length > 0) {
        return res.json({
          success: true,
          lyrics: found.lyrics,
          source: found.source || 'manual',
          isVerified: Boolean(found.isVerified),
          verifiedBy: found.verifiedBy || ''
        });
      }
    }

    if (trackId) {
      const found = await SongLyrics.findOne({ trackId: String(trackId) }).lean();
      if (found && Array.isArray(found.lyrics) && found.lyrics.length > 0) {
        return res.json({
          success: true,
          lyrics: found.lyrics,
          source: found.source || 'manual',
          isVerified: Boolean(found.isVerified),
          verifiedBy: found.verifiedBy || ''
        });
      }

      if (mongoose.isValidObjectId(trackId)) {
        const trk = await Track.findById(trackId).lean();
        if (trk && Array.isArray(trk.lyrics) && trk.lyrics.length > 0) {
          return res.json({
            success: true,
            lyrics: trk.lyrics,
            source: trk.isVerified ? 'verified' : 'manual',
            isVerified: Boolean(trk.isVerified || trk.isVerifiedLyrics),
            verifiedBy: trk.verifiedBy || ''
          });
        }
      }
    }

    if (title) {
      const lyrics = await fetchLrclibLyrics(title, artist, 180);
      if (lyrics && lyrics.length > 0) {
        return res.json({ success: true, lyrics, source: 'synced', isVerified: false });
      }
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
    const { url, title, artist, id, trackId } = req.query;

    if (url && typeof url === 'string' && (url.startsWith('/uploads/') || url.includes('/uploads/'))) {
      const cleanPath = url.startsWith('/') ? url : `/${url}`;
      return res.json({
        success: true,
        url: cleanPath,
        directUrl: cleanPath,
        duration: 210,
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
          const directAudio = await resolveOfficialYouTubeAudioStream(dbTrack.audioUrl, dbTrack.title, dbTrack.artist);
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

    // Check if title and artist match an uploaded track in local DB
    if (title && artist) {
      try {
        const localUploaded = await Track.findOne({
          title: new RegExp(`^${escapeRegex(title)}$`, 'i'),
          artist: new RegExp(`^${escapeRegex(artist)}$`, 'i'),
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
            cover: localUploaded.cover,
            isYouTube: false
          });
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
          const directAudio = await resolveOfficialYouTubeAudioStream(vidCandidate, title || '', artist || '');
          if (directAudio) {
            const resolvedPath = directAudio.url || String(directAudio);
            const isLocalUpload = resolvedPath.startsWith('/uploads/');
            const finalUrl = isLocalUpload ? resolvedPath : `/api/tracks/stream-proxy?url=${encodeURIComponent(resolvedPath)}`;
            return res.json({
              success: true,
              url: finalUrl,
              directUrl: resolvedPath,
              duration: (directAudio.duration && directAudio.duration > 0) ? directAudio.duration : 210,
              cover: `https://i.ytimg.com/vi/${vidCandidate}/hqdefault.jpg`,
              isYouTube: false
            });
          }
        }
      }
    }

    if (title || artist || url) {
      const directAudio = await resolveOfficialYouTubeAudioStream(url || '', title || '', artist || '');
      if (directAudio) {
        const resolvedPath = directAudio.url || String(directAudio);
        const isLocalUpload = resolvedPath.startsWith('/uploads/');
        const finalUrl = isLocalUpload ? resolvedPath : `/api/tracks/stream-proxy?url=${encodeURIComponent(resolvedPath)}`;
        return res.json({
          success: true,
          url: finalUrl,
          directUrl: resolvedPath,
          duration: (directAudio.duration && directAudio.duration > 0) ? directAudio.duration : 210,
          isYouTube: false,
        });
      }
    }

    if (url && url.startsWith('http') && !url.includes('pixabay.com') && !url.includes('preview') && !url.includes('soundcloud.com') && !url.includes('sndcdn.com')) {
      return res.json({ success: true, url });
    }

    res.status(404).json({ success: false, error: 'Could not resolve audio stream' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
router.get('/resolve-stream', resolveStreamHandler);

// Purge SoundCloud tracks
router.post('/purge-soundcloud', adminAuth, async (req, res) => {
  try {
    const scQuery = {
      $or: [
        { source: { $regex: /soundcloud/i } },
        { audioUrl: { $regex: /soundcloud\.com|sndcdn\.com/i } },
        { album: { $regex: /soundcloud/i } },
        { originalUrl: { $regex: /soundcloud\.com/i } },
        { id: { $regex: /^sc-/i } },
      ]
    };
    const r = await Track.deleteMany(scQuery);
    res.json({ success: true, deletedCount: r.deletedCount });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
