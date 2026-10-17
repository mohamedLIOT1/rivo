import os

path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'server', 'utils', 'helpers.js')
with open(path, 'r', encoding='utf-8') as f:
    code = f.read()

# Replace searchYouTubeId
old_start = "async function searchYouTubeId(query) {"
old_end = "async function fetchTrackCover(title, artist) {"

new_search = '''async function searchYouTubeId(queryOrOptions, maybeOptions = {}) {
  let query = '';
  let targetDuration = null;
  let artist = '';
  let title = '';

  if (queryOrOptions && typeof queryOrOptions === 'object') {
    query = queryOrOptions.query || '';
    targetDuration = Number(queryOrOptions.targetDuration || queryOrOptions.duration) || null;
    artist = queryOrOptions.artist || '';
    title = queryOrOptions.title || '';
  } else if (typeof queryOrOptions === 'string') {
    query = queryOrOptions.trim();
    if (typeof maybeOptions === 'number') {
      targetDuration = maybeOptions;
    } else if (maybeOptions && typeof maybeOptions === 'object') {
      targetDuration = Number(maybeOptions.targetDuration || maybeOptions.duration) || null;
      artist = maybeOptions.artist || '';
      title = maybeOptions.title || '';
    }
  }

  if (!artist && !title && query && query.includes(' - ')) {
    const parts = query.split(' - ');
    artist = parts[0].trim();
    title = parts.slice(1).join(' - ').trim();
  }

  const cleanArt = String(artist || '').replace(/["']/g, ' ').trim();
  const cleanTit = String(title || '').replace(/["']/g, ' ').trim();

  const searchQueries = [];
  if (cleanArt && cleanTit) {
    searchQueries.push(`"${cleanArt}" "${cleanTit}"`);
    searchQueries.push(`"${cleanTit}" ${cleanArt} official audio`);
  } else if (query) {
    const cleanQ = query.replace(/\\s+music$/i, '').trim();
    searchQueries.push(cleanQ);
    searchQueries.push(`${cleanQ} official audio`);
  }

  if (searchQueries.length === 0) return null;

  const cacheKey = `${searchQueries[0]}_${targetDuration || ''}`.toLowerCase();
  if (ytSearchCache.has(cacheKey)) {
    return ytSearchCache.get(cacheKey);
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
      const candidates = contents.map(c => c.videoRenderer).filter(v => v && v.videoId);

      if (candidates.length > 0) {
        hadInnertubeCandidates = true;
        let scoredCandidates = candidates.map(item => {
          const vidId = item.videoId;
          const durSec = parseSec(item);
          const candTitle = (item.title?.runs?.[0]?.text || '').toLowerCase();
          const candChannel = (item.ownerText?.runs?.[0]?.text || '').toLowerCase();

          let score = 0;
          let durationDiff = targetDuration && durSec > 0 ? Math.abs(durSec - targetDuration) : null;

          if (durationDiff !== null) {
            if (durationDiff <= 5) score += 50;
            else if (durationDiff <= 15) score += 30;
            else if (durationDiff <= 35) score += 15;
            else if (durationDiff > 60) score -= 200; // Strict duration filter: reject videos > 60s difference!
          }

          if (normTitle && candTitle.includes(normTitle)) score += 40;
          if (normArtist && (candTitle.includes(normArtist) || candChannel.includes(normArtist))) score += 30;

          if (candChannel.includes('topic') || candChannel.includes('official') || candChannel.includes('vevo')) score += 30;
          if (candTitle.includes('official audio') || candTitle.includes('official lyric') || candTitle.includes('official video')) score += 20;

          if (!normTitle.includes('mix') && (candTitle.includes('mix') || candTitle.includes('full album') || candTitle.includes('playlist'))) score -= 100;
          if (!normTitle.includes('live') && candTitle.includes('live') && !normTitle.includes('حفلة')) score -= 50;
          if (durSec > 900 && (!targetDuration || targetDuration < 900)) score -= 100;

          return {
            videoId: vidId,
            duration: durSec || null,
            title: candTitle,
            channel: candChannel,
            score,
            durationDiff
          };
        });

        // Strict duration filter: Reject any candidate with durationDiff > 60s
        if (targetDuration) {
          scoredCandidates = scoredCandidates.filter(c => c.durationDiff === null || c.durationDiff <= 60);
        }

        if (scoredCandidates.length > 0) {
          scoredCandidates.sort((a, b) => b.score - a.score);
          const best = scoredCandidates[0];
          if (best && best.videoId) {
            if (ytSearchCache.size > 5000) ytSearchCache.clear();
            ytSearchCache.set(cacheKey, best.videoId);
            return best.videoId;
          }
        }
      }
    } catch (err) {}
  }

  // If Innertube searched and returned video candidates, but none matched the catalog duration (diff <= 60s),
  // NEVER fall back to blind scrapers or unverified API results!
  if (targetDuration && hadInnertubeCandidates) {
    return null;
  }

  const finalQuery = searchQueries[0];

  // 2. Fallback: YouTube Data API v3
  const apiKey = process.env.YOUTUBE_API_KEY || 'AIzaSyD9GLRXh9UgmhFbuhNqRfr-WPIT3QlWxJs';
  if (apiKey && Date.now() > ytQuotaExceededUntil) {
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
        let bestId = items[0]?.id?.videoId;
        const normArtist = (artist || '').toLowerCase();
        const normTitle = (title || '').toLowerCase();
        for (const it of items) {
          const t = (it.snippet?.title || '').toLowerCase();
          if (normTitle && t.includes(normTitle)) {
            bestId = it.id?.videoId;
            break;
          }
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
        ytQuotaExceededUntil = Date.now() + 2 * 3600 * 1000;
      }
    }
  }

  // 3. Fallback: Scraping results
  try {
    const res = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(finalQuery)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 3000
    });
    const matches = [...res.data.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map(m => m[1]);
    const valid = matches.filter(id => id && id.length === 11);
    if (valid[0]) {
      if (ytSearchCache.size > 5000) ytSearchCache.clear();
      ytSearchCache.set(cacheKey, valid[0]);
      return valid[0];
    }
  } catch (err) {}

  // 4. Fallback: yt-dlp
  try {
    const bin = getYtDlpBin();
    const cookiesPath = path.join(__dirname, '../../cookies.txt');
    const ytdlpArgs = ['--no-check-certificates', '--get-id', `ytsearch1:${finalQuery}`];
    if (fs.existsSync(cookiesPath)) {
      ytdlpArgs.splice(1, 0, '--cookies', cookiesPath);
    }

    const videoId = await new Promise((resolve) => {
      execFile(bin, ytdlpArgs, { timeout: 6000 }, (err, stdout) => {
        if (err || !stdout) return resolve(null);
        const lines = stdout.trim().split(/\\r?\\n/);
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

'''

if old_start in code and old_end in code:
    before = code[:code.index(old_start)]
    after = code[code.index(old_end):]
    code = before + new_search + after

# Also update resolveOfficialYouTubeAudioStream
old_res_start = "async function resolveOfficialYouTubeAudioStream(rawUrl, title = '', artist = '') {"
new_res_start = """async function resolveOfficialYouTubeAudioStream(rawUrl, title = '', artist = '', options = {}) {
  const targetDuration = Number(options?.duration || options?.targetDuration) || null;
  const defaultDur = targetDuration && targetDuration > 0 ? targetDuration : 209;"""

code = code.replace(old_res_start, new_res_start)

# In resolveOfficialYouTubeAudioStream, replace searchYouTubeId call
old_search_call = "videoId = await searchYouTubeId(`${artist || ''} ${title || ''}`.trim());"
new_search_call = "videoId = await searchYouTubeId({ artist, title, targetDuration });"
code = code.replace(old_search_call, new_search_call)

# In resolveOfficialYouTubeAudioStream, replace retObj.duration = 210; with retObj.duration = defaultDur;
code = code.replace("retObj.duration = 210;", "retObj.duration = defaultDur;")

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)

print("helpers.js cleanly patched")
