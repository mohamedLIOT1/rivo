/**
 * Bilingual Franco-Arabic Phonetic Transliteration Engine
 * Converts between Egyptian Franco-Arabic (Arabizi) and Arabic script
 * bidirectional search matching across tracks, artists, and albums.
 * File size strictly < 400 lines.
 */

const COMMON_WORD_MAP = {
  // Common song title words (Franco -> Arabic)
  'shoft': ['شوفت', 'شفت'],
  'sheft': ['شوفت', 'شفت'],
  'shoof': ['شوف'],
  'shofna': ['شوفنا'],
  'kalam': ['كلام'],
  'el': ['ال'],
  'al': ['ال'],
  'bakht': ['بخت', 'البخت'],
  'dorak': ['دورك'],
  'gai': ['جاي'],
  'gay': ['جاي'],
  'ghaba': ['غابة'],
  'keif': ['كيف'],
  'keify': ['كيفي'],
  'keda': ['كده', 'كذا'],
  'salka': ['سلكة'],
  'kan': ['كان'],
  'kol': ['كل'],
  'lak': ['لك'],
  'leek': ['ليك'],
  'lek': ['لك'],
  'maaya': ['معايا'],
  'ma3aya': ['معايا'],
  'wana': ['وانا', 'وأنا'],
  'ma': ['مع'],
  'nafsy': ['نفسي'],
  'aed': ['قاعد'],
  '2a3ed': ['قاعد'],
  'qaed': ['قاعد'],
  'sahran': ['سهران'],
  'tamally': ['تملي'],
  'maak': ['معاك'],
  'nour': ['نور'],
  'ein': ['عين'],
  '3ein': ['عين'],
  'habibi': ['حبيبي'],
  '7abibi': ['حبيبي'],
  'ayam': ['ايام', 'أيام'],
  'forak': ['فراق'],
  'khawaga': ['خواجة'],
  'matkhafsh': ['متخافش'],
  'hokooma': ['حكومة'],
  'ethbat': ['اثبت', 'إثبت'],
  'makanak': ['مكانك'],
  'barbary': ['بربري'],
  'tesla': ['تسلا'],
  'control': ['كنترول'],
  'roma': ['روما'],
  'marboot': ['مربوط'],
  'astek': ['استيك', 'أستيك'],
  'noaata': ['نقطة', 'نقطه'],
  'beida': ['بيضا', 'بيضاء'],
  'nas': ['ناس'],
  'w': ['و'],
  'akher': ['اخر', 'آخر'],
  'oghnya': ['اغنية', 'أغنية'],
  'placebo': ['بلاسيبو'],
  'aqareb': ['عقارب'],
  'swissra': ['سويسرا'],
  '3al': ['ع', 'على'],
  'khatt': ['الخط', 'خط'],
  'kahtt': ['الخط', 'خط'],
  'tharthara': ['ثرثرة'],
  'salmonella': ['سالمونيلا'],
  'nesena': ['نسينا'],
  'msh': ['مش'],
  'mesh': ['مش'],
  'mosh': ['مش'],
  'da': ['دا', 'ده'],
  'elle': ['اللي'],
  'eli': ['اللي'],
  'elly': ['اللي'],
  'ekhtarto': ['اخترته'],
  'troo7': ['تروح'],
  'trooh': ['تروح'],
  'lemeen': ['لمين'],
  'fel': ['في ال', 'في'],
  'galeed': ['الجليد', 'جليد'],
  'daftar': ['دفتر'],
  'yakhoya': ['ياخويا', 'يا اخويا'],
  'wassa3': ['وسع'],
  'se7reya': ['سحرية'],
  'sabry': ['صبري'],
  'qaleel': ['قليل'],
  'adrenaline': ['ادرينالين'],
  'baet': ['بقيت'],
  'waheed': ['وحيد'],
  'amira': ['اميرة', 'أميرة'],
  'metkattef': ['متكتف'],
  'samurai': ['ساموراي'],
  'basrah': ['بسرح'],
  'nefsy': ['نفسي'],
  'ahebbek': ['احبك'],
  'helmy': ['حلمي'],
  'ana': ['انا', 'أنا'],
  'zay': ['زي'],
  'shams': ['شمس'],
  'qamar': ['قمر'],
  'zina': ['زينة'],
  'salamat': ['سلامات'],
  'khashab': ['خشب'],
  'bayaa': ['بياعة'],
  'kollaha': ['كلها'],
  'ghirana': ['غيرانة'],
  'ekhteyarat': ['اختياراتي'],
  'tegy': ['تيجي'],
  'ntrahan': ['نتراهن'],
  'mohakma': ['محكمة'],
  'batal': ['بطل'],
  '3alam': ['عالم'],
  'alam': ['عالم'],
  'hadota': ['حدوتة'],
  '7adota': ['حدوتة'],
  'almany': ['الماني', 'ألماني'],
  'drogba': ['دروجبا'],
  'yom': ['يوم'],
  'gedid': ['جديد'],
  'saab': ['صعب'],
  'ekhteyar': ['اختيار'],
  'wayah': ['وياه'],
  'ragea': ['راجع'],
  'aks': ['عكس'],
  'baad': ['بعض'],
  'helwa': ['حلوة', 'حلوه'],
  'bedayat': ['بدايات', 'البدايات'],
  'hayeish': ['هيعيش'],
  'yeftekerni': ['يفتكرني'],
  'amaken': ['اماكن', 'أماكن'],
  'sahar': ['سهر', 'السهر'],
  'enta': ['انت', 'أنت'],
  'haz': ['حظ', 'الحظ'],
  'awghad': ['اوغاد', 'أوغاد'],
  'hokomdar': ['حكمدار'],
  'balad': ['بلد'],
  'ghorba': ['غربة'],
  'agzakhana': ['اجزاخانة'],
  'afareet': ['عفاريت'],
  'ghasala': ['غسالة'],
  'khamsa': ['خمسة'],
  'cinderella': ['سندريلا'],
  'deja vu': ['ديجا فو'],
  'leha': ['ليها'],
  'ghabet': ['غابت'],
  'magrooh': ['مجروح'],
  'rouh': ['روح'],
  '3yoonak': ['عيونك'],
  'balash': ['بلاش'],
  'sattar': ['ستار'],
  'malama': ['ملامة'],
  'lela': ['ليلة'],
  'samra': ['سمرا', 'سمراء'],
  'shamandora': ['شمندورة']
};

