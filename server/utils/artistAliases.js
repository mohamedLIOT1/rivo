/**
 * Canonical Artist Aliases & Deduplication Dictionary (Server)
 * Unifies Arabic, Latin, and transliterated artist spellings
 * Strictly modularized (< 400 lines).
 */

const CANONICAL_ARTIST_MAP = {
  // Lege-Cy and all Arabic/English variants
  'lege cy': 'lege-cy',
  'lege-cy': 'lege-cy',
  'legecy': 'lege-cy',
  'legi c': 'lege-cy',
  'legi-c': 'lege-cy',
  'legic': 'lege-cy',
  'ليجي': 'lege-cy',
  'ليجي سي': 'lege-cy',
  'ليجي-سي': 'lege-cy',

  // Wegz
  'wegz': 'wegz',
  'ويجز': 'wegz',
  'wegzz': 'wegz',

  // Marwan Pablo
  'marwan pablo': 'marwan pablo',
  'pablo': 'marwan pablo',
  'مروان بابلو': 'marwan pablo',
  'بابلو': 'marwan pablo',

  // Marwan Moussa
  'marwan moussa': 'marwan moussa',
  'marwan mousa': 'marwan moussa',
  'مروان موسى': 'marwan moussa',
  'موسى سام': 'mousa sam',
  'mousa sam': 'mousa sam',

  // Abyusif
  'abyusif': 'abyusif',
  'أبيوسف': 'abyusif',
  'ابيوسف': 'abyusif',
  'ابو يوسف': 'abyusif',

  // Afroto
  'afroto': 'afroto',
  'عفروتو': 'afroto',

  // Cairokee / Amir Eid
  'cairokee': 'cairokee',
  'amir eid': 'cairokee',
  'amireid': 'cairokee',
  'امير عيد': 'cairokee',
  'أمير عيد': 'cairokee',
  'كايروكي': 'cairokee',

  // Amr Diab
  'amr diab': 'amr diab',
  'عمرو دياب': 'amr diab',
  'الهضبة': 'amr diab',
  'elhadaba': 'amr diab',
  'el hadaba': 'amr diab',

  // Mohamed Hamaki
  'hamaki': 'mohamed hamaki',
  'mohamed hamaki': 'mohamed hamaki',
  'محمد حماقي': 'mohamed hamaki',
  'حماقي': 'mohamed hamaki',

  // Tamer Hosny
  'tamer hosny': 'tamer hosny',
  'tamer hosni': 'tamer hosny',
  'تامر حسني': 'tamer hosny',

  // Essam Sasa
  'essam sasa': 'essam sasa',
  'عصام صاصا': 'essam sasa',
  'ساسا': 'essam sasa',

  // Muslim
  'muslim': 'muslim',
  'مسلم': 'muslim',

  // Hamo Bika
  'hamo bika': 'hamo bika',
  'حمو بيكا': 'hamo bika',

  // Hassan Shakosh
  'hassan shakosh': 'hassan shakosh',
  'حسن شاكوش': 'hassan shakosh',

  // Ahmed Saad
  'ahmed saad': 'ahmed saad',
  'احمد سعد': 'ahmed saad',
  'أحمد سعد': 'ahmed saad',

  // Sherine
  'sherine': 'sherine',
  'شيرين': 'sherine',
  'شيرين عبد الوهاب': 'sherine',
  'sherine abdel wahab': 'sherine',

  // Ziad Zaza
  'ziad zaza': 'ziad zaza',
  'زياد ظاظا': 'ziad zaza',
  'ظاظا': 'ziad zaza',

  // Flx
  'flx': 'flx',
  'flex': 'flx',
  'فليكس': 'flx',

  // Karim Osama
  'karim osama': 'karim osama',
  'كريم اسامة': 'karim osama',
  'كريم اسامه': 'karim osama',

  // Arsenic
  'arsenic': 'arsenic',
  'ارسينك': 'arsenic',

  // El Joker
  'el joker': 'el joker',
  'الجوكر': 'el joker',
  'joker': 'el joker',

  // Abo El Anwar
  'abo el anwar': 'abo el anwar',
  'ابو الانوار': 'abo el anwar',
  'أبو الأنوار': 'abo el anwar',

  // Double Zuksh
  'double zuksh': 'double zuksh',
  'دبل زوكش': 'double zuksh',

  // 3enba
  '3enba': '3enba',
  'enba': '3enba',
  'enaba': '3enba',
  'عنبة': '3enba',
  'عنبه': '3enba',

  // Massar Egbari
  'massar egbari': 'massar egbari',
  'مسار اجباري': 'massar egbari',
  'مسار إجباري': 'massar egbari',

  // Sharmoofers
  'sharmoofers': 'sharmoofers',
  'شارموفرز': 'sharmoofers',

  // Hamza Namira
  'hamza namira': 'hamza namira',
  'حمزة نمرة': 'hamza namira',
  'حمزه نمره': 'hamza namira',

  // Ahmed Santa
  'santa': 'santa',
  'ahmed santa': 'santa',
  'احمد سانتا': 'santa',
  'سانتا': 'santa',

  // Wingii
  'wingii': 'wingii',
  'wingi': 'wingii',
  'وينجي': 'wingii',
  'ونجي': 'wingii',
};

function normalizeString(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '')
    .replace(/[\-_|–—:]/g, ' ')
    .replace(/[^a-zA-Z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const { getCanonicalArtistName } = require('./artistAlbumUtils');

function resolveCanonicalArtist(rawNorm) {
  if (!rawNorm || typeof rawNorm !== 'string') return '';
  const trimmed = rawNorm.trim();
  // Exact lookup in local map first
  if (CANONICAL_ARTIST_MAP[trimmed.toLowerCase()]) {
    return CANONICAL_ARTIST_MAP[trimmed.toLowerCase()];
  }
  // Lookup via centralized canonical artist dictionary (exact alias match)
  const canonical = getCanonicalArtistName(trimmed);
  if (canonical && canonical.toLowerCase() !== trimmed.toLowerCase()) {
    return canonical.toLowerCase();
  }
  return trimmed;
}

function getPrimaryArtistNormalized(artist) {
  if (!artist || typeof artist !== 'string') return 'unknown';
  const clean = artist.toLowerCase().split(/\b(ft\.?|feat\.?|featuring|with|x|vs\.?)\b|[,&،\+\/]/i)[0];
  const norm = normalizeString(clean);
  return resolveCanonicalArtist(norm) || 'unknown';
}

module.exports = {
  CANONICAL_ARTIST_MAP,
  resolveCanonicalArtist,
  getPrimaryArtistNormalized
};
