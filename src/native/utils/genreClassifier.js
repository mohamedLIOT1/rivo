/**
 * Rivo Native Genre & Mood Classification Engine (Client-side helper)
 * Provides instantaneous offline genre deduction, Arabic genre names, and Quran detection.
 */

export const GENRES = {
  QURAN: {
    id: 'quran',
    name: 'Holy Quran',
    arabicName: 'قرآن كريم',
    code: 'QURAN',
    color: '#10b981',
    isQuran: true,
    keywords: ['قرآن', 'سورة', 'مصحف', 'تلاوة', 'تراويح', 'تجويد', 'ترتيل', 'ختمة', 'مجود', 'مرتل', 'أذكار', 'اذكار', 'رقية شرعية', 'quran', 'surah', 'recitation', 'tilawat', 'tajweed', 'murattal', 'mujawwad', 'athkar', 'ruqyah'],
    artists: ['مشاري العفاسي', 'عبد الباسط عبد الصمد', 'محمود خليل الحصري', 'محمد صديق المنشاوي', 'ماهر المعيقلي', 'سعد الغامدي', 'ياسر الدوسري', 'عبد الرحمن السديس', 'سعود الشريم', 'احمد العجمي', 'فارس عباد', 'ناصر القطامي', 'ادريس ابكر', 'خالد الجليل', 'علي جابر', 'محمد أيوب', 'ابو بكر الشاطري', 'هزاع البلوشي', 'رعد الكردي', 'وديع اليمني', 'اسلام صبحي', 'mishary rashid', 'abdul basit', 'al-minshawi', 'al-hussary', 'maher al muaiqly', 'al-sudais'],
    aliases: ['quran', 'islamic', 'holy quran', 'murattal', 'mujawwad', 'قران', 'قرآن']
  },
  SHAABI: {
    id: 'shaabi',
    name: 'Shaabi',
    arabicName: 'شعبي',
    code: 'SHAABI',
    color: '#f59e0b',
    keywords: ['شعبي', 'الشعبي', 'شعبيات', 'أغاني شعبية', 'اغاني شعبية', 'بلدي', 'موال شعبي', 'shaabi', 'shabi', 'egyptian shaabi', 'folk shaabi'],
    artists: ['أحمد عدوية', 'احمد عدوية', 'ahmed adaweya', 'adaweya', 'عبد الباسط حمودة', 'عبد الباسط', 'abdel baset hamouda', 'abdel basset hamouda', 'طارق الشيخ', 'tarek el sheikh', 'احمد شيبة', 'أحمد شيبة', 'ahmed sheba', 'ahmed sheiba', 'رضا البحراوي', 'reda el bahrawy', 'حكيم', 'hakim', 'حجازي متقال', 'hegazy metkal', 'شفيقة', 'حسن الأسمر', 'حسن الاسمر', 'hassan el asmar', 'بوسي', 'bosy', 'محمد رشدي', 'محمد العزبي'],
    aliases: ['shaabi', 'shabi', 'شعبي', 'شعبيات', 'اغاني شعبية', 'egyptian shaabi']
  },
  MAHRAGANAT: {
    id: 'mahraganat',
    name: 'Mahraganat',
    arabicName: 'مهرجانات',
    code: 'MAHRAGANAT',
    color: '#fbbf24',
    keywords: ['مهرجان', 'مهرجانات', 'المهرجانات', 'سرسجي', 'دبكة', 'زار', 'سستم', 'درامز', 'توزيع درامز', 'mahragan', 'mahraganat', 'electro shaabi'],
    artists: ['عصام صاصا', 'essam sasa', 'حمو بيكا', 'hamo bika', 'حسن شاكوش', 'hassan shakosh', 'عمر كمال', 'omar kamal', 'عنبة', '3enba', 'enaba', 'دبل زوكش', 'double zuksh', 'شواحة', 'المدفعجية', 'فيجو الدخلاوي', 'حودة بندق', 'houda bondok', 'سيف مجدي', 'اسلام كابونجا', 'سامر المدني', 'فيلو', 'شحتة كاريكا', 'shehta karika', 'كزبرة', 'اوكا واورتيجا', 'الصواريخ', 'حمو الطيخا', 'نور التوت', 'زوكش'],
    aliases: ['mahraganat', 'mahragan', 'مهرجانات', 'مهرجان', 'electro shaabi']
  },
  RAP: {
    id: 'rap-hiphop',
    name: 'Rap / Hip-Hop',
    arabicName: 'راب / هيب هوب',
    code: 'RAP',
    color: '#f97316',
    keywords: ['راب', 'الراب', 'تراب', 'دريل', 'فري ستايل', 'ديس', 'سين', 'سايفر', 'تراك راب', 'rap', 'trap', 'drill', 'hip-hop', 'hiphop', 'freestyle', 'diss', 'cypher', 'bars'],
    artists: ['ويجز', 'wegz', 'مروان بابلو', 'marwan pablo', 'ليجي', 'ليجي سي', 'lege-cy', 'lege cy', 'مروان موسى', 'marwan moussa', 'ابيوسف', 'abyusif', 'عفروتو', 'afroto', 'ونجي', 'وينجي', 'wingii', 'wingi', 'باتستوتا', 'batistuta', 'شب جديد', 'shabjdeed', 'ابو الانوار', 'abo el anwar', 'احمد سانتا', 'كريم اسامة', 'karim osama', 'موسى سام', 'mousa sam', 'شهاب', 'shehab', 'فليكس', 'flx', 'flex', 'زياد ظاظا', 'ziad zaza', 'مهاب', 'mohab', 'ارسينك', 'arsenic', 'الجوكر', 'el joker', 'شاهين', 'shaheen', 'الضبع', 'drake', 'travis scott', 'kendrick lamar', 'eminem', 'kanye west', 'kanye', 'j cole', 'future', 'metro boomin', '21 savage', 'central cee', 'tupac', 'snoop dogg', 'post malone'],
    aliases: ['rap', 'hip-hop', 'hip hop', 'trap', 'drill', 'راب', 'الراب', 'هيب هوب']
  },
  INDIE: {
    id: 'indie-alt',
    name: 'Indie / Alternative',
    arabicName: 'إندي / بديل',
    code: 'INDIE',
    color: '#8b5cf6',
    keywords: ['إندي', 'اندي', 'بديل', 'أندرجراوند', 'اندرجراوند', 'روك عربي', 'indie', 'alternative', 'underground', 'indie rock', 'indie pop', 'garage rock'],
    artists: ['كايروكي', 'cairokee', 'مسار إجباري', 'مسار اجباري', 'massar egbari', 'شارموفرز', 'sharmoofers', 'حمزة نمرة', 'حمزه نمره', 'hamza namira', 'امير عيد', 'amir eid', 'أوتوستراد', 'autostrad', 'جدل', 'jadal', 'مشروع ليلى', 'mashrou leila', 'المربع', 'el morabba3', 'عزيز مرقة', 'aziz maraka', 'ديسكو مصر', 'disco misr', 'اخر زفير', 'akher zapheer', 'هوس', 'أدونيس', 'adonis', 'تامر نفار', 'وسط البلد', 'بلاك تيما', 'arctic monkeys', 'the strokes', 'tame impala', 'radiohead', 'coldplay', 'the 1975', 'the cure'],
    aliases: ['indie', 'alternative', 'indie / alternative', 'إندي', 'بديل', 'اندرجراوند']
  },
  TARAB: {
    id: 'tarab',
    name: 'Tarab',
    arabicName: 'طرب أصيل',
    code: 'TARAB',
    color: '#d97706',
    keywords: ['طرب', 'الطرب', 'طرب أصيل', 'طرب اصيل', 'سلطنة', 'تراث', 'موشح', 'قدود', 'قصيدة', 'تخت شرقي', 'عود', 'تقاسيم', 'موال', 'tarab', 'classic arabic', 'classical arabic', 'andalusian', 'mawwal', 'muwashah', 'taqsim'],
    artists: ['أم كلثوم', 'ام كلثوم', 'om kalthoum', 'um kalthoum', 'umm kulthum', 'عبد الحليم حافظ', 'عبد الحليم', 'abdel halim hafez', 'abdel halim', 'فيروز', 'fairuz', 'fairouz', 'fayrouz', 'وردة', 'وردة الجزائرية', 'warda', 'نجاة الصغيرة', 'نجاة', 'محمد عبد الوهاب', 'mohamed abdel wahab', 'سيد درويش', 'sayed darwish', 'طلال مداح', 'صباح فخري', 'صباح', 'فريد الأطرش', 'farid el atrache', 'اسمهان', 'وديع الصافي', 'جورج وسوف', 'george wassouf', 'ميادة الحناوي', 'ملحم بركات', 'شادية', 'ليلى مراد', 'فايزة أحمد'],
    aliases: ['tarab', 'طرب', 'طرب أصيل', 'كلاسيك عربي', 'تراث', 'classic arabic', 'classical arabic']
  },
  ARABIC_POP: {
    id: 'arabic-pop',
    name: 'Arabic Pop',
    arabicName: 'بوب عربي',
    code: 'AR-POP',
    color: '#ec4899',
    keywords: ['بوب عربي', 'رومانسي', 'هيتس', 'arabic pop', 'arab pop'],
    artists: ['عمرو دياب', 'amr diab', 'تامر حسني', 'tamer hosny', 'محمد حماقي', 'حماقي', 'mohamed hamaki', 'شيرين', 'sherine', 'شرين', 'شيرين عبد الوهاب', 'أصالة', 'اصالة', 'asala', 'assala', 'اليسا', 'elissa', 'نانسي عجرم', 'nancy ajram', 'بهاء سلطان', 'bahaa sultan', 'تامر عاشور', 'tamer ashoor', 'رامي صبري', 'rami sabry', 'فضل شاكر', 'fadel shaker', 'احمد سعد', 'ahmed saad', 'حسين الجسمي', 'hussain al jassmi', 'أنغام', 'angham', 'وائل كفوري', 'راغب علامة', 'نوال الزغبي', 'كارول سماحة', 'بلقيس', 'سعد لمجرد', 'صابر الرباعي', 'محمد فؤاد', 'مصطفى قمر', 'هشام عباس', 'إيهاب توفيق', 'ساندي', 'رامي عياش', 'ميريام فارس', 'حميد الشاعري', 'مصطفى حجاج', 'احمد كامل', 'زياد برجي'],
    aliases: ['arabic pop', 'arab pop', 'بوب عربي']
  },
  KHALEEJI: {
    id: 'khaleeji',
    name: 'Khaleeji',
    arabicName: 'خليجي',
    code: 'KHALEEJI',
    color: '#ca8a04',
    keywords: ['شيلات', 'شيلة', 'خليجي', 'جلسة', 'سامري', 'خبيتي', 'khaleeji', 'sheilat', 'shilat', 'jalsa'],
    artists: ['محمد عبده', 'mohammed abdu', 'راشد الماجد', 'rashed al majed', 'عبد المجيد عبد الله', 'abdulmajeed abdullah', 'ماجد المهندس', 'majed al mohandis', 'نبيل شعيل', 'رابح صقر', 'احلام', 'ahlam', 'فؤاد عبد الواحد', 'نوال الكويتية', 'غريب ال مخلص', 'بدر العزي'],
    aliases: ['khaleeji', 'خليجي', 'شيلات']
  },
  ROCK: {
    id: 'rock',
    name: 'Rock',
    arabicName: 'روك',
    code: 'ROCK',
    color: '#ef4444',
    keywords: ['rock', 'hard rock', 'alternative rock', 'classic rock', 'grunge', 'روك', 'الروك'],
    artists: ['linkin park', 'queen', 'led zeppelin', 'nirvana', 'ac/dc', 'guns n roses', 'red hot chili peppers', 'foo fighters', 'green day', 'muse', 'pink floyd', 'bon jovi', 'pearl jam', 'carlos santana', 'santana'],
    aliases: ['rock', 'classic rock', 'hard rock', 'روك']
  },
  METAL: {
    id: 'metal',
    name: 'Metal',
    arabicName: 'ميتال',
    code: 'METAL',
    color: '#475569',
    keywords: ['metal', 'heavy metal', 'death metal', 'black metal', 'thrash metal', 'metalcore', 'ميتال'],
    artists: ['slipknot', 'metallica', 'megadeth', 'slayer', 'iron maiden', 'avenged sevenfold', 'judas priest', 'rammstein', 'lamb of god', 'bring me the horizon', 'korn', 'system of a down'],
    aliases: ['metal', 'heavy metal', 'metalcore', 'ميتال']
  },
  ELECTRONIC: {
    id: 'electronic',
    name: 'EDM / Electronic',
    arabicName: 'إلكترونيك / EDM',
    code: 'EDM',
    color: '#06b6d4',
    keywords: ['edm', 'electronic', 'electro', 'house', 'techno', 'deep house', 'synthwave', 'trance', 'dubstep', 'dance', 'club', 'remix', 'مكس', 'ريمكس', 'إلكترونيك', 'دي جي'],
    artists: ['david guetta', 'calvin harris', 'avicii', 'tiesto', 'martin garrix', 'skrillex', 'deadmau5', 'daft punk', 'the chainsmokers', 'alan walker', 'zedd', 'kygo', 'marshmello', 'dj snake', 'afrojack', 'hardwell', 'armin van buuren'],
    aliases: ['edm', 'electronic', 'electro', 'house', 'techno', 'dance', 'الكترونيك']
  },
  RNB: {
    id: 'rnb-soul',
    name: 'R&B / Soul',
    arabicName: 'آر أند بي / سول',
    code: 'RNB',
    color: '#0284c7',
    keywords: ['r&b', 'rnb', 'soul', 'neo soul', 'motown', 'آر آند بي', 'سول'],
    artists: ['the weeknd', 'sza', 'frank ocean', 'brent faiyaz', 'daniel caesar', 'bryson tiller', 'chris brown', 'usher', 'beyonce', 'alicia keys', 'john legend', 'summer walker', 'giveon'],
    aliases: ['r&b', 'rnb', 'soul', 'r&b / soul']
  },
  LOFI: {
    id: 'lofi',
    name: 'Lo-Fi',
    arabicName: 'لو-فاي',
    code: 'LOFI',
    color: '#6366f1',
    keywords: ['lofi', 'lo-fi', 'chillhop', 'study beats', 'lofi hip hop', 'chill beats', 'sleep beats', 'لوفاي', 'لو فاي'],
    artists: ['lofi girl', 'chilledcow', 'potsu', 'idealism', 'kudasai', 'jinsang', 'tomppabeats', 'saib'],
    aliases: ['lofi', 'lo-fi', 'chillhop']
  },
  JAZZ: {
    id: 'jazz',
    name: 'Jazz / Blues',
    arabicName: 'جاز / بلوز',
    code: 'JAZZ',
    color: '#3b82f6',
    keywords: ['jazz', 'smooth jazz', 'bebop', 'swing', 'blues', 'saxophone', 'trumpet', 'جاز', 'بلوز'],
    artists: ['miles davis', 'john coltrane', 'louis armstrong', 'ella fitzgerald', 'bill evans', 'chet baker', 'nina simone'],
    aliases: ['jazz', 'jazz / blues', 'smooth jazz', 'blues', 'جاز', 'بلوز']
  },
  CLASSICAL: {
    id: 'classical',
    name: 'Classical',
    arabicName: 'موسيقى كلاسيكية',
    code: 'CLASSIC',
    color: '#64748b',
    keywords: ['symphony', 'concerto', 'sonata', 'orchestral', 'philharmonic', 'classical music', 'سيمفونية', 'اوركسترا'],
    artists: ['mozart', 'beethoven', 'bach', 'chopin', 'tchaikovsky', 'vivaldi', 'debussy', 'brahms', 'rachmaninoff', 'yo-yo ma'],
    aliases: ['classical', 'symphony', 'orchestral', 'opera', 'موسيقى كلاسيكية']
  },
  SOUNDTRACK: {
    id: 'soundtrack',
    name: 'Soundtrack / Instrumental',
    arabicName: 'موسيقى تصويرية',
    code: 'SOUNDTRACK',
    color: '#0ea5e9',
    keywords: ['soundtrack', 'ost', 'score', 'film score', 'original soundtrack', 'theme song', 'main theme', 'instrumental', 'bgm', 'موسيقى تصويرية', 'اوست'],
    artists: ['hans zimmer', 'john williams', 'ennio morricone', 'howard shore', 'ramin djawadi', 'alan silvestri', 'ludovico einaudi', 'yiruma', 'max richter', 'عمر خيرت', 'omar khairat'],
    aliases: ['soundtrack', 'ost', 'score', 'instrumental', 'film score', 'موسيقى تصويرية']
  },
  BOLLYWOOD_INDIC: {
    id: 'bollywood-indic',
    name: 'Bollywood / Indic',
    arabicName: 'بوليوود / هندي',
    code: 'INDIC',
    color: '#e11d48',
    keywords: ['bollywood', 'hindi', 'indic', 'punjabi', 'desi', 'urdu', 'bhangra', 'filmi', 'qawwali', 'ghazal', 'بوليوود', 'هندي', 'بنجابي'],
    artists: ['arijit singh', 'shreya ghoshal', 'neha kakkar', 'ar rahman', 'a.r. rahman', 'lata mangeshkar', 'kishore kumar', 'badshah', 'diljit dosanjh', 'pritam', 'alka yagnik', 'atif aslam'],
    aliases: ['bollywood', 'indic', 'hindi', 'punjabi', 'desi', 'bollywood / indic', 'بوليوود', 'هندي']
  },
  POP: {
    id: 'pop',
    name: 'Pop',
    arabicName: 'بوب عالمي',
    code: 'POP',
    color: '#a855f7',
    keywords: ['pop music', 'synthpop', 'dance pop', 'electropop', 'بوب'],
    artists: ['taylor swift', 'michael jackson', 'ariana grande', 'ed sheeran', 'bruno mars', 'dua lipa', 'justin bieber', 'katy perry', 'rihanna', 'billie eilish', 'lady gaga', 'harry styles', 'selena gomez', 'olivia rodrigo', 'shawn mendes', 'abba'],
    aliases: ['pop']
  },
  PODCAST: {
    id: 'podcast',
    name: 'Podcast',
    arabicName: 'بودكاست',
    code: 'PODCAST',
    color: '#8b5cf6',
    isPodcast: true,
    keywords: ['بودكاست', 'podcast', 'podcasts', 'حلقة', 'حلقه', 'episode', 'episodes', 'كبريت', 'فنجان', 'ثمانية', 'بودكاست وعي', 'دوباميكافين', 'دروس أونلاين', 'السندباد', 'مربع', 'طحالب', 'بدون ورق', 'أبجورة', 'سوالف بزنس', 'إيه المشكلة', 'الدحيح', 'بودكاست الماتش'],
    artists: ['كبريت', 'كبريت ai', 'كبريت ai+', 'بودكاست وعي', 'برنامج وعي', 'بودكاست فنجان', 'فنجان', 'ثمانية', 'الدحيح', 'احمد الغندور', 'دوباميكافين', 'دروس أونلاين', 'احمد ابو زيد', 'بودكاست السندباد', 'سوالف بزنس', 'إيه المشكلة', 'امير منير', 'بودكاست الماتش', 'بدون ورق', 'مربع', 'أبجورة', 'طحالب'],
    aliases: ['podcast', 'podcasts', 'بودكاست', 'حلقات بودكاست', 'حلقة بودكاست', 'episode']
  }
};

