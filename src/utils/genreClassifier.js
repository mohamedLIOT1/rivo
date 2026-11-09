/**
 * Re-export genreClassifier for web and client utilities
 */
export * from '../native/utils/genreClassifier.js';

export const GENRE_MAP = {
  'Holy Quran': {
    keywords: ['قرآن', 'سورة', 'مصحف', 'تلاوة', 'تراويح', 'quran', 'surah', 'abdulbasit', 'al-afasy', 'minshawi', 'al-sudais', 'maher al-muaiqly'],
    artists: ['مشاري العفاسي', 'عبد الباسط عبد الصمد', 'المنشاوي', 'ماهر المعيقلي', 'سعد الغامدي', 'ياسر الدوسري', 'محمود خليل الحصري', 'احمد العجمي', 'ناصر القطامي'],
  },
  'Shaabi': {
    keywords: ['شعبي', 'الشعبي', 'شعبيات', 'أغاني شعبية', 'اغاني شعبية', 'بلدي', 'shaabi', 'shabi'],
    artists: ['أحمد عدوية', 'احمد عدوية', 'ahmed adaweya', 'عبد الباسط حمودة', 'عبد الباسط', 'abdel baset hamouda', 'محمود الليثي', 'طارق الشيخ', 'احمد شيبة', 'رضا البحراوي', 'حكيم', 'حسن الأسمر'],
  },
  'Mahraganat': {
    keywords: ['مهرجان', 'مهرجانات', 'المهرجانات', 'سرسجي', 'دبكة', 'mahragan', 'mahraganat', 'electro shaabi'],
    artists: ['عصام صاصا', 'essam sasa', 'حمو بيكا', 'hamo bika', 'حسن شاكوش', 'hassan shakosh', 'عمر كمال', 'عنبة', 'دبل زوكش', 'شواحة', 'المدفعجية', 'فيجو الدخلاوي', 'حودة بندق', 'سيف مجدي', 'فيلو', 'شحتة كاريكا', 'كزبرة'],
  },
  'Rap / Hip-Hop': {
    keywords: ['راب', 'الراب', 'تراب', 'دريل', 'فري ستايل', 'ديس', 'سين', 'rap', 'trap', 'drill', 'hip-hop', 'hiphop', 'freestyle', 'diss'],
    artists: ['ويجز', 'wegz', 'مروان بابلو', 'marwan pablo', 'مروان موسى', 'marwan moussa', 'عفروتو', 'afroto', 'شب جديد', 'shabjdeed', 'ابو الانوار', 'كريم اسامة', 'موسى سام', 'شهاب', 'فليكس', 'زياد ظاظا', 'مهاب', 'ارسينك', 'الجوكر', 'شاهين', 'باتستوتا', 'احمد سانتا', 'ليجي', 'lege-cy', 'drake', 'travis scott', 'kendrick lamar', 'eminem', 'kanye', 'future', 'metro boomin', '21 savage'],
  },
  'Tarab': {
    keywords: ['طرب', 'الطرب', 'طرب أصيل', 'تراث', 'موشح', 'سلطنة', 'قصيدة', 'tarab', 'classic arabic'],
    artists: ['أم كلثوم', 'ام كلثوم', 'om kalthoum', 'عبد الحليم حافظ', 'عبد الحليم', 'فيروز', 'fairouz', 'fayrouz', 'وردة', 'warda', 'نجاة الصغيرة', 'محمد عبد الوهاب', 'سيد درويش', 'طلال مداح', 'صباح فخري', 'فريد الأطرش', 'اسمهان', 'وديع الصافي', 'جورج وسوف', 'ميادة الحناوي'],
  },
  'Classic / Tarab': {
    keywords: ['طرب', 'كلاسيك', 'تراث', 'موشح', 'سلطنة', 'tarab', 'classic'],
    artists: ['أم كلثوم', 'ام كلثوم', 'om kalthoum', 'عبد الحليم حافظ', 'فيروز', 'fairouz', 'وردة', 'warda', 'محمد عبد الوهاب', 'جورج وسوف'],
  },
  'Indie / Alternative': {
    keywords: ['إندي', 'اندي', 'بديل', 'أندرجراوند', 'اندرجراوند', 'روك', 'indie', 'alternative', 'underground', 'acoustic', 'rock'],
    artists: ['كايروكي', 'cairokee', 'مسار إجباري', 'مسار اجباري', 'massar egbari', 'شارموفرز', 'حمزة نمرة', 'امير عيد', 'أوتوستراد', 'جدل', 'مشروع ليلى', 'المربع', 'عزيز مرقة', 'ديسكو مصر', 'اخر زفير', 'the cure', 'arctic monkeys', 'the strokes', 'radiohead', 'coldplay'],
  },
  'Arabic Pop': {
    keywords: ['بوب عربي', 'رومانسي', 'دراما', 'صيف', 'arabic pop'],
    artists: ['عمرو دياب', 'amr diab', 'تامر حسني', 'tamer hosny', 'محمد حماقي', 'شيرين', 'أصالة', 'اليسا', 'نانسي عجرم', 'بهاء سلطان', 'تامر عاشور', 'رامي صبري', 'فضل شاكر', 'احمد سعد', 'حسين الجسمي', 'أنغام', 'وائل كفوري', 'راغب علامة'],
  },
  'Khaleeji': {
    keywords: ['شيلات', 'شيلة', 'خليجي', 'جلسة', 'سامري', 'khaleeji'],
    artists: ['محمد عبده', 'راشد الماجد', 'عبد المجيد عبد الله', 'ماجد المهندس', 'نبيل شعيل', 'رابح صقر', 'احلام', 'فؤاد عبد الواحد'],
  },
  'Rock': {
    keywords: ['rock', 'hard rock', 'alternative rock', 'classic rock', 'grunge', 'روك', 'الروك'],
    artists: ['linkin park', 'queen', 'led zeppelin', 'nirvana', 'ac/dc', 'guns n roses', 'red hot chili peppers', 'pink floyd', 'pearl jam', 'carlos santana', 'santana'],
  },
  'Metal': {
    keywords: ['metal', 'heavy metal', 'death metal', 'black metal', 'thrash metal', 'metalcore', 'ميتال'],
    artists: ['slipknot', 'metallica', 'megadeth', 'slayer', 'iron maiden', 'avenged sevenfold', 'rammstein', 'system of a down'],
  },
  'EDM / Electronic': {
    keywords: ['edm', 'electronic', 'remix', 'house', 'techno', 'dance', 'club', 'ريمكس', 'مكس', 'إلكترونيك'],
    artists: ['marshmello', 'david guetta', 'calvin harris', 'avicii', 'tiesto', 'alan walker', 'martin garrix', 'skrillex', 'daft punk'],
  },
  'Electronic': {
    keywords: ['edm', 'electronic', 'remix', 'house', 'techno', 'dance', 'club', 'ريمكس', 'مكس', 'توزيع جديد'],
    artists: ['marshmello', 'david guetta', 'calvin harris', 'avicii', 'tiesto', 'alan walker'],
  },
  'R&B / Soul': {
    keywords: ['r&b', 'soul', 'neo-soul', 'آر آند بي', 'سول'],
    artists: ['the weeknd', 'sza', 'frank ocean', 'brent faiyaz', 'daniel caesar', 'bryson tiller', 'chris brown', 'usher'],
  },
  'Lo-Fi': {
    keywords: ['lofi', 'lo-fi', 'chillhop', 'study beats', 'chill beats', 'لوفاي'],
    artists: ['lofi girl', 'chilledcow', 'potsu', 'idealism', 'kudasai'],
  },
  'Jazz / Blues': {
    keywords: ['jazz', 'smooth jazz', 'bebop', 'swing', 'blues', 'saxophone', 'جاز', 'بلوز'],
    artists: ['miles davis', 'john coltrane', 'louis armstrong', 'ella fitzgerald', 'bill evans', 'nina simone'],
  },
  'Classical': {
    keywords: ['symphony', 'concerto', 'sonata', 'orchestral', 'philharmonic', 'classical music', 'سيمفونية', 'اوركسترا'],
    artists: ['mozart', 'beethoven', 'bach', 'chopin', 'tchaikovsky', 'vivaldi', 'yo-yo ma'],
  },
  'Soundtrack / Instrumental': {
    keywords: ['soundtrack', 'ost', 'score', 'film score', 'instrumental', 'موسيقى تصويرية', 'اوست'],
    artists: ['hans zimmer', 'john williams', 'ennio morricone', 'howard shore', 'ramin djawadi', 'عمر خيرت', 'omar khairat'],
  },
  'Bollywood / Indic': {
    keywords: ['bollywood', 'hindi', 'indic', 'punjabi', 'desi', 'urdu', 'bhangra', 'filmi', 'بوليوود', 'هندي'],
    artists: ['arijit singh', 'shreya ghoshal', 'neha kakkar', 'ar rahman', 'lata mangeshkar', 'kishore kumar', 'badshah', 'diljit dosanjh'],
  },
  'Pop': {
    keywords: ['pop music', 'synthpop', 'dance pop', 'electropop', 'بوب'],
    artists: ['taylor swift', 'michael jackson', 'ariana grande', 'ed sheeran', 'bruno mars', 'dua lipa', 'billie eilish', 'abba'],
  },
  'Podcast': {
    keywords: ['بودكاست', 'podcast', 'حلقة', 'episode', 'كبريت', 'فنجان', 'ثمانية', 'وعي', 'دوباميكافين', 'دروس أونلاين', 'السندباد', 'مربع', 'طحالب', 'بدون ورق', 'أبجورة', 'سوالف بزنس', 'إيه المشكلة', 'الدحيح', 'الماتش'],
    artists: ['كبريت', 'كبريت ai', 'كبريت ai+', 'بودكاست وعي', 'وعي', 'بودكاست فنجان', 'فنجان', 'ثمانية', 'الدحيح', 'احمد الغندور', 'دوباميكافين', 'دروس أونلاين', 'بودكاست السندباد', 'سوالف بزنس', 'إيه المشكلة', 'بودكاست الماتش'],
  },
};
