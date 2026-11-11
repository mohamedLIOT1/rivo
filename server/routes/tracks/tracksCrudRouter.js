const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { Track, Album, User, SongLyrics } = require('../../models');
const { auth, adminAuth, isAdminUser } = require('../../middleware/auth');
const { upload, uploadsDir, verifyUploadedAudioMagicBytes } = require('../../middleware/upload');
const { safeResolveUpload } = require('../../utils/security');
const {
  escapeRegex,
  isQuranContent,
  fetchTrackCover,
  syncTrackToAlbum,
  autoAddTrackToUserLinksPlaylist,
  getTrackKey,
  invalidateAudioCache
} = require('../../utils/helpers');
const { invalidateTracksCache } = require('./tracksCache');
const { performTrackDeduplication } = require('./tracksDedupeHelper');
const { classifyGenre } = require('../../utils/genreClassifier');

const trackCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many tracks created from this IP, please try again after 15 minutes.' }
});

function safeUnlink(filePath) {
  if (!filePath) return;
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
}

function cleanupCloudCacheForTrack(trackId) {
  const cleanId = String(trackId || '').trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(cleanId)) return;
  const cloudCacheDir = path.join(uploadsDir, 'cloud-cache');
  try {
    if (!fs.existsSync(cloudCacheDir)) return;
    for (const entry of fs.readdirSync(cloudCacheDir)) {
      if (entry.startsWith(`${cleanId}.`)) safeUnlink(path.join(cloudCacheDir, entry));
    }
  } catch {}
}

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
      safeUnlink(req.files?.audio?.[0]?.path);
      safeUnlink(req.files?.cover?.[0]?.path);
      if (req.user?.id) await autoAddTrackToUserLinksPlaylist(req.user.id, existingTrack._id, existingTrack.cover);
      return res.json({ success: true, track: existingTrack, isDuplicate: true });
    }

    const cleanTitle = title.trim().slice(0, 200);
    const cleanArtist = artist.trim().slice(0, 150);
    const cleanAlbum = (album || '').trim().slice(0, 150) || 'Single';
    const classification = classifyGenre({ title: cleanTitle, artist: cleanArtist, album: cleanAlbum, genre });
    const finalGenre = classification.genre.slice(0, 60);
    const finalIsQuran = Boolean(classification.isQuran || isQuranContent(cleanTitle, cleanArtist, cleanAlbum, finalGenre));

    const newTrack = await new Track({
      title: cleanTitle,
      artist: cleanArtist,
      album: cleanAlbum,
      cover: coverUrl,
      audioUrl,
      duration: parsedDuration,
      genre: finalGenre,
      source: 'Upload',
      addedBy: req.user ? req.user.id : 'user',
      lyrics: parsedLyrics,
      isQuran: finalIsQuran
    }).save();

    await syncTrackToAlbum(newTrack);
    invalidateTracksCache();

    if (req.user?.id) await autoAddTrackToUserLinksPlaylist(req.user.id, newTrack._id, newTrack.cover);

    const io = req.app?.get('io') || req.io;
    if (io) io.emit('track:created', newTrack);

    res.json({ success: true, track: newTrack });
  } catch (err) {
    safeUnlink(req.files?.audio?.[0]?.path);
    safeUnlink(req.files?.cover?.[0]?.path);
    res.status(500).json({ error: err.message });
  }
});

// Create track manually
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
    const classification = classifyGenre({ title: cleanTitle, artist: cleanArtist, album: cleanAlbum, genre });
    const cleanGenre = classification.genre.slice(0, 60);
    const finalIsQuran = Boolean(classification.isQuran || isQuranContent(cleanTitle, cleanArtist, cleanAlbum, cleanGenre));
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
      isQuran: finalIsQuran
    }).save();

    await syncTrackToAlbum(newTrack);
    invalidateTracksCache();

    if (req.user?.id) await autoAddTrackToUserLinksPlaylist(req.user.id, newTrack._id, newTrack.cover);

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
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Permission denied. Only administrators can delete songs from the website.' });
    }

    const trackId = String(req.params.id || req.body.trackId || '');
    if (!trackId) return res.status(400).json({ error: 'Track ID required' });

    try {
      const existing = await Track.findById(trackId);
      if (existing) {
        if (existing.audioUrl) {
          invalidateAudioCache(existing.audioUrl);
          if (existing.audioUrl.startsWith('/uploads/') || existing.audioUrl.startsWith('uploads/')) {
            safeUnlink(safeResolveUpload(existing.audioUrl, uploadsDir));
          }
        }
        if (existing.legacyAudioUrl) invalidateAudioCache(existing.legacyAudioUrl);
        if (existing.cover && (existing.cover.startsWith('/uploads/') || existing.cover.startsWith('uploads/'))) {
          safeUnlink(safeResolveUpload(existing.cover, uploadsDir));
        }
      }
      await Track.deleteOne({ _id: trackId });
    } catch {}
    cleanupCloudCacheForTrack(trackId);
    invalidateTracksCache();
    try { await Album.updateMany({}, { $pull: { trackIds: trackId } }); } catch {}

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
    if (genre !== undefined) {
      const gRes = classifyGenre({ title: track.title, artist: track.artist, album: track.album, genre });
      track.genre = gRes.genre;
      if (gRes.isQuran) track.isQuran = true;
    }
    if (Array.isArray(lyrics)) track.lyrics = lyrics;

    await track.save();
    invalidateTracksCache();

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

// Deduplicate tracks
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
