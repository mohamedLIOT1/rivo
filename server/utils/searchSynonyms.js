/**
 * Bilingual Arabic-English Search Synonyms & Transliterations (Backend Node.js)
 * Enables searching Egyptian/Arabic tracks & artists seamlessly
 * Strictly modularized (< 400 lines).
 */

const { generateBilingualVariants } = require('./francoArabicTransliteration');

const TITLE_SYNONYMS = {
  'شوفت كلام': ['shoft kalam', 'sheft kalam', 'شفت كلام'],
  'شفت كلام': ['shoft kalam', 'sheft kalam', 'شوفت كلام'],
  'shoft kalam': ['شوفت كلام', 'شفت كلام'],
  'sheft kalam': ['شوفت كلام', 'شفت كلام'],

  'النيه': ['el neyya', 'neyya', 'el neya', 'neya', 'النية'],
  'النية': ['el neyya', 'neyya', 'el neya', 'neya', 'النيه'],
  'el neyya': ['النيه', 'النية', 'neyya'],
  'neyya': ['النيه', 'النية', 'el neyya'],

  'البخت': ['el bakht', 'elbakht', 'bakht'],
  'el bakht': ['البخت', 'bakht'],

  'دورك جاي': ['dorak gai', 'dorak gay'],
  'dorak gai': ['دورك جاي'],

  'سهران': ['sahran'],
  'sahran': ['سهران'],

  'كل حياتي': ['kol hayaty', 'kol 7ayaty'],
  'kol hayaty': ['كل حياتي'],

  'مكانك': ['makanak'],
  'makanak': ['مكانك'],

  'يا انا يا لا': ['ya ana ya la', 'ya ana ya laa'],
  'ya ana ya la': ['يا انا يا لا'],

  'بلاسيبو': ['placebo'],
  'placebo': ['بلاسيبو'],

  'تلاتيني': ['talatini'],
  'talatini': ['تلاتيني'],

  'ماتادور': ['matador'],
  'matador': ['ماتادور'],

  'روما': ['roma'],
  'roma': ['روما'],

  'سوبرنوفا': ['supernova'],
  'supernova': ['سوبرنوفا'],

  'نقطه بيضا': ['noaata beida', 'noata beida', 'نقطة بيضاء', 'نقطة بيضا'],
  'noaata beida': ['نقطه بيضا', 'نقطة بيضاء'],

  'ناس وناس': ['nas w nas'],
  'nas w nas': ['ناس وناس'],

  'عقارب': ['aqareb'],
  'aqareb': ['عقارب'],

  'جدول الضرب': ['gadwal el darb', 'gadwal el darr'],
  'gadwal el darb': ['جدول الضرب'],

  'بريك دانس': ['break dance', 'breakdance'],
  'break dance': ['بريك دانس'],

  'هاسيندا': ['hacienda'],
  'hacienda': ['هاسيندا'],

  'سويسرا': ['swissra'],
  'swissra': ['سويسرا'],

  'ع الخط': ['3al kahtt', '3al khatt', 'على الخط'],
  '3al kahtt': ['ع الخط', 'على الخط'],

  'منظر': ['manzzar', 'manzar'],
  'manzzar': ['منظر'],

  '١٦ ساعة': ['16 sa3aa', '16 saa3a', '16 ساعة'],
  '16 ساعة': ['16 sa3aa', '16 saa3a', '١٦ ساعة'],
  '16 sa3aa': ['١٦ ساعة', '16 ساعة'],

  'فانتازيا': ['fantazia'],
  'fantazia': ['فانتازيا'],

  'الو': ['alo', 'ألو'],
  'alo': ['الو', 'ألو'],

  'مفيش مانع': ['mafesh mane3'],
  'mafesh mane3': ['مفيش مانع'],

  'لو ناسياني': ['law nasyany'],
  'law nasyany': ['لو ناسياني'],

  'مش دا اللي اخترته': ['msh da elle ekhtarto'],
  'msh da elle ekhtarto': ['مش دا اللي اخترته'],

  'تروح لمين': ['troo7 lemeen', 'trooh lemeen'],
  'troo7 lemeen': ['تروح لمين'],

  'كامادات': ['kamadaat', 'kamadat'],
  'kamadaat': ['كامادات'],

  'بيتادين': ['betadeen'],
  'betadeen': ['بيتادين'],

  'في الجليد': ['fel galeed'],
  'fel galeed': ['في الجليد'],

  'دفتر': ['daftar'],
  'daftar': ['دفتر'],

  'سيما': ['cima'],
  'cima': ['سيما'],

  'ياخويا': ['yakhoya'],
  'yakhoya': ['ياخويا'],

  'ع الصامت': ['3alsamet', 'على الصامت'],
  '3alsamet': ['ع الصامت'],

  'الوقت الضايع': ['elwa2t eldaye3', 'el waat el daye3'],
  'el waat el daye3': ['الوقت الضايع'],

  'موجه': ['moga', 'موجة'],
  'moga': ['موجه', 'موجة'],

  'وسع': ['wassa3'],
  'wassa3': ['وسع'],

  'عين سحرية': ['3ein se7reya', 'عين سحريه'],
  '3ein se7reya': ['عين سحرية'],

  'نو بروبليما': ['no problema'],
  'no problema': ['نو بروبليما']
};

