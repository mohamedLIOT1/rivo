const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execFile } = require('child_process');
const { Track } = require('../../models');
const { adminAuth } = require('../../middleware/auth');
const { uploadsDir } = require('../../middleware/upload');
const {
  escapeRegex,
  isAudioFileValid,
  resolveOfficialYouTubeAudioStream,
  getYtDlpBin,
  getCookiesPath
} = require('../../utils/helpers');
const { autoPersistExternalTrack } = require('./tracksResolutionRouter');

const handleTrackStream = async (req, res) => {
  try {
    const id = req.params?.id || req.query?.trackId || req.query?.id || '';
    let track = null;
    if (id && mongoose.isValidObjectId(id)) {
      track = await Track.findById(id).lean();
    }
    let rawUrl = req.query.url || track?.audioUrl || '';
    let title = req.query.title || track?.title || '';
    let artist = req.query.artist || track?.artist || '';
    const isRetryAlt = req.query.retryAlt === '1' || req.query.retryAlt === 'true';

    if (!track && (title || artist)) {
      try {
        track = await Track.findOne({
          title: new RegExp(`^${escapeRegex(title)}$`, 'i'),
          ...(artist ? { artist: new RegExp(`^${escapeRegex(artist)}$`, 'i') } : {})
        }).lean();
        if (track?.audioUrl && !rawUrl) {
          rawUrl = track.audioUrl;
        }
        if (track?.title && !title) title = track.title;
        if (track?.artist && !artist) artist = track.artist;
      } catch (err) {}
    }

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

    // Immediate return if audio cache already exists for videoId
    const targetCandidate = rawUrl || track?.audioUrl || id || '';
    const vidMatch = targetCandidate.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/|^yt[-_]?)([a-zA-Z0-9_-]{11})/i) ||
      (typeof targetCandidate === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(targetCandidate.trim()) && !mongoose.isValidObjectId(targetCandidate.trim()) ? [null, targetCandidate.trim()] : null);
    const videoId = vidMatch?.[1] || null;

    if (videoId && !isRetryAlt) {
      const cachedM4a = path.join(uploadsDir, 'audio-cache', `${videoId}.m4a`);
      if (fs.existsSync(cachedM4a) && isAudioFileValid(cachedM4a)) {
        return res.json({
          success: true,
          url: `/uploads/audio-cache/${videoId}.m4a`,
          directUrl: `/uploads/audio-cache/${videoId}.m4a`,
          duration: track?.duration || 210,
          cover: track?.cover || ''
        });
      }
      const cachedMp3 = path.join(uploadsDir, 'audio-cache', `${videoId}.mp3`);
      if (fs.existsSync(cachedMp3) && isAudioFileValid(cachedMp3)) {
        return res.json({
          success: true,
          url: `/uploads/audio-cache/${videoId}.mp3`,
          directUrl: `/uploads/audio-cache/${videoId}.mp3`,
          duration: track?.duration || 210,
          cover: track?.cover || ''
        });
      }
    }

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
    const streamUrl = await resolveOfficialYouTubeAudioStream(
      isRetryAlt ? '' : streamTarget,
      title,
      artist,
      {
        duration,
        album: albumName,
        retryAlt: isRetryAlt,
        excludeVideoId: isRetryAlt ? videoId : null,
        bypassCache: isRetryAlt
      }
    );
    if (streamUrl) {
      const resolvedPath = streamUrl.url || String(streamUrl);
      const vidCandidate = streamUrl.videoId || (rawUrl.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i)?.[1]) || null;
      const isLocalUpload = resolvedPath.startsWith('/uploads/');
      const vidParam = vidCandidate ? `&videoId=${encodeURIComponent(vidCandidate)}` : '';
      const finalUrl = isLocalUpload
        ? resolvedPath
        : `/api/tracks/stream-proxy?url=${encodeURIComponent(resolvedPath)}${vidParam}&title=${encodeURIComponent(title || '')}&artist=${encodeURIComponent(artist || '')}`;
      const targetCover = req.query.cover || (vidCandidate ? `https://i.ytimg.com/vi/${vidCandidate}/hqdefault.jpg` : track?.cover || '');
      const finalDur = (streamUrl.duration && streamUrl.duration > 0) ? streamUrl.duration : (duration || track?.duration || 210);
      if (track?._id && finalDur > 0 && Math.abs((track.duration || 0) - finalDur) > 3) {
        Track.updateOne({ _id: track._id }, { $set: { duration: finalDur } }).catch(() => {});
      }
      const savedTrack = await autoPersistExternalTrack({
        id: track?._id || id,
        title,
        artist,
        album: req.query.album || track?.album || 'Single',
        cover: targetCover,
        audioUrl: rawUrl || (vidCandidate ? `https://www.youtube.com/watch?v=${vidCandidate}` : ''),
        duration: finalDur
      });

      return res.json({
        success: true,
        url: finalUrl,
        directUrl: resolvedPath,
        duration: finalDur,
        cover: savedTrack?.cover || track?.cover || targetCover,
        track: savedTrack
      });
    }
    res.status(404).json({ success: false, error: 'Could not resolve audio stream' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

const ALLOWED_RADIO_HOSTS = [
  'radiojar.com',
  'qurango.net',
  'xecod.com',
  'mp3quran.net'
];

/**
 * 24/7 Verified Quran Radio Stream Proxy with automatic HTTP redirect following.
 * Protects clients from Insecure Mixed-Content blocking (HTTP -> HTTPS) and CORS issues.
 */
router.get('/radio-proxy', (req, res) => {
  const target = req.query.url;
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Missing radio stream url parameter' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(target);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid radio stream URL' });
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const isAllowed = ALLOWED_RADIO_HOSTS.some(h => hostname === h || hostname.endsWith(`.${h}`));
  if (!isAllowed) {
    return res.status(403).json({ error: 'Proxy host not permitted' });
  }

  const pipeStream = (streamUrl, redirectDepth = 0) => {
    if (redirectDepth > 5) {
      if (!res.headersSent) res.status(502).json({ error: 'Too many redirects' });
      return;
    }

    let currentUrl;
    try {
      currentUrl = new URL(streamUrl);
    } catch {
      if (!res.headersSent) res.status(400).json({ error: 'Invalid stream redirect URL' });
      return;
    }

    const client = currentUrl.protocol === 'https:' ? https : http;

    const proxyReq = client.get(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        'Accept': '*/*'
      },
      timeout: 10000
    }, (proxyRes) => {
      // Follow 301/302 redirects (e.g. Radiojar HTTPS -> HTTP redirect node)
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        const nextLoc = new URL(proxyRes.headers.location, streamUrl).toString();
        proxyRes.resume();
        return pipeStream(nextLoc, redirectDepth + 1);
      }

      const contentType = proxyRes.headers['content-type'] || 'audio/mpeg';
      res.writeHead(proxyRes.statusCode || 200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Connection': 'keep-alive'
      });

      proxyRes.pipe(res);
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!res.headersSent) res.status(504).end();
    });

    proxyReq.on('error', () => {
      if (!res.headersSent) res.status(502).end();
    });

    req.on('close', () => {
      proxyReq.destroy();
    });
  };

  pipeStream(target, 0);
});

router.get('/stream', handleTrackStream);
router.get('/:id/stream', handleTrackStream);

router.get('/debug-stream', adminAuth, async (req, res) => {
  const rawVid = req.query.videoId || '0hhXwSen-Vw';
  const cleanVidMatch = String(rawVid).match(/^[a-zA-Z0-9_-]{11}$/);
  const videoId = cleanVidMatch ? cleanVidMatch[0] : '0hhXwSen-Vw';
  const bin = getYtDlpBin();
  const binExists = fs.existsSync(bin);
  const cp = getCookiesPath();
  const nodeBinDir = path.dirname(process.execPath);
  const execEnv = { ...process.env, PATH: `${nodeBinDir}:/usr/local/bin:/usr/bin:/bin:` + (process.env.PATH || '') };

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
        error: err?.message || null,
        stderr: stderr || null,
        stdout: stdout ? stdout.trim().slice(0, 150) : null
      });
    });
  });
});

module.exports = router;
