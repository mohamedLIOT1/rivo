/**
 * Canonical Artist Aliases & Deduplication Dictionary
 * Unifies Arabic, Latin, and transliterated artist spellings
 * Strictly modularized (< 400 lines).
 */

export const CANONICAL_ARTIST_MAP = {
  // Lege-Cy
  'lege-cy': 'lege-cy',
  'lege cy': 'lege-cy',
  'legecy': 'lege-cy',
  'legi c': 'lege-cy',
  'legi-c': 'lege-cy',
  'legic': 'lege-cy',
  'ليجيسي': 'lege-cy',
  'ليجي': 'lege-cy',
  'ليجسي': 'lege-cy',
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
  'مروان موسي': 'marwan moussa',
  'موسى سام': 'mousa sam',
  'mousa sam': 'mousa sam',

  // El Joker
  'el joker': 'el joker',
  'eljoker': 'el joker',
  'joker': 'el joker',
  'الجوكر': 'el joker',
  'جوكر': 'el joker',

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
  'cairokeeofficial': 'cairokee',
  'cairokee official': 'cairokee',
  'amir eid': 'cairokee',
  'amireid': 'cairokee',
  'امير عيد': 'cairokee',
  'أمير عيد': 'cairokee',
  'كايروكي': 'cairokee',

  // Amr Diab
  'amr diab': 'amr diab',
  'عمرو دياب': 'amr diab',
  'الهضبة': 'amr diab',
  'الهضبه': 'amr diab',
  'elhadaba': 'amr diab',
  'el hadaba': 'amr diab',

  // Tamer Hosny
  'tamer hosny': 'tamer hosny',
  'tamer hosni': 'tamer hosny',
  'تامر حسني': 'tamer hosny',
  'تامر حسنى': 'tamer hosny',

  // Mohamed Hamaki
  'mohamed hamaki': 'mohamed hamaki',
  'hamaki': 'mohamed hamaki',
  'محمد حماقي': 'mohamed hamaki',
  'محمد حماقى': 'mohamed hamaki',
  'حماقي': 'mohamed hamaki',
  'حماقى': 'mohamed hamaki',

  // Tamer Ashour
  'tamer ashour': 'tamer ashour',
  'ashour': 'tamer ashour',
  'تامر عاشور': 'tamer ashour',
  'عاشور': 'tamer ashour',

  // Sherine
  'sherine': 'sherine',
  'sherine abdel wahab': 'sherine',
  'شيرين': 'sherine',
  'شرين': 'sherine',
  'شيرين عبد الوهاب': 'sherine',
  'شرين عبد الوهاب': 'sherine',

  // Essam Sasa
  'essam sasa': 'essam sasa',
  'sasa': 'essam sasa',
  'عصام صاصا': 'essam sasa',
  'صاصا': 'essam sasa',

  // Muslim
  'muslim': 'muslim',
  'مسلم': 'muslim',

  // Tul8te
  'tul8te': 'tul8te',
  'toolete': 'tul8te',
  'tulet': 'tul8te',
  'تو ليت': 'tul8te',
  'توليت': 'tul8te',
  'توو ليت': 'tul8te',

  // Ahmed Saad
  'ahmed saad': 'ahmed saad',
  'أحمد سعد': 'ahmed saad',
  'احمد سعد': 'ahmed saad',

  // Ramy Sabry
  'ramy sabry': 'ramy sabry',
  'رامي صبري': 'ramy sabry',
  'رامى صبرى': 'ramy sabry',

  // Mahmoud El Esseily
  'mahmoud el esseily': 'mahmoud el esseily',
  'esseily': 'mahmoud el esseily',
  'محمود العسيلي': 'mahmoud el esseily',
  'محمود العسيلى': 'mahmoud el esseily',

  // Ziad Zaza
  'ziad zaza': 'ziad zaza',
  'zaza': 'ziad zaza',
  'زياد ظاظا': 'ziad zaza',
  'ظاظا': 'ziad zaza',

  // DizzyTooSkinny
  'dizzytooskinny': 'dizzytooskinny',
  'dizzy': 'dizzytooskinny',
  'ديزي': 'dizzytooskinny',

  // Karim Osama
  'karim osama': 'karim osama',
  'كريم اسامة': 'karim osama',
  'كريم اسامه': 'karim osama',

  // Shahyn
  'shahyn': 'shahyn',
  'شاهين': 'shahyn',

  // Batistuta
  'batistuta': 'batistuta',
  'باتيستوتا': 'batistuta',

  // Arsenik
  'arsenik': 'arsenik',
  'ارسينيك': 'arsenik',

  // FL EX
  'fl ex': 'fl ex',
  'flex': 'fl ex',
  'فليكس': 'fl ex',

  // Shaabi
  'hassan shakosh': 'hassan shakosh',
  'حسن شاكوش': 'hassan shakosh',
  'omar kamal': 'omar kamal',
  'عمر كمال': 'omar kamal',
  'hamo bika': 'hamo bika',
  'حمو بيكا': 'hamo bika',
  'enaba': 'enaba',
  'عنبة': 'enaba',
  'عنبه': 'enaba',
  'houda bondok': 'houda bondok',
  'حودة بندق': 'houda bondok',
  'حوده بندق': 'houda bondok',

  // Arabic Icons
  'angham': 'angham',
  'أنغام': 'angham',
  'انغام': 'angham',
  'asala': 'asala',
  'assala': 'asala',
  'أصالة': 'asala',
  'اصالة': 'asala',
  'elissa': 'elissa',
  'إليسا': 'elissa',
  'اليسا': 'elissa',
  'nancy ajram': 'nancy ajram',
  'نانسي عجرم': 'nancy ajram',
  'bahaa sultan': 'bahaa sultan',
  'بهاء سلطان': 'bahaa sultan',
  'wael jassar': 'wael jassar',
  'وائل جسار': 'wael jassar',

  // International Icons
  'the weeknd': 'the weeknd',
  'weeknd': 'the weeknd',
  'ذا ويكند': 'the weeknd',
  'ويكند': 'the weeknd',
  'drake': 'drake',
  'دريك': 'drake',
  'travis scott': 'travis scott',
  'ترافيس سكوت': 'travis scott',
  'eminem': 'eminem',
  'إمينيم': 'eminem',
  'امينيم': 'eminem',
  'taylor swift': 'taylor swift',
  'تايلور سويفت': 'taylor swift',
  'billie eilish': 'billie eilish',
  'بيلي إيليش': 'billie eilish',
  'بيلي ايليش': 'billie eilish',
  'dua lipa': 'dua lipa',
  'دوا ليبا': 'dua lipa',
  'coldplay': 'coldplay',
  'كولدبلاي': 'coldplay'
};

