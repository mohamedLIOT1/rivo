const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');
const { execFile, spawn } = require('child_process');
const { Track, Album, SongLyrics, User } = require('../models');

function escapeRegex(s) {
  return String(s || '').replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

const QURAN_REGEX = /(\bسورة|\bسوره|\bقرآن|\bقران|\bالمصحف|\bمصحف|\bتلاوة|\bتلاوه|\bترتيل|\bتجويد|المنشاوي|عبد\s*الباسط|الحصري|البناء|الطبلاوي|العفاسي|ماهر\s*المعيقلي|السديس|الشريم|ياسر\s*الدوسري|مشاري\s*العفاسي|أحمد\s*العجمي|سعد\s*الغامدي|\bsurah\b|\bquran\b|\bkoran\b|\brecitation\b|\btajweed\b|\btartil\b|\bmushaf\b)/i;

function isQuranContent(title, artist, album, genre, description) {
  const str = `${title || ''} ${artist || ''} ${album || ''} ${genre || ''} ${description || ''}`;
  return QURAN_REGEX.test(str);
}

const SERVER_FAMOUS_RECITERS = [
  {
    name: 'مشاري راشد العفاسي',
    aliases: [
      'مشاري العفاسي', 'العفاسي', 'العفاسى', 'مشاري راشد', 'مشارى العفاسى', 'مشارى راشد', 'مشاري', 'مشارى', 
      'mishary rashid alafasy', 'mishary rashid', 'mishari rashid', 'mishary alafasy', 'mishari alafasy', 
      'alafasy', 'mishary', 'mishari', 'al-afasy', 'al afasy', 'al-afasi', 'al afasi'
    ]
  },
  {
    name: 'محمود خليل الحصري',
    aliases: [
      'محمود خليل الحصرى', 'الحصري', 'الحصرى', 'خليل الحصري', 'خليل الحصرى', 
      'mahmoud khalil al-hussary', 'mahmoud khalil al hussary', 'al-hussary', 'al-hosary', 'al-husary', 
      'al-hosari', 'al hussary', 'al hosary', 'hussary', 'hosary', 'husary', 'hosari'
    ]
  },
  {
    name: 'محمد صديق المنشاوي',
    aliases: [
      'محمد صديق المنشاوى', 'المنشاوي', 'المنشاوى', 'صديق المنشاوي', 'صديق المنشاوى', 
      'mohamed siddiq el-minshawi', 'mohamed el minshawi', 'al-minshawi', 'al minshawi', 
      'minshawi', 'menshawy', 'al-menshawy', 'al menshawy'
    ]
  },
  {
    name: 'عبد الباسط عبد الصمد',
    aliases: [
      'عبدالباسط عبدالصمد', 'عبد الباسط', 'عبدالباسط', 'عبد الصمد', 'عبدالصمد', 
      'abdul basit abdel samad', 'abdelbasset abdessamad', 'abdulbasit', 'abdelbasset', 
      'abdul basit', 'abdul-basit', 'abdel-basset', 'abd el basit'
    ]
  },
  {
    name: 'ماهر المعيقلي',
    aliases: [
      'ماهر المعيقلى', 'المعيقلي', 'المعيقلى', 
      'maher al muaiqly', 'maher al-muaiqly', 'maher al-moaikli', 'maher al moaikli', 
      'al-muaiqly', 'al muaiqly', 'muaiqly', 'moaikli', 'maher'
    ]
  },
  {
    name: 'سعد الغامدي',
    aliases: ['سعد الغامدى', 'الغامدي', 'الغامدى', 'saad al ghamdi', 'saad al-ghamdi', 'al-ghamdi', 'al ghamdi', 'ghamdi']
  },
  {
    name: 'ياسر الدوسري',
    aliases: [
      'ياسر الدوسرى', 'الدوسري', 'الدوسرى', 
      'yasser al dossari', 'yasser al-dossari', 'yasser al dosari', 'yasser al-dosari', 
      'yasser aldosari', 'yasser aldossari', 'yasser dosari', 'yasser dossari',
      'yaser al dosari', 'yaser al-dosari', 'yaser al dossari', 'yaser al-dossari', 
      'yaser dosari', 'yaser dossari', 'al-dosari', 'al dosari', 'al-dossari', 'al dossari', 
      'aldosari', 'aldossari', 'dosari', 'dossari'
    ]
  },
  {
    name: 'عبد الرحمن السديس',
    aliases: [
      'عبدالرحمن السديس', 'السديس', 'abdul rahman al-sudais', 'abdul rahman al sudais', 
      'abdurrahman al-sudais', 'al-sudais', 'al sudais', 'sudais'
    ]
  },
  {
    name: 'سعود الشريم',
    aliases: ['سعود الشريم', 'الشريم', 'saud al-shuraim', 'saud al shuraim', 'al-shuraim', 'al shuraim', 'shuraim']
  },
  {
    name: 'أحمد بن علي العجمي',
    aliases: [
      'أحمد العجمي', 'احمد العجمي', 'أحمد العجمى', 'احمد العجمى', 'العجمي', 'العجمى', 
      'ahmed al-ajmi', 'ahmed al ajmi', 'al-ajmy', 'al-ajmi', 'al ajmi', 'ajmi'
    ]
  },
  {
    name: 'فارس عباد',
    aliases: ['فارس عباد', 'عباد', 'fares abbad', 'fares abad', 'abbad', 'abad']
  },
  {
    name: 'ناصر القطامي',
    aliases: ['ناصر القطامى', 'القطامي', 'القطامى', 'nasser al-qatami', 'nasser al qatami', 'al-qatami', 'al qatami', 'qatami']
  },
  {
    name: 'إدريس أبكر',
    aliases: ['ادريس ابكر', 'أبكر', 'ابكر', 'idris abkar', 'idrees abkar', 'abkar']
  },
  {
    name: 'خالد الجليل',
    aliases: ['خالد الجليل', 'الجليل', 'khalid al jalil', 'khalid al-jalil', 'al-jalil', 'al جلil', 'jalil']
  },
  {
    name: 'علي عبد الله جابر',
    aliases: ['علي جابر', 'على جابر', 'ali jaber', 'ali abdullah jaber', 'jaber']
  },
  {
    name: 'محمد أيوب',
    aliases: ['محمد ايوب', 'أيوب', 'ايوب', 'mohamed ayyoub', 'mohammed ayoub', 'ayyoub', 'ayoub']
  },
  {
    name: 'أبو بكر الشاطري',
    aliases: ['ابو بكر الشاطري', 'ابوبكر الشاطري', 'الشاطري', 'الشاطرى', 'abu bakr al shatri', 'abu bakr al-shatri', 'al-shatri', 'shatri']
  },
  {
    name: 'محمود علي البنا',
    aliases: ['محمود على البنا', 'على البنا', 'علي البنا', 'البنا', 'al-banna', 'mahmoud ali al banna']
  },
  {
    name: 'محمد محمود الطبلاوي',
    aliases: ['الطبلاوي', 'الطبلاوى', 'محمود الطبلاوي', 'tablawi', 'al-tablawi', 'al tablawi']
  },
  {
    name: 'إسلام صبحي',
    aliases: ['إسلام صبحى', 'اسلام صبحي', 'اسلام صبحى', 'islam sobhi', 'islam subhi', 'islam sobhy']
  }
];

function normalizeArabic(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

function detectQuranReciter(title = '', artist = '', album = '', description = '') {
  const combined = `${title || ''} ${artist || ''} ${album || ''} ${description || ''}`;
  const normCombined = normalizeArabic(combined);
  const lowerCombined = combined.toLowerCase();

  for (const r of SERVER_FAMOUS_RECITERS) {
    for (const alias of r.aliases) {
      const normAlias = normalizeArabic(alias);
      if (normAlias.length >= 3 && (normCombined.includes(normAlias) || lowerCombined.includes(alias.toLowerCase()))) {
        return r.name;
      }
    }
  }

  const prefixMatch = combined.match(/(?:بصوت\s+(?:الشيخ\s+|القارئ\s+)?|(?:فضيلة\s+)?الشيخ\s+|(?:فضيلة\s+)?القارئ\s+|تلاوة\s+(?:الشيخ\s+|القارئ\s+)?)([\u0621-\u064A\s]{4,28})/);
  if (prefixMatch && prefixMatch[1]) {
    const candidate = prefixMatch[1].trim();
    if (candidate.length > 3 && !/قرآن|قناة|مصحف|تلاوات|islam/i.test(candidate)) {
      return candidate;
    }
  }

  const enMatch = combined.match(/(?:recited\s+by\s+(?:sheikh\s+|qari\s+)?|(?:by\s+)?(?:sheikh\s+|qari\s+))([A-Za-z\s'-]{3,30})/i);
  if (enMatch && enMatch[1]) {
    const candidate = enMatch[1].trim();
    for (const r of SERVER_FAMOUS_RECITERS) {
      for (const alias of r.aliases) {
        if (candidate.toLowerCase().includes(alias.toLowerCase())) {
          return r.name;
        }
      }
    }
    if (candidate.length > 3 && !/channel|quran|sound|audio/i.test(candidate)) {
      return candidate;
    }
  }

  return null;
}

const OFFICIAL_ALBUM_COVERS = {
  'roma': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/46/81/82/468182bd-6914-bf7d-2f4a-4cb4bd5175cd/196925215671.jpg/1200x1200bb.jpg',
  'supernova': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/7f/a0/00/7fa00086-e72c-191b-6547-e8992f774a9a/885288056853.jpg/1200x1200bb.jpg',
  'nas w nas': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/64/78/b1/6478b176-8977-c2fb-bacd-761567625b00/196925011204.jpg/1200x1200bb.jpg',
  'noaata beida': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/e9/de/11/e9de11f3-be73-e0df-b4ff-72dd702476e3/196626997326.jpg/1200x1200bb.jpg',
  'the ugly ducklings': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/17/21/ff/1721ffa2-9895-8c92-43af-eaebd0a31cc6/3615938009819.png/1200x1200bb.jpg',
  'ابناء البطة السوداء': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/17/21/ff/1721ffa2-9895-8c92-43af-eaebd0a31cc6/3615938009819.png/1200x1200bb.jpg',
  'كايروكي من الاستوديو': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/2b/37/92/2b37929b-6df4-0a3e-24c4-5401eb70b5fe/196626954855.jpg/1200x1200bb.jpg',
  'classics, vol. 1': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/8a/22/95/8a2295a7-e3ba-5b30-1e07-cf3c372c07cc/cover.jpg/1200x1200bb.jpg',
  'classics': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/8a/22/95/8a2295a7-e3ba-5b30-1e07-cf3c372c07cc/cover.jpg/1200x1200bb.jpg',
  'لما بنتولد': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/d8/46/06/d846063d-1cbd-f455-1287-5370cc305292/artwork.jpg/1200x1200bb.jpg',
  'roxi': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/ad/83/7f/ad837f70-04a2-b985-2e0b-dbeaf1f2c5c2/196872351095.jpg/1200x1200bb.jpg',
  'rivo': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/6a/71/f3/6a71f3e3-b9c0-a08d-a782-4fead92c8ed6/cover.jpg/1200x1200bb.jpg',
  'ريفو': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/6a/71/f3/6a71f3e3-b9c0-a08d-a782-4fead92c8ed6/cover.jpg/1200x1200bb.jpg',
  'shoft kalam': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/01/c4/31/01c43187-da8b-fc50-b68e-2e71cd1d7c85/885288123609.jpg/1200x1200bb.jpg',
  'placebo': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/3d/be/1a/3dbe1ae5-a9c0-ff0c-d8ea-3b87692cadeb/6221216529510_cover.png/1200x1200bb.jpg',
  'plan-b': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/ef/28/e0/ef28e07b-c631-8981-55f4-a8979a433fc5/6221216496775_cover.jpg/1200x1200bb.jpg',
  'agzakhana': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/65/7c/94/657c9473-c77e-601c-9bbc-4540ecc2c08b/6221216496768_Artwork.jpg/1200x1200bb.jpg'
};

async function autoFixAlbumCovers(io) {
  try {
    if (mongoose.connection.readyState !== 1) return;
    const albums = await Album.find();
    let updatedCount = 0;
    for (const album of albums) {
      const rawName = (album.name || '').trim();
      const cleanKey = rawName.replace(/^Album\s*[-–—:]\s*/i, '').trim().toLowerCase();
      let targetCover = OFFICIAL_ALBUM_COVERS[cleanKey];

      if (targetCover && album.cover !== targetCover) {
        album.cover = targetCover;
        await album.save();
        updatedCount++;
      }
    }
    if (updatedCount > 0) {
      console.log(`✅ [Album Artwork Auto-Fix] Updated ${updatedCount} albums with official 1200x1200 square covers.`);
      if (io) io.emit('albums:updated_batch');
    }
  } catch (err) {
    console.warn('[Album Artwork Auto-Fix] Error:', err.message);
  }
}

const CANONICAL_ARTIST_MAP = [
  {
    canonical: 'Cairokee',
    aliases: [
      'cairokee', 'cairokeeoffical', 'cairokeeofficial', 'cairokee official',
      'amir eid', 'amireid', 'أمير عيد', 'كايروكي'
    ]
  },
  {
    canonical: 'Mohamed Hamaki',
    aliases: ['hamaki', 'mohamed hamaki', 'محمد حماقي', 'حماقي']
  },
  {
    canonical: 'Amr Diab',
    aliases: ['amr diab', 'عمرو دياب', 'elhadaba', 'el hadaba']
  },
  {
    canonical: 'Tamer Hosny',
    aliases: ['tamer hosny', 'tamer hosni', 'تامر حسني']
  },
  {
    canonical: 'Marwan Pablo',
    aliases: ['marwan pablo', 'pablo', 'مروان بابلو', 'بابلو']
  },
  {
    canonical: 'Wegz',
    aliases: ['wegz', 'ويجز']
  },
  {
    canonical: 'Lege-Cy',
    aliases: ['lege-cy', 'lege cy', 'legecy', 'ليجي سي', 'ليجي-سي']
  },
  {
    canonical: 'Abyusif',
    aliases: ['abyusif', 'أبيوسف', 'ابيوسف']
  },
  {
    canonical: 'Marwan Moussa',
    aliases: ['marwan moussa', 'marwan mousa', 'مروان موسى']
  },
  {
    canonical: 'Afroto',
    aliases: ['afroto', 'عفروتو']
  },
  {
    canonical: 'Sharmoofers',
    aliases: ['sharmoofers', 'شارموفرز']
  },
  {
    canonical: 'Massar Egbari',
    aliases: ['massar egbari', 'مسار إجباري', 'مسار اجباري']
  },
  {
    canonical: 'Ahmed Saad',
    aliases: ['ahmed saad', 'أحمد سعد', 'احمد سعد']
  },
  {
    canonical: 'Bahaa Sultan',
    aliases: ['bahaa sultan', 'بهاء سلطان']
  },
  {
    canonical: 'Sherine',
    aliases: ['sherine', 'sherine abdel-wahab', 'sherine abdel wahab', 'شيرين', 'شيرين عبد الوهاب']
  }
];

function normalizeArtistName(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let clean = raw.trim();
  clean = clean.replace(/\s*-\s*topic\b/gi, '');
  clean = clean.replace(/\b(official(?:\s*(?:channel|music|video|audio|records|tv|page))?|offical|vevo|topic|channel)\b/gi, '');
  clean = clean.replace(/^["'\[\(]+|["'\]\)]+$/g, '');
  clean = clean.replace(/\s+/g, ' ').trim();
  return clean;
}

function getCanonicalArtistName(rawName) {
  if (!rawName || typeof rawName !== 'string') return '';
  const trimmed = rawName.trim();
  const lower = trimmed.toLowerCase();
  const normalized = normalizeArtistName(trimmed).toLowerCase();

  for (const group of CANONICAL_ARTIST_MAP) {
    if (group.aliases.includes(lower) || group.aliases.includes(normalized)) {
      return group.canonical;
    }
  }

  const clean = normalizeArtistName(trimmed);
  return clean || trimmed;
}

function getArtistAliases(artistName) {
  if (!artistName || typeof artistName !== 'string') return [];
  const canonical = getCanonicalArtistName(artistName).toLowerCase();
  for (const group of CANONICAL_ARTIST_MAP) {
    if (group.canonical.toLowerCase() === canonical) {
      return group.aliases;
    }
  }
  return [artistName.toLowerCase().trim()];
}

function isValidAlbumName(albumName) {
  if (!albumName || typeof albumName !== 'string') return false;
  const clean = albumName.trim().toLowerCase();
  const invalid = [
    '', 'single', 'single cassette', 'singles', 'single release',
    'unknown', 'unknown album', 'track', 'audio', 'youtube', 'soundcloud',
    'import', 'spotify', 'spotify playlist', 'imported playlist', 'official audio',
    'playlist', 'my playlist', 'favorites', 'liked songs', 'new playlist'
  ];
  if (invalid.includes(clean)) return false;
  if (clean.startsWith('playlist') || clean.endsWith('playlist')) return false;
  if (clean.length < 2) return false;
  return true;
}

async function syncTrackToAlbum(track) {
  if (!track || !track.title || !track.artist || !track.album) return null;
  const albumTitle = (track.album || '').trim();
  const artistName = track.artist.trim();
  const trackId = String(track._id || track.id);
  if (!isValidAlbumName(albumTitle)) return null;

  try {
    let album = await Album.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(albumTitle)}$`, 'i') },
      artist: { $regex: new RegExp(`^${escapeRegex(artistName)}$`, 'i') }
    });

    if (album) {
      if (!album.trackIds.includes(trackId)) {
        album.trackIds.push(trackId);
        await album.save();
      }
      return album;
    }
  } catch (err) {
    console.warn('[Album] syncTrackToAlbum error:', err.message);
  }
  return null;
}

const searchCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const ytSearchCache = new Map();
let ytQuotaExceededUntil = 0;

function calculateTitleSimilarity(targetTitle = '', candTitle = '', targetArtist = '') {
  const t = String(targetTitle || '').toLowerCase().replace(/[/\\?%*:|"<>_]/g, ' ').trim();
  const c = String(candTitle || '').toLowerCase().replace(/[/\\?%*:|"<>_]/g, ' ').trim();
  const a = String(targetArtist || '').toLowerCase().replace(/[/\\?%*:|"<>_]/g, ' ').trim();
  if (!t || !c) return 0;
  if (c === t || (t.length >= 4 && c.includes(t))) return 1.0;

  const tTokens = t.split(/\s+/).filter(w => w.length > 1);
  const cTokens = c.split(/\s+/).filter(w => w.length > 1);
  if (tTokens.length === 0) return 0;

  let matched = 0;
  for (const tok of tTokens) {
    if (cTokens.includes(tok) || c.includes(tok)) matched++;
  }
  let score = matched / tTokens.length;
  if (a && (c.includes(a) || cTokens.includes(a))) {
    score = Math.min(1.0, score + 0.2);
  }
  return score;
}

async function searchYouTubeId(queryOrOptions, maybeOptions = {}) {
  let query = '';
  let targetDuration = null;
  let artist = '';
  let title = '';
  let strictCatalogDuration = false;

  if (queryOrOptions && typeof queryOrOptions === 'object') {
    query = queryOrOptions.query || '';
    targetDuration = Number(queryOrOptions.targetDuration || queryOrOptions.duration) || null;
    artist = queryOrOptions.artist || '';
    title = queryOrOptions.title || '';
    strictCatalogDuration = Boolean(queryOrOptions.strictCatalogDuration);
  } else if (typeof queryOrOptions === 'string') {
    query = queryOrOptions.trim();
    if (typeof maybeOptions === 'number') {
      targetDuration = maybeOptions;
    } else if (maybeOptions && typeof maybeOptions === 'object') {
      targetDuration = Number(maybeOptions.targetDuration || maybeOptions.duration) || null;
      artist = maybeOptions.artist || '';
      title = maybeOptions.title || '';
      strictCatalogDuration = Boolean(maybeOptions.strictCatalogDuration);
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
    const cleanQ = query.replace(/\s+music$/i, '').trim();
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

          if (candChannel.includes('topic') || candChannel.includes('official') || candChannel.includes('vevo')) score += 30;
          if (candTitle.includes('official audio') || candTitle.includes('official lyric') || candTitle.includes('official video')) score += 20;

          if (!normTitle.includes('mix') && (candTitle.includes('mix') || candTitle.includes('full album') || candTitle.includes('playlist'))) score -= 100;
          if (!normTitle.includes('live') && candTitle.includes('live') && !normTitle.includes('حفلة')) score -= 50;
          if (durSec > 900 && (!targetDuration || targetDuration < 900)) score -= 100;

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
        // Enforce candidate duration difference is reasonable, allowing up to 90s for video/audio differences if title similarity is good (>= 0.35)
        scoredCandidates = scoredCandidates.filter(c => {
          if (targetDuration && c.durationDiff !== null) {
            if (c.similarity >= 0.35 && c.durationDiff <= 90) return true;
            if (c.durationDiff > 35) return false;
            if (c.durationDiff > 15 && c.similarity < 0.4) return false;
          }
          if (cleanTit && c.similarity < 0.2) return false;
          return true;
        });

        if (scoredCandidates.length > 0) {
          scoredCandidates.sort((a, b) => b.score - a.score);
          const best = scoredCandidates[0];
          if (best && best.videoId) {
            if (ytSearchCache.size > 5000) ytSearchCache.clear();
            const resObj = new String(best.videoId);
            resObj.confidence = best.confidence;
            resObj.durationDiff = best.durationDiff;
            ytSearchCache.set(cacheKey, resObj);
            return resObj;
          }
        }
      }
    } catch (err) {}
  }

  // If strict catalog matching is requested and candidate duration was way off, abort.
  // Otherwise, fall back to API or scraping so AI & user-searched songs can play!
  if (strictCatalogDuration && targetDuration && hadInnertubeCandidates && scoredCandidates.length === 0) {
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
    const cookiesPath = fs.existsSync('/home/ubuntu/rivo/cookies.txt') ? '/home/ubuntu/rivo/cookies.txt' : (fs.existsSync(path.join(__dirname, '../../cookies.txt')) ? path.join(__dirname, '../../cookies.txt') : '/home/ubuntu/cookies.txt');
    const simpleQ = `${cleanArt} ${cleanTit}`.trim() || finalQuery;
    const ytdlpArgs = ['--no-check-certificates', '--no-playlist', '--get-id', `ytsearch1:${simpleQ}`];
    if (fs.existsSync(cookiesPath)) {
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

async function fetchTrackCover(title, artist) {
  const q = `${artist || ''} ${title || ''}`.trim();
  if (!q) return null;
  try {
    const res = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=1`, { timeout: 2500 });
    const art = res.data?.results?.[0]?.artworkUrl100;
    if (art) return art.replace('100x100bb', '600x600bb');
  } catch {}
  try {
    const ytId = await searchYouTubeId(q);
    if (ytId) return `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
  } catch {}
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
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (apiKey && Date.now() > ytQuotaExceededUntil) {
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
          ytTracks = ytRes.data.items
            .filter(item => item?.id?.videoId)
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
              return {
                id: `yt-${videoId}`,
                title,
                artist,
                album: 'YouTube',
                cover,
                audioUrl: `https://www.youtube.com/watch?v=${videoId}`,
                duration: 240,
                source: 'YouTube'
              };
            })
            .filter(t => isMusicTrackServer(t.title, t.artist));
        }
      } catch (err) {
        const errMsg = err?.response?.data?.error?.message || err.message || '';
        if (err?.response?.status === 403 || errMsg.toLowerCase().includes('quota')) {
          ytQuotaExceededUntil = Date.now() + 2 * 3600 * 1000;
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

async function scrapePlaylistOrAlbum(url) {
  let title = 'Imported Collection';
  let cover = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600';
  let artist = '';
  let rawItems = [];
  let isAlbum = false;

  const isSpotifyAlbum = url.includes('spotify.com/album') || url.includes('spotify:album');
  const isSpotifyPlaylist = url.includes('spotify.com/playlist') || url.includes('spotify:playlist');
  isAlbum = isSpotifyAlbum;

  if (isSpotifyPlaylist || isSpotifyAlbum) {
    const match = isSpotifyAlbum
      ? (url.match(/album\/([a-zA-Z0-9]+)/) || url.match(/spotify:album:([a-zA-Z0-9]+)/))
      : (url.match(/playlist\/([a-zA-Z0-9]+)/) || url.match(/spotify:playlist:([a-zA-Z0-9]+)/));
    const entityId = match ? match[1] : null;

    if (!entityId) throw new Error(`Invalid Spotify ${isSpotifyAlbum ? 'album' : 'playlist'} link`);

    try {
      const embedType = isSpotifyAlbum ? 'album' : 'playlist';
      const embedRes = await axios.get(`https://open.spotify.com/embed/${embedType}/${entityId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 10000
      });

      const html = embedRes.data;
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
      if (nextDataMatch) {
        const parsed = JSON.parse(nextDataMatch[1]);
        const entity = parsed?.props?.pageProps?.state?.data?.entity;
        if (entity) {
          title = entity.name || title;
          if (entity.coverArt?.sources?.[0]?.url) cover = entity.coverArt.sources[0].url;

          artist = entity.subtitle || entity.artists?.[0]?.name || '';
          const defaultArtist = artist || 'Artist';
          const trackList = entity.trackList || [];
          rawItems = trackList.map(t => ({
            title: t.title || t.name,
            artist: t.subtitle || t.artists?.[0]?.name || defaultArtist,
            duration: Math.round((t.duration || 180000) / 1000)
          }));
        }
      }
    } catch (err) {
      console.warn('Spotify embed fetch failed:', err.message);
    }
  } else if (url.includes('youtube.com/playlist') || url.includes('list=')) {
    const match = url.match(/list=([a-zA-Z0-9_-]+)/);
    const listId = match ? match[1] : null;
    if (!listId) throw new Error('Invalid YouTube playlist link');

    try {
      const ytRes = await axios.get(`https://www.youtube.com/playlist?list=${listId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 12000
      });
      const html = ytRes.data;

      const extractYTVideos = (node, dest = []) => {
        if (!node || typeof node !== 'object') return dest;
        if (node.lockupViewModel && node.lockupViewModel.contentId) {
          const vm = node.lockupViewModel;
          const videoId = vm.contentId;
          const vTitle = vm.metadata?.lockupMetadataViewModel?.title?.content || 'Unknown Track';
          const metadataRows = vm.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows || [];
          const author = metadataRows[0]?.metadataParts?.[0]?.text?.content || 'Artist';
          const duration = parseDurationFromLabel(vm.rendererContext?.accessibilityContext?.label);
          const vCover = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          dest.push({
            title: vTitle,
            artist: author,
            videoId,
            duration,
            cover: vCover,
            audioUrl: `https://www.youtube.com/watch?v=${videoId}`
          });
        } else if (node.playlistVideoRenderer && node.playlistVideoRenderer.videoId) {
          const p = node.playlistVideoRenderer;
          const videoId = p.videoId;
          const vTitle = p.title?.runs?.[0]?.text || p.title?.simpleText || 'Unknown Track';
          const author = p.shortBylineText?.runs?.[0]?.text || 'Artist';
          const duration = p.lengthSeconds ? parseInt(p.lengthSeconds, 10) : 200;
          const vCover = p.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          dest.push({
            title: vTitle,
            artist: author,
            videoId,
            duration,
            cover: vCover,
            audioUrl: `https://www.youtube.com/watch?v=${videoId}`
          });
        } else if (Array.isArray(node)) {
          for (const el of node) extractYTVideos(el, dest);
        } else {
          for (const k of Object.keys(node)) {
            if (k !== 'lockupViewModel' && k !== 'playlistVideoRenderer') {
              extractYTVideos(node[k], dest);
            }
          }
        }
        return dest;
      };

      const findYTContinuationToken = (node) => {
        if (!node || typeof node !== 'object') return null;
        if (node.continuationItemRenderer) {
          const tok = node.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
          if (tok) return tok;
        }
        if (node.continuationCommand && node.continuationCommand.token) {
          return node.continuationCommand.token;
        }
        if (Array.isArray(node)) {
          for (const el of node) {
            const tok = findYTContinuationToken(el);
            if (tok) return tok;
          }
        } else {
          for (const k of Object.keys(node)) {
            const tok = findYTContinuationToken(node[k]);
            if (tok) return tok;
          }
        }
        return null;
      };

      const initialDataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/ytInitialData\s*=\s*({.+?});/);
      if (initialDataMatch) {
        try {
          const data = JSON.parse(initialDataMatch[1]);
          const headerTitle = data?.metadata?.playlistMetadataRenderer?.title || data?.header?.playlistHeaderRenderer?.title?.simpleText;
          if (headerTitle) title = headerTitle;

          const headerOwner = data?.header?.playlistHeaderRenderer?.ownerText?.runs?.[0]?.text;
          if (headerOwner) artist = headerOwner;

          extractYTVideos(data, rawItems);
          let continuationToken = findYTContinuationToken(data);

          const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || html.match(/"innertubeApiKey":"([^"]+)"/i) || html.match(/"key":"(AIza[^"]+)"/);
          const apiKey = apiKeyMatch ? apiKeyMatch[1] : null;
          const clientVersionMatch = html.match(/"INNERTUBE_CONTEXT_CLIENT_VERSION":"([^"]+)"/) || html.match(/"clientVersion":"([^"]+)"/);
          const clientVersion = clientVersionMatch ? clientVersionMatch[1] : '2.20240101.00.00';

          let pageCount = 0;
          const MAX_PAGES = 30;

          while (continuationToken && apiKey && pageCount < MAX_PAGES) {
            pageCount++;
            try {
              const contRes = await axios.post(
                `https://www.youtube.com/youtubei/v1/browse?key=${apiKey}`,
                {
                  context: {
                    client: {
                      clientName: 'WEB',
                      clientVersion: clientVersion,
                      hl: 'en',
                      gl: 'US'
                    }
                  },
                  continuation: continuationToken
                },
                {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Content-Type': 'application/json'
                  },
                  timeout: 10000
                }
              );

              const contData = contRes.data;
              const prevLen = rawItems.length;
              extractYTVideos(contData, rawItems);
              continuationToken = findYTContinuationToken(contData);

              if (rawItems.length === prevLen) {
                break;
              }
            } catch (pageErr) {
              break;
            }
          }

          const seenVids = new Set();
          rawItems = rawItems.filter(item => {
            if (!item.videoId) return true;
            if (seenVids.has(item.videoId)) return false;
            seenVids.add(item.videoId);
            return true;
          });
        } catch (e) {}
      }

      if (title === 'Imported Collection') {
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) {
          title = titleMatch[1].replace(' - YouTube', '').trim();
        }
      }

      if (rawItems.length > 0 && rawItems[0].cover) {
        cover = rawItems[0].cover;
      }
    } catch (err) {
      if (err.response?.status === 404) {
        throw new Error('YouTube playlist not found (404). Please verify the link is complete and the playlist is public.');
      }
      throw err;
    }
  } else if (url.includes('music.apple.com')) {
    try {
      const appleRes = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
      });
      const html = appleRes.data;
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      if (titleMatch) {
        title = titleMatch[1].replace(' - Apple Music', '').trim();
      }
    } catch (err) {}
  }

  if (!artist && rawItems.length > 0) {
    const artistCounts = {};
    rawItems.forEach(item => {
      if (item.artist && item.artist !== 'Artist') {
        artistCounts[item.artist] = (artistCounts[item.artist] || 0) + 1;
      }
    });
    const sorted = Object.entries(artistCounts).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) artist = sorted[0][0];
  }

  return { title, cover, artist, isAlbum, items: rawItems };
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

