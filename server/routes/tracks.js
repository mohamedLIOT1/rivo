const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Track, Album } = require('../models');
const { uploadsDir } = require('../middleware/upload');
const { validateSafeUrl, safeResolveUpload } = require('../utils/security');
const {
  isQuranContent,
  resolveOfficialYouTubeAudioStream,
  isAudioFileValid,
  invalidateAudioCache,
  clearStreamMemoryCache
} = require('../utils/helpers');
const { checkMemoryCache, cacheStreamUrl } = require('../utils/streamFallbackProvider');

const urlAliasMap = new Map();
const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function clearStreamCache(videoId) {
  if (!videoId) return;
  if (typeof clearStreamMemoryCache === 'function') clearStreamMemoryCache(videoId);
  invalidateAudioCache(videoId, false);
}

const tracksPersistenceRouter = require('./tracks/tracksPersistenceRouter');
const tracksImportRouter = require('./tracks/tracksImportRouter');
const tracksCrudRouter = require('./tracks/tracksCrudRouter');
const tracksStreamRouter = require('./tracks/tracksStreamRouter');
const tracksDownloadRouter = require('./tracks/tracksDownloadRouter');
const tracksResolutionRouter = require('./tracks/tracksResolutionRouter');
const lyricsRouter = require('./tracks/lyricsRouter');
const vocalsRouter = require('./tracks/vocalsRouter');
const { getCachedTracks, setCachedTracks, invalidateTracksCache } = require('./tracks/tracksCache');

// Share Socket.IO instance with resolution auto-persister across sub-routers
router.use((req, _res, next) => {
  const io = req.app?.get('io') || req.io;
  if (io && typeof tracksResolutionRouter.setIo === 'function') tracksResolutionRouter.setIo(io);
  next();
});

// Internal loopback-only cache invalidation endpoint for background migration bot
router.post('/internal/invalidate-cache', (req, res) => {
  const peerIp = req.socket?.remoteAddress || req.ip || '';
  if (!LOOPBACK_IPS.has(peerIp) || req.headers['x-forwarded-for']) {
    return res.status(403).json({ error: 'Loopback access only' });
  }
  invalidateTracksCache();
  return res.json({ success: true });
});

router.use(
  tracksPersistenceRouter,
  tracksImportRouter,
  tracksCrudRouter,
  tracksStreamRouter,
  tracksDownloadRouter,
  tracksResolutionRouter.router,
  lyricsRouter,
  vocalsRouter
);