/**
 * Returns canonical artist name for any input variant or alias.
 */
export function getCanonicalArtist(name) {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim().toLowerCase();
  if (CANONICAL_ARTIST_MAP[trimmed]) return CANONICAL_ARTIST_MAP[trimmed];
  for (const [alias, canonical] of Object.entries(CANONICAL_ARTIST_MAP)) {
    if (trimmed.includes(alias) || alias.includes(trimmed)) return canonical;
  }
  return name.trim();
}

export const resolveCanonicalArtist = getCanonicalArtist;

// Precomputed canonical -> Set of aliases for instant O(1) lookup
const CANONICAL_TO_ALIASES_MAP = new Map();
for (const [alias, canonical] of Object.entries(CANONICAL_ARTIST_MAP)) {
  const cKey = canonical.toLowerCase().trim();
  if (!CANONICAL_TO_ALIASES_MAP.has(cKey)) {
    CANONICAL_TO_ALIASES_MAP.set(cKey, new Set([cKey]));
  }
  CANONICAL_TO_ALIASES_MAP.get(cKey).add(alias.toLowerCase().trim());
}

/**
 * Returns all known aliases (Arabic, English, Franco, nicknames) for an artist.
 */
export function getAllArtistAliases(name) {
  if (!name || typeof name !== 'string') return [];
  const canonical = getCanonicalArtist(name).toLowerCase().trim();
  const set = CANONICAL_TO_ALIASES_MAP.get(canonical);
  if (set) {
    return Array.from(set);
  }
  return [name.toLowerCase().trim()];
}

