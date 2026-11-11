/**
 * AI Core Model, JSON Generation & Content Eligibility Helpers
 * Strictly modularized (< 400 lines).
 */

const { buildCombinedSignal } = require('../../utils/cloudStorageClient');
const { isPodcastContent } = require('../../utils/genreClassifier');

let GoogleGenerativeAI;
try {
  GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
} catch {
  GoogleGenerativeAI = null;
}

const genAI = (process.env.GEMINI_API_KEY && GoogleGenerativeAI)
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];
const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

const QURAN_REGEX = /(سورة|سوره|قرآن|قران|المصحف|مصحف|تلاوة|تلاوه|ترتيل|تجويد|المنشاوي|عبد\s*الباسط|الحصري|البناء|الطبلاوي|العفاسي|ماهر\s*المعيقلي|السديس|الشريم|ياسر\s*الدوسري|مشاري\s*العفاسي|أحمد\s*العجمي|سعد\s*الغامدي|\bsurah\b|\bquran\b|\bkoran\b|\brecitation\b|\btajweed\b|\btartil\b|\bmushaf\b)/i;

function getGeminiModel(modelName = GEMINI_MODELS[0]) {
  if (!genAI) return null;
  const chosen = GEMINI_MODELS.includes(modelName) ? modelName : GEMINI_MODELS[0];
  try {
    const cfg = chosen.startsWith('gemini-2.5')
      ? { model: chosen, generationConfig: { thinkingConfig: { thinkingBudget: 0 } } }
      : { model: chosen };
    return genAI.getGenerativeModel(cfg);
  } catch {
    return null;
  }
}

function parseAiJsonResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  const cleaned = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  if (!cleaned) return null;
  try {
    return JSON.parse(cleaned);
  } catch {}
  const firstArr = cleaned.indexOf('[');
  const firstObj = cleaned.indexOf('{');
  const tryOrder = (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj))
    ? [/\[[\s\S]*\]/, /\{[\s\S]*\}/]
    : [/\{[\s\S]*\}/, /\[[\s\S]*\]/];
  for (const re of tryOrder) {
    const m = cleaned.match(re);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {}
    }
  }
  return null;
}

async function callGeminiRaw(prompt, { signal, maxTokens = 1024, timeoutMs = 12000, jsonMode = true, temperature = 0.2 } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !prompt || signal?.aborted) return null;

  for (const model of GEMINI_MODELS) {
    if (signal?.aborted) return null;
    const { signal: reqSignal, cleanup } = buildCombinedSignal(timeoutMs, signal);
    try {
      const generationConfig = { temperature, maxOutputTokens: maxTokens };
      if (jsonMode) generationConfig.responseMimeType = 'application/json';
      if (model.startsWith('gemini-2.5')) generationConfig.thinkingConfig = { thinkingBudget: 0 };

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: String(prompt) }] }],
            generationConfig
          }),
          signal: reqSignal
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (text && text.trim()) return text.trim();
    } catch {
      // Try next Gemini model or fall back to Groq
    } finally {
      cleanup();
    }
  }
  return null;
}

async function callGroqRaw(prompt, { signal, maxTokens = 1024, timeoutMs = 12000, temperature = 0.2 } = {}) {
  const key = process.env.GROQ_API_KEY;
  if (!key || !prompt || signal?.aborted) return null;

  for (const model of GROQ_MODELS) {
    if (signal?.aborted) return null;
    const { signal: reqSignal, cleanup } = buildCombinedSignal(timeoutMs, signal);
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: String(prompt) }],
          temperature,
          max_tokens: maxTokens
        }),
        signal: reqSignal
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || '';
      if (text && text.trim()) return text.trim();
    } catch {
      // Try next Groq model
    } finally {
      cleanup();
    }
  }
  return null;
}

async function generateAiJson(prompt, { signal, maxTokens = 1024, timeoutMs = 14000, temperature = 0.2 } = {}) {
  if (!prompt || signal?.aborted) return null;
  const geminiText = await callGeminiRaw(prompt, { signal, maxTokens, timeoutMs, jsonMode: true, temperature });
  const parsedGemini = parseAiJsonResponse(geminiText);
  if (parsedGemini !== null) return parsedGemini;

  if (signal?.aborted) return null;
  const groqText = await callGroqRaw(prompt, { signal, maxTokens, timeoutMs, temperature });
  return parseAiJsonResponse(groqText);
}

