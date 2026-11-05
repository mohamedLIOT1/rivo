const axios = require('axios');
const { Track } = require('../models');
const { isMusicTrackServer } = require('./trackMetadataUtils');
const { getActiveYouTubeApiKey, markYouTubeApiKeyExceeded } = require('./youtubeSearch');

const searchCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function searchTracksInternal(query) {
  let q = (query || '').trim();
  if (!q) return [];

  let targetQuery = q;
  if (/^(pop|the pop|pop music|pops|بوب|بوب عربي|arabic pop)$/i.test(q)) {
    targetQuery = 'أغاني بوب عربي عمرو دياب تامر حسني';
  } else if (q === 'بوب') {
    targetQuery = 'أغاني بوب عربي';
  }

  const cacheKey = q.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.tracks.filter(t => isMusicTrackServer(t.title, t.artist));
  }

  try {
    const fuzzyChars = q.trim().replace(/[-_.'"`!?:;,/\\~@#$%^&*()[\]{}|<>+=]/g, '').split('');
    const fuzzyPattern = fuzzyChars.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[-_\\s]*');
    const fuzzyRegex = new RegExp(fuzzyPattern, 'i');
    const exactRegex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const dbTracks = await Track.find({
      $or: [
        { title: { $regex: exactRegex } },
        { artist: { $regex: exactRegex } },
        { title: { $regex: fuzzyRegex } },
        { artist: { $regex: fuzzyRegex } }
      ]
    }).limit(15).lean();

    const formattedDbTracks = dbTracks
      .filter(t => isMusicTrackServer(t.title, t.artist))
      .map(t => ({
        id: String(t._id),
        title: t.title,
        artist: t.artist,
        album: t.album || 'Single',
        cover: t.cover,
        audioUrl: t.audioUrl,
        duration: t.duration || 180,
        lyrics: t.lyrics || [],
        bpm: t.bpm,
        key: t.key,
        source: t.source || (t.audioUrl && (t.audioUrl.startsWith('/uploads/') || t.audioUrl.includes('/uploads/')) ? 'Upload' : 'Rivo')
      }));

    let ytTracks = [];
    const apiKey = getActiveYouTubeApiKey();
    if (apiKey) {
      try {
        const ytRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
          params: {
            part: 'snippet',
            q: `${targetQuery}`,
            type: 'video',
            maxResults: 12,
            key: apiKey
          },
          timeout: 4000
        });
        if (ytRes.data?.items && Array.isArray(ytRes.data.items)) {
          const videoItems = ytRes.data.items.filter(item => item?.id?.videoId);
          const videoIds = videoItems.map(item => item.id.videoId);
          let durationMap = {};
          if (videoIds.length > 0) {
            try {
              const detailsRes = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
                params: {
                  part: 'contentDetails',
                  id: videoIds.join(','),
                  key: apiKey
                },
                timeout: 3000
              });
              if (detailsRes.data?.items && Array.isArray(detailsRes.data.items)) {
                for (const vid of detailsRes.data.items) {
                  const iso = vid.contentDetails?.duration || '';
                  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
                  if (match) {
                    const hours = parseInt(match[1] || '0', 10);
                    const mins = parseInt(match[2] || '0', 10);
                    const secs = parseInt(match[3] || '0', 10);
                    durationMap[vid.id] = hours * 3600 + mins * 60 + secs;
                  }
                }
              }
            } catch (dErr) {}
          }

          ytTracks = videoItems
            .map(item => {
              const videoId = item.id.videoId;
              let title = item.snippet?.title || targetQuery;
              title = title
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>');
              const artist = (item.snippet?.channelTitle || 'YouTube').replace(/ - Topic$/i, '');
              const cover = item.snippet?.thumbnails?.high?.url ||
                            item.snippet?.thumbnails?.medium?.url ||
                            `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
              const exactDuration = durationMap[videoId] || 180;
              return {
                id: `yt-${videoId}`,
                title,
                artist,
                album: 'YouTube',
                cover,
                audioUrl: `https://www.youtube.com/watch?v=${videoId}`,
                duration: exactDuration,
                source: 'YouTube'
              };
            })
            .filter(t => isMusicTrackServer(t.title, t.artist));
        }
      } catch (err) {
        const errMsg = err?.response?.data?.error?.message || err.message || '';
        if (err?.response?.status === 403 || errMsg.toLowerCase().includes('quota')) {
          markYouTubeApiKeyExceeded(apiKey);
        }
      }
    }

    if (ytTracks.length === 0) {
      try {
        const ytSearchStr = `${targetQuery} music`;
        const ytRes = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(ytSearchStr)}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          timeout: 3500
        });
        const jsonMatch = ytRes.data.match(/var ytInitialData = ({.*?});<\/script>/s) || ytRes.data.match(/ytInitialData = ({.*?});<\/script>/s);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1]);
          const contents = parsed.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
          ytTracks = contents
            .filter(c => c.videoRenderer && c.videoRenderer.videoId)
            .map(c => {
              const v = c.videoRenderer;
              const title = v.title?.runs?.[0]?.text || q;
              const artist = v.ownerText?.runs?.[0]?.text || 'YouTube';
              const durText = v.lengthText?.simpleText || v.lengthText?.runs?.[0]?.text || '';
              let durSec = 0;
              if (durText) {
                const parts = durText.split(':').map(p => parseInt(p, 10));
                if (parts.length === 2) durSec = parts[0] * 60 + parts[1];
                else if (parts.length === 3) durSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
              }
              return {
                id: `yt-${v.videoId}`,
                title,
                artist,
                album: 'YouTube',
                cover: v.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
                audioUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
                duration: (durSec && durSec > 0 && durSec < 86400) ? durSec : 210,
                source: 'YouTube'
              };
            })
            .filter(t => isMusicTrackServer(t.title, t.artist))
            .slice(0, 10);
        }
      } catch {}
    }

    const allTracks = [...formattedDbTracks, ...ytTracks];
    const seen = new Set();
    const uniqueTracks = allTracks.filter(t => {
      const key = `${(t.title || '').toLowerCase()}-${(t.artist || '').toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (searchCache.size > 200) searchCache.clear();
    searchCache.set(cacheKey, { tracks: uniqueTracks, timestamp: Date.now() });
    return uniqueTracks;
  } catch (e) {
    return [];
  }
}

module.exports = {
  searchCache,
  searchTracksInternal
};
