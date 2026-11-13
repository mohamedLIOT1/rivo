/**
 * Bilingual Franco-Arabic Phonetic Transliteration Engine (Client / ES Module)
 * Converts between Egyptian Franco-Arabic (Arabizi) and Arabic script
 * bidirectional search matching across tracks, artists, and albums.
 * File size strictly < 400 lines.
 */

export const COMMON_WORD_MAP = {
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
  'mesh': ['مش'],
  'msh': ['مش'],
  'feen': ['فين'],
  'leh': ['ليه'],
  'leih': ['ليه'],
  'enta': ['انت', 'إنت'],
  'enti': ['انتي', 'إنتي'],
  'howa': ['هو'],
  'heya': ['هي'],
  'eh': ['ايه', 'إيه'],
  'lama': ['لما'],
  'lamma': ['لما'],
  'ya': ['يا'],
  'w': ['و'],
  'wa': ['و'],
  'fi': ['في'],
  'fee': ['في'],
  'men': ['من'],
  'min': ['من'],
  '3an': ['عن'],
  'an': ['عن'],
  'ala': ['على', 'علي'],
  '3ala': ['على', 'علي'],
  'bass': ['بس'],
  'bas': ['بس'],
  'kteer': ['كتير'],
  'gedan': ['جدا', 'جدًا'],
  'asly': ['اصلي', 'أصلي'],
  'helw': ['حلو'],
  'helwa': ['حلوة'],
  'gamed': ['جامد'],
  'gamda': ['جامدة'],
  'saab': ['صعب'],
  '7elw': ['حلو'],
  '7elwa': ['حلوة'],
  'sot': ['صوت'],
  'alb': ['قلب'],
  '2alb': ['قلب'],
  'qalby': ['قلبي'],
  'alby': ['قلبي'],
  '2alby': ['قلبي'],
  'rohy': ['روحي'],
  '7obi': ['حبي'],
  'hob': ['حب'],
  '7ob': ['حب'],
  'baheb': ['بحب'],
  'ba7eb': ['بحب'],
  'bahebak': ['بحبك'],
  'ba7ebak': ['بحبك'],
  'asheq': ['عاشق'],
  '3asheq': ['عاشق'],
  'ghaly': ['غالي'],
  'leila': ['ليلة'],
  'leilat': ['ليلة'],
  'lail': ['ليل'],
  'layl': ['ليل'],
  'nhar': ['نهار'],
  'zaman': ['زمان'],
  'makan': ['مكان'],
  'makanak': ['مكانك'],
  'denya': ['دنيا'],
  'dunya': ['دنيا'],
  'alam': ['عالم'],
  '3alam': ['عالم'],
  'omry': ['عمري'],
  '3omry': ['عمري'],
  '7ayaty': ['حياتي'],
  'hayaty': ['حياتي'],
  'soura': ['صورة'],
  'sora': ['صورة'],
  'had': ['حد'],
  'wahed': ['واحد'],
  'keteer': ['كتير'],
  'sohba': ['صحبة'],
  'sehab': ['صحاب'],
  'as-hab': ['أصحاب', 'اصحاب'],
  'khlas': ['خلاص'],
  'khalas': ['خلاص']
};

