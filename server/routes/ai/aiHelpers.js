/**
 * AI Core Model & Recommendation/Shuffle Generation Helpers
 * Strictly modularized (< 400 lines).
 */

let GoogleGenerativeAI;
try {
  GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
} catch (e) {
  GoogleGenerativeAI = null;
}

const genAI = (process.env.GEMINI_API_KEY && GoogleGenerativeAI) ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

function getGeminiModel() {
  if (!genAI) return null;
  const models = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.7-flash', 'gemini-3.8-flash'];
  for (const m of models) {
    try {
      return genAI.getGenerativeModel({ model: m });
    } catch {}
  }
  return null;
}

const QURAN_REGEX = /(سورة|سوره|قرآن|قران|المصحف|مصحف|تلاوة|تلاوه|ترتيل|تجويد|المنشاوي|عبد\s*الباسط|الحصري|البناء|الطبلاوي|العفاسي|ماهر\s*المعيقلي|السديس|الشريم|ياسر\s*الدوسري|مشاري\s*العفاسي|أحمد\s*العجمي|سعد\s*الغامدي|\bsurah\b|\bquran\b|\bkoran\b|\brecitation\b|\btajweed\b|\btartil\b|\bmushaf\b)/i;

const isQuranTrack = (t) => {
  if (!t) return false;
  if (t.isQuran === true || t.category === 'quran' || t.genre === 'Quran') return true;
  const str = `${t.title || ''} ${t.artist || ''} ${t.album || ''}`;
  return QURAN_REGEX.test(str);
};

module.exports = {
  genAI,
  getGeminiModel,
  QURAN_REGEX,
  isQuranTrack
};