// ──────────────────────────────────────────
// Audio Stream & Yt-Dlp Helpers
// ──────────────────────────────────────────
const downloadingAudioMap = new Map();
const directStreamCache = new Map();
const activeBackgroundDownloads = new Set();
const MAX_CONCURRENT_BG_DOWNLOADS = 3;
const bgDownloadQueue = [];

function getYtDlpBin() {
  const isWin = process.platform === 'win32';
  const binDir = path.join(__dirname, '../../bin');
  const localBin = path.join(binDir, isWin ? 'yt-dlp.exe' : 'yt-dlp');
  if (fs.existsSync(localBin)) {
    if (!isWin) {
      try { fs.chmodSync(localBin, 0o755); } catch {}
    }
    return localBin;
  }
  if (!isWin) {
    if (fs.existsSync('/usr/local/bin/yt-dlp')) return '/usr/local/bin/yt-dlp';
    if (fs.existsSync('/usr/bin/yt-dlp')) return '/usr/bin/yt-dlp';
    if (fs.existsSync('/home/ubuntu/.local/bin/yt-dlp')) return '/home/ubuntu/.local/bin/yt-dlp';
  }
  return 'yt-dlp';
}

async function ensureYtDlpBinary() {
  const isWin = process.platform === 'win32';
  const binDir = path.join(__dirname, '../../bin');
  if (!fs.existsSync(binDir)) {
    try { fs.mkdirSync(binDir, { recursive: true }); } catch {}
  }
  const localBin = path.join(binDir, isWin ? 'yt-dlp.exe' : 'yt-dlp');
  if (fs.existsSync(localBin) && fs.statSync(localBin).size > 1000000) {
    if (!isWin) {
      try { fs.chmodSync(localBin, 0o755); } catch {}
    }
    return localBin;
  }
  try {
    const dlUrl = isWin
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
    const res = await axios({ method: 'get', url: dlUrl, responseType: 'stream', timeout: 60000 });
    const writer = fs.createWriteStream(localBin);
    await new Promise((resolve, reject) => {
      res.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    if (!isWin) {
      try { fs.chmodSync(localBin, 0o755); } catch {}
    }
  } catch (e) {
    console.warn('[yt-dlp] download notice:', e.message);
  }
  return localBin;
}

let ytWorkerProc = null;
const ytWorkerPending = new Map();
let ytWorkerReqSeq = 0;
let warmWorkerFailedPermanently = false;

function initWarmYtWorker() {
  if (process.platform === 'win32' || ytWorkerProc || warmWorkerFailedPermanently) return;
  try {
    const pyScript = `
import sys, os, json
try:
    import yt_dlp
except ImportError:
    try:
        sys.path.insert(0, '/usr/local/bin/yt-dlp')
        import yt_dlp
    except Exception:
        sys.exit(42)

opts = {
    'quiet': True,
    'no_warnings': True,
    'nocheckcertificate': True,
    'noplaylist': True,
    'extractor_args': {'youtube': {'player_client': ['visionos', 'android']}},
    'format': 'ba/b'
}

ydl = yt_dlp.YoutubeDL(opts)
print("READY", flush=True)

for line in sys.stdin:
    line = line.strip()
    if not line: continue
    rid = 0
    try:
        req = json.loads(line)
        rid = req.get('id', 0)
        vid = req.get('videoId', '')
        info = ydl.extract_info(f'https://www.youtube.com/watch?v={vid}', download=False)
        print(json.dumps({'id': rid, 'url': info.get('url'), 'duration': info.get('duration')}), flush=True)
    except Exception as e:
        print(json.dumps({'id': rid, 'url': None, 'error': str(e)}), flush=True)
`;
    const proc = spawn('python3', ['-u', '-c', pyScript], { stdio: ['pipe', 'pipe', 'ignore'] });
    let isReady = false;
    let buf = '';
    proc.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const l of lines) {
        const trimmed = l.trim();
        if (trimmed === 'READY') {
          isReady = true;
          continue;
        }
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && ytWorkerPending.has(parsed.id)) {
            const { resolve, timer } = ytWorkerPending.get(parsed.id);
            clearTimeout(timer);
            ytWorkerPending.delete(parsed.id);
            resolve(parsed.url || null);
          }
        } catch {}
      }
    });
    proc.on('exit', (code) => {
      ytWorkerProc = null;
      for (const [, { resolve, timer }] of ytWorkerPending.entries()) {
        clearTimeout(timer);
        resolve(null);
      }
      ytWorkerPending.clear();
      if (!isReady || code === 42) {
        warmWorkerFailedPermanently = true;
      } else {
        setTimeout(initWarmYtWorker, 10000);
      }
    });
    ytWorkerProc = proc;
  } catch (e) {
    warmWorkerFailedPermanently = true;
  }
}