const GENERIC_GENRES = new Set([
  'imported', 'other', 'unknown', 'stereo', 'music', 'single', 'audio',
  'track', 'various', 'general', ''
]);

export function normalizeSearchText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, ' ')
    .replace(/\b(official\s*(video|audio|music\s*video|clip|hd|hq|4k)|lyric\s*video|audio|visualizer)\b/gi, ' ')
    .replace(/(فيديو\s*كليب|كليب|حصريا|حصرياً|النسخة\s*الأصلية|النسخة\s*الاصلية)/gi, ' ')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchesPattern(haystackNorm, needleNorm) {
  if (!haystackNorm || !needleNorm) return false;
  if (haystackNorm === needleNorm) return true;
  const escaped = escapeRegex(needleNorm);
  const regex = new RegExp(`(^|[^a-zA-Z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF])${escaped}([^a-zA-Z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]|$)`, 'i');
  return regex.test(haystackNorm);
}

const AMBIGUOUS_ARTISTS = new Set([
  'future', 'queen', 'santa', 'flex', 'flx', 'rose', 'star', 'legend', 'hero', 'angel', 'free', 'ghost',
  'وردة', 'صباح', 'شهاب', 'مهاب', 'شاهين', 'الضبع', 'عنبة', 'كزبرة', 'فيلو', 'مسلم', 'نور', 'سيف'
]);

