// Intelligent Popularity & Hit Scoring Engine for Rivo
// Used across Web and React Native APK for dynamic top charts

export const MEGA_HITS = [
  'el bakht', 'البخت', 'el keif', 'الكيف', 'kan lak maaya', 'kan lak ma3aya', 'كان لك معايا',
  'ya abyad ya eswed', 'يا ابيض يا اسود', 'dorak gai', 'دورك جاي', 'ghaba', 'غابة',
  'el gemeza', 'الجميزة', 'sheraton', 'شيراتون', 'tamally maak', 'تملي معاك', 'nour el ein', 'نور العين',
  'habibi leh', 'حبيبي ليه', 'law kan', 'لو كان', 'kol haga betaady', 'كل حاجة بتعدي',
  'layla', 'ليلى', 'dinosaur', 'داينصور', 'betetmahey', 'بتتمحي', 'asef', 'اسف',
  'mab2etsh bahes', 'مابقتش باحس', 'roma', 'روما', 'james dean', 'جيمس دين',
  'ethbat makanak', 'اثبت مكانك', 'barbary', 'بربري', 'control', 'كنترول', 'sindbad', 'سندباد',
  'el halal', 'الحلال', 'tesla', 'تسلا', 'alshan feena', 'علشان فينا', 'tayer', 'طاير',
  'rivo', 'ريفو', '21', 'واحد وعشرين', 'keify keda', 'keif keda', 'كيفي كده', 'salka', 'سلكة',
  'asyad el balad', 'اسياد البلد', 'bazet', 'باظت', 'matigy n3eesh', 'ما تيجى نعيش',
  'leh benkhaby', 'ليه بنخبي', 'baet waheed', 'بقيت وحيد', 'seneen', 'سنين',
  'amira', 'اميرة', 'brazil', 'برازيل', 'far2 kheter', 'فرق خبرة', 'metkattef', 'متكتف',
  'ana negm', 'انا نجم', 'sabry qaleel', 'صبري قليل', 'adrenaline', 'ادرينالين',
  'back to black', 'starboy', 'the less i know the better', 'apocalypse'
];

export const MAJOR_HITS = [
  'marboot be astek', 'marbout be astek', 'مربوط باستيك', 'مربوط بآستيك', 'noaata beida', 'نقطة بيضا',
  'nas w nas', 'ناس وناس', 'ناس و ناس', 'akher oghnya', 'اخر اغنية', 'ana el sout', 'أنا الصوت',
  'matkhafsh men el hokooma', 'متخافش من الحكومة', 'ghammed einak', 'غمض عينك',
  'samurai', 'ساموراي', 'basrah w atooho', 'بسرح واتوه', 'nefsy ahebbek', 'نفسي احبك',
  'helmy ana', 'حلمي انا', 'aandi fekra', 'عندي فكرة', 'zay shams w qamar', 'زي شمس وقمر',
  'zina', 'زينة', 'salamat', 'سلامات', 'mesh bel hazout', 'مش بالحظوظ', 'khashab', 'خشب',
  'bayaa', 'بياعة', 'kollaha ghaleyat', 'كلها غيرانة', 'ekhteyarat', 'اختياراتي',
  'tegy ntrahan', 'تيجي نتراهن', 'el mohakma', 'المحكمة', '24 kiraat', '24 قيراط',
  'batal 3alam', 'ابطال العالم', '7adota almany', 'haddouta almany', 'حدوتة الماني',
  'drogba', 'دروجبا', 'yom gedid', 'يوم جديد', 'saa\'b el ekhteyar', 'صعب الاختيار',
  'wayah', 'وياه', 'ragea', 'راجع', 'aks baad', 'عكس بعض', 'helwa el bedayat', 'حلوة البدايات',
  'wana maak', 'وانا معاك', 'hayeish yeftekerni', 'هيعيش يفتكرني', 'kol hayaty', 'كل حياتي',
  'ya ana ya la', 'يا انا يا لاء', 'amaken el sahar', 'اماكن السهر', 'enta el haz', 'انت الحظ',
  'tutu', 'توتو', 'awghad', 'أوغاد', 'hokomdar', 'حكمدار', 'balad el ghorba', 'بلد الغربة',
  'agzakhana', 'اجزاخانة', 'placebo', 'بلاسيبو', 'plan-b', 'بلان بي', 'tafeh', 'تفه',
  'tany', 'ثاني', 'mafesh mane3', 'مفيش مانع', 'fel galeed', 'في الجليد', 'tharthara', 'ثرثرة',
  'afareet', 'عفاريت', 'salmonella', 'سالمونيلا', 'el ghasala', 'الغسالة', 'khamsa', 'خمسة',
  'free', 'فيري', 'atary', 'اتاري', 'cinderella', 'سندريلا', 'deja vu', 'ديجا فو',
  'leha ghabet', 'ليها غابت', 'magrooh', 'مجروح', 'rouh', 'روح', '3yoonak', 'عيونك',
  'ma balash', 'ما بلاش', 'ya sattar', 'يا ستار', 'la malama', 'لا ملامة',
  'el lela ya samra', 'الليلة يا سمرا', 'shamandora', 'شمندورة'
];