export const ARABIC_TO_FRANCO_MAP = {
  'شوفت': ['shoft', 'sheft'],
  'شفت': ['shoft', 'sheft'],
  'شوف': ['shoof', 'shof'],
  'كلام': ['kalam'],
  'ال': ['el', 'al'],
  'بخت': ['bakht'],
  'البخت': ['el bakht', 'elbakht'],
  'دورك': ['dorak'],
  'جاي': ['gai', 'gay'],
  'غابة': ['ghaba'],
  'كيف': ['keif'],
  'كيفي': ['keify'],
  'كده': ['keda'],
  'سلكة': ['salka'],
  'كان': ['kan'],
  'كل': ['kol'],
  'لك': ['lak', 'lek'],
  'ليك': ['leek'],
  'معايا': ['maaya', 'ma3aya'],
  'مع': ['ma', 'maa'],
  'وانا': ['wana', 'wa ana'],
  'وأنا': ['wana', 'wa ana'],
  'نفسي': ['nafsy', 'nafsi'],
  'قاعد': ['aed', '2a3ed', 'qaed'],
  'سهران': ['sahran'],
  'تملي': ['tamally', 'tamali'],
  'معاك': ['maak', 'ma3ak'],
  'نور': ['nour', 'nor'],
  'عين': ['ein', '3ein', 'ain'],
  'حبيبي': ['habibi', '7abibi'],
  'أيام': ['ayam'],
  'ايام': ['ayam'],
  'فراق': ['forak', 'feraq'],
  'خواجة': ['khawaga'],
  'متخافش': ['matkhafsh'],
  'مش': ['mesh', 'msh'],
  'فين': ['feen', 'fen'],
  'ليه': ['leh', 'leih'],
  'انت': ['enta'],
  'إنت': ['enta'],
  'انتي': ['enti'],
  'إنتي': ['enti'],
  'هو': ['howa'],
  'هي': ['heya'],
  'ايه': ['eh'],
  'إيه': ['eh'],
  'لما': ['lama', 'lamma'],
  'يا': ['ya'],
  'و': ['w', 'wa'],
  'في': ['fi', 'fee'],
  'من': ['men', 'min'],
  'عن': ['an', '3an'],
  'على': ['ala', '3ala'],
  'علي': ['ali', 'ala', '3ala'],
  'بس': ['bass', 'bas'],
  'كتير': ['kteer', 'keteer'],
  'جدا': ['gedan'],
  'جدًا': ['gedan'],
  'اصلي': ['asly'],
  'أصلي': ['asly'],
  'حلو': ['helw', '7elw'],
  'حلوة': ['helwa', '7elwa'],
  'جامد': ['gamed'],
  'جامدة': ['gamda'],
  'صعب': ['saab', 'sa3b'],
  'صوت': ['sot', 'sawt'],
  'قلب': ['alb', '2alb', 'qalb'],
  'قلبي': ['alby', '2alby', 'qalby'],
  'روحي': ['rohy', 'rouhy'],
  'حب': ['hob', '7ob'],
  'حبي': ['hoby', '7obi'],
  'بحب': ['baheb', 'ba7eb'],
  'بحبك': ['bahebak', 'ba7ebak'],
  'عاشق': ['asheq', '3asheq'],
  'غالي': ['ghaly'],
  'ليلة': ['leila', 'layla'],
  'ليل': ['lail', 'layl'],
  'نهار': ['nhar', 'nahar'],
  'زمان': ['zaman'],
  'مكان': ['makan'],
  'مكانك': ['makanak'],
  'دنيا': ['denya', 'dunya'],
  'عالم': ['alam', '3alam'],
  'عمري': ['omry', '3omry'],
  'حياتي': ['hayaty', '7ayaty'],
  'صورة': ['soura', 'sora'],
  'حد': ['had', '7ad'],
  'واحد': ['wahed', 'wa7ed'],
  'صحبة': ['sohba', 'sa7ba'],
  'صحاب': ['sehab', 'sohab'],
  'أصحاب': ['as-hab', 'ashab'],
  'اصحاب': ['as-hab', 'ashab'],
  'خلاص': ['khlas', 'khalas']
};