// Build reverse map (Arabic -> Franco)
const ARABIC_TO_FRANCO_MAP = {};
for (const [franco, arList] of Object.entries(COMMON_WORD_MAP)) {
  for (const ar of arList) {
    if (!ARABIC_TO_FRANCO_MAP[ar]) ARABIC_TO_FRANCO_MAP[ar] = [];
    if (!ARABIC_TO_FRANCO_MAP[ar].includes(franco)) {
      ARABIC_TO_FRANCO_MAP[ar].push(franco);
    }
  }
}

function normalizeText(str = '') {
  return String(str)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[-_.,/\\~`!?:;"'#@$%^&*()[\]{}|<>+=]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function transliterateWordToFrancoPhonetic(arWord = '') {
  let w = arWord
    .replace(/^ال/g, 'el ')
    .replace(/ش/g, 'sh')
    .replace(/خ/g, 'kh')
    .replace(/غ/g, 'gh')
    .replace(/ث/g, 'th')
    .replace(/ح/g, '7')
    .replace(/ع/g, '3')
    .replace(/ط/g, 't')
    .replace(/ص/g, 's')
    .replace(/ض/g, 'd')
    .replace(/ظ/g, 'z')
    .replace(/ق/g, 'k')
    .replace(/ك/g, 'k')
    .replace(/ج/g, 'g')
    .replace(/ف/g, 'f')
    .replace(/ب/g, 'b')
    .replace(/ت/g, 't')
    .replace(/د/g, 'd')
    .replace(/ر/g, 'r')
    .replace(/ز/g, 'z')
    .replace(/س/g, 's')
    .replace(/ل/g, 'l')
    .replace(/م/g, 'm')
    .replace(/ن/g, 'n')
    .replace(/ه/g, 'h')
    .replace(/و/g, 'o')
    .replace(/ي|ى/g, 'y')
    .replace(/ا|أ|إ|آ|ء/g, 'a');
  return w.trim();
}

function transliterateWordToArabicPhonetic(francoWord = '') {
  let prefix = '';
  let w = francoWord;
  if (w.startsWith('el') || w.startsWith('al')) {
    prefix = 'ال';
    w = w.substring(2);
  }

  let ar = w
    .replace(/sh|ch/g, 'ش')
    .replace(/kh|5|7'/g, 'خ')
    .replace(/gh|3'/g, 'غ')
    .replace(/th/g, 'ث')
    .replace(/ph/g, 'ف')
    .replace(/3/g, 'ع')
    .replace(/7/g, 'ح')
    .replace(/6/g, 'ط')
    .replace(/9/g, 'ص')
    .replace(/2|'/g, 'أ')
    .replace(/b/g, 'ب')
    .replace(/t/g, 'ت')
    .replace(/g|j/g, 'ج')
    .replace(/d/g, 'د')
    .replace(/r/g, 'ر')
    .replace(/z/g, 'ز')
    .replace(/s/g, 'س')
    .replace(/f/g, 'ف')
    .replace(/q|k/g, 'ك')
    .replace(/l/g, 'ل')
    .replace(/m/g, 'م')
    .replace(/n/g, 'ن')
    .replace(/h/g, 'ه')
    .replace(/w|oo|ou|u|o/g, 'و')
    .replace(/y|ee|i/g, 'ي')
    .replace(/a|e/g, 'ا');

  return prefix + ar;
}

/**
 * Generate bilingual search terms from query (Arabic <-> Franco)
 */
function generateBilingualVariants(input = '') {
  if (!input || typeof input !== 'string') return [];
  const raw = input.trim();
  const norm = normalizeText(raw);
  if (!norm) return [];

  const variants = new Set([raw.toLowerCase(), norm]);
  const hasArabic = /[\u0600-\u06FF]/.test(raw);
  const words = norm.split(/\s+/).filter(Boolean);

  if (hasArabic) {
    // 1. ARABIC -> FRANCO
    const francoOptionsPerWord = words.map(w => {
      const mapped = ARABIC_TO_FRANCO_MAP[w] || [];
      const phonetic = transliterateWordToFrancoPhonetic(w);
      return Array.from(new Set([...mapped, phonetic])).filter(Boolean);
    });

    // Cartesian product of first 2 choices per word to avoid exponential explosion
    let combos = [''];
    for (const options of francoOptionsPerWord) {
      const nextCombos = [];
      const sliceOpts = options.slice(0, 2);
      for (const prefix of combos) {
        for (const opt of sliceOpts) {
          nextCombos.push((prefix ? prefix + ' ' : '') + opt);
        }
      }
      combos = nextCombos.slice(0, 10);
    }
    combos.forEach(c => variants.add(c.trim()));
  } else {
    // 2. FRANCO -> ARABIC
    const arabicOptionsPerWord = words.map(w => {
      const mapped = COMMON_WORD_MAP[w] || [];
      const phonetic = transliterateWordToArabicPhonetic(w);
      const phoneticNoAlif = phonetic.replace(/(?<!^)ا/g, ''); // e.g. كلام vs كلم
      return Array.from(new Set([...mapped, phonetic, phoneticNoAlif])).filter(Boolean);
    });

    let combos = [''];
    for (const options of arabicOptionsPerWord) {
      const nextCombos = [];
      const sliceOpts = options.slice(0, 3);
      for (const prefix of combos) {
        for (const opt of sliceOpts) {
          nextCombos.push((prefix ? prefix + ' ' : '') + opt);
        }
      }
      combos = nextCombos.slice(0, 10);
    }
    combos.forEach(c => variants.add(normalizeText(c.trim())));
  }

  return Array.from(variants).filter(Boolean);
}

module.exports = {
  COMMON_WORD_MAP,
  ARABIC_TO_FRANCO_MAP,
  generateBilingualVariants,
  normalizeText
};
