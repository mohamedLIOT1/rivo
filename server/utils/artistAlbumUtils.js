const mongoose = require('mongoose');
const { Album } = require('../models');
const { escapeRegex } = require('./quranUtils');
const { CANONICAL_ARTIST_GROUPS } = require('./canonicalArtistData');

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
  'agzakhana': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/65/7c/94/657c9473-c77e-601c-9bbc-4540ecc2c08b/6221216496768_Artwork.jpg/1200x1200bb.jpg',
  'talatini': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/21/df/b8/21dfb8ce-a9ea-722d-2fe4-d2c679a781d4/cover.jpg/1200x1200bb.jpg',
  'تلاتيني': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/21/df/b8/21dfb8ce-a9ea-722d-2fe4-d2c679a781d4/cover.jpg/1200x1200bb.jpg',
  'matador': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/2c/31/54/2c31548e-cfbe-639a-7c2a-89a19c629e46/195497282647.jpg/1200x1200bb.jpg',
  'ماتادور': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/2c/31/54/2c31548e-cfbe-639a-7c2a-89a19c629e46/195497282647.jpg/1200x1200bb.jpg',
  'bgd': 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/b8/01/5e/b8015e1f-13a8-44d4-20b1-ce3cb6ea861a/196626466989.jpg/1200x1200bb.jpg',
  '191-181': 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/3b/b1/68/3bb16886-f404-54c2-9e20-7f2cb09e13f4/196925008549.jpg/1200x1200bb.jpg',
  'florida': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/4a/1c/91/4a1c91d3-45fe-515c-3f1f-df436f521bb3/195497478057.jpg/1200x1200bb.jpg',
  'aqareb': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/33/f0/ec/33f0ece3-d007-4cdd-03b7-de6dfaa1442b/199806680476.jpg/1200x1200bb.jpg',
  'sahran': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/11/49/a2/1149a2a7-5c55-bfa3-0c46-f94e9f90cf05/859737402638_Cover.jpg/1200x1200bb.jpg',
  'سهران': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/11/49/a2/1149a2a7-5c55-bfa3-0c46-f94e9f90cf05/859737402638_Cover.jpg/1200x1200bb.jpg',
  'kol hayaty': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/53/72/e3/5372e3cc-173f-c5ed-88ac-d19ab6b381e8/5061028762894.jpg/1200x1200bb.jpg',
  'كل حياتي': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/53/72/e3/5372e3cc-173f-c5ed-88ac-d19ab6b381e8/5061028762894.jpg/1200x1200bb.jpg',
  'meaddy el nas': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d2/e1/97/d2e19759-e749-749a-a439-1e310ac89f14/889502763589.jpg/1200x1200bb.jpg',
  'معدي الناس': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d2/e1/97/d2e19759-e749-749a-a439-1e310ac89f14/889502763589.jpg/1200x1200bb.jpg',
  'ahla w ahla': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/a8/81/9f/a8819f9f-99f8-eb28-6a73-fcae47843bc8/3616842352848.jpg/1200x1200bb.jpg',
  'أحلى وأحلى': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/a8/81/9f/a8819f9f-99f8-eb28-6a73-fcae47843bc8/3616842352848.jpg/1200x1200bb.jpg',
  'eish beshoak': 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/15/d5/43/15d54341-26ec-8be5-61be-d7f4be2b8ee3/3615934057869.png/1200x1200bb.jpg',
  'عيش بشوقك': 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/15/d5/43/15d54341-26ec-8be5-61be-d7f4be2b8ee3/3615934057869.png/1200x1200bb.jpg',
  'khallik foulazy': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/b4/d9/31/b4d9319e-e4a8-4221-ce16-7eebe39695be/3616553818961.jpg/1200x1200bb.jpg',
  'خليك فولاذي': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/b4/d9/31/b4d9319e-e4a8-4221-ce16-7eebe39695be/3616553818961.jpg/1200x1200bb.jpg',
  'ashamgy': 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/37/10/7c/37107c11-9a70-8b1d-fc30-c322d7ba59eb/3616848805362.jpg/1200x1200bb.jpg',
  'عشأنجي': 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/37/10/7c/37107c11-9a70-8b1d-fc30-c322d7ba59eb/3616848805362.jpg/1200x1200bb.jpg',
  'tegy nrahan': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/7c/4f/7b/7c4f7b49-bdf3-85f2-95f2-6c39bb2f9746/3616843477816.jpg/1200x1200bb.jpg',
  'تيجي نتراهن': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/7c/4f/7b/7c4f7b49-bdf3-85f2-95f2-6c39bb2f9746/3616843477816.jpg/1200x1200bb.jpg',
  'ayam': 'https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/6c/0e/41/6c0e4171-897b-bb68-ea48-fbf5272a2754/859730591025_Cover.jpg/1200x1200bb.jpg',
  'أيام': 'https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/6c/0e/41/6c0e4171-897b-bb68-ea48-fbf5272a2754/859730591025_Cover.jpg/1200x1200bb.jpg'
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

