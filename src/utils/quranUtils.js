// Utility to accurately identify, separate, and format Quranic content and reciters

export const QURAN_REGEX = /(\bسورة|\bسوره|\bقرآن|\bقران|\bالمصحف|\bمصحف|\bتلاوة|\bتلاوه|\bترتيل|\bتجويد|المنشاوي|عبد\s*الباسط|الحصري|البناء|الطبلاوي|العفاسي|ماهر\s*المعيقلي|السديس|الشريم|ياسر\s*الدوسري|مشاري\s*العفاسي|أحمد\s*العجمي|سعد\s*الغامدي|\bsurah\b|\bquran\b|\bkoran\b|\brecitation\b|\btajweed\b|\btartil\b|\bmushaf\b)/i;

export const FAMOUS_RECITERS = [
  {
    name: 'مشاري راشد العفاسي',
    aliases: [
      'مشاري العفاسي', 'العفاسي', 'العفاسى', 'مشاري راشد', 'مشارى العفاسى', 'مشارى راشد', 'مشاري', 'مشارى', 
      'mishary rashid alafasy', 'mishary rashid', 'mishari rashid', 'mishary alafasy', 'mishari alafasy', 
      'alafasy', 'mishary', 'mishari', 'al-afasy', 'al afasy', 'al-afasi', 'al afasi'
    ],
  },
  {
    name: 'محمود خليل الحصري',
    aliases: [
      'محمود خليل الحصرى', 'الحصري', 'الحصرى', 'خليل الحصري', 'خليل الحصرى', 
      'mahmoud khalil al-hussary', 'mahmoud khalil al hussary', 'al-hussary', 'al-hosary', 'al-husary', 
      'al-hosari', 'al hussary', 'al hosary', 'hussary', 'hosary', 'husary', 'hosari'
    ],
  },
  {
    name: 'محمد صديق المنشاوي',
    aliases: [
      'محمد صديق المنشاوى', 'المنشاوي', 'المنشاوى', 'صديق المنشاوي', 'صديق المنشاوى', 
      'mohamed siddiq el-minshawi', 'mohamed el minshawi', 'al-minshawi', 'al minshawi', 
      'minshawi', 'menshawy', 'al-menshawy', 'al menshawy'
    ],
  },
  {
    name: 'عبد الباسط عبد الصمد',
    aliases: [
      'عبدالباسط عبدالصمد', 'عبد الباسط', 'عبدالباسط', 'عبد الصمد', 'عبدالصمد', 
      'abdul basit abdel samad', 'abdelbasset abdessamad', 'abdulbasit', 'abdelbasset', 
      'abdul basit', 'abdul-basit', 'abdel-basset', 'abd el basit'
    ],
  },
  {
    name: 'ماهر المعيقلي',
    aliases: [
      'ماهر المعيقلى', 'المعيقلي', 'المعيقلى', 
      'maher al muaiqly', 'maher al-muaiqly', 'maher al-moaikli', 'maher al moaikli', 
      'al-muaiqly', 'al muaiqly', 'muaiqly', 'moaikli', 'maher'
    ],
  },
  {
    name: 'سعد الغامدي',
    aliases: ['سعد الغامدى', 'الغامدي', 'الغامدى', 'saad al ghamdi', 'saad al-ghamdi', 'al-ghamdi', 'al ghamdi', 'ghamdi'],
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
    ],
  },
  {
    name: 'عبد الرحمن السديس',
    aliases: [
      'عبدالرحمن السديس', 'السديس', 'abdul rahman al-sudais', 'abdul rahman al sudais', 
      'abdurrahman al-sudais', 'al-sudais', 'al sudais', 'sudais'
    ],
  },
  {
    name: 'سعود الشريم',
    aliases: ['سعود الشريم', 'الشريم', 'saud al-shuraim', 'saud al shuraim', 'al-shuraim', 'al shuraim', 'shuraim'],
  },
  {
    name: 'أحمد بن علي العجمي',
    aliases: [
      'أحمد العجمي', 'احمد العجمي', 'أحمد العجمى', 'احمد العجمى', 'العجمي', 'العجمى', 
      'ahmed al-ajmi', 'ahmed al ajmi', 'al-ajmy', 'al-ajmi', 'al ajmi', 'ajmi'
    ],
  },
  {
    name: 'فارس عباد',
    aliases: ['فارس عباد', 'عباد', 'fares abbad', 'fares abad', 'abbad', 'abad'],
  },
  {
    name: 'ناصر القطامي',
    aliases: ['ناصر القطامى', 'القطامي', 'القطامى', 'nasser al-qatami', 'nasser al qatami', 'al-qatami', 'al qatami', 'qatami'],
  },
  {
    name: 'إدريس أبكر',
    aliases: ['ادريس ابكر', 'أبكر', 'ابكر', 'idris abkar', 'idrees abkar', 'abkar'],
  },
  {
    name: 'خالد الجليل',
    aliases: ['خالد الجليل', 'الجليل', 'khalid al jalil', 'khalid al-jalil', 'al-jalil', 'al jalil', 'jalil'],
  },
  {
    name: 'علي عبد الله جابر',
    aliases: ['علي جابر', 'على جابر', 'ali jaber', 'ali abdullah jaber', 'jaber'],
  },
  {
    name: 'محمد أيوب',
    aliases: ['محمد ايوب', 'أيوب', 'ايوب', 'mohamed ayyoub', 'mohammed ayoub', 'ayyoub', 'ayoub'],
  },
  {
    name: 'أبو بكر الشاطري',
    aliases: ['ابو بكر الشاطري', 'ابوبكر الشاطري', 'الشاطري', 'الشاطرى', 'abu bakr al shatri', 'abu bakr al-shatri', 'al-shatri', 'shatri'],
  },
  {
    name: 'محمود علي البنا',
    aliases: ['محمود على البنا', 'على البنا', 'علي البنا', 'البنا', 'al-banna', 'mahmoud ali al banna'],
  },
  {
    name: 'محمد محمود الطبلاوي',
    aliases: ['الطبلاوي', 'الطبلاوى', 'محمود الطبلاوي', 'tablawi', 'al-tablawi', 'al tablawi'],
  },
  {
    name: 'مصطفى إسماعيل',
    aliases: ['مصطفى اسماعيل', 'mustafa ismail', 'mostafa ismail'],
  },
  {
    name: 'محمد رفعت',
    aliases: ['الشيخ رفعت', 'mohamed refat', 'mohammed refat'],
  },
  {
    name: 'هزاع البلوشي',
    aliases: ['هزاع البلوشى', 'البلوشي', 'البلوشى', 'hazza al balushi', 'hazza al-balushi', 'al-balushi', 'balushi'],
  },
  {
    name: 'رعد الكردي',
    aliases: ['رعد الكردى', 'الكردي', 'الكردى', 'raad al kurdi', 'raad al-kurdi', 'al-kurdi', 'kurdi'],
  },
  {
    name: 'إسلام صبحي',
    aliases: ['إسلام صبحى', 'اسلام صبحي', 'اسلام صبحى', 'islam sobhi', 'islam subhi', 'islam sobhy'],
  },
  {
    name: 'وديع اليمني',
    aliases: ['وديع اليمنى', 'اليمني', 'اليمنى', 'wadih al yamani', 'wadih al-yamani', 'al-yamani', 'yamani'],
  },
  {
    name: 'علي الحذيفي',
    aliases: ['علي الحذيفى', 'على الحذيفى', 'الحذيفي', 'الحذيفى', 'al-hudhaify', 'al hudhaify', 'hudhaify'],
  },
  {
    name: 'عبد الله بصفر',
    aliases: ['عبدالله بصفر', 'بصفر', 'abdullah basfar', 'basfar'],
  },
  {
    name: 'محمد جبريل',
    aliases: ['محمد جبريل', 'جبريل', 'mohamed jebril', 'mohammed jebril', 'jebril'],
  },
  {
    name: 'توفيق الصائغ',
    aliases: ['توفيق الصائغ', 'الصائغ', 'tawfeeq al sayegh', 'al-sayegh'],
  },
  {
    name: 'صلاح بو خاطر',
    aliases: ['صلاح بو خاطر', 'بو خاطر', 'salah bu khater', 'bu khater'],
  },
  {
    name: 'كامل يوسف البهتيمي',
    aliases: ['يوسف البهتيمي', 'البهتيمي', 'البهتيمى', 'al-bahtimi'],
  },
  {
    name: 'أحمد نعينع',
    aliases: ['احمد نعينع', 'نعينع', 'ahmed naina'],
  },
  {
    name: 'عبد الرشيد صوفي',
    aliases: ['عبدالرشيد صوفي', 'رشيد صوفي', 'abdul rashid sufi', 'rashid sufi'],
  },
  {
    name: 'بدر التركي',
    aliases: ['بدر التركي', 'التركي', 'bader al-turki', 'al-turki'],
  },
  {
    name: 'هيثم الدخين',
    aliases: ['هيثم الدخين', 'الدخين', 'haitham al-dukhain'],
  },
  {
    name: 'شريف مصطفى',
    aliases: ['شريف مصطفى', 'sherif mostafa', 'sherif mustafa'],
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
    .replace(/^\d{1,3}\s*[\.\-–]\s*/, '')
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
    const tId = String(trackOrItem.id || trackOrItem._id || '');
    const parentPl = playlists.find(pl => 
      (pl.trackIds && tId && pl.trackIds.map(String).includes(tId)) ||
      (trackOrItem.album && pl.name && trackOrItem.album.trim().toLowerCase() === pl.name.trim().toLowerCase())
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
      if (normAlias.length >= 3 && (normAllText.includes(normAlias) || allText.toLowerCase().includes(alias.toLowerCase()))) {
        return reciter.name;
      }
    }
  }

  // 3. Extract dynamically using Arabic prefix if mentioned (الشيخ / القارئ / بصوت)
  const prefixMatch = allText.match(/(?:بصوت\s+(?:الشيخ\s+|القارئ\s+)?|(?:فضيلة\s+)?الشيخ\s+|(?:فضيلة\s+)?القارئ\s+|تلاوة\s+(?:الشيخ\s+|القارئ\s+)?)([\u0621-\u064A\s]{4,28})/);
  if (prefixMatch && prefixMatch[1]) {
    const candidate = prefixMatch[1].trim();
    const normCand = normalizeArabicText(candidate);
    const isGeneric = GENERIC_CHANNEL_NAMES.some(g => normCand.includes(normalizeArabicText(g)));
    if (!isGeneric && candidate.length > 3) {
      return candidate;
    }
  }

  // 4. Dynamic English Sheikh / Reciter extraction: "recited by Sheikh ...", "by Sheikh ...", "Sheikh ..."
  const enPrefixMatch = allText.match(/(?:recited\s+by\s+(?:sheikh\s+|qari\s+)?|(?:by\s+)?(?:sheikh\s+|qari\s+))([A-Za-z\s'-]{3,30})/i);
  if (enPrefixMatch && enPrefixMatch[1]) {
    const candidate = enPrefixMatch[1].trim();
    const normCand = normalizeArabicText(candidate);
    for (const reciter of FAMOUS_RECITERS) {
      for (const alias of reciter.aliases) {
        if (normCand.includes(normalizeArabicText(alias)) || candidate.toLowerCase().includes(alias.toLowerCase())) {
          return reciter.name;
        }
      }
    }
    const isGeneric = GENERIC_CHANNEL_NAMES.some(g => normCand.includes(normalizeArabicText(g)) || candidate.toLowerCase().includes(g.toLowerCase()));
    if (!isGeneric && candidate.length > 3) {
      return candidate;
    }
  }

  // 5. Fallback to track artist if not generic
  const rawArtist = (trackOrItem.artist || '').trim();
  const normArtist = normalizeArabicText(rawArtist);
  const isArtistGeneric = !rawArtist || GENERIC_CHANNEL_NAMES.some(g => normArtist === normalizeArabicText(g) || normArtist.includes(normalizeArabicText(g)) || rawArtist.toLowerCase().includes(g.toLowerCase()));

  if (!isArtistGeneric) {
    return rawArtist;
  }

  return 'تلاوات قرآنية';
}
