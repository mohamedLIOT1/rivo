/**
 * Re-export genreClassifier for web and client utilities
 */
export * from '../native/utils/genreClassifier';

export const GENRE_MAP = {
  'Holy Quran': {
    keywords: ['قرآن', 'سورة', 'مصحف', 'تلاوة', 'تراويح', 'quran', 'surah', 'abdulbasit', 'al-afasy', 'minshawi', 'al-sudais', 'maher al-muaiqly'],
    artists: ['مشاري العفاسي', 'عبد الباسط عبد الصمد', 'المنشاوي', 'ماهر المعيقلي', 'سعد الغامدي', 'ياسر الدوسري', 'محمود خليل الحصري', 'احمد العجمي', 'ناصر القطامي'],
  },
  'Mahraganat': {
    keywords: ['مهرجان', 'مهرجانات', 'شعبي', 'شعبيات', 'مولد', 'سرسجي', 'دبكة', 'mahragan', 'shaabi'],
    artists: ['عصام صاصا', 'essam sasa', 'مسلم', 'muslim', 'حمو بيكا', 'hamo bika', 'حسن شاكوش', 'hassan shakosh', 'عمر كمال', 'omar kamal', 'رضا البحراوي', 'reda el bahrawy', 'محمود الليثي', 'mahmoud el leithy', 'طارق الشيخ', 'tarek el sheikh', 'احمد شيبة', 'ahmed sheba', 'عنبة', '3enba', 'عنبه', 'دبل زوكش', 'double zuksh', 'شواحة', 'المدفعجية', 'فيجو الدخلاوي', 'حودة بندق', 'houda bondok', 'سيف مجدي', 'اسلام كابونجا', 'سامر المدني', 'فيلو', 'شحتة كاريكا'],
  },
  'Rap / Hip-Hop': {
    keywords: ['راب', 'تراب', 'دريل', 'فري ستايل', 'ديس', 'سين', 'rap', 'trap', 'drill', 'hip-hop', 'hiphop', 'freestyle', 'diss'],
    artists: ['ويجز', 'wegz', 'مروان بابلو', 'marwan pablo', 'مروان موسى', 'marwan moussa', 'عفروتو', 'afroto', 'شب جديد', 'shabjdeed', 'ابو الانوار', 'abo el anwar', 'سانتا', 'كريم اسامة', 'karim osama', 'موسى سام', 'mousa sam', 'شهاب', 'shehab', 'فليكس', 'flx', 'زياد ظاظا', 'ziad zaza', 'مهاب', 'mohab', 'ارسينك', 'arsenic', 'الجوكر', 'el joker', 'ابيوسف', 'abyusif', 'شاهين', 'shaheen', 'باتستوتا', 'احمد سانتا', 'الضبع', 'ليجي', 'lege-cy', 'lege cy', 'drake', 'travis scott', 'kendrick lamar', 'eminem', 'kanye', 'j. cole', 'future', 'metro boomin', '21 savage'],
  },
  'Classic / Tarab': {
    keywords: ['طرب', 'كلاسيك', 'تراث', 'موشح', 'سلطنة', 'tarab', 'classic'],
    artists: ['أم كلثوم', 'ام كلثوم', 'om kalthoum', 'um kalthoum', 'عبد الحليم حافظ', 'عبد الحليم', 'abdel halim', 'فيروز', 'fairouz', 'fayrouz', 'وردة', 'وردة الجزائرية', 'warda', 'نجاة الصغيرة', 'نجاة', 'محمد عبد الوهاب', 'mohamed abdel wahab', 'سيد درويش', 'طلال مداح', 'صباح فخري', 'صباح', 'فريد الأطرش', 'farid el atrache', 'اسمهان', 'وديع الصافي', 'جورج وسوف', 'george wassouf', 'ميادة الحناوي'],
  },
  'Indie / Alternative': {
    keywords: ['إندي', 'اندي', 'بديل', 'أندرجراوند', 'اندرجراوند', 'روك', 'indie', 'alternative', 'underground', 'acoustic', 'rock'],
    artists: ['كايروكي', 'cairokee', 'مسار إجباري', 'مسار اجباري', 'massar egbari', 'شارموفرز', 'sharmoofers', 'حمزة نمرة', 'حمزه نمره', 'hamza namira', 'امير عيد', 'amir eid', 'أوتوستراد', 'autostrad', 'جدل', 'jadal', 'مشروع ليلى', 'mashrou leila', 'المربع', 'el morabba3', 'عزيز مرقة', 'aziz maraka', 'ديسكو مصر', 'disco misr', 'اخر زفير', 'akher zapheer', 'هوس', 'أدونيس', 'adonis', 'تامر نفار', 'فلكلور'],
  },
  'Arabic Pop': {
    keywords: ['بوب عربي', 'رومانسي', 'دراما', 'صيف', 'arabic pop'],
    artists: ['عمرو دياب', 'amr diab', 'تامر حسني', 'tamer hosny', 'محمد حماقي', 'حماقي', 'mohamed hamaki', 'شيرين', 'sherine', 'شرين', 'أصالة', 'اصالة', 'asala', 'اليسا', 'elissa', 'نانسي عجرم', 'nancy ajram', 'بهاء سلطان', 'bahaa sultan', 'تامر عاشور', 'tamer ashoor', 'رامي صبري', 'rami sabry', 'فضل شاكر', 'fadel shaker', 'احمد سعد', 'ahmed saad', 'حسين الجسمي', 'hussain al jassmi', 'أنغام', 'angham', 'وائل كفوري', 'wael kfoury', 'راغب علامة', 'ragheb alama', 'نوال الزغبي', 'كارول سماحة', 'بلقيس', 'سعد لمجرد', 'saad lamjarred', 'صابر الرباعي', 'محمد فؤاد', 'مصطفى قمر', 'هشام عباس', 'إيهاب توفيق', 'ehab tawfik', 'ساندي'],
  },
  'Khaleeji': {
    keywords: ['شيلات', 'شيلة', 'خليجي', 'جلسة', 'سامري', 'khaleeji'],
    artists: ['محمد عبده', 'راشد الماجد', 'عبد المجيد عبد الله', 'ماجد المهندس', 'نبيل شعيل', 'رابح صقر', 'احلام', 'فؤاد عبد الواحد'],
  },
  'R&B / Soul': {
    keywords: ['r&b', 'soul', 'neo-soul'],
    artists: ['the weeknd', 'sza', 'frank ocean', 'brent faiyaz', 'daniel caesar', 'bryson tiller'],
  },
  'Electronic': {
    keywords: ['edm', 'electronic', 'remix', 'house', 'techno', 'dance', 'club', 'ريمكس', 'مكس', 'توزيع جديد'],
    artists: ['marshmello', 'david guetta', 'calvin harris', 'avicii', 'tiesto', 'alan walker'],
  },
};
