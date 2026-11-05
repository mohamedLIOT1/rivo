const axios = require('axios');
const { getCanonicalArtistName } = require('./artistAlbumUtils');

function parseLrc(lrcString) {
  if (!lrcString) return [];
  const lines = lrcString.split('\n');
  const result = [];
  for (const line of lines) {
    const match = line.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseFloat(match[2]);
      const time = Math.round((minutes * 60 + seconds) * 10) / 10;
      const text = match[3].trim();
      if (text) result.push({ time, text });
    }
  }
  return result;
}

function parsePlain(plainString, duration = 180) {
  if (!plainString) return [];
  const lines = plainString.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const step = duration / lines.length;
  return lines.map((text, idx) => ({
    time: Math.round(idx * step),
    text
  }));
}

function cleanLyricsMetadata(rawTitle, rawArtist) {
  let title = String(rawTitle || '').trim();
  let artist = String(rawArtist || '').trim();

  // Strip YouTube tags
  title = title
    .replace(/\s*[\(\[](?:official\s*(?:music\s*)?(?:video|audio|lyrics?|visualizer|clip)?|audio|video|clip|كليب|فيديو|رسمي|hd|4k|hq)[\)\]]/gi, '')
    .replace(/(?:ft\.?|feat\.?|featuring)\s+[^|\-]+/gi, '')
    .trim();

  const isSuspiciousArtist = (a) => !a || a.includes('_') || /topic|channel|vevo|records|prod|beats/i.test(a) || a.toLowerCase() === 'various artists' || a.toLowerCase() === 'youtube';

  const rawParts = title.split('|').map(s => s.trim()).filter(Boolean);
  const parts = rawParts.filter(p => !isSuspiciousArtist(p) && !/prod\.?\s*by/i.test(p));

  let arabicPart = '';
  let latinPart = '';
  let candidateTitle = parts.length > 0 ? parts[0] : (rawParts[0] || title);
  let detectedArtist = '';

  for (const p of parts) {
    if (/[\u0600-\u06FF]/.test(p) && !arabicPart) {
      arabicPart = p;
    } else if (/[a-zA-Z]/.test(p) && !latinPart) {
      latinPart = p;
    }
  }

  for (const p of [candidateTitle, ...parts]) {
    const dashMatch = p.match(/^([^\n]+?)\s+-\s+(.+)$/);
    if (dashMatch) {
      const possibleArtist = dashMatch[1].replace(/x[a-zA-Z0-9_\s]+/i, '').trim();
      const possibleTitle = dashMatch[2].trim();
      if (possibleArtist && (isSuspiciousArtist(artist) || !detectedArtist)) {
        detectedArtist = possibleArtist;
      }
      candidateTitle = possibleTitle;
      break;
    }
  }

  if (arabicPart) {
    const arDash = arabicPart.match(/^([^\n]+?)\s+-\s+(.+)$/);
    if (arDash) {
      if (isSuspiciousArtist(artist) && !detectedArtist) detectedArtist = arDash[1].trim();
      arabicPart = arDash[2].trim();
    }
  }

  const finalArtist = isSuspiciousArtist(artist) ? (detectedArtist || '') : (detectedArtist || artist);
  const canonicalArt = getCanonicalArtistName(finalArtist) || finalArtist;

  return {
    cleanTitle: candidateTitle.replace(/[/\\?%*:|"<>_]/g, ' ').replace(/\s+/g, ' ').trim(),
    cleanArtist: canonicalArt.replace(/[/\\?%*:|"<>_]/g, ' ').replace(/\s+/g, ' ').trim(),
    arabicTitle: arabicPart.replace(/[/\\?%*:|"<>_]/g, ' ').replace(/\s+/g, ' ').trim(),
    latinTitle: latinPart.replace(/[/\\?%*:|"<>_]/g, ' ').replace(/\s+/g, ' ').trim()
  };
}

async function fetchLrclibLyrics(title, artist, duration = 180) {
  if (!title) return [];
  const meta = cleanLyricsMetadata(title, artist);

  // 1. Direct /api/get for instant synced lyrics
  const targetTracks = [meta.cleanTitle, meta.arabicTitle, title].filter(Boolean);
  const targetArtists = [meta.cleanArtist, artist].filter(Boolean);

  for (const t of targetTracks) {
    for (const a of targetArtists) {
      try {
        const getRes = await axios.get('https://lrclib.net/api/get', {
          params: { track_name: t, artist_name: a },
          headers: { 'User-Agent': 'RivoApp/1.0 (https://github.com/mohamedLIOT1/Rivo)' },
          timeout: 3500
        });
        if (getRes.data?.syncedLyrics) {
          return parseLrc(getRes.data.syncedLyrics);
        }
        if (getRes.data?.plainLyrics) {
          return parsePlain(getRes.data.plainLyrics, duration);
        }
      } catch (err) {}
    }
  }

  // 2. /api/search fallback
  const queries = [
    meta.cleanArtist && meta.cleanTitle ? `${meta.cleanArtist} ${meta.cleanTitle}` : null,
    meta.cleanArtist && meta.arabicTitle ? `${meta.cleanArtist} ${meta.arabicTitle}` : null,
    meta.cleanTitle,
    meta.arabicTitle,
    meta.latinTitle
  ].filter(Boolean);

  const uniqueQueries = [...new Set(queries)];
  for (const q of uniqueQueries) {
    try {
      const res = await axios.get('https://lrclib.net/api/search', {
        params: { q },
        headers: { 'User-Agent': 'RivoApp/1.0 (https://github.com/mohamedLIOT1/Rivo)' },
        timeout: 4000
      });
      const items = res.data || [];
      for (const item of items) {
        if (item.syncedLyrics) return parseLrc(item.syncedLyrics);
        if (item.plainLyrics) return parsePlain(item.plainLyrics, duration);
      }
    } catch (err) {}
  }

  if (meta.cleanArtist && meta.cleanTitle) {
    try {
      const ovhRes = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(meta.cleanArtist)}/${encodeURIComponent(meta.cleanTitle)}`, {
        timeout: 3500
      });
      if (ovhRes.data?.lyrics) {
        return parsePlain(ovhRes.data.lyrics, duration);
      }
    } catch {}
  }

  return [];
}

async function fetchGeniusLyrics(title, artist, duration = 180) {
  if (!title && !artist) return [];
  const meta = cleanLyricsMetadata(title, artist);

  const queries = [
    meta.cleanArtist && meta.cleanTitle ? `${meta.cleanArtist} ${meta.cleanTitle}` : null,
    meta.cleanArtist && meta.arabicTitle ? `${meta.cleanArtist} ${meta.arabicTitle}` : null,
    meta.arabicTitle,
    meta.cleanTitle,
    meta.latinTitle
  ].filter(Boolean);

  const uniqueQueries = [...new Set(queries)];
  for (const q of uniqueQueries) {
    try {
      const res = await axios.get('https://genius.com/api/search', {
        params: { q },
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        timeout: 7000
      });
      const hits = res.data?.response?.hits || [];
      if (hits.length > 0 && hits[0].result?.url) {
        const songUrl = hits[0].result.url;
        const pageRes = await axios.get(songUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
          timeout: 7000
        });
        const html = pageRes.data;
        const regex = /<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/g;
        let match;
        let rawHtml = '';
        while ((match = regex.exec(html)) !== null) {
          rawHtml += match[1] + '\n';
        }
        if (rawHtml) {
          const cleanText = rawHtml
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&#x27;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .trim();
          if (cleanText && cleanText.length > 20) {
            const lines = cleanText
              .split(/\r?\n/)
              .map(l => l.trim())
              .filter(l => l.length > 0 && !/^\[.*\]$/.test(l) && !/^\d+\s*contributors?$/i.test(l) && !/^lyrics$/i.test(l));
            if (lines.length > 0) {
              const step = Math.max(2, duration / (lines.length + 1));
              return lines.map((text, idx) => ({
                time: Math.round(idx * step * 10) / 10,
                text
              }));
            }
          }
        }
      }
    } catch (err) {}
  }
  return [];
}

module.exports = {
  parseLrc,
  parsePlain,
  cleanLyricsMetadata,
  fetchLrclibLyrics,
  fetchGeniusLyrics
};