const ARTIST_SYNONYMS = {
  'ليجيسي': ['lege-cy', 'lege cy', 'legecy', 'ليجي سي', 'ليجسي'],
  'ليجي سي': ['lege-cy', 'lege cy', 'legecy', 'ليجيسي'],
  'ليجسي': ['lege-cy', 'lege cy', 'legecy', 'ليجيسي'],
  'lege-cy': ['ليجيسي', 'ليجي سي', 'ليجسي'],
  'lege cy': ['ليجيسي', 'ليجي سي', 'ليجسي'],
  'legecy': ['ليجيسي', 'ليجي سي', 'ليجسي'],

  'ويجز': ['wegz'],
  'wegz': ['ويجز'],

  'مروان بابلو': ['marwan pablo', 'pablo'],
  'بابلو': ['marwan pablo', 'pablo'],
  'marwan pablo': ['مروان بابلو', 'بابلو'],
  'pablo': ['marwan pablo', 'مروان بابلو'],

  'مروان موسى': ['marwan moussa', 'marwan mousa'],
  'مروان موسي': ['marwan moussa', 'marwan mousa'],
  'marwan moussa': ['مروان موسى', 'مروان موسي'],

  'الجوكر': ['el joker', 'eljoker', 'joker'],
  'جوكر': ['el joker', 'eljoker', 'joker'],
  'el joker': ['الجوكر', 'جوكر'],

  'أبيوسف': ['abyusif'],
  'ابيوسف': ['abyusif'],
  'abyusif': ['أبيوسف', 'ابيوسف'],

  'عفروتو': ['afroto'],
  'afroto': ['عفروتو'],

  'عمرو دياب': ['amr diab'],
  'amr diab': ['عمرو دياب'],

  'تامر حسني': ['tamer hosny', 'tamer hosni'],
  'tamer hosny': ['تامر حسني'],

  'محمد حماقي': ['mohamed hamaki', 'hamaki'],
  'حماقي': ['mohamed hamaki', 'hamaki'],
  'hamaki': ['محمد حماقي', 'حماقي'],
  'mohamed hamaki': ['محمد حماقي', 'حماقي'],

  'كايروكي': ['cairokee'],
  'cairokee': ['كايروكي'],

  'تامر عاشور': ['tamer ashour', 'ashour'],
  'عاشور': ['tamer ashour'],
  'tamer ashour': ['تامر عاشور'],

  'شيرين': ['sherine', 'sherine abdel wahab'],
  'sherine': ['شيرين'],

  'أحمد سعد': ['ahmed saad'],
  'احمد سعد': ['ahmed saad'],
  'ahmed saad': ['أحمد سعد', 'احمد سعد'],

  'عصام صاصا': ['essam sasa', 'sasa'],
  'صاصا': ['essam sasa'],
  'essam sasa': ['عصام صاصا'],

  'مسلم': ['muslim'],
  'muslim': ['مسلم'],

  'تو ليت': ['tul8te', 'toolete'],
  'توليت': ['tul8te', 'toolete'],
  'tul8te': ['تو ليت', 'توليت'],

  'زياد ظاظا': ['ziad zaza'],
  'ziad zaza': ['زياد ظاظا']
};

function normalizeSearchTerm(str) {
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

function getExpandedSearchTerms(query) {
  if (!query || typeof query !== 'string') return [];
  const clean = query.trim().toLowerCase();
  const normalized = normalizeSearchTerm(clean);
  const terms = new Set([clean, normalized]);

  const lookupDicts = [TITLE_SYNONYMS, ARTIST_SYNONYMS];
  for (const dict of lookupDicts) {
    for (const [key, synList] of Object.entries(dict)) {
      const normKey = normalizeSearchTerm(key);
      if (clean === key || normalized === normKey || clean.includes(key) || (normKey && normalized.includes(normKey))) {
        synList.forEach(s => {
          terms.add(s.toLowerCase());
          terms.add(normalizeSearchTerm(s));
        });
      }
    }
  }

  // Bilingual Franco-Arabic phonetic expansion
  try {
    const bilinguals = generateBilingualVariants(clean);
    for (const b of bilinguals) {
      if (b) {
        terms.add(b.toLowerCase());
        const normB = normalizeSearchTerm(b);
        if (normB) terms.add(normB);
      }
    }
  } catch (err) {
    // Fail-safe
  }

  return Array.from(terms).filter(Boolean);
}

module.exports = {
  TITLE_SYNONYMS,
  ARTIST_SYNONYMS,
  normalizeSearchTerm,
  getExpandedSearchTerms
};