const CANONICAL_ARTIST_MAP = CANONICAL_ARTIST_GROUPS;

function normalizeArabicText(str) {
  if (!str) return '';
  return str
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\u0600-\u06FF0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeLatinText(str) {
  if (!str) return '';
  return str
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeArtistName(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let clean = raw.trim();
  clean = clean.replace(/\s*-\s*topic\b/gi, '');
  clean = clean.replace(/\b(official(?:\s*(?:channel|music|video|audio|records|tv|page))?|offical|vevo|topic|channel)\b/gi, '');
  clean = clean.replace(/^["'\[\(]+|["'\]\)]+$/g, '');
  clean = clean.replace(/\s+/g, ' ').trim();
  return clean;
}

function findCanonicalInGroup(text) {
  if (!text) return null;
  const lower = text.trim().toLowerCase();
  const normAr = normalizeArabicText(text);
  const normLat = normalizeLatinText(text);

  for (const group of CANONICAL_ARTIST_MAP) {
    if (group.canonical.toLowerCase() === lower) return group.canonical;
    for (const alias of group.aliases) {
      const aliasLower = alias.toLowerCase();
      if (aliasLower === lower) return group.canonical;
      if (normLat && normLat === normalizeLatinText(alias)) return group.canonical;
      if (normAr && normAr === normalizeArabicText(alias)) return group.canonical;
    }
  }
  return null;
}

/**
 * Universal bilingual artist resolution.
 * Detects Latin + Arabic variants separated by '-', '/', parentheses, brackets, or pipes.
 * Ensures that names like "Shehab - شهاب" are NEVER treated as two separate artists.
 */
function resolveBilingualArtist(rawStr) {
  if (!rawStr || typeof rawStr !== 'string') return null;
  const str = rawStr.trim();

  // Direct alias match first
  const direct = findCanonicalInGroup(str);
  if (direct) return direct;

  const hasArabic = /[\u0600-\u06FF]/.test(str);
  const hasLatin = /[a-zA-Z]/.test(str);
  if (!hasArabic || !hasLatin) return null;

  // Check parentheses/brackets: e.g. "Shehab (شهاب)", "شهاب (Shehab)", "Tul8te (تووليت)"
  const parenMatch = str.match(/^([^(]+)\s*\(([^)]+)\)$/) || str.match(/^([^[Block]+)\s*\[([^\]]+)\]$/);
  if (parenMatch) {
    const p1 = parenMatch[1].trim();
    const p2 = parenMatch[2].trim();
    const c1 = findCanonicalInGroup(p1);
    const c2 = findCanonicalInGroup(p2);
    if (c1 && c2 && c1 === c2) return c1;
    if (c1 && !c2) return c1;
    if (c2 && !c1) return c2;
    if (/[a-zA-Z]/.test(p1) && !/[\u0600-\u06FF]/.test(p1)) return p1;
    if (/[a-zA-Z]/.test(p2) && !/[\u0600-\u06FF]/.test(p2)) return p2;
  }

  // Check standard bilingual delimiters: - – — / \ | • ~ I
  const delimMatch = str.split(/\s*[-–—/\\|•~]\s*|\s+I\s+/);
  if (delimMatch.length === 2) {
    const left = delimMatch[0].trim();
    const right = delimMatch[1].trim();
    const cLeft = findCanonicalInGroup(left);
    const cRight = findCanonicalInGroup(right);
    if (cLeft && cRight && cLeft === cRight) return cLeft;
    if (cLeft && !cRight) return cLeft;
    if (cRight && !cLeft) return cRight;
    if (/[a-zA-Z]/.test(left) && !/[\u0600-\u06FF]/.test(left)) return left;
    if (/[a-zA-Z]/.test(right) && !/[\u0600-\u06FF]/.test(right)) return right;
  }

  // Generic extraction of Arabic & Latin chunks when separated by spaces
  const arabicPart = str.replace(/[^\u0600-\u06FF\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const latinPart = str.replace(/[^\u0020-\u007E]/g, ' ').replace(/[-–—/\\|•~()[\]{}]/g, ' ').replace(/[^a-zA-Z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();

  const cAr = findCanonicalInGroup(arabicPart);
  const cLat = findCanonicalInGroup(latinPart);
  if (cAr && cLat && cAr === cLat) return cAr;
  if (cLat && !cAr) return cLat;
  if (cAr && !cLat) return cAr;

  return null;
}

const COLLAB_SPLIT_REGEX = /(?:\s*[,،;&+]\s*|\s+(?:ft\.?|feat\.?|featuring|with|مع|vs\.?)\s+|\s+[xX]\s+|\s+و\s+)/i;

function splitArtistNames(raw) {
  if (!raw || typeof raw !== 'string') return [];
  const rawStr = String(raw).trim();

  // Protect bilingual slashes (e.g. "Latin / Arabic" or "Arabic / Latin") from being split
  const sanitized = rawStr.replace(/([a-zA-Z0-9\s]+)\s*\/\s*([\u0600-\u06FF\s]+)/g, '$1 - $2')
                          .replace(/([\u0600-\u06FF\s]+)\s*\/\s*([a-zA-Z0-9\s]+)/g, '$1 - $2');

  // If there are NO collaboration delimiters, check if this is a single bilingual artist
  if (!COLLAB_SPLIT_REGEX.test(sanitized)) {
    const wholeBilingual = resolveBilingualArtist(sanitized);
    if (wholeBilingual) return [wholeBilingual];
  }

  // Split on true collaboration delimiters
  const parts = sanitized
    .split(COLLAB_SPLIT_REGEX)
    .map(p => {
      const clean = normalizeArtistName(p).trim();
      return getCanonicalArtistName(clean);
    })
    .filter(p => p.length > 0);

  const unique = [];
  for (const p of parts) {
    if (!unique.includes(p)) unique.push(p);
  }
  return unique.length > 0 ? unique : [getCanonicalArtistName(rawStr)];
}

function getDirectCanonicalArtist(rawName) {
  if (!rawName || typeof rawName !== 'string') return '';
  const trimmed = rawName.trim();
  const bilingual = resolveBilingualArtist(trimmed);
  if (bilingual) return bilingual;
  return findCanonicalInGroup(trimmed) || '';
}

function getPrimaryArtist(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  const direct = getDirectCanonicalArtist(trimmed);
  if (direct) return direct;

  const parts = splitArtistNames(trimmed);
  if (parts.length > 1) {
    for (const part of parts) {
      const can = getDirectCanonicalArtist(part);
      if (can) return can;
    }
    return parts[0];
  }
  return trimmed;
}

function getCanonicalArtistName(rawName) {
  if (!rawName || typeof rawName !== 'string') return '';
  const trimmed = rawName.trim();
  const direct = getDirectCanonicalArtist(trimmed);
  if (direct) return direct;

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
    'playlist', 'my playlist', 'favorites', 'liked songs', 'new playlist',
    'quran', 'holy quran', 'القرآن الكريم', 'القران الكريم', 'مصحف', 'تلاوات'
  ];
  if (invalid.includes(clean)) return false;
  if (clean.startsWith('playlist') || clean.endsWith('playlist')) return false;
  if (clean.length < 2) return false;
  return true;
}

async function syncTrackToAlbum(track) {
  if (!track || !track.title || !track.artist || !track.album) return null;
  if (track.isQuran || track.genre === 'Holy Quran') return null;
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

module.exports = {
  OFFICIAL_ALBUM_COVERS,
  autoFixAlbumCovers,
  CANONICAL_ARTIST_MAP,
  normalizeArtistName,
  splitArtistNames,
  getPrimaryArtist,
  getCanonicalArtistName,
  getArtistAliases,
  isValidAlbumName,
  syncTrackToAlbum
};
