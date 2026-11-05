const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { Track } = require('../../models');
const { escapeRegex, resolveOfficialYouTubeAudioStream } = require('../../utils/helpers');
const { classifyGenre, isQuranContent } = require('../../utils/genreClassifier');

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
            title: new RegExp(`^${escapeRegex(stripped)}$`, 'i'),
            ...(cleanA ? { artist: new RegExp(`^${escapeRegex(cleanA)}$`, 'i') } : {})
          });
        }
      }
    }
    if (t) {
      if (duration && duration > 0 && Math.abs((t.duration || 0) - duration) > 2) {
        t.duration = duration;
        await t.save().catch(() => {});
      }
    } else {
      const cleanTitle = title.trim();
      const cleanArtist = (artist || 'Unknown Artist').trim();
      const cleanAlbum = album || 'Single';
      const classification = classifyGenre({ title: cleanTitle, artist: cleanArtist, album: cleanAlbum });
      const finalGenre = classification.genre;
      const finalIsQuran = Boolean(classification.isQuran || isQuranContent(cleanTitle, cleanArtist, cleanAlbum, finalGenre));

      t = await Track.create({
        title: cleanTitle,
        artist: cleanArtist,
        album: cleanAlbum,
        cover: cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
        audioUrl: audioUrl || '',
        duration: duration || 210,
        genre: finalGenre,
        isQuran: finalIsQuran,
        source: 'Rivo',
        addedBy: 'auto-search'
      });
    }
    const resolvedGenre = t.genre || classifyGenre({ title: t.title, artist: t.artist, album: t.album }).genre;
    return {
      id: String(t._id || t.id),
      _id: String(t._id || t.id),
      title: t.title,
      artist: t.artist,
      album: t.album,
      cover: t.cover,
      audioUrl: t.audioUrl,
      duration: t.duration || duration || 210,
      genre: resolvedGenre,
      source: t.source || 'Rivo',
      isQuran: Boolean(t.isQuran),
      lyrics: t.lyrics || []
    };
  } catch (err) {
    console.warn('[autoPersistExternalTrack error]', err.message);
    return null;
  }
}

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
            const vidCandidate = directAudio.videoId || (dbTrack.audioUrl && dbTrack.audioUrl.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i)?.[1]) || null;
            const vidParam = vidCandidate ? `&videoId=${encodeURIComponent(vidCandidate)}` : '';
            const finalUrl = isLocalUpload ? resolvedPath : `/api/tracks/stream-proxy?url=${encodeURIComponent(resolvedPath)}${vidParam}`;
            const finalDur = (directAudio.duration && directAudio.duration > 0) ? directAudio.duration : (dbTrack.duration || 210);
            if (dbTrack._id && finalDur > 0 && Math.abs((dbTrack.duration || 0) - finalDur) > 3) {
              Track.updateOne({ _id: dbTrack._id }, { $set: { duration: finalDur } }).catch(() => {});
            }
            return res.json({
              success: true,
              url: finalUrl,
              directUrl: resolvedPath,
              duration: finalDur,
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
            const vidCandidate = directAudio.videoId || (dbTrack.audioUrl && dbTrack.audioUrl.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i)?.[1]) || null;
            const vidParam = vidCandidate ? `&videoId=${encodeURIComponent(vidCandidate)}` : '';
            const finalUrl = isLocalUpload ? resolvedPath : `/api/tracks/stream-proxy?url=${encodeURIComponent(resolvedPath)}${vidParam}`;
            const finalDur = (directAudio.duration && directAudio.duration > 0) ? directAudio.duration : (dbTrack.duration || 210);
            if (dbTrack._id && finalDur > 0 && Math.abs((dbTrack.duration || 0) - finalDur) > 3) {
              Track.updateOne({ _id: dbTrack._id }, { $set: { duration: finalDur } }).catch(() => {});
            }
            return res.json({
              success: true,
              url: finalUrl,
              directUrl: resolvedPath,
              duration: finalDur,
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
            const vidParam = vidCandidate ? `&videoId=${encodeURIComponent(vidCandidate)}` : '';
            const finalUrl = isLocalUpload ? resolvedPath : `/api/tracks/stream-proxy?url=${encodeURIComponent(resolvedPath)}${vidParam}`;
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
        const vidId = directAudio.videoId || (url && url.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i)?.[1]) || null;
        const vidParam = vidId ? `&videoId=${encodeURIComponent(vidId)}` : '';
        const finalUrl = isLocalUpload ? resolvedPath : `/api/tracks/stream-proxy?url=${encodeURIComponent(resolvedPath)}${vidParam}`;
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

module.exports = {
  router,
  autoPersistExternalTrack,
  resolveStreamHandler
};
