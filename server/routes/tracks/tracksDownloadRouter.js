const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Track } = require('../../models');
const { uploadsDir } = require('../../middleware/upload');
const { safeResolveUpload, validateSafeUrl } = require('../../utils/security');
const {
  escapeRegex,
  searchYouTubeId,
  isAudioFileValid,
  resolveOfficialYouTubeAudioStream,
} = require('../../utils/helpers');
const { serveCloudDownload } = require('../../utils/cloudMediaServer');
const { resolveTrackStemInfo } = require('./vocalsRouter');

router.get('/download', async (req, res) => {
  try {
    let { url, title, artist, id, trackId, duration } = req.query;
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
      duration = duration || dbTrack.duration;
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

    // Vocal-Only Mode Download Handler
    const isVocalOnlyDownload = req.query.vocalOnly === 'true' || req.query.vocalOnly === '1';
    if (isVocalOnlyDownload && typeof resolveTrackStemInfo === 'function') {
      const { isVocalStemReady, getVocalStemPath } = require('../../utils/vocalSeparator');
      const { primaryKey, aliases } = await resolveTrackStemInfo(req);
      const allKeys = [primaryKey, ...aliases];
      for (const k of allKeys) {
        if (isVocalStemReady(k)) {
          const stemFile = getVocalStemPath(k);
          const vocalFilename = `${cleanFilename} [Vocal Only]`;
          const safeAscii = vocalFilename.replace(/[^\x20-\x7E]/g, '').trim() || 'vocal_track';
          res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Disposition': `attachment; filename="${safeAscii}.mp3"; filename*=UTF-8''${encodeURIComponent(vocalFilename)}.mp3`,
            'Access-Control-Allow-Origin': '*'
          });
          return res.sendFile(stemFile);
        }
      }
    }

    // Cloud-migrated track download (Telegram / Backblaze B2 / local cloud cache)
    if (dbTrack?.cloudStorage?.provider || (url && url.includes('/uploads/cloud/'))) {
      let targetTrack = dbTrack;
      if (!targetTrack && url) {
        const m = url.match(/\/uploads\/cloud\/([a-fA-F0-9]{24})/);
        if (m?.[1] && mongoose.isValidObjectId(m[1])) {
          try { targetTrack = await Track.findById(m[1]).lean(); } catch {}
        }
      }
      if (targetTrack?.cloudStorage?.provider) {
        const served = await serveCloudDownload(targetTrack, cleanFilename, req, res);
        if (served) return;
      }
    }

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
      const cachedM4a = path.join(uploadsDir, `audio-cache/${videoId}.m4a`);
      const cachedMp3 = path.join(uploadsDir, `audio-cache/${videoId}.mp3`);
      const localCachedFile = (fs.existsSync(cachedM4a) && isAudioFileValid(cachedM4a))
        ? cachedM4a
        : ((fs.existsSync(cachedMp3) && isAudioFileValid(cachedMp3)) ? cachedMp3 : null);

      if (localCachedFile) {
        const ext = path.extname(localCachedFile);
        const safeAscii = cleanFilename.replace(/[^\x20-\x7E]/g, '').trim() || 'track';
        res.set({
          'Content-Type': ext === '.m4a' ? 'audio/mp4' : 'audio/mpeg',
          'Content-Disposition': `attachment; filename="${safeAscii}${ext}"; filename*=UTF-8''${encodeURIComponent(cleanFilename)}${ext}`
        });
        return fs.createReadStream(localCachedFile).pipe(res);
      } else {
        try {
          const directAudio = await resolveOfficialYouTubeAudioStream(videoId, cleanTitle, cleanArtist, { duration });
          if (directAudio) {
            const streamTarget = directAudio.url || String(directAudio);
            if (streamTarget.startsWith('http')) {
              const safeStream = await validateSafeUrl(streamTarget);
              if (safeStream && safeStream.valid) {
                const streamRes = await axios({
                  method: 'get',
                  url: safeStream.parsed.href,
                  responseType: 'stream',
                  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                  timeout: 180000
                });
                const ext = streamTarget.includes('.m4a') ? '.m4a' : '.mp3';
                const safeAscii = cleanFilename.replace(/[^\x20-\x7E]/g, '').trim() || 'track';
                res.set({
                  'Content-Type': ext === '.m4a' ? 'audio/mp4' : 'audio/mpeg',
                  'Content-Disposition': `attachment; filename="${safeAscii}${ext}"; filename*=UTF-8''${encodeURIComponent(cleanFilename)}${ext}`,
                  'Access-Control-Allow-Origin': '*'
                });
                return streamRes.data.pipe(res);
              }
            }
          }
        } catch (streamErr) {
          console.warn('Direct stream resolution in /download failed:', streamErr.message);
        }
      }
    }

    res.status(404).json({ success: false, error: 'Could not prepare download stream' });
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