export function normalizeText(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[-_.\s/\\,:+()~`'"!?#@*&^%$[\]{}|<>]+/g, ' ')
    .trim();
}

function transliterateWordToFrancoPhonetic(word) {
  const norm = normalizeText(word);
  let res = '';
  let i = 0;
  while (i < norm.length) {
    const ch = norm[i];
    const next = norm[i + 1] || '';
    if (ch === 'ش') res += 'sh';
    else if (ch === 'خ') res += 'kh';
    else if (ch === 'غ') res += 'gh';
    else if (ch === 'ث') res += 'th';
    else if (ch === 'ذ') res += 'th';
    else if (ch === 'ظ') res += 'z';
    else if (ch === 'ض') res += 'd';
    else if (ch === 'ص') res += 's';
    else if (ch === 'ط') res += 't';
    else if (ch === 'ق') res += (next === 'و' ? 'q' : 'a');
    else if (ch === 'ع') res += '3';
    else if (ch === 'ح') res += '7';
    else if (ch === 'ج') res += 'g';
    else if (ch === 'ا') res += 'a';
    else if (ch === 'ب') res += 'b';
    else if (ch === 'ت') res += 't';
    else if (ch === 'د') res += 'd';
    else if (ch === 'ر') res += 'r';
    else if (ch === 'ز') res += 'z';
    else if (ch === 'س') res += 's';
    else if (ch === 'ف') res += 'f';
    else if (ch === 'ك') res += 'k';
    else if (ch === 'ل') res += 'l';
    else if (ch === 'م') res += 'm';
    else if (ch === 'ن') res += 'n';
    else if (ch === 'ه') res += 'h';
    else if (ch === 'و') res += (res.endsWith('o') ? 'u' : 'o');
    else if (ch === 'ي') res += (res ? 'y' : 'y');
    else if (ch === 'ء' || ch === 'ئ' || ch === 'ؤ') res += '2';
    else res += ch;
    i++;
  }
  return res;
}

function transliterateWordToArabicPhonetic(word) {
  const w = word.toLowerCase();
  let res = '';
  let i = 0;
  while (i < w.length) {
    const two = w.slice(i, i + 2);
    if (two === 'sh') { res += 'ش'; i += 2; continue; }
    if (two === 'kh') { res += 'خ'; i += 2; continue; }
    if (two === 'gh') { res += 'غ'; i += 2; continue; }
    if (two === 'th') { res += 'ث'; i += 2; continue; }
    if (two === 'ch') { res += 'ش'; i += 2; continue; }
    if (two === 'ee') { res += 'ي'; i += 2; continue; }
    if (two === 'oo') { res += 'و'; i += 2; continue; }

    const ch = w[i];
    if (ch === '3') res += 'ع';
    else if (ch === '7') res += 'ح';
    else if (ch === '2') res += 'ء';
    else if (ch === '5') res += 'خ';
    else if (ch === '6') res += 'ط';
    else if (ch === '8') res += 'غ';
    else if (ch === '9') res += 'ص';
    else if (ch === 'a') res += 'ا';
    else if (ch === 'b') res += 'ب';
    else if (ch === 'c' || ch === 'k') res += 'ك';
    else if (ch === 'd') res += 'د';
    else if (ch === 'e') res += (i === 0 ? 'ا' : '');
    else if (ch === 'f') res += 'ف';
    else if (ch === 'g' || ch === 'j') res += 'ج';
    else if (ch === 'h') res += 'ه';
    else if (ch === 'i' || ch === 'y') res += 'ي';
    else if (ch === 'l') res += 'ل';
    else if (ch === 'm') res += 'م';
    else if (ch === 'n') res += 'ن';
    else if (ch === 'o' || ch === 'u' || ch === 'w') res += 'و';
    else if (ch === 'p') res += 'ب';
    else if (ch === 'q') res += 'ق';
    else if (ch === 'r') res += 'ر';
    else if (ch === 's') res += 'س';
    else if (ch === 't') res += 'ت';
    else if (ch === 'v') res += 'ف';
    else if (ch === 'z') res += 'ز';
    i++;
  }
  return res;
}

export function generateBilingualVariants(input) {
  if (!input || typeof input !== 'string') return [];
  const clean = input.trim().toLowerCase();
  if (clean.length < 2) return [clean];

  const variants = new Set([clean]);
  const isArabicInput = /[\u0600-\u06FF]/.test(clean);
  const words = clean.split(/\s+/).filter(Boolean);

  if (isArabicInput) {
    const francoOptionsPerWord = words.map(w => {
      const normW = normalizeText(w);
      const mapped = ARABIC_TO_FRANCO_MAP[normW] || ARABIC_TO_FRANCO_MAP[w] || [];
      const phonetic = transliterateWordToFrancoPhonetic(w);
      return Array.from(new Set([...mapped, phonetic])).filter(Boolean);
    });

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
    const arabicOptionsPerWord = words.map(w => {
      const mapped = COMMON_WORD_MAP[w] || [];
      const phonetic = transliterateWordToArabicPhonetic(w);
      const phoneticNoAlif = phonetic.replace(/(?<!^)ا/g, '');
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