function extractViaWarmWorker(videoId) {
  if (warmWorkerFailedPermanently || !ytWorkerProc || !ytWorkerProc.stdin || !ytWorkerProc.stdin.writable) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const id = ++ytWorkerReqSeq;
    const timer = setTimeout(() => {
      ytWorkerPending.delete(id);
      resolve(null);
    }, 1500);
    ytWorkerPending.set(id, { resolve, timer });
    try {
      ytWorkerProc.stdin.write(JSON.stringify({ id, videoId }) + '\n');
    } catch {
      clearTimeout(timer);
      ytWorkerPending.delete(id);
      resolve(null);
    }
  });
}

function queueBackgroundAudioCache(videoId, targetFile, highPriority = false) {
  try {
    if (fs.existsSync(targetFile) && fs.statSync(targetFile).size > 20000) return;
  } catch {}
  if (activeBackgroundDownloads.has(videoId)) return;
  if (bgDownloadQueue.some(item => item.videoId === videoId)) return;

  if (highPriority) {
    bgDownloadQueue.unshift({ videoId, targetFile });
  } else {
    bgDownloadQueue.push({ videoId, targetFile });
  }
  processNextBgDownload();
}

function processNextBgDownload() {
  if (activeBackgroundDownloads.size >= MAX_CONCURRENT_BG_DOWNLOADS) return;
  if (bgDownloadQueue.length === 0) return;

  const { videoId, targetFile } = bgDownloadQueue.shift();
  try {
    if (fs.existsSync(targetFile) && fs.statSync(targetFile).size > 20000) {
      return processNextBgDownload();
    }
  } catch {}

  activeBackgroundDownloads.add(videoId);
  const bin = getYtDlpBin();
  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const ytdlpArgs = [
    '--no-check-certificates',
    '--no-playlist',
    '--extractor-args', 'youtube:player_client=visionos,android',
    '-f', 'ba[ext=m4a]/ba/bestaudio',
    '-o', targetFile,
    ytUrl
  ];

  execFile(bin, ytdlpArgs, { timeout: 45000 }, (err) => {
    activeBackgroundDownloads.delete(videoId);
    processNextBgDownload();
  });
}

