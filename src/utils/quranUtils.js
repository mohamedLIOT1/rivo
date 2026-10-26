// Utility to accurately identify, separate, and format Quranic content and reciters

export const QURAN_REGEX = /(سورة|سوره|قرآن|قران|المصحف|مصحف|تلاوة|تلاوه|ترتيل|تجويد|المنشاوي|عبد\s*الباسط|الحصري|البناء|الطبلاوي|العفاسي|ماهر\s*المعيقلي|السديس|الشريم|ياسر\s*الدوسري|مشاري\s*العفاسي|أحمد\s*العجمي|سعد\s*الغامدي|\bsurah\b|\bquran\b|\bkoran\b|\brecitation\b|\btajweed\b|\btartil\b|\bmushaf\b)/i;

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
    name: 'عبد الرحمن مسعد',
    aliases: [
      'عبدالرحمن مسعد', 'عبد الرحمن مسعد', 'مسعد',
      'abdel rahman musad', 'abdulrhman mosad', 'abdelrahman mosad', 'abdul rahman musad',
      'abdel rahman mossad', 'abdul rahman mossad', 'abdulrahman mossad', 'abdelrahman mossad',
      'abdurrahman mosad', 'abdurrahman mossad', 'abdurrahman musad', 'abdelrahman musad',
      'abdulrhman mosaad', 'abdelrahman mosaad', 'abdel rahman mosaad', 'abdul rahman mosaad',
      'abdulrahman musad', 'abdulrahman mosad', 'abdulrhman musad', 'abdel rhman musad', 'abdel rhman mosad',
      'mosad', 'mossad', 'musad', 'mosaad'
    ],
    cover: 'https://images.unsplash.com/photo-1542816417-0983c9c9ad53?w=600'
  },
  {
    name: 'إسلام صبحي',
    aliases: ['اسلام صبحي', 'اسلام صبحى', 'إسلام صبحى', 'صبحي', 'صبحى', 'islam sobhi', 'islam sobhy', 'sobhi', 'sobhy'],
    cover: 'https://images.unsplash.com/photo-1585036156171-384164a8c675?w=600'
  },
  {
    name: 'هزاع البلوشي',
    aliases: ['هزاع البلوشى', 'البلوشي', 'البلوشى', 'hazza al balushi', 'hazza al-balushi', 'al balushi'],
  },
  {
    name: 'منصور السالمي',
    aliases: ['منصور السالمى', 'السالمي', 'السالمى', 'mansour al salmi', 'mansoor al-salmi', 'al salmi'],
  },
  {
    name: 'رعد الكردي',
    aliases: ['رعد الكردى', 'الكردي', 'الكردى', 'raad al kurdi', 'raad al-kurdi', 'al kurdi'],
  },
  {
    name: 'أحمد النفيس',
    aliases: ['احمد النفيس', 'النفيس', 'ahmed al nafees', 'ahmed al-nafees', 'al nafees'],
  },
  {
    name: 'وديع اليمني',
    aliases: ['وديع اليمنى', 'اليمني', 'اليمنى', 'wadih al yamani', 'wadi al-yamani', 'al yamani'],
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

export function isRadioTrack(item) {
  if (!item || typeof item !== 'object') return false;
  return Boolean(
    item.isRadio === true ||
    item.isLive === true ||
    item.genre === 'Quran Radio' ||
    item.genre === 'quran-radio' ||
    String(item.id || item._id || '').startsWith('radio-')
  );
}

export function isQuranContent(item, artist = '', album = '') {
  if (!item) return false;
  if (typeof item === 'object') {
    if (item.isQuran === true || item.genre === 'quran-radio') return true;
    const str = `${item.title || item.name || ''} ${item.artist || ''} ${item.album || ''} ${item.genre || ''} ${item.description || ''}`;
    return QURAN_REGEX.test(str);
  }
  const str = `${item} ${artist} ${album}`;
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
    for (const reciter of FAMOUS_RECITERS) {
      for (const alias of reciter.aliases) {
        const normAlias = normalizeArabicText(alias);
        if (normArtist === normAlias || normArtist.includes(normAlias) || rawArtist.toLowerCase().includes(alias.toLowerCase())) {
          return reciter.name;
        }
      }
    }
    if (/abd(?:el|ul|ur)?\s*r[a-z]*\s*m[ou]s[a-z]+/i.test(rawArtist) || /مسعد/i.test(rawArtist)) {
      return 'عبد الرحمن مسعد';
    }
    return rawArtist;
  }

  return 'تلاوات قرآنية';
}