export function isQuranContent(title = '', artist = '', album = '', genre = '') {
  const combined = normalizeSearchText(`${title} ${artist} ${album} ${genre}`);
  if (!combined) return false;
  const q = GENRES.QURAN;
  for (const kw of q.keywords) {
    if (matchesPattern(combined, normalizeSearchText(kw))) return true;
  }
  for (const art of q.artists) {
    if (matchesPattern(combined, normalizeSearchText(art))) return true;
  }
  return false;
}

export function isPodcastContent(title = '', artist = '', album = '', genre = '') {
  const normGenre = normalizeSearchText(genre);
  if (normGenre === 'podcast' || normGenre === 'بودكاست') return true;
  const combined = normalizeSearchText(`${title} ${artist} ${album} ${genre}`);
  if (!combined) return false;
  const p = GENRES.PODCAST;
  for (const kw of p.keywords) {
    if (matchesPattern(combined, normalizeSearchText(kw))) return true;
  }
  for (const art of p.artists) {
    if (matchesPattern(combined, normalizeSearchText(art))) return true;
  }
  return false;
}

export function classifyGenre({ title = '', artist = '', album = '', genre = '', tags = [], description = '' } = {}) {
  const rawGenre = String(genre || '').trim();
  const normExplicit = normalizeSearchText(rawGenre);
  const normArtist = normalizeSearchText(artist);
  const normTitle = normalizeSearchText(title);
  const tagStr = Array.isArray(tags) ? tags.join(' ') : String(tags || '');
  const normTags = normalizeSearchText(tagStr);
  const normDescription = normalizeSearchText(description);
  const fullText = `${normTitle} ${normArtist} ${normalizeSearchText(album)} ${normTags} ${normDescription}`.trim();

  // 1. Quran check
  if (isQuranContent(title, artist, album, rawGenre)) {
    return { genre: GENRES.QURAN.name, arabicGenre: GENRES.QURAN.arabicName, isQuran: true, isPodcast: false };
  }

  // 1.1 Podcast check
  if (isPodcastContent(title, artist, album, rawGenre)) {
    return { genre: GENRES.PODCAST.name, arabicGenre: GENRES.PODCAST.arabicName, isQuran: false, isPodcast: true };
  }

  // 2. Explicit custom genre check
  if (normExplicit && !GENERIC_GENRES.has(normExplicit)) {
    for (const g of Object.values(GENRES)) {
      if (g.aliases.some(a => normalizeSearchText(a) === normExplicit)) {
        return { genre: g.name, arabicGenre: g.arabicName, isQuran: Boolean(g.isQuran), isPodcast: Boolean(g.isPodcast) };
      }
    }
    return { genre: rawGenre, arabicGenre: rawGenre, isQuran: false, isPodcast: rawGenre.toLowerCase() === 'podcast' || rawGenre === 'بودكاست' };
  }

  // 3. Artist detection (exact artist matching)
  if (normArtist) {
    for (const g of Object.values(GENRES)) {
      if (g.isQuran || g.isPodcast) continue;
      if (g.artists.some(a => matchesPattern(normArtist, normalizeSearchText(a)))) {
        return { genre: g.name, arabicGenre: g.arabicName, isQuran: false, isPodcast: false };
      }
    }
  }

  // 4. Keyword detection in full text
  for (const g of Object.values(GENRES)) {
    if (g.isQuran || g.isPodcast) continue;
    if (g.keywords.some(k => matchesPattern(fullText, normalizeSearchText(k)))) {
      return { genre: g.name, arabicGenre: g.arabicName, isQuran: false, isPodcast: false };
    }
  }

  // 5. Fallback artist search in title (guarded against common nouns)
  for (const g of Object.values(GENRES)) {
    if (g.isQuran || g.isPodcast) continue;
    for (const a of g.artists) {
      const normA = normalizeSearchText(a);
      if (!normA) continue;
      if (AMBIGUOUS_ARTISTS.has(normA)) {
        const escaped = escapeRegex(normA);
        const artistPosRegex = new RegExp(`(?:^|[-_|/:]\\s*|(?:feat|ft|featuring|prod|with|by)\\.?\\s+)${escaped}(?:\\s*[-_|/:]|\\s*$)`, 'i');
        if (!artistPosRegex.test(title)) continue;
      }
      if (matchesPattern(normTitle, normA)) {
        return { genre: g.name, arabicGenre: g.arabicName, isQuran: false, isPodcast: false };
      }
    }
  }

  // 6. Multi-feature cue detection
  const FEATURE_RULES = [
    { genre: GENRES.CLASSICAL, patterns: ['symphony', 'concerto', 'sonata', 'philharmonic', 'orchestral', 'orchestra', 'chamber music', 'opera', 'سيمفونية', 'اوركسترا', 'أوركسترا', 'موسيقى كلاسيكية', 'كونشيرتو', 'سوناتا'] },
    { genre: GENRES.SOUNDTRACK, patterns: ['soundtrack', 'original soundtrack', 'ost', 'film score', 'movie score', 'main theme', 'motion picture score', 'instrumental', 'game soundtrack', 'anime ost', 'موسيقى تصويرية', 'اوست'] },
    { genre: GENRES.METAL, patterns: ['heavy metal', 'death metal', 'black metal', 'thrash metal', 'metalcore', 'doom metal', 'ميتال', 'الميتال'] },
    { genre: GENRES.ROCK, patterns: ['hard rock', 'alternative rock', 'classic rock', 'grunge', 'punk rock', 'indie rock', 'روك', 'الروك'] },
    { genre: GENRES.INDIE, patterns: ['underground', 'acoustic version', 'unplugged', 'garage rock', 'indie folk', 'إندي', 'اندي', 'بديل', 'اندرجراوند'] },
    { genre: GENRES.TARAB, patterns: ['طرب أصيل', 'طرب اصيل', 'طرب', 'سلطنة', 'تخت شرقي', 'تقاسيم عود', 'موشحات', 'قدود حلبية', 'قصيدة مغناة', 'موال طربي'] },
    { genre: GENRES.MAHRAGANAT, patterns: ['مهرجان', 'مهرجانات', 'سرسجي', 'توزيع درامز', 'درامز جديد', 'electro shaabi'] },
    { genre: GENRES.SHAABI, patterns: ['أغاني شعبية', 'اغاني شعبية', 'شعبيات مصرية', 'موال شعبي', 'شعبي قديم', 'egyptian shaabi'] },
    { genre: GENRES.JAZZ, patterns: ['smooth jazz', 'bebop', 'swing jazz', 'saxophone solo', 'جاز', 'بلوز'] },
    { genre: GENRES.ELECTRONIC, patterns: ['deep house', 'synthwave', 'techno remix', 'club mix', 'dubstep', 'extended mix', 'إلكترونيك', 'دي جي'] },
    { genre: GENRES.LOFI, patterns: ['chillhop', 'study beats', 'chill beats', 'sleep beats', 'lofi hip hop', 'لوفاي', 'لو فاي'] },
    { genre: GENRES.RNB, patterns: ['neo soul', 'rnb soul', 'motown', 'آر آند بي', 'سول'] },
    { genre: GENRES.BOLLYWOOD_INDIC, patterns: ['bollywood', 'punjabi song', 'hindi song', 'bhangra', 'filmi', 'بوليوود', 'اغاني هندية', 'هندي'] },
    { genre: GENRES.KHALEEJI, patterns: ['شيلات حصرية', 'شيلة جديدة', 'سامري', 'جلسة طرب', 'جلسة خليجية'] }
  ];

  for (const rule of FEATURE_RULES) {
    if (rule.genre && rule.patterns.some(p => matchesPattern(fullText, normalizeSearchText(p)))) {
      return { genre: rule.genre.name, arabicGenre: rule.genre.arabicName, isQuran: false, isPodcast: false };
    }
  }

  // 7. Arabic script heuristic
  if (/[\u0600-\u06FF]/.test(`${title} ${artist}`)) {
    return { genre: GENRES.ARABIC_POP.name, arabicGenre: GENRES.ARABIC_POP.arabicName, isQuran: false, isPodcast: false };
  }

  // 8. Pop fallback
  return { genre: GENRES.POP.name, arabicGenre: GENRES.POP.arabicName, isQuran: false, isPodcast: false };
}