export const ARTIST_GLOBAL_SCORES = {
  'wegz': 2000000,
  'cairokee': 1900000,
  'cairokeeofficial': 1900000,
  'amr diab': 1800000,
  'marwan pablo': 1750000,
  'tul8te': 1700000,
  'amir eid': 1650000,
  'lege-cy': 1600000,
  'marwan moussa': 1500000,
  'tamer ashour': 1400000,
  'sherine': 1400000,
  'mohamed mounir': 1350000,
  'hamaki': 1350000,
  'afroto': 1300000,
  'el joker': 1200000,
  'abyusif': 1100000,
  'shahyn': 1050000,
  'mousv': 1000000
};

export function normalizeArabicText(str = '') {
  return String(str)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^a-z0-9\u0600-\u06FF]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NORM_MEGA_HITS = MEGA_HITS.map(h => normalizeArabicText(h));
const NORM_MAJOR_HITS = MAJOR_HITS.map(h => normalizeArabicText(h));
const ARTIST_SCORES_ENTRIES = Object.entries(ARTIST_GLOBAL_SCORES);

export function getGlobalTrackScore(t) {
  if (!t) return 0;
  const normTitle = normalizeArabicText(t.title);
  const normArtist = normalizeArabicText(t.artist);
  let score = 0;

  // Real engagement: plays, views, likes
  const plays = Number(t.plays) || 0;
  const views = Number(t.views) || 0;
  const likes = Number(t.likes) || 0;
  score += plays * 100000;
  score += views;
  score += likes * 50000;
  if (t.popular) score += 15000000;

  // Global Mega Hits
  for (let i = 0; i < NORM_MEGA_HITS.length; i++) {
    const nh = NORM_MEGA_HITS[i];
    if (normTitle === nh || normTitle.includes(nh)) {
      score += 35000000;
      break;
    }
  }

  // Major Hits
  for (let i = 0; i < NORM_MAJOR_HITS.length; i++) {
    const nh = NORM_MAJOR_HITS[i];
    if (normTitle === nh || normTitle.includes(nh)) {
      score += 18000000;
      break;
    }
  }

  // Artist Global Stature
  for (let i = 0; i < ARTIST_SCORES_ENTRIES.length; i++) {
    const [art, weight] = ARTIST_SCORES_ENTRIES[i];
    if (normArtist.includes(art)) {
      score += weight;
      break;
    }
  }

  return score;
}

/**
 * Sorts tracks by popularity score and applies smart artist interleaving.
 * Prevents more than 2 consecutive tracks from the same artist in the top charts.
 */
export function sortTracksByPopularity(trackList = []) {
  if (!Array.isArray(trackList) || trackList.length === 0) return [];

  // 1. Calculate and attach score
  const scored = trackList.map(t => ({
    track: t,
    score: getGlobalTrackScore(t),
    normArtist: normalizeArabicText(t.artist || 'unknown')
  }));

  // 2. Sort by score descending (with title tie-break)
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.track.title || '').localeCompare(b.track.title || '');
  });

  // 3. Artist Interleaving: Prevent back-to-back clustering of the same artist
  const result = [];
  const remaining = [...scored];
  let lastArtist = '';
  let secondLastArtist = '';

  while (remaining.length > 0) {
    let pickIndex = -1;

    // Try finding the best track whose artist isn't repeating twice in a row
    for (let i = 0; i < remaining.length; i++) {
      const art = remaining[i].normArtist;
      if (art && art === lastArtist && art === secondLastArtist) {
        continue; // Too many from this artist consecutively, skip
      }
      pickIndex = i;
      break;
    }

    // Fallback: If all remaining belong to the same artist, take the next one
    if (pickIndex === -1) {
      pickIndex = 0;
    }

    const [chosen] = remaining.splice(pickIndex, 1);
    result.push(chosen.track);
    secondLastArtist = lastArtist;
    lastArtist = chosen.normArtist;
  }

  return result;
}