export const CANONICAL_SURAHS = [
  { number: 1, name: 'الفاتحة', english: 'Al-Fatiha', aliases: ['فاتحة', 'أم الكتاب', 'السبع المثاني', 'fatiha', 'al-fatiha', 'fatihah'] },
  { number: 2, name: 'البقرة', english: 'Al-Baqarah', aliases: ['بقرة', 'baqarah', 'al-baqarah', 'baqara'] },
  { number: 3, name: 'آل عمران', english: 'Aal-Imran', aliases: ['ال عمران', 'عمران', 'aal-imran', 'al-imran', 'imran'] },
  { number: 4, name: 'النساء', english: 'An-Nisa', aliases: ['نساء', 'an-nisa', 'nisa'] },
  { number: 5, name: 'المائدة', english: 'Al-Maidah', aliases: ['مائدة', 'al-maidah', 'al-maida', 'maidah', 'maida'] },
  { number: 6, name: 'الأنعام', english: 'Al-Anam', aliases: ['الانعام', 'انعام', 'al-anam', 'anam'] },
  { number: 7, name: 'الأعراف', english: 'Al-Araf', aliases: ['الاعراف', 'اعراف', 'al-araf', 'araf'] },
  { number: 8, name: 'الأنفال', english: 'Al-Anfal', aliases: ['الانفال', 'انفال', 'al-anfal', 'anfal'] },
  { number: 9, name: 'التوبة', english: 'At-Tawbah', aliases: ['توبة', 'براءة', 'براءه', 'at-tawbah', 'tawbah', 'tawba', 'baraa'] },
  { number: 10, name: 'يونس', english: 'Yunus', aliases: ['yunus', 'younus', 'younes'] },
  { number: 11, name: 'هود', english: 'Hud', aliases: ['hud', 'houd'] },
  { number: 12, name: 'يوسف', english: 'Yusuf', aliases: ['yusuf', 'youssef', 'yousef'] },
  { number: 13, name: 'الرعد', english: 'Ar-Rad', aliases: ['رعد', 'ar-rad', 'rad'] },
  { number: 14, name: 'إبراهيم', english: 'Ibrahim', aliases: ['ابراهيم', 'ibrahim'] },
  { number: 15, name: 'الحجر', english: 'Al-Hijr', aliases: ['حجر', 'al-hijr', 'hijr'] },
  { number: 16, name: 'النحل', english: 'An-Nahl', aliases: ['نحل', 'an-nahl', 'nahl'] },
  { number: 17, name: 'الإسراء', english: 'Al-Isra', aliases: ['الاسراء', 'اسراء', 'بني إسرائيل', 'بني اسرائيل', 'al-isra', 'isra'] },
  { number: 18, name: 'الكهف', english: 'Al-Kahf', aliases: ['كهف', 'al-kahf', 'kahf'] },
  { number: 19, name: 'مريم', english: 'Maryam', aliases: ['maryam', 'mariam'] },
  { number: 20, name: 'طه', english: 'Ta-Ha', aliases: ['ta-ha', 'taha'] },
  { number: 21, name: 'الأنبياء', english: 'Al-Anbiya', aliases: ['الانبياء', 'انبياء', 'al-anbiya', 'anbiya'] },
  { number: 22, name: 'الحج', english: 'Al-Hajj', aliases: ['حج', 'al-hajj', 'hajj'] },
  { number: 23, name: 'المؤمنون', english: 'Al-Muminun', aliases: ['مؤمنون', 'al-muminun', 'muminun'] },
  { number: 24, name: 'النور', english: 'An-Nur', aliases: ['نور', 'an-nur', 'nur'] },
  { number: 25, name: 'الفرقان', english: 'Al-Furqan', aliases: ['فرقان', 'al-furqan', 'furqan'] },
  { number: 26, name: 'الشعراء', english: 'Ash-Shuara', aliases: ['شعراء', 'ash-shuara', 'shuara'] },
  { number: 27, name: 'النمل', english: 'An-Naml', aliases: ['نمل', 'an-naml', 'naml'] },
  { number: 28, name: 'القصص', english: 'Al-Qasas', aliases: ['قصص', 'al-qasas', 'qasas'] },
  { number: 29, name: 'العنكبوت', english: 'Al-Ankabut', aliases: ['عنكبوت', 'al-ankabut', 'ankabut'] },
  { number: 30, name: 'الروم', english: 'Ar-Rum', aliases: ['روم', 'ar-rum', 'rum'] },
  { number: 31, name: 'لقمان', english: 'Luqman', aliases: ['luqman', 'lokman'] },
  { number: 32, name: 'السجدة', english: 'As-Sajdah', aliases: ['سجدة', 'سجده', 'as-sajdah', 'sajdah', 'sajda'] },
  { number: 33, name: 'الأحزاب', english: 'Al-Ahzab', aliases: ['الاحزاب', 'احزاب', 'al-ahzab', 'ahzab'] },
  { number: 34, name: 'سبأ', english: 'Saba', aliases: ['سبا', 'saba'] },
  { number: 35, name: 'فاطر', english: 'Fatir', aliases: ['fatir'] },
  { number: 36, name: 'يس', english: 'Ya-Sin', aliases: ['yasin', 'ya-sin', 'yaseen'] },
  { number: 37, name: 'الصافات', english: 'As-Saffat', aliases: ['صافات', 'as-saffat', 'saffat'] },
  { number: 38, name: 'ص', english: 'Sad', aliases: ['سورة ص', 'sad'] },
  { number: 39, name: 'الزمر', english: 'Az-Zumar', aliases: ['زمر', 'az-zumar', 'zumar'] },
  { number: 40, name: 'غافر', english: 'Ghafir', aliases: ['المؤمن', 'ghafir', 'al-mumin'] },
  { number: 41, name: 'فصلت', english: 'Fussilat', aliases: ['حم السجدة', 'حم سجده', 'fussilat'] },
  { number: 42, name: 'الشورى', english: 'Ash-Shura', aliases: ['شورى', 'شوري', 'ash-shura', 'shura'] },
  { number: 43, name: 'الزخرف', english: 'Az-Zukhruf', aliases: ['زخرف', 'az-zukhruf', 'zukhruf'] },
  { number: 44, name: 'الدخان', english: 'Ad-Dukhan', aliases: ['دخان', 'ad-dukhan', 'dukhan'] },
  { number: 45, name: 'الجاثية', english: 'Al-Jathiyah', aliases: ['جاثية', 'جاثيه', 'al-jathiyah', 'jathiyah', 'jathia'] },
  { number: 46, name: 'الأحقاف', english: 'Al-Ahqaf', aliases: ['الاحقاف', 'احقاف', 'al-ahqaf', 'ahqaf'] },
  { number: 47, name: 'محمد', english: 'Muhammad', aliases: ['القتال', 'muhammad', 'mohamed'] },
  { number: 48, name: 'الفتح', english: 'Al-Fath', aliases: ['فتح', 'al-fath', 'fath'] },
  { number: 49, name: 'الحجرات', english: 'Al-Hujurat', aliases: ['حجرات', 'al-hujurat', 'hujurat'] },
  { number: 50, name: 'ق', english: 'Qaf', aliases: ['سورة ق', 'qaf'] },
  { number: 51, name: 'الذاريات', english: 'Adh-Dhariyat', aliases: ['ذاريات', 'adh-dhariyat', 'dhariyat'] },
  { number: 52, name: 'الطور', english: 'At-Tur', aliases: ['طور', 'at-tur', 'tur'] },
  { number: 53, name: 'النجم', english: 'An-Najm', aliases: ['نجم', 'an-najm', 'najm'] },
  { number: 54, name: 'القمر', english: 'Al-Qamar', aliases: ['قمر', 'al-qamar', 'qamar'] },
  { number: 55, name: 'الرحمن', english: 'Ar-Rahman', aliases: ['رحمان', 'ar-rahman', 'rahman'] },
  { number: 56, name: 'الواقعة', english: 'Al-Waqiah', aliases: ['واقعة', 'واقعه', 'al-waqiah', 'waqiah', 'waqia'] },
  { number: 57, name: 'الحديد', english: 'Al-Hadid', aliases: ['حديد', 'al-hadid', 'hadid'] },
  { number: 58, name: 'المجادلة', english: 'Al-Mujadilah', aliases: ['مجادلة', 'مجادله', 'al-mujadilah', 'mujadilah'] },
  { number: 59, name: 'الحشر', english: 'Al-Hashr', aliases: ['حشر', 'al-hashr', 'hashr'] },
  { number: 60, name: 'الممتحنة', english: 'Al-Mumtahanah', aliases: ['ممتحنة', 'ممتحنه', 'al-mumtahanah', 'mumtahanah'] },
  { number: 61, name: 'الصف', english: 'As-Saff', aliases: ['صف', 'as-saff', 'saff'] },
  { number: 62, name: 'الجمعة', english: 'Al-Jumuah', aliases: ['جمعة', 'جمعه', 'al-jumuah', 'jumuah', 'jumua'] },
  { number: 63, name: 'المنافقون', english: 'Al-Munafiqun', aliases: ['منافقون', 'al-munafiqun', 'munafiqun'] },
  { number: 64, name: 'التغابن', english: 'At-Taghabun', aliases: ['تغابن', 'at-taghabun', 'taghabun'] },
  { number: 65, name: 'الطلاق', english: 'At-Talaq', aliases: ['طلاق', 'at-talaq', 'talaq'] },
  { number: 66, name: 'التحريم', english: 'At-Tahrim', aliases: ['تحريم', 'at-tahrim', 'tahrim'] },
  { number: 67, name: 'الملك', english: 'Al-Mulk', aliases: ['ملك', 'تبارك', 'al-mulk', 'mulk', 'tabarak'] },
  { number: 68, name: 'القلم', english: 'Al-Qalam', aliases: ['قلم', 'ن', 'al-qalam', 'qalam'] },
  { number: 69, name: 'الحاقة', english: 'Al-Haqqah', aliases: ['حاقة', 'حاقه', 'al-haqqah', 'haqqah', 'haqqa'] },
  { number: 70, name: 'المعارج', english: 'Al-Maarij', aliases: ['معارج', 'al-maarij', 'maarij'] },
  { number: 71, name: 'نوح', english: 'Nuh', aliases: ['nuh', 'nooh'] },
  { number: 72, name: 'الجن', english: 'Al-Jinn', aliases: ['جن', 'al-jinn', 'jinn'] },
  { number: 73, name: 'المزمل', english: 'Al-Muzzammil', aliases: ['مزمل', 'al-muzzammil', 'muzzammil'] },
  { number: 74, name: 'المدثر', english: 'Al-Muddathir', aliases: ['مدثر', 'al-muddathir', 'muddathir'] },
  { number: 75, name: 'القيامة', english: 'Al-Qiyamah', aliases: ['قيامة', 'قيامه', 'al-qiyamah', 'qiyamah', 'qiyama'] },
  { number: 76, name: 'الإنسان', english: 'Al-Insan', aliases: ['الانسان', 'انسان', 'الدهر', 'دهر', 'al-insan', 'insan', 'dahr'] },
  { number: 77, name: 'المرسلات', english: 'Al-Mursalat', aliases: ['مرسلات', 'al-mursalat', 'mursalat'] },
  { number: 78, name: 'النبأ', english: 'An-Naba', aliases: ['النبا', 'نبا', 'عم', 'al-naba', 'an-naba', 'naba', 'amma'] },
  { number: 79, name: 'النازعات', english: 'An-Naziat', aliases: ['نازعات', 'an-naziat', 'naziat'] },
  { number: 80, name: 'عبس', english: 'Abasa', aliases: ['abasa'] },
  { number: 81, name: 'التكوير', english: 'At-Takwir', aliases: ['تكوير', 'at-takwir', 'takwir'] },
  { number: 82, name: 'الانفطار', english: 'Al-Infitar', aliases: ['انفطار', 'al-infitar', 'infitar'] },
  { number: 83, name: 'المطففين', english: 'Al-Mutaffifin', aliases: ['مطففين', 'al-mutaffifin', 'mutaffifin'] },
  { number: 84, name: 'الانشقاق', english: 'Al-Inshiqaq', aliases: ['انشقاق', 'al-inshiqaq', 'inshiqaq'] },
  { number: 85, name: 'البروج', english: 'Al-Buruj', aliases: ['بروج', 'al-buruj', 'buruj'] },
  { number: 86, name: 'الطارق', english: 'At-Tariq', aliases: ['طارق', 'at-tariq', 'tariq'] },
  { number: 87, name: 'الأعلى', english: 'Al-Ala', aliases: ['الاعلى', 'الاعلي', 'اعلى', 'اعلي', 'al-ala', 'ala'] },
  { number: 88, name: 'الغاشية', english: 'Al-Ghashiyah', aliases: ['غاشية', 'غاشيه', 'al-ghashiyah', 'ghashiyah', 'ghashiya'] },
  { number: 89, name: 'الفجر', english: 'Al-Fajr', aliases: ['فجر', 'al-fajr', 'fajr'] },
  { number: 90, name: 'البلد', english: 'Al-Balad', aliases: ['بلد', 'al-balad', 'balad'] },
  { number: 91, name: 'الشمس', english: 'Ash-Shams', aliases: ['شمس', 'ash-shams', 'shams'] },
  { number: 92, name: 'الليل', english: 'Al-Layl', aliases: ['ليل', 'al-layl', 'layl', 'lail'] },
  { number: 93, name: 'الضحى', english: 'Ad-Duha', aliases: ['ضحى', 'ضحي', 'ad-duha', 'duha'] },
  { number: 94, name: 'الشرح', english: 'Ash-Sharh', aliases: ['الانشراح', 'انشراح', 'شرح', 'ash-sharh', 'sharh', 'inshirah'] },
  { number: 95, name: 'التين', english: 'At-Tin', aliases: ['تين', 'at-tin', 'tin'] },
  { number: 96, name: 'العلق', english: 'Al-Alaq', aliases: ['علق', 'اقرأ', 'اقرا', 'al-alaq', 'alaq', 'iqra'] },
  { number: 97, name: 'القدر', english: 'Al-Qadr', aliases: ['قدر', 'al-qadr', 'qadr'] },
  { number: 98, name: 'البينة', english: 'Al-Bayyinah', aliases: ['بينة', 'بينه', 'لم يكن', 'al-bayyinah', 'bayyinah', 'bayyina'] },
  { number: 99, name: 'الزلزلة', english: 'Az-Zalzalah', aliases: ['زلزلة', 'زلزله', 'الزلزال', 'زلزال', 'az-zalzalah', 'zalzalah', 'zalzala'] },
  { number: 100, name: 'العاديات', english: 'Al-Adiyat', aliases: ['عاديات', 'al-adiyat', 'adiyat'] },
  { number: 101, name: 'القارعة', english: 'Al-Qariah', aliases: ['قارعة', 'قارعه', 'al-qariah', 'qariah', 'qaria'] },
  { number: 102, name: 'التكاثر', english: 'At-Takathur', aliases: ['تكاثر', 'at-takathur', 'takathur'] },
  { number: 103, name: 'العصر', english: 'Al-Asr', aliases: ['عصر', 'al-asr', 'asr'] },
  { number: 104, name: 'الهمزة', english: 'Al-Humazah', aliases: ['همزة', 'همزه', 'al-humazah', 'humazah', 'humaza'] },
  { number: 105, name: 'الفيل', english: 'Al-Fil', aliases: ['فيل', 'al-fil', 'fil'] },
  { number: 106, name: 'قريش', english: 'Quraysh', aliases: ['لايلاف', 'قريش', 'quraysh', 'quraish'] },
  { number: 107, name: 'الماعون', english: 'Al-Maun', aliases: ['ماعون', 'al-maun', 'maun'] },
  { number: 108, name: 'الكوثر', english: 'Al-Kawthar', aliases: ['كوثر', 'al-kawthar', 'kawthar'] },
  { number: 109, name: 'الكافرون', english: 'Al-Kafirun', aliases: ['كافرون', 'قل يا أيها الكافرون', 'al-kafirun', 'kafirun'] },
  { number: 110, name: 'النصر', english: 'An-Nasr', aliases: ['نصر', 'إذا جاء نصر الله', 'an-nasr', 'nasr'] },
  { number: 111, name: 'المسد', english: 'Al-Masad', aliases: ['مسد', 'تبت', 'اللهب', 'لهب', 'al-masad', 'masad', 'tabbat', 'lahab'] },
  { number: 112, name: 'الإخلاص', english: 'Al-Ikhlas', aliases: ['الاخلاص', 'إخلاص', 'اخلاص', 'التوحيد', 'al-ikhlas', 'ikhlas'] },
  { number: 113, name: 'الفلق', english: 'Al-Falaq', aliases: ['فلق', 'قل أعوذ برب الفلق', 'al-falaq', 'falaq'] },
  { number: 114, name: 'الناس', english: 'An-Nas', aliases: ['ناس', 'قل أعوذ برب الناس', 'an-nas', 'nas'] },
];

