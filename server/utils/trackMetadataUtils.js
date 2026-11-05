const axios = require('axios');
const { User } = require('../models');

async function fetchTrackCover(title, artist, searchYouTubeFn) {
  const q = `${artist || ''} ${title || ''}`.trim();
  if (!q) return null;
  try {
    const res = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=1`, { timeout: 2500 });
    const art = res.data?.results?.[0]?.artworkUrl100;
    if (art) return art.replace('100x100bb', '600x600bb');
  } catch {}
  if (typeof searchYouTubeFn === 'function') {
    try {
      const ytId = await searchYouTubeFn(q);
      if (ytId) return `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
    } catch {}
  }
  return null;
}

async function fetchTrackMetadata(title, artist) {
  const q = `${artist || ''} ${title || ''}`.trim();
  if (!q) return null;
  try {
    const res = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=1`, { timeout: 3000 });
    const item = res.data?.results?.[0];
    if (item) {
      const art = item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : null;
      return {
        cover: art,
        album: item.collectionName || '',
        artist: item.artistName || artist,
        releaseDate: item.releaseDate ? item.releaseDate.split('-')[0] : '',
        genre: item.primaryGenreName || ''
      };
    }
  } catch {}
  return null;
}

function getTrackKey(title, artist) {
  const norm = (str) => (str || '')
    .toLowerCase()
    .replace(/[\[\(].*?[\]\)]/g, '')
    .replace(/feat\..*|ft\..*/gi, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  const t = norm(title);
  const a = norm(artist);
  return `${t}___${a}`;
}

const NON_MUSIC_REGEX = /(سبونج\s*بوب|سبونجبوب|spongebob|sponge\s*bob|بوب\s*القطار|bob\s*the\s*train|كرتون|رسوم\s*متحركة|حلقة\s*\d+|الموسم|حلقات|سلسلة|أنمي|انمي|نيكيلوديون|nickelodeon|mbc\s*3|mbc3|سبيستون|spacetoon|أطفال|اطفال|حكايات\s*أطفال|قصة\s*قبل\s*النوم|مسلسل|فيلم\s*كامل|مشهد\s*مضحك|كارتون|براعم|طيور\s*الجنة|كراميش|baby\s*shark|cocomelon|cartoon|animation|episode|full\s*episode)/i;

function isMusicTrackServer(title = '', artist = '') {
  const combined = `${title} ${artist}`.toLowerCase();
  return !NON_MUSIC_REGEX.test(combined);
}

function parseDurationFromLabel(label) {
  if (!label) return 200;
  const mMatch = label.match(/(\d+)\s+minute/);
  const sMatch = label.match(/(\d+)\s+second/);
  const minutes = mMatch ? parseInt(mMatch[1], 10) : 0;
  const seconds = sMatch ? parseInt(sMatch[1], 10) : 0;
  const total = minutes * 60 + seconds;
  return total > 0 ? total : 200;
}

async function autoAddTrackToUserLinksPlaylist(userId, trackId, cover) {
  try {
    const u = await User.findById(userId);
    if (!u) return;

    let linksPl = u.playlists.find(p => p.id === 'imported-links' || p.name === 'Imported Links' || p.name === 'الروابط المحفوظة');
    if (!linksPl) {
      linksPl = {
        id: 'imported-links',
        name: 'Imported Links',
        cover: cover || '',
        trackIds: [],
        isLikedSongs: false,
        isPublic: false
      };
      u.playlists.push(linksPl);
    }

    if (!linksPl.trackIds.includes(String(trackId))) {
      linksPl.trackIds.unshift(String(trackId));
      if (!linksPl.cover && cover) linksPl.cover = cover;
      u.markModified('playlists');
      await u.save();
    }
  } catch (err) {
    console.warn('[autoAddTrackToUserLinksPlaylist] error:', err.message);
  }
}

module.exports = {
  fetchTrackCover,
  fetchTrackMetadata,
  getTrackKey,
  NON_MUSIC_REGEX,
  isMusicTrackServer,
  parseDurationFromLabel,
  autoAddTrackToUserLinksPlaylist
};
