const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { Track, SongLyrics } = require('../../models');
const { auth, adminAuth, isAdminUser } = require('../../middleware/auth');
const {
  getTrackKey,
  fetchLrclibLyrics,
  fetchGeniusLyrics,
  cleanLyricsMetadata,
} = require('../../utils/helpers');

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
    const trackKey = getTrackKey(title, artist);

    let parsed = lyrics;
    if (typeof lyrics === 'string') {
      try { parsed = JSON.parse(lyrics); } catch {}
    }
    if (!Array.isArray(parsed)) {
      return res.status(400).json({ error: 'Lyrics must be an array' });
    }

    if (trackKey && trackKey !== '___') {
      await SongLyrics.findOneAndUpdate(
        { trackKey },
        {
          $set: {
            trackKey,
            trackId: trackId ? String(trackId) : '',
            title,
            artist,
            lyrics: parsed,
            isVerified: isAdmin ? Boolean(isVerified) : false,
            updatedBy: req.user?.name || 'User',
            updatedAt: new Date(),
          }
        },
        { upsert: true }
      ).catch(() => {});
    }

    if (trackId && mongoose.isValidObjectId(trackId)) {
      await Track.updateOne(
        { _id: trackId },
        { $set: { lyrics: parsed } }
      ).catch(() => {});
    }

    res.json({ success: true, lyrics: parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
      const meta = cleanLyricsMetadata(title, artist);
      let lyrics = await fetchLrclibLyrics(meta.cleanTitle || title, meta.cleanArtist || artist, 180);
      let lyricSource = 'synced';
      if (!lyrics || lyrics.length === 0) {
        lyrics = await fetchGeniusLyrics(meta.cleanTitle || title, meta.cleanArtist || artist, 180);
        lyricSource = 'genius';
      }
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
                source: shouldBeVerified ? 'verified' : lyricSource, 
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
          source: shouldBeVerified ? 'verified' : lyricSource, 
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

    res.json({ success: true, message: 'Lyrics cleared successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
