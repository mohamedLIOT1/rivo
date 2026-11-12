const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execFile } = require('child_process');
const { getCanonicalArtistName } = require('./artistAlbumUtils');
const { getYtDlpBin } = require('./ytDlpWorker');
const { getCookiesPath } = require('./audioCacheUtils');

// Multi-Key YouTube API Manager with automatic failover and rotation
function getYouTubeApiKeys() {
  const rawList = process.env.YOUTUBE_API_KEYS || process.env.YOUTUBE_API_KEY || '';
  const parsed = rawList.split(',').map(k => k.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  if (parsed.length === 0) {
    parsed.push('AIzaSyBMoZQ5TZxtIQLeOj-Kia-WmP1C4b2Ite0');
  }
  return parsed;
}

const keyQuotaExceededMap = new Map();
let currentKeyIndex = 0;

function getActiveYouTubeApiKey() {
  const keys = getYouTubeApiKeys();
  if (keys.length === 0) return null;
  const now = Date.now();
  for (let i = 0; i < keys.length; i++) {
    const idx = (currentKeyIndex + i) % keys.length;
    const key = keys[idx];
    const cooldown = keyQuotaExceededMap.get(key) || 0;
    if (now > cooldown) {
      currentKeyIndex = idx;
      return key;
    }
  }
  return null;
}

function markYouTubeApiKeyExceeded(key, hours = 4) {
  if (!key) return;
  const cooldownUntil = Date.now() + hours * 3600 * 1000;
  keyQuotaExceededMap.set(key, cooldownUntil);
  console.warn(`[YouTube API Rotation] Key ...${key.slice(-6)} reached quota limit! Rotating key (cooldown: ${hours}h)`);
  const keys = getYouTubeApiKeys();
  if (keys.length > 0) {
    currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  }
}

function calculateTitleSimilarity(targetTitle = '', candTitle = '', targetArtist = '') {
  const t = String(targetTitle || '').toLowerCase().replace(/[/\\?%*:|"<>_()\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
  const c = String(candTitle || '').toLowerCase().replace(/[/\\?%*:|"<>_()\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
  const a = String(targetArtist || '').toLowerCase().replace(/[/\\?%*:|"<>_()\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || !c) return 0;
  if (c === t) return 1.0;

  const tTokens = t.split(/\s+/).filter(w => w.length > 1);
  const cTokens = c.split(/\s+/).filter(w => w.length > 1);
  if (tTokens.length === 0) return 0;

  let matched = 0;
  for (const tok of tTokens) {
    if (cTokens.includes(tok) || c.includes(tok)) matched++;
  }
  const tokenRecall = matched / tTokens.length;
  // Dice coefficient to penalize candidate titles with bloated compilations / extra songs
  const dice = (2 * matched) / (tTokens.length + Math.min(cTokens.length, tTokens.length * 2.5));
  let score = (tokenRecall * 0.6) + (dice * 0.4);

  if (c.includes(t)) {
    if (cTokens.length <= tTokens.length + 3) {
      score = Math.max(score, 0.95);
    } else {
      score = Math.max(score, 0.7);
    }
  }

  if (a && (c.includes(a) || cTokens.includes(a))) {
    score = Math.min(1.0, score + 0.15);
  }
  return Math.min(1.0, score);
}

const ytSearchCache = new Map();

async function searchYouTubeId(queryOrOptions, maybeOptions = {}) {
  let query = '';
  let targetDuration = null;
  let artist = '';
  let title = '';
  let strictCatalogDuration = false;
  let excludeVideoIds = [];

  if (queryOrOptions && typeof queryOrOptions === 'object') {
    query = queryOrOptions.query || '';
    targetDuration = Number(queryOrOptions.targetDuration || queryOrOptions.duration) || null;
    artist = queryOrOptions.artist || '';
    title = queryOrOptions.title || '';
    strictCatalogDuration = Boolean(queryOrOptions.strictCatalogDuration);
    if (queryOrOptions.excludeVideoIds) {
      excludeVideoIds = Array.isArray(queryOrOptions.excludeVideoIds) ? queryOrOptions.excludeVideoIds : [queryOrOptions.excludeVideoIds];
    } else if (queryOrOptions.excludeVideoId) {
      excludeVideoIds = [queryOrOptions.excludeVideoId];
    }
  } else if (typeof queryOrOptions === 'string') {
    query = queryOrOptions.trim();
    if (typeof maybeOptions === 'number') {
      targetDuration = maybeOptions;
    } else if (typeof maybeOptions === 'string') {
      artist = maybeOptions.trim();
    } else if (maybeOptions && typeof maybeOptions === 'object') {
      targetDuration = Number(maybeOptions.targetDuration || maybeOptions.duration) || null;
      artist = maybeOptions.artist || '';
      title = maybeOptions.title || '';
      strictCatalogDuration = Boolean(maybeOptions.strictCatalogDuration);
      if (maybeOptions.excludeVideoIds) {
        excludeVideoIds = Array.isArray(maybeOptions.excludeVideoIds) ? maybeOptions.excludeVideoIds : [maybeOptions.excludeVideoIds];
      } else if (maybeOptions.excludeVideoId) {
        excludeVideoIds = [maybeOptions.excludeVideoId];
      }
    }
  }
  excludeVideoIds = excludeVideoIds.map(x => String(x).trim()).filter(Boolean);

  if (!artist && !title && query && query.includes(' - ')) {
    const parts = query.split(' - ');
    artist = parts[0].trim();
    title = parts.slice(1).join(' - ').trim();
  }

  const normArt = getCanonicalArtistName(artist);
  const cleanArt = String(normArt || artist || '').replace(/official|offical|topic|vevo|channel/gi, '').replace(/["']/g, ' ').trim();
  const cleanTit = String(title || '').replace(/["']/g, ' ').trim();

  const searchQueries = [];
  if (cleanArt && cleanTit) {
    searchQueries.push(`${cleanArt} ${cleanTit} Topic`);
    searchQueries.push(`${cleanArt} ${cleanTit} official audio`);
    searchQueries.push(`"${cleanArt}" "${cleanTit}"`);
    searchQueries.push(`${cleanArt} ${cleanTit}`);
  } else if (cleanTit) {
    searchQueries.push(`${cleanTit} official audio`);
    searchQueries.push(cleanTit);
  } else if (query) {
    const cleanQ = query.replace(/\s+music$/i, '').trim();
    searchQueries.push(`${cleanQ} official audio`);
    searchQueries.push(cleanQ);
  }

  if (searchQueries.length === 0) return null;

  const cacheKey = `${searchQueries[0]}_${targetDuration || ''}${excludeVideoIds.length ? '_ex_' + excludeVideoIds.join(',') : ''}`.toLowerCase();
  if (ytSearchCache.has(cacheKey)) {
    const cachedVal = ytSearchCache.get(cacheKey);
    const cachedId = String(cachedVal?.videoId || cachedVal?.id || cachedVal || '');
    if (!excludeVideoIds.includes(cachedId)) {
      return cachedVal;
    }
  }

  const parseSec = (renderer) => {
    const durText = renderer.lengthText?.simpleText || renderer.lengthText?.runs?.[0]?.text || '';
    if (!durText) return 0;
    const parts = durText.split(':').map(p => parseInt(p, 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return parts[0] * 60 + parts[1];
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  };

  const normArtist = cleanArt.toLowerCase();
  const normTitle = cleanTit.toLowerCase();
  let hadInnertubeCandidates = false;
  let scoredCandidates = [];

  // 1. Ultra-fast Innertube search with dual query & strict duration filtering
  for (const finalQuery of searchQueries) {
    try {
      const key = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
      const itRes = await axios.post(`https://www.youtube.com/youtubei/v1/search?key=${key}`, {
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20231201.00.00',
            hl: 'en',
            gl: 'US'
          }
        },
        query: finalQuery
      }, { timeout: 3500 });

      const contents = itRes.data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
      const candidates = contents.map(c => c.videoRenderer).filter(v => v && v.videoId && !excludeVideoIds.includes(v.videoId));

      if (candidates.length > 0) {
        hadInnertubeCandidates = true;
        scoredCandidates = candidates.map(item => {
          const vidId = item.videoId;
          const durSec = parseSec(item);
          const candTitle = (item.title?.runs?.[0]?.text || '').toLowerCase();
          const candChannel = (item.ownerText?.runs?.[0]?.text || '').toLowerCase();

          let score = 0;
          let durationDiff = targetDuration && durSec > 0 ? Math.abs(durSec - targetDuration) : null;
          const similarity = calculateTitleSimilarity(cleanTit, candTitle, cleanArt);

          if (durationDiff !== null) {
            if (durationDiff <= 5) score += 60;
            else if (durationDiff <= 15) score += 40;
            else if (durationDiff <= 25) score += 10;
            else score -= 200; // Over 25s difference rejected
          }

          score += Math.round(similarity * 50);

          if (normTitle && candTitle.includes(normTitle)) score += 40;
          if (normArtist && (candTitle.includes(normArtist) || candChannel.includes(normArtist))) score += 30;

          if (candChannel.includes('topic')) {
            if (normArtist && (candChannel.includes(normArtist) || candTitle.includes(normArtist))) {
              score += 90;
            } else if (normArtist) {
              score -= 150; // Topic channel belonging to a completely different artist!
            } else {
              score += 20;
            }
          } else if (candChannel.includes('official') || candChannel.includes('vevo')) {
            if (normArtist && (candChannel.includes(normArtist) || candTitle.includes(normArtist))) {
              score += 40;
            } else {
              score += 10;
            }
          }

          if (candTitle.includes('official audio') || candTitle.includes('audio')) score += 70;
          else if (candTitle.includes('official lyric') || candTitle.includes('lyrics')) score += 30;
          else if (candTitle.includes('official video') || candTitle.includes('music video') || candTitle.includes('video') || candTitle.includes('كليب')) score -= 40;

          const isUnwantedModifier = !normTitle.includes('remix') && !normTitle.includes('ريمكس') &&
            (candTitle.includes('remix') || candTitle.includes('ريمكس') || candTitle.includes('slowed') || candTitle.includes('reverb') || candTitle.includes('cover') || candTitle.includes('كفر') || candTitle.includes('karaoke') || candTitle.includes('حفلة') || candTitle.includes('live') || candTitle.includes('concert'));
          if (isUnwantedModifier) score -= 250;

          // Multi-song compilations / medleys
          const isCompilation = /(?:كاملة|حفلة\s*كاملة|ألبوم\s*كامل|سهرة|تجميعة|ميدلي|medley|full\s*concert|full\s*live|full\s*album|greatest\s*hits)/i.test(candTitle);
          if (!normTitle.includes('حفلة') && !normTitle.includes('live') && isCompilation) score -= 400;

          if (!normTitle.includes('mix') && (candTitle.includes('mix') || candTitle.includes('full album') || candTitle.includes('playlist'))) score -= 150;
          
          // Strict protection against concerts/long videos matching single songs:
          if (durSec > 600 && (!targetDuration || targetDuration < 600)) score -= 500;
          if (durSec > 900 && (!targetDuration || targetDuration < 900)) score -= 600;

          // Calculate match confidence (0.0 to 1.0)
          let confidence = similarity * 0.6;
          if (durationDiff !== null) {
            if (durationDiff <= 5) confidence += 0.4;
            else if (durationDiff <= 15) confidence += 0.35;
            else if (durationDiff <= 25) confidence += 0.15;
          } else if (similarity >= 0.7) {
            confidence += 0.3;
          }

          return {
            videoId: vidId,
            duration: durSec || null,
            title: candTitle,
            channel: candChannel,
            score,
            durationDiff,
            similarity,
            confidence: Math.min(1.0, confidence)
          };
        });

        // Duration & title filter:
        scoredCandidates = scoredCandidates.filter(c => {
          if (excludeVideoIds.includes(c.videoId)) return false;
          // Reject videos over 10 minutes when looking for a normal single song
          if ((!targetDuration || targetDuration < 600) && c.duration && c.duration > 660) return false;
          if (targetDuration && c.durationDiff !== null) {
            if (c.similarity >= 0.35 && c.durationDiff <= 60) return true;
            if (c.durationDiff > 45) return false;
            if (c.durationDiff > 15 && c.similarity < 0.4) return false;
          }
          if (cleanTit && c.similarity < 0.25) return false;
          return true;
        });

        if (scoredCandidates.length > 0) {
          scoredCandidates.sort((a, b) => b.score - a.score);
          const best = scoredCandidates[0];
          if (best && best.videoId) {
            if (ytSearchCache.size > 5000) ytSearchCache.clear();
            const resObj = new String(best.videoId);
            resObj.id = best.videoId;
            resObj.videoId = best.videoId;
            resObj.duration = best.duration || null;
            resObj.confidence = best.confidence;
            resObj.durationDiff = best.durationDiff;
            ytSearchCache.set(cacheKey, resObj);
            return resObj;
          }
        }
      }
    } catch (err) {}
  }

  if (strictCatalogDuration && targetDuration && hadInnertubeCandidates && scoredCandidates.length === 0) {
    return null;
  }

  const finalQuery = searchQueries[0];

  // 2. Fallback: YouTube Data API v3 with automatic key rotation
  const apiKey = getActiveYouTubeApiKey();
  if (apiKey) {
    try {
      const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          q: finalQuery,
          type: 'video',
          maxResults: 5,
          key: apiKey
        },
        timeout: 3000
      });
      const items = res.data?.items || [];
      if (items.length > 0) {
        let bestId = null;
        const normArtistLower = (artist || '').toLowerCase();
        const normTitleLower = (title || '').toLowerCase();
        for (const it of items) {
          const itVid = it.id?.videoId;
          if (!itVid || excludeVideoIds.includes(itVid)) continue;
          const t = (it.snippet?.title || '').toLowerCase();
          if (normTitleLower && t.includes(normTitleLower)) {
            bestId = itVid;
            break;
          }
          if (!bestId) bestId = itVid;
        }
        if (bestId && bestId.length === 11) {
          if (ytSearchCache.size > 5000) ytSearchCache.clear();
          ytSearchCache.set(cacheKey, bestId);
          return bestId;
        }
      }
    } catch (err) {
      const errMsg = err?.response?.data?.error?.message || err.message;
      if (err?.response?.status === 403 || /quota/i.test(errMsg)) {
        markYouTubeApiKeyExceeded(apiKey);
      }
    }
  }

  // 3. Fallback: Scraping results with strict title verification
  try {
    const res = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(finalQuery)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 3500
    });
    // Extract videoId and title pairings from videoRenderer JSON blocks in the HTML
    const videoBlocks = [...res.data.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"[^}]+?"title":\{"runs":\[\{"text":"([^"]+)"/g)];
    for (const vb of videoBlocks) {
      const vid = vb[1];
      const tit = vb[2];
      if (excludeVideoIds.includes(vid)) continue;
      const sim = calculateTitleSimilarity(cleanTit, tit, cleanArt);
      if (sim >= 0.35) {
        if (ytSearchCache.size > 5000) ytSearchCache.clear();
        ytSearchCache.set(cacheKey, vid);
        return vid;
      }
    }
  } catch (err) {}

  // 4. Fallback: yt-dlp
  try {
    const bin = getYtDlpBin();
    const cookiesPath = getCookiesPath();
    const simpleQ = `${cleanArt} ${cleanTit}`.trim() || finalQuery;
    const ytdlpArgs = [
        '--no-check-certificates',
      '--no-playlist',
      '--extractor-args', 'youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416',
      '--get-id',
      `ytsearch1:${simpleQ}`
    ];
    if (cookiesPath && fs.existsSync(cookiesPath)) {
      ytdlpArgs.splice(1, 0, '--cookies', cookiesPath);
    }

    const videoId = await new Promise((resolve) => {
      execFile(bin, ytdlpArgs, { timeout: 10000 }, (err, stdout) => {
        if (err || !stdout) return resolve(null);
        const lines = stdout.trim().split(/\r?\n/);
        const id = lines.find(l => /^[a-zA-Z0-9_-]{11}$/.test(l.trim()));
        resolve(id?.trim() || null);
      });
    });

    if (videoId) {
      if (ytSearchCache.size > 5000) ytSearchCache.clear();
      ytSearchCache.set(cacheKey, videoId);
      return videoId;
    }
  } catch (err) {}

  return null;
}

module.exports = {
  getYouTubeApiKeys,
  getActiveYouTubeApiKey,
  markYouTubeApiKeyExceeded,
  calculateTitleSimilarity,
  searchYouTubeId
};