async function extractDirectStreamUrl(videoId) {
  try {
    const warmUrl = await extractViaWarmWorker(videoId);
    if (warmUrl && warmUrl.startsWith('http')) {
      return warmUrl;
    }
  } catch {}

  const bin = getYtDlpBin();
  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const ytdlpArgs = [
    '--no-check-certificates',
    '--no-playlist',
    '--extractor-args', 'youtube:player_client=visionos,android',
    '-g',
    '-f', 'ba/b',
    ytUrl
  ];

  return new Promise((resolve) => {
    execFile(bin, ytdlpArgs, { timeout: 8000 }, (err, stdout) => {
      if (err || !stdout) return resolve(null);
      const lines = stdout.trim().split(/\r?\n/);
      const directUrl = lines.find(l => l.startsWith('http'))?.trim() || null;
      resolve(directUrl);
    });
  });
}

async function resolveOfficialYouTubeAudioStream(rawUrl, title = '', artist = '', options = {}) {
  const targetDuration = Number(options?.duration || options?.targetDuration) || null;
  const defaultDur = targetDuration && targetDuration > 0 ? targetDuration : 209;
  if (rawUrl && typeof rawUrl === 'string' && (rawUrl.startsWith('/uploads/') || rawUrl.includes('/uploads/'))) {
    const cleanUpload = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
    const retObj = new String(cleanUpload);
    retObj.url = cleanUpload;
    retObj.duration = defaultDur;
    return retObj;
  }

  let videoId = null;
  const candidates = [rawUrl];
  for (const cand of candidates) {
    if (!cand || typeof cand !== 'string') continue;
    const m1 = cand.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
    if (m1 && m1[1]) { videoId = m1[1]; break; }
    const m2 = cand.match(/^yt[-_]?([a-zA-Z0-9_-]{11})$/i);
    if (m2 && m2[1]) { videoId = m2[1]; break; }
    if (/^[a-zA-Z0-9_-]{11}$/.test(cand.trim()) && !mongoose.isValidObjectId(cand.trim())) {
      videoId = cand.trim();
      break;
    }
  }
  if (!videoId && (title || artist)) {
    try {
      videoId = await searchYouTubeId({ artist, title, targetDuration });
      const confidence = Number(videoId?.confidence) || 0;
      // STOP permanently writing unverified audioUrl to MongoDB on runtime searches unless strict duration and title verification passes with >= 85% match confidence
      if (videoId && (title || artist) && confidence >= 0.85) {
        Track.updateOne(
          {
            $or: [{ title, artist }, { _id: mongoose.isValidObjectId(rawUrl) ? rawUrl : null }],
            source: { $ne: 'Upload' },
            audioUrl: { $not: /^\/?uploads\// }
          },
          { $set: { audioUrl: `https://www.youtube.com/watch?v=${videoId}` } }
        ).catch(() => {});
      }
    } catch {}
  }
  if (!videoId && rawUrl) {
    const rawMatch = rawUrl.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
    if (rawMatch && rawMatch[1]) videoId = rawMatch[1];
  }
  if (!videoId && (title || artist)) {
    try {
      const scUrl = await extractSoundCloudStream(title, artist, options);
      if (scUrl) {
        const retObj = new String(scUrl);
        retObj.url = scUrl;
        retObj.duration = defaultDur;
        return retObj;
      }
    } catch {}
  }
  if (!videoId) return null;

  const audioCacheDir = path.join(__dirname, '../../uploads/audio-cache');
  if (!fs.existsSync(audioCacheDir)) {
    try { fs.mkdirSync(audioCacheDir, { recursive: true }); } catch {}
  }

  const cachedM4a = path.join(audioCacheDir, `${videoId}.m4a`);
  const cachedMp3 = path.join(audioCacheDir, `${videoId}.mp3`);

  if (fs.existsSync(cachedM4a) && fs.statSync(cachedM4a).size > 20000) {
    const retObj = new String(`/uploads/audio-cache/${videoId}.m4a`);
    retObj.url = `/uploads/audio-cache/${videoId}.m4a`;
    retObj.duration = defaultDur;
    retObj.videoId = videoId;
    return retObj;
  }
  if (fs.existsSync(cachedMp3) && fs.statSync(cachedMp3).size > 20000) {
    const retObj = new String(`/uploads/audio-cache/${videoId}.mp3`);
    retObj.url = `/uploads/audio-cache/${videoId}.mp3`;
    retObj.duration = defaultDur;
    retObj.videoId = videoId;
    return retObj;
  }

  const cachedStream = directStreamCache.get(videoId);
  if (cachedStream && Date.now() < cachedStream.expireAt) {
    queueBackgroundAudioCache(videoId, cachedM4a, true);
    const retObj = new String(cachedStream.url);
    retObj.url = cachedStream.url;
    retObj.duration = defaultDur;
    retObj.videoId = videoId;
    return retObj;
  }

  if (downloadingAudioMap.has(videoId)) {
    try {
      const url = await downloadingAudioMap.get(videoId);
      if (url) {
        const retObj = new String(url);
        retObj.url = url;
        retObj.duration = defaultDur;
        retObj.videoId = videoId;
        return retObj;
      }
    } catch (e) {}
  }

  const extractPromise = (async () => {
    const directUrl = await extractDirectStreamUrl(videoId);
    if (directUrl) {
      directStreamCache.set(videoId, { url: directUrl, expireAt: Date.now() + 3 * 3600 * 1000 });
      queueBackgroundAudioCache(videoId, cachedM4a, true);
      return directUrl;
    }

    if (title || artist) {
      try {
        const scUrl = await extractSoundCloudStream(title, artist, {
          album: options?.album,
          duration: defaultDur,
          strictDuration: true
        });
        if (scUrl) {
          directStreamCache.set(videoId, { url: scUrl, expireAt: Date.now() + 3 * 3600 * 1000 });
          queueBackgroundAudioCache(videoId, cachedM4a, false);
          return scUrl;
        }
      } catch {}
    }

    const bin = getYtDlpBin();
    const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const ytdlpArgs = [
      '--no-check-certificates',
      '--no-playlist',
      '--extractor-args', 'youtube:player_client=visionos,android',
      '-f', 'ba/b',
      '-o', cachedM4a,
      ytUrl
    ];

    await new Promise((resolve) => {
      execFile(bin, ytdlpArgs, { timeout: 15000 }, (err) => {
        resolve();
      });
    });

    if (fs.existsSync(cachedM4a) && fs.statSync(cachedM4a).size > 20000) {
      return `/uploads/audio-cache/${videoId}.m4a`;
    }
    return null;
  })();

  downloadingAudioMap.set(videoId, extractPromise);

  try {
    const resolvedUrl = await extractPromise;
    if (resolvedUrl) {
      const retObj = new String(resolvedUrl);
      retObj.url = resolvedUrl;
      retObj.duration = defaultDur;
      retObj.videoId = videoId;
      return retObj;
    }
    return null;
  } catch (err) {
    return null;
  } finally {
    downloadingAudioMap.delete(videoId);
  }
}

// ──────────────────────────────────────────
// Lyrics Parsing & Fetching
// ──────────────────────────────────────────
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

async function fetchLrclibLyrics(title, artist, duration = 180) {
  if (!title) return [];

  const cleanTitle = (title || '')
    .replace(/\(.*?\)|\[.*?\]|\|.*$/g, '')
    .replace(/(?:ft\.?|feat\.?|featuring)\s+.*$/i, '')
    .trim();
  
  const primaryArtist = (artist || '')
    .split(/[|/•,]/)[0]
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .trim();

  const fullCleanArtist = (artist || '')
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .trim();

  const queries = [
    `${primaryArtist} ${cleanTitle}`.trim(),
    `${fullCleanArtist} ${cleanTitle}`.trim(),
    cleanTitle
  ].filter(Boolean);

  const uniqueQueries = [...new Set(queries)];

  for (const q of uniqueQueries) {
    try {
      const res = await axios.get('https://lrclib.net/api/search', {
        params: { q },
        headers: { 'User-Agent': 'RivoApp/1.0 (https://github.com/WhooAre-you/Rivo)' },
        timeout: 4500
      });
      const items = res.data || [];
      for (const item of items) {
        if (item.syncedLyrics) return parseLrc(item.syncedLyrics);
        if (item.plainLyrics) return parsePlain(item.plainLyrics, duration);
      }
    } catch (err) {}
  }

  if (primaryArtist && cleanTitle) {
    try {
      const ovhRes = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(primaryArtist)}/${encodeURIComponent(cleanTitle)}`, {
        timeout: 4000
      });
      if (ovhRes.data?.lyrics) {
        return parsePlain(ovhRes.data.lyrics, duration);
      }
    } catch {}
  }

  return [];
}


async function extractSoundCloudStream(title = '', artist = '', options = {}) {
  if (!title && !artist) return null;
  const bin = getYtDlpBin();
  const cleanTitle = (title || '')
    .replace(/\(Official.*?\)|\[Official.*?\]|Video|Audio|Lyrics|Visualizer|Clip|كليب|فيديو|رسمي/gi, '')
    .trim();

  const VERSION_KEYWORDS = [
    'red bull', 'symphonic', 'سيمفونيك', 'ريد بول', 'ريدبول',
    'live', 'حفلة', 'حفله', 'لايف',
    'remix', 'ريمكس',
    'acoustic', 'أكوستيك', 'اكوستيك',
    'orchestra', 'أوركسترا', 'اوركسترا',
    'piano', 'بيانو',
    'instrumental', 'موسيقى'
  ];

  const albumStr = (options?.album || '').toLowerCase();
  const titleStr = (title || '').toLowerCase();
  const extraKws = [];
  for (const kw of VERSION_KEYWORDS) {
    if ((albumStr.includes(kw) || titleStr.includes(kw)) && !cleanTitle.toLowerCase().includes(kw)) {
      extraKws.push(kw);
    }
  }

  const query = `${artist ? artist + ' ' : ''}${cleanTitle}${extraKws.length > 0 ? ' ' + extraKws.join(' ') : ''}`.trim();
  const targetDuration = Number(options?.duration || options?.targetDuration) || null;
  const strictDuration = Boolean(options?.strictDuration || targetDuration);

  const args = [
    '--no-check-certificates',
    '--no-playlist',
    '-j',
    `scsearch5:${query}`
  ];

  return new Promise((resolve) => {
    execFile(bin, args, { timeout: 9000 }, (err, stdout) => {
      if (err || !stdout) return resolve(null);
      const lines = stdout.trim().split(/\r?\n/);
      const candidates = [];

      for (const line of lines) {
        try {
          const item = JSON.parse(line.trim());
          if (!item) continue;

          let audioUrl = null;
          if (Array.isArray(item.formats)) {
            const httpFmt = item.formats.find(f => f.url && f.protocol === 'http' && (f.ext === 'mp3' || f.vcodec === 'none'));
            const anyFmt = item.formats.find(f => f.url && f.url.startsWith('http') && !f.url.includes('preview-media') && !f.url.includes('/preview/'));
            audioUrl = httpFmt?.url || anyFmt?.url || null;
          }
          if (!audioUrl && item.url && item.url.startsWith('http')) {
            audioUrl = item.url;
          }
          if (!audioUrl) continue;

          const dur = Number(item.duration) || 0;
          const candTitle = String(item.title || item.track || '').toLowerCase();
          const candUploader = String(item.uploader || '').toLowerCase();

          let matchesVersion = true;
          if (extraKws.length > 0) {
            matchesVersion = extraKws.some(kw => candTitle.includes(kw) || candUploader.includes(kw));
          }

          let durDiff = targetDuration && dur > 0 ? Math.abs(dur - targetDuration) : null;

          if (strictDuration && durDiff !== null && durDiff > 35) {
            continue;
          }

          if (extraKws.length > 0 && !matchesVersion) {
            continue;
          }

          candidates.push({
            url: audioUrl,
            duration: dur,
            durDiff: durDiff !== null ? durDiff : 999,
            matchesVersion: matchesVersion ? 1 : 0
          });
        } catch {}
      }

      if (candidates.length === 0) return resolve(null);

      candidates.sort((a, b) => {
        if (b.matchesVersion !== a.matchesVersion) return b.matchesVersion - a.matchesVersion;
        return a.durDiff - b.durDiff;
      });

      resolve(candidates[0].url);
    });
  });
}

function cleanupAudioCache() {
  try {
    const audioCacheDir = path.join(__dirname, '../../uploads/audio-cache');
    if (!fs.existsSync(audioCacheDir)) return;
    const files = fs.readdirSync(audioCacheDir);
    const now = Date.now();
    const maxAge = 24 * 3600 * 1000; // 24 hours
    for (const file of files) {
      try {
        const filePath = path.join(audioCacheDir, file);
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
        }
      } catch {}
    }
  } catch {}
}
setTimeout(cleanupAudioCache, 5000);
setInterval(cleanupAudioCache, 6 * 3600 * 1000);

module.exports = {
  escapeRegex,
  QURAN_REGEX,
  isQuranContent,
  SERVER_FAMOUS_RECITERS,
  normalizeArabic,
  detectQuranReciter,
  OFFICIAL_ALBUM_COVERS,
  autoFixAlbumCovers,
  CANONICAL_ARTIST_MAP,
  normalizeArtistName,
  getCanonicalArtistName,
  getArtistAliases,
  isValidAlbumName,
  syncTrackToAlbum,
  searchYouTubeId,
  fetchTrackCover,
  fetchTrackMetadata,
  getTrackKey,
  isMusicTrackServer,
  parseDurationFromLabel,
  searchTracksInternal,
  scrapePlaylistOrAlbum,
  autoAddTrackToUserLinksPlaylist,
  getYtDlpBin,
  ensureYtDlpBinary,
  initWarmYtWorker,
  extractViaWarmWorker,
  queueBackgroundAudioCache,
  extractDirectStreamUrl,
  resolveOfficialYouTubeAudioStream,
  parseLrc,
  parsePlain,
  fetchLrclibLyrics
};
