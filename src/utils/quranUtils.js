// Utility to accurately identify, separate, and format Quranic content and reciters

export const QURAN_REGEX = /(\bسورة|\bسوره|\bقرآن|\bقران|\bالمصحف|\bمصحف|\bتلاوة|\bتلاوه|\bترتيل|\bتجويد|المنشاوي|عبد\s*الباسط|الحصري|البناء|الطبلاوي|العفاسي|ماهر\s*المعيقلي|السديس|الشريم|ياسر\s*الدوسري|مشاري\s*العفاسي|أحمد\s*العجمي|سعد\s*الغامدي|\bsurah\b|\bquran\b|\bkoran\b|\brecitation\b|\btajweed\b|\btartil\b|\bmushaf\b)/i;

export const FAMOUS_RECITERS = [
  {
    name: 'مشاري راشد العفاسي',
    aliases: ['مشاري العفاسي', 'العفاسي', 'العفاسى', 'مشاري راشد', 'مشارى العفاسى', 'مشارى راشد', 'مشاري', 'مشارى', 'alafasy', 'mishary', 'mishari', 'al-afasy'],
  },
  {
    name: 'محمود خليل الحصري',
    aliases: ['محمود خليل الحصرى', 'الحصري', 'الحصرى', 'خليل الحصري', 'خليل الحصرى', 'al-hussary', 'al-hosary', 'hussary', 'hosary'],
  },
  {
    name: 'محمد صديق المنشاوي',
    aliases: ['محمد صديق المنشاوى', 'المنشاوي', 'المنشاوى', 'صديق المنشاوي', 'صديق المنشاوى', 'minshawi', 'al-minshawi', 'menshawy'],
  },
  {
    name: 'عبد الباسط عبد الصمد',
    aliases: ['عبدالباسط عبدالصمد', 'عبد الباسط', 'عبدالباسط', 'عبد الصمد', 'عبدالصمد', 'abdulbasit', 'abdelbasset', 'abdul basit'],
  },
  {
    name: 'ماهر المعيقلي',
    aliases: ['ماهر المعيقلى', 'المعيقلي', 'المعيقلى', 'maher al muaiqly', 'maher al-muaiqly', 'al-muaiqly', 'muaiqly', 'maher'],
  },
  {
    name: 'سعد الغامدي',
    aliases: ['سعد الغامدى', 'الغامدي', 'الغامدى', 'saad al ghamdi', 'al-ghamdi', 'ghamdi'],
  },
  {
    name: 'ياسر الدوسري',
    aliases: ['ياسر الدوسرى', 'الدوسري', 'الدوسرى', 'yasser al dossari', 'al-dossari', 'dossari'],
  },
  {
    name: 'عبد الرحمن السديس',
    aliases: ['عبدالرحمن السديس', 'السديس', 'al-sudais', 'sudais', 'abdul rahman al-sudais'],
  },
  {
    name: 'سعود الشريم',
    aliases: ['سعود الشريم', 'الشريم', 'al-shuraim', 'shuraim', 'saud al-shuraim'],
  },
  {
    name: 'أحمد بن علي العجمي',
    aliases: ['أحمد العجمي', 'احمد العجمي', 'أحمد العجمى', 'احمد العجمى', 'العجمي', 'العجمى', 'al-ajmy', 'al-ajmi', 'ajmi'],
  },
  {
    name: 'فارس عباد',
    aliases: ['فارس عباد', 'عباد', 'fares abbad', 'abbad'],
  },
  {
    name: 'ناصر القطامي',
    aliases: ['ناصر القطامى', 'القطامي', 'القطامى', 'al-qatami', 'qatami'],
  },
  {
    name: 'إدريس أبكر',
    aliases: ['ادريس ابكر', 'أبكر', 'ابكر', 'idris abkar'],
  },
  {
    name: 'خالد الجليل',
    aliases: ['خالد الجليل', 'الجليل', 'khalid al jalil', 'al-jalil'],
  },
  {
    name: 'علي عبد الله جابر',
    aliases: ['علي جابر', 'على جابر', 'ali jaber'],
  },
  {
    name: 'محمد أيوب',
    aliases: ['محمد ايوب', 'أيوب', 'ايوب', 'mohamed ayyoub', 'ayyoub'],
  },
  {
    name: 'أبو بكر الشاطري',
    aliases: ['ابو بكر الشاطري', 'ابوبكر الشاطري', 'الشاطري', 'الشاطرى', 'abu bakr al shatri', 'al-shatri'],
  },
  {
    name: 'محمود علي البنا',
    aliases: ['محمود على البنا', 'على البنا', 'علي البنا', 'البنا', 'al-banna', 'mahmoud ali al banna'],
  },
  {
    name: 'محمد محمود الطبلاوي',
    aliases: ['الطبلاوي', 'الطبلاوى', 'محمود الطبلاوي', 'tablawi', 'al-tablawi'],
  },
  {
    name: 'مصطفى إسماعيل',
    aliases: ['مصطفى اسماعيل', 'mustafa ismail'],
  },
  {
    name: 'محمد رفعت',
    aliases: ['الشيخ رفعت', 'mohamed refat'],
  },
  {
    name: 'هزاع البلوشي',
    aliases: ['هزاع البلوشى', 'البلوشي', 'البلوشى', 'hazza al balushi'],
  },
  {
    name: 'رعد الكردي',
    aliases: ['رعد الكردى', 'الكردي', 'الكردى', 'raad al kurdi'],
  },
  {
    name: 'إسلام صبحي',
    aliases: ['إسلام صبحى', 'اسلام صبحي', 'اسلام صبحى', 'islam sobhi'],
  },
  {
    name: 'وديع اليمني',
    aliases: ['وديع اليمنى', 'اليمني', 'اليمنى', 'wadih al yamani'],
  },
  {
    name: 'علي الحذيفي',
    aliases: ['علي الحذيفى', 'على الحذيفى', 'الحذيفي', 'الحذيفى', 'al-hudhaify'],
  },
  {
    name: 'عبد الله بصفر',
    aliases: ['عبدالله بصفر', 'بصفر', 'basfar'],
  },
  {
    name: 'محمد جبريل',
    aliases: ['محمد جبريل', 'جبريل'],
  },
  {
    name: 'توفيق الصائغ',
    aliases: ['توفيق الصائغ', 'الصائغ'],
  },
  {
    name: 'صلاح بو خاطر',
    aliases: ['صلاح بو خاطر', 'بو خاطر'],
  },
  {
    name: 'كامل يوسف البهتيمي',
    aliases: ['يوسف البهتيمي', 'البهتيمي', 'البهتيمى'],
  },
  {
    name: 'أحمد نعينع',
    aliases: ['احمد نعينع', 'نعينع'],
  },
  {
    name: 'عبد الرشيد صوفي',
    aliases: ['عبدالرشيد صوفي', 'رشيد صوفي', 'rashid sufi'],
  },
  {
    name: 'بدر التركي',
    aliases: ['بدر التركي', 'التركي'],
  },
  {
    name: 'هيثم الدخين',
    aliases: ['هيثم الدخين', 'الدخين'],
  },
  {
    name: 'شريف مصطفى',
    aliases: ['شريف مصطفى', 'sherif mostafa'],
  }
];

