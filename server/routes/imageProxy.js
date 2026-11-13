const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateSafeUrl } = require('../utils/security');

const cacheDir = path.join(__dirname, '../../uploads/image-cache');
if (!fs.existsSync(cacheDir)) {
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
  } catch {}
}

const negativeCache = new Map();

router.get('/', async (req, res) => {
  const rawUrl = req.query.url;
  if (!rawUrl || typeof rawUrl !== 'string') {
    return res.status(400).json({ error: 'url parameter is required' });
  }

  const requestedWidth = Math.min(1200, Math.max(100, parseInt(req.query.w, 10) || 300));

  let optimizedUrl = rawUrl.trim();
  if (optimizedUrl.includes('mzstatic.com')) {
    optimizedUrl = optimizedUrl.replace(/\/\d+x\d+bb\.(jpg|png)/i, `/${requestedWidth}x${requestedWidth}bb.$1`);
  } else if (optimizedUrl.includes('googleusercontent.com')) {
    optimizedUrl = optimizedUrl.replace(/=w\d+-h\d+[^?&]*/i, `=w${requestedWidth}-h${requestedWidth}-l90-rj`);
  } else if (optimizedUrl.includes('ytimg.com') && optimizedUrl.includes('maxresdefault.jpg')) {
    optimizedUrl = optimizedUrl.replace('maxresdefault.jpg', 'hqdefault.jpg');
  }

  const cacheKey = crypto.createHash('md5').update(`${optimizedUrl}_w${requestedWidth}`).digest('hex');
  const cachePath = path.join(cacheDir, `${cacheKey}.jpg`);

  if (negativeCache.has(cacheKey) && Date.now() - negativeCache.get(cacheKey) < 60000) {
    return res.status(404).end();
  }

  // 1. Instant Disk Cache Hit (<2ms response)
  if (fs.existsSync(cachePath)) {
    try {
      const stats = fs.statSync(cachePath);
      if (stats.size > 500) {
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.sendFile(cachePath);
      }
    } catch {}
  }

  const safeCheck = await validateSafeUrl(optimizedUrl);
  if (!safeCheck || !safeCheck.valid) {
    return res.status(403).json({ error: safeCheck?.error || 'Access to URL blocked' });
  }

  try {
    const upstreamRes = await axios({
      method: 'get',
      url: optimizedUrl,
      responseType: 'arraybuffer',
      timeout: 7000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      validateStatus: (s) => s === 200
    });

    const contentType = upstreamRes.headers['content-type'] || 'image/jpeg';
    const buffer = Buffer.from(upstreamRes.data);

    fs.writeFile(cachePath, buffer, () => {});

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.end(buffer);
  } catch (err) {
    negativeCache.set(cacheKey, Date.now());
    return res.status(404).json({ error: 'Failed to fetch image upstream' });
  }
});

module.exports = router;