// Precompiled keyword map for instant O(1) surah lookup
const SURAH_KEYWORD_MAP = new Map();
const SHORT_SURAHS = new Set(['ص', 'ق', 'طه', 'يس', 'ن']);

for (const s of CANONICAL_SURAHS) {
  const allAliases = [s.name, s.english, ...(s.aliases || [])];
  for (const a of allAliases) {
    const norm = normalizeArabicText(a);
    if (!norm) continue;
    if (!SURAH_KEYWORD_MAP.has(norm)) {
      SURAH_KEYWORD_MAP.set(norm, s.number);
    }
  }
}

export function getSurahNumber(item) {
  if (!item) return 999;
  if (typeof item === 'number') return (item >= 1 && item <= 114) ? item : 999;
  if (typeof item === 'object' && item !== null && item._surahNum !== undefined) {
    return item._surahNum;
  }

  const rawTitle = typeof item === 'string' ? item : (item.title || item.name || '');
  const normTitle = normalizeArabicText(rawTitle);

  // 1. Direct match for 'سورة X' where X is a number
  const numMatch = normTitle.match(/(?:سوره|سورة|surah)\s*0*([1-9][0-9]?|10[0-9]|11[0-4])(?:\b|$)/i) ||
                   normTitle.match(/(?:^|[\s\-_|#])0*([1-9][0-9]?|10[0-9]|11[0-4])(?:\s*[\.\-–\s]|\s*$)/);
  if (numMatch && numMatch[1]) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 1 && n <= 114) {
      if (typeof item === 'object' && item !== null) item._surahNum = n;
      return n;
    }
  }

  // 2. Tokenize words for instant O(1) map lookups
  const words = normTitle.match(/[\u0621-\u064A0-9a-z]+/gi) || [];

  // Pass A: Check directly after 'سورة' or 'surah'
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if ((w === 'سوره' || w === 'سورة' || w === 'surah') && i + 1 < words.length) {
      if (i + 2 < words.length) {
        const twoWord = words[i+1] + ' ' + words[i+2];
        if (SURAH_KEYWORD_MAP.has(twoWord)) {
          const res = SURAH_KEYWORD_MAP.get(twoWord);
          if (typeof item === 'object' && item !== null) item._surahNum = res;
          return res;
        }
      }
      const nextWord = words[i+1];
      if (SURAH_KEYWORD_MAP.has(nextWord)) {
        const res = SURAH_KEYWORD_MAP.get(nextWord);
        if (typeof item === 'object' && item !== null) item._surahNum = res;
        return res;
      }
    }
  }

  // Pass B: Check two-word pairs anywhere
  for (let i = 0; i < words.length - 1; i++) {
    const pair = words[i] + ' ' + words[i+1];
    if (SURAH_KEYWORD_MAP.has(pair)) {
      const res = SURAH_KEYWORD_MAP.get(pair);
      if (typeof item === 'object' && item !== null) item._surahNum = res;
      return res;
    }
  }

  // Pass C: Check single words anywhere (skip single-letter short names without 'سورة')
  for (const w of words) {
    if (SHORT_SURAHS.has(w)) continue;
    if (SURAH_KEYWORD_MAP.has(w)) {
      const res = SURAH_KEYWORD_MAP.get(w);
      if (typeof item === 'object' && item !== null) item._surahNum = res;
      return res;
    }
  }

  if (typeof item === 'object' && item !== null) item._surahNum = 999;
  return 999;
}

export function getSurahName(trackOrNumber) {
  const num = typeof trackOrNumber === 'number' ? trackOrNumber : getSurahNumber(trackOrNumber);
  const found = CANONICAL_SURAHS.find(s => s.number === num);
  return found ? found.name : '';
}

export function sortQuranTracks(tracks = []) {
  if (!Array.isArray(tracks) || tracks.length === 0) return [];
  // Schwartzian transform to call getSurahNumber once per track (O(N) instead of O(N log N * 570 regexes))
  const decorated = tracks.map((t, idx) => ({ t, num: getSurahNumber(t), idx }));
  decorated.sort((a, b) => {
    if (a.num !== b.num) return a.num - b.num;
    return a.idx - b.idx;
  });
  return decorated.map(d => d.t);
}