const GENERIC_CHANNEL_NAMES = [
  'balligho', 'القرآن الكريم', 'قرآن كريم', 'القران الكريم', 'قران كريم',
  'quran', 'holy quran', 'the holy quran', 'youtube', 'unknown', 'unknown artist',
  'قارئ غير معروف', 'تلاوات', 'قناة', 'مصحف', 'المصحف', 'تلاوة خاشعة', 'various artists',
  'islamic', 'islam', 'audio', 'sound', 'channel'
];

export function normalizeArabicText(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

export function isQuranContent(item) {
  if (!item) return false;
  if (item.isQuran === true) return true;
  const str = `${item.title || item.name || ''} ${item.artist || ''} ${item.album || ''} ${item.genre || ''} ${item.description || ''}`;
  return QURAN_REGEX.test(str);
}

export function cleanQuranTrackTitle(title) {
  if (!title || typeof title !== 'string') return '';
  let cleaned = title
    .replace(/\|\s*بدون\s*إ?علانات\s*\d*/gi, '')
    .replace(/[\(\[\{]\s*بدون\s*إ?علانات\s*[\)\]\}]/gi, '')
    .replace(/\|\s*كامل\s*بدون\s*فواصل/gi, '')
    .replace(/^\d{2,3}\s*[-–]\s*/, '')
    .replace(/[\s|–-]+$/, '')
    .trim();
  return cleaned || title;
}

export function getQuranReciterName(trackOrItem, playlists = []) {
  if (!trackOrItem) return 'قارئ غير معروف';

  // 1. Gather all candidate text sources
  let allText = `${trackOrItem.artist || ''} ${trackOrItem.title || trackOrItem.name || ''} ${trackOrItem.album || ''} ${trackOrItem.description || ''}`;

  // If a track object has an associated playlist or we have a playlists array
  if (Array.isArray(playlists) && playlists.length > 0) {
    const tId = trackOrItem.id || trackOrItem._id;
    const parentPl = playlists.find(pl => 
      (pl.trackIds && tId && pl.trackIds.includes(tId)) ||
      (trackOrItem.album && pl.name && trackOrItem.album === pl.name)
    );
    if (parentPl) {
      allText += ` ${parentPl.name || ''} ${parentPl.description || ''}`;
    }
  }

  const normAllText = normalizeArabicText(allText);

  // 2. Check famous reciters (prioritizing longer matching aliases)
  for (const reciter of FAMOUS_RECITERS) {
    for (const alias of reciter.aliases) {
      const normAlias = normalizeArabicText(alias);
      if (normAlias.length >= 3 && normAllText.includes(normAlias)) {
        return reciter.name;
      }
    }
  }

  // 3. Extract dynamically using prefix if mentioned (الشيخ / القارئ / بصوت)
  const prefixMatch = allText.match(/(?:بصوت\s+(?:الشيخ\s+|القارئ\s+)?|(?:فضيلة\s+)?الشيخ\s+|(?:فضيلة\s+)?القارئ\s+|تلاوة\s+(?:الشيخ\s+|القارئ\s+)?)([\u0621-\u064A\s]{4,28})/);
  if (prefixMatch && prefixMatch[1]) {
    const candidate = prefixMatch[1].trim();
    const normCand = normalizeArabicText(candidate);
    const isGeneric = GENERIC_CHANNEL_NAMES.some(g => normCand.includes(normalizeArabicText(g)));
    if (!isGeneric && candidate.length > 3) {
      return candidate;
    }
  }

  // 4. Fallback to track artist if not generic
  const rawArtist = (trackOrItem.artist || '').trim();
  const normArtist = normalizeArabicText(rawArtist);
  const isArtistGeneric = !rawArtist || GENERIC_CHANNEL_NAMES.some(g => normArtist === normalizeArabicText(g) || normArtist.includes(normalizeArabicText(g)));

  if (!isArtistGeneric) {
    return rawArtist;
  }

  return 'تلاوات قرآنية';
}