async function generateAiText(prompt, { signal, maxTokens = 512, timeoutMs = 12000, temperature = 0.4 } = {}) {
  if (!prompt || signal?.aborted) return null;
  const geminiText = await callGeminiRaw(prompt, { signal, maxTokens, timeoutMs, jsonMode: false, temperature });
  if (geminiText) return geminiText;
  if (signal?.aborted) return null;
  return callGroqRaw(prompt, { signal, maxTokens, timeoutMs, temperature });
}

const isQuranTrack = (t) => {
  if (!t) return false;
  const genre = String(t.genre || '').trim();
  if (
    t.isQuran === true ||
    t.contentType === 'quran' ||
    t.category === 'quran' ||
    /^(?:Holy\s*)?Quran$/i.test(genre)
  ) {
    return true;
  }
  const str = `${t.title || ''} ${t.artist || ''} ${t.album || ''}`;
  return QURAN_REGEX.test(str);
};

const isPodcastOrAudiobookTrack = (t) => {
  if (!t) return false;
  const genre = String(t.genre || '').trim();
  if (
    t.isPodcast === true ||
    t.isAudiobook === true ||
    t.contentType === 'podcast' ||
    t.contentType === 'audiobook' ||
    t.category === 'podcast' ||
    /^(?:Podcast|Audiobook)$/i.test(genre)
  ) {
    return true;
  }
  return isPodcastContent(t.title || '', t.artist || '', t.album || '', genre);
};

const isMusicEligibleTrack = (t) => Boolean(t && !isQuranTrack(t) && !isPodcastOrAudiobookTrack(t));
const isQuranEligibleTrack = (t) => Boolean(t && isQuranTrack(t) && !isPodcastOrAudiobookTrack(t));

const MUSIC_ONLY_QUERY = {
  isQuran: { $ne: true },
  isPodcast: { $ne: true },
  isAudiobook: { $ne: true },
  contentType: { $nin: ['quran', 'podcast', 'audiobook'] },
  genre: { $not: /^(?:Holy\s*)?Quran$|^Podcast$|^Audiobook$/i },
  source: { $ne: 'SoundCloud' },
  album: { $ne: 'SoundCloud' }
};

const QURAN_ONLY_QUERY = {
  isPodcast: { $ne: true },
  isAudiobook: { $ne: true },
  contentType: { $nin: ['podcast', 'audiobook'] },
  genre: { $not: /^Podcast$|^Audiobook$/i },
  $or: [
    { isQuran: true },
    { contentType: 'quran' },
    { category: 'quran' },
    { genre: /^(?:Holy\s*)?Quran$/i },
    { title: /سورة|سوره|قرآن|قران/i }
  ]
};

const PODCAST_ONLY_QUERY = {
  isQuran: { $ne: true },
  $or: [
    { isPodcast: true },
    { isAudiobook: true },
    { contentType: { $in: ['podcast', 'audiobook'] } },
    { genre: /^(?:Podcast|Audiobook)$/i }
  ]
};

function buildBaseQuery(mode = 'music') {
  if (mode === 'quran') return QURAN_ONLY_QUERY;
  if (mode === 'podcast') return PODCAST_ONLY_QUERY;
  return MUSIC_ONLY_QUERY;
}

function isTrackEligibleForMode(track, mode = 'music') {
  if (!track) return false;
  if (mode === 'quran') return isQuranEligibleTrack(track);
  if (mode === 'podcast') return isPodcastOrAudiobookTrack(track);
  return isMusicEligibleTrack(track);
}

module.exports = {
  genAI,
  GEMINI_MODELS,
  GROQ_MODELS,
  getGeminiModel,
  generateAiJson,
  generateAiText,
  parseAiJsonResponse,
  QURAN_REGEX,
  isQuranTrack,
  isPodcastOrAudiobookTrack,
  isMusicEligibleTrack,
  isQuranEligibleTrack,
  buildBaseQuery,
  isTrackEligibleForMode
};