// Get all tracks with pagination, limit cap, and ETag / Cache-Control support
router.get('/', async (req, res) => {
  try {
    const rawLimit = parseInt(req.query.limit, 10);
    const limit = Math.min(1000, Math.max(1, !isNaN(rawLimit) ? rawLimit : 500));
    const rawPage = parseInt(req.query.page, 10);
    const page = Math.max(1, !isNaN(rawPage) ? rawPage : 1);
    const skip = (page - 1) * limit;

    const isDefaultRequest = !req.query.album && !req.query.artist && page === 1 && limit === 500;
    if (isDefaultRequest) {
      const cached = getCachedTracks();
      if (cached) {
        const etag = `"${crypto.createHash('md5').update(cached).digest('hex')}"`;
        res.setHeader('Cache-Control', 'public, max-age=120');
        res.setHeader('ETag', etag);
        const ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch && (ifNoneMatch === etag || ifNoneMatch === `W/${etag}` || ifNoneMatch.includes(etag.replace(/"/g, '')))) {
          return res.status(304).end();
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.send(cached);
      }
    }

    const filter = { source: { $ne: 'SoundCloud' }, album: { $ne: 'SoundCloud' } };

    if (req.query.album) {
      const rawAlbName = req.query.album.trim().replace(/^album-/i, '');
      const escaped = rawAlbName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flexiblePattern = escaped.replace(/[-_\s]+/g, '[-_\\s]*');
      const foundAlbum = await Album.findOne({
        $or: [{ name: new RegExp(`^${flexiblePattern}$`, 'i') }, { id: rawAlbName }]
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

    const raw = await Track.find(filter, { lyrics: 0 })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const tracks = raw
      .filter(t => !t.audioUrl || (!t.audioUrl.includes('soundcloud.com') && !t.audioUrl.includes('sndcdn.com')))
      .map(t => ({
        ...t,
        id: String(t._id),
        isQuran: Boolean(t.isQuran || isQuranContent(t.title, t.artist, t.album, t.genre))
      }));

    const payload = JSON.stringify({ success: true, tracks, page, limit });
    const etag = `"${crypto.createHash('md5').update(payload).digest('hex')}"`;
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.setHeader('ETag', etag);

    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch && (ifNoneMatch === etag || ifNoneMatch === `W/${etag}` || ifNoneMatch.includes(etag.replace(/"/g, '')))) {
      return res.status(304).end();
    }

    if (isDefaultRequest) setCachedTracks(payload);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.send(payload);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Stream Proxy with Range support, upstream timeout recovery, and strict CORS
router.get('/stream-proxy', async (req, res) => {
  let targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send('URL required');

  if (urlAliasMap.has(targetUrl)) {
    const alias = urlAliasMap.get(targetUrl);
    if (alias && alias.expiresAt > Date.now()) targetUrl = alias.renewedUrl;
    else urlAliasMap.delete(targetUrl);
  }

  if (targetUrl.startsWith('/uploads/') || targetUrl.startsWith('uploads/')) {
    const resolvedPath = safeResolveUpload(targetUrl, uploadsDir);
    if (!resolvedPath || !fs.existsSync(resolvedPath)) return res.status(403).send('Forbidden or non-existent file path');
    return res.sendFile(resolvedPath);
  }

  let videoId = req.query.videoId || null;
  let title = req.query.title || '';
  let artist = req.query.artist || '';
  if (!videoId && targetUrl) {
    const m = targetUrl.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
    if (m) videoId = m[1];
  }

  if ((!title || !artist) && (videoId || req.query.id)) {
    try {
      const qCond = [];
      if (req.query.id && mongoose.isValidObjectId(req.query.id)) qCond.push({ _id: req.query.id });
      if (videoId) qCond.push({ audioUrl: new RegExp(videoId, 'i') });
      if (qCond.length > 0) {
        const found = await Track.findOne({ $or: qCond }).select('title artist').lean();
        if (found) {
          if (!title) title = found.title || '';
          if (!artist) artist = found.artist || '';
        }
      }
    } catch {}
  }

  if (videoId) {
    const cachedM4a = path.join(uploadsDir, 'audio-cache', `${videoId}.m4a`);
    if (fs.existsSync(cachedM4a) && isAudioFileValid(cachedM4a)) return res.sendFile(cachedM4a);
    const cachedMp3 = path.join(uploadsDir, 'audio-cache', `${videoId}.mp3`);
    if (fs.existsSync(cachedMp3) && isAudioFileValid(cachedMp3)) return res.sendFile(cachedMp3);

    const memCached = checkMemoryCache(videoId);
    if (memCached && memCached.url) {
      const expMatch = targetUrl.match(/[?&]expire=([0-9]+)/);
      if (expMatch && Number(expMatch[1]) * 1000 <= Date.now()) targetUrl = memCached.url;
    }
  }

  const { valid, error } = await validateSafeUrl(targetUrl);
  if (!valid) return res.status(403).json({ error: error || 'SSRF verification failed' });

  let activeAbortController = new AbortController();
  let upstreamStream = null;
  const cleanupStream = () => {
    try {
      if (activeAbortController) activeAbortController.abort();
      if (upstreamStream && typeof upstreamStream.destroy === 'function') upstreamStream.destroy();
    } catch {}
  };

  req.on('close', () => { if (!res.writableEnded) cleanupStream(); });
  res.on('close', () => { if (!res.writableEnded) cleanupStream(); });
  res.on('error', cleanupStream);

  const getMatchingUserAgent = (url) => {
    if (url.includes('c=ANDROID_VR')) return 'Mozilla/5.0 (Linux; Android 12; Quest 3) AppleWebKit/537.36';
    if (url.includes('c=VISIONOS')) return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
    if (url.includes('c=ANDROID')) return 'com.google.android.youtube/20.01.35 (Linux; U; Android 11) gzip';
    if (url.includes('c=IOS')) return 'com.google.ios.youtube/20.01.35 (iPhone15,2; U; CPU iOS 18_0 like Mac OS X; en_US)';
    if (url.includes('googlevideo.com')) return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    return req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  };

  const applyStrictCors = () => {
    const clientOrigin = req.headers.origin;
    if (clientOrigin) {
      const isAllowed = clientOrigin.startsWith('http://localhost:') || clientOrigin.startsWith('http://127.0.0.1:') ||
        clientOrigin === 'tauri://localhost' || clientOrigin === 'https://tauri.localhost' ||
        clientOrigin.endsWith('.rivo.app') || clientOrigin.endsWith('.pages.dev') ||
        clientOrigin.endsWith('.railway.app') || clientOrigin.includes('duckdns.org');
      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', clientOrigin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
    }
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
  };

  const forwardStreamResponse = (streamResponse, sourceUrl) => {
    upstreamStream = streamResponse.data;
    upstreamStream.on('error', () => {
      cleanupStream();
      if (!res.headersSent) res.status(500).end();
    });

    res.status(streamResponse.status);
    if (streamResponse.status === 416) {
      if (streamResponse.headers['content-range']) res.setHeader('Content-Range', streamResponse.headers['content-range']);
      return res.end();
    }

    const isGoogleVid = sourceUrl.includes('googlevideo.com');
    const HOP_BY_HOP = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-authenticate', 'proxy-authorization'];
    for (const [key, value] of Object.entries(streamResponse.headers)) {
      const lowerKey = key.toLowerCase();
      if (!HOP_BY_HOP.includes(lowerKey)) {
        if (lowerKey === 'content-length' && isGoogleVid && streamResponse.status === 200 && !req.headers.range) continue;
        if (lowerKey === 'content-type' && (String(value).includes('video/mp4') || isGoogleVid)) {
          res.setHeader('Content-Type', 'audio/mp4');
          continue;
        }
        res.setHeader(key, value);
      }
    }
    applyStrictCors();
    streamResponse.data.pipe(res);
  };

  try {
    const headers = { 'User-Agent': getMatchingUserAgent(targetUrl) };
    if (req.headers.range && !targetUrl.includes('sndcdn.com') && !targetUrl.includes('soundcloud.')) {
      headers['Range'] = req.headers.range;
    }

    const response = await axios({
      method: 'get',
      url: targetUrl,
      responseType: 'stream',
      headers,
      signal: activeAbortController.signal,
      timeout: 180000,
      maxRedirects: 5,
      validateStatus: () => true
    });
    if (response.status >= 400 && response.status !== 416) {
      let errBody = '';
      try {
        const chunks = [];
        for await (const chunk of response.data) chunks.push(chunk);
        errBody = Buffer.concat(chunks).toString('utf-8');
      } catch {}
      console.error('[GOOGLEVIDEO ERROR STATUS]:', response.status, 'BODY:', errBody);
      throw new Error('GoogleVideo responded with ' + response.status + ': ' + errBody);
    }

    forwardStreamResponse(response, targetUrl);
  } catch (err) {
    cleanupStream();
    console.error('[STREAM PROXY ERROR]:', err.message, err.stack);

    const isTimeout = err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || (err.message && err.message.toLowerCase().includes('timeout'));
    if (isTimeout && !res.headersSent) {
      return res.status(504).json({ error: 'GATEWAY_TIMEOUT', message: 'Upstream stream request timed out' });
    }

    const isForbidden = err.response?.status === 403 || (err.message && err.message.includes('403'));
    if (!res.headersSent && !res.writableEnded && (isForbidden || videoId || title || artist)) {
      try {
        if (videoId) {
          clearStreamCache(videoId);
          invalidateAudioCache(videoId, false);
        }
        let freshDirect = videoId
          ? await resolveOfficialYouTubeAudioStream(videoId, title, artist, { bypassCache: true, bypassInnertube: isForbidden })
          : null;
        let freshResolved = freshDirect ? (freshDirect.url || String(freshDirect)) : null;

        if ((!freshResolved || freshResolved === targetUrl) && (title || artist)) {
          freshDirect = await resolveOfficialYouTubeAudioStream('', title, artist, {
            retryAlt: true,
            excludeVideoId: videoId,
            bypassCache: true,
            bypassInnertube: isForbidden
          });
          freshResolved = freshDirect ? (freshDirect.url || String(freshDirect)) : null;
        }

        if (freshResolved) {
          const aliasExp = Date.now() + 3 * 3600 * 1000;
          urlAliasMap.set(targetUrl, { renewedUrl: freshResolved, expiresAt: aliasExp });
          if (req.query.url && req.query.url !== targetUrl) {
            urlAliasMap.set(req.query.url, { renewedUrl: freshResolved, expiresAt: aliasExp });
          }
          if (urlAliasMap.size > 2000) urlAliasMap.clear();
          if (videoId) cacheStreamUrl(videoId, freshResolved);

          if (freshResolved.startsWith('/uploads/') || freshResolved.startsWith('uploads/')) {
            const localFile = safeResolveUpload(freshResolved, uploadsDir);
            if (localFile && fs.existsSync(localFile)) return res.sendFile(localFile);
          } else if ((freshResolved.startsWith('http://') || freshResolved.startsWith('https://')) && freshResolved !== targetUrl) {
            const { valid: freshValid } = await validateSafeUrl(freshResolved);
            if (freshValid && !res.headersSent && !res.writableEnded) {
              activeAbortController = new AbortController();
              const freshHeaders = { 'User-Agent': getMatchingUserAgent(freshResolved) };
              if (req.headers.range && !freshResolved.includes('sndcdn.com') && !freshResolved.includes('soundcloud.')) {
                freshHeaders['Range'] = req.headers.range;
              }
              const freshResponse = await axios({
                method: 'get',
                url: freshResolved,
                responseType: 'stream',
                headers: freshHeaders,
                signal: activeAbortController.signal,
                timeout: 180000,
                maxRedirects: 5,
                validateStatus: (status) => status < 400 || status === 416
              });
              return forwardStreamResponse(freshResponse, freshResolved);
            }
          }
        }
      } catch {}
    }
    applyStrictCors();
    if (!res.headersSent) res.status(500).send('Proxy streaming failed');
  }
});

router.urlAliasMap = urlAliasMap;
module.exports = router;
