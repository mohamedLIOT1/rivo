const { classifyGenre, isQuranContent, isPodcastContent, GENRES, GENERIC_GENRES } = require('./genreClassifier');
const { NON_MUSIC_REGEX } = require('./trackMetadataUtils');
const { getActiveYouTubeApiKey, markYouTubeApiKeyExceeded } = require('./youtubeSearch');
const { buildCombinedSignal } = require('./cloudStorageClient');

const INDIC_SCRIPT_REGEX = /[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F]/;
const HINDI_HINT_REGEX = /(\bhindi\b|\bbollywood\b|\bpunjabi\b|\btamil\b|\btelugu\b|\bmalyalam\b|\bkannada\b|\bdesi\b|\bfilmi\b|هندي|بوليوود|بنجابي|أغنية هندية|اغنية هندية)/i;
const BLACKLISTED_ARTISTS_REGEX = /(?:محمود\s*الليث[يى]|mahmoud\s*el\s*leithy|mahmoud\s*elleithy|\belleithy\b)/i;
const EXTRA_NON_MUSIC_REGEX = /(مقلب|مقالب|تحدي\s*ا?ل?أ?كل|تحدي\s*الأكل|اكل|أكل|طبخ|وصفة|فلوج|فلوقات|يوميات|روتين|ملخص\s*مباراة|أهداف|مباراة|ببجي|ماينكرافت|فورتنايت|رد\s*فعل|ريأكشن|تحليل\s*الحلقة|برنامج|مقابلة|بودكاست|\bmukbang\b|\bprank\b|\bvlog\b|\bgameplay\b|\bhighlights\b|\btrailer\b|\breaction\b|\bunboxing\b|\breview\b|\btutorial\b|\bfood\s*challenge\b)/i;

const VALID_CATEGORIES = new Set(['music', 'hindi', 'quran', 'podcast', 'non_music_video', 'blacklisted']);

const CANONICAL_GENRES = [
  'Rap / Hip-Hop',
  'Shaabi',
  'Mahraganat',
  'Tarab',
  'Arabic Pop',
  'Indie / Alternative',
  'Khaleeji',
  'Rock',
  'Metal',
  'Pop',
  'R&B / Soul',
  'Lo-Fi',
  'EDM / Electronic',
  'Jazz / Blues',
  'Classical',
  'Soundtrack / Instrumental',
  'Holy Quran',
  'Podcast',
  'Bollywood / Indic'
];

const CANONICAL_GENRE_LOWER = new Map(CANONICAL_GENRES.map((g) => [g.toLowerCase(), g]));
Object.values(GENRES).forEach((def) => {
  if (def?.name) CANONICAL_GENRE_LOWER.set(def.name.toLowerCase(), def.name);
});

function normalizeCanonicalGenre(rawGenre, category, fallbackGenre = '') {
  if (category === 'quran') return 'Holy Quran';
  if (category === 'podcast') return 'Podcast';
  if (category === 'hindi') return 'Bollywood / Indic';
  if (category === 'non_music_video') return fallbackGenre || '';

  const cleaned = String(rawGenre || '').trim();
  if (cleaned) {
    const exact = CANONICAL_GENRE_LOWER.get(cleaned.toLowerCase());
    if (exact && exact !== 'Holy Quran' && exact !== 'Podcast') return exact;
    if (!GENERIC_GENRES.has(cleaned.toLowerCase())) {
      const cls = classifyGenre({ genre: cleaned });
      if (cls?.matchedBy === 'explicit_alias' && cls.genre && cls.genre !== 'Holy Quran' && cls.genre !== 'Podcast') {
        return cls.genre;
      }
    }
  }
  return fallbackGenre || 'Pop';
}

function parseIsoDurationSeconds(iso) {
  if (!iso || typeof iso !== 'string') return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
}

/**
 * Fetches lightweight YouTube video metadata (title, channel, category, duration) before downloading audio.
 */
async function fetchYouTubeVideoMetadata(videoId, signal) {
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;
  const key = getActiveYouTubeApiKey();
  if (!key) return null;

  const { signal: reqSignal, cleanup } = buildCombinedSignal(8000, signal);
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(key)}`;
    const res = await fetch(url, { signal: reqSignal });
    if (res.status === 403 || res.status === 429) {
      markYouTubeApiKeyExceeded(key, 4);
      return null;
    }
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.items?.[0];
    if (!item) return null;
    return {
      ytTitle: item.snippet?.title || '',
      ytChannel: item.snippet?.channelTitle || '',
      ytCategoryId: String(item.snippet?.categoryId || ''),
      ytTags: Array.isArray(item.snippet?.tags) ? item.snippet.tags.slice(0, 12) : [],
      ytDescription: String(item.snippet?.description || '').slice(0, 400),
      ytDuration: parseIsoDurationSeconds(item.contentDetails?.duration)
    };
  } catch {
    return null;
  } finally {
    cleanup();
  }
}

function buildClassifierPrompt(meta) {
  return [
    'You are an audio catalog moderator and music genre verifier for an Arabic/international streaming app.',
    'Classify this item into strictly ONE category:',
    '- "music": Genuine song, music track, rap, mahraganat, shaabi, tarab/mawwal (even long concerts >15m), music sessions (e.g. Red Bull Muzika Salonat / مزيكا صالونات, Coke Studio, Colors), remix, or instrumental — even if the description mentions "حلقة" or "episode".',
    '- "hindi": Indian, Bollywood, Hindi, Punjabi, Tamil, Telugu, or Desi music.',
    '- "quran": Holy Quran recitation, Surah, Tajweed, Azkar, Ruqyah, or Adhan.',
    '- "podcast": Spoken podcast episode, talk show, interview, religious lecture, or audiobook (typically spoken-word, NOT a 3-5 min song).',
    '- "non_music_video": YouTube pranks (مقالب), eating/food/cooking/mukbang, vlogs, gaming, sports highlights, comedy skits, movie/TV scenes, reactions, or tutorials.',
    '',
    'Also output the accurate canonical "genre" from this exact list:',
    CANONICAL_GENRES.join(', '),
    'Note: Correct generic or wrong DB genres (e.g. if DB says "Pop" or "Imported" for an Egyptian Shaabi, Mahraganat, Tarab, Arabic Pop, or Rap song, output the true canonical genre).',
    'Return ONLY valid JSON: {"category":"...","genre":"...","reason":"..."}',
    '',
    `DB Title: ${meta.title}`,
    `DB Artist: ${meta.artist}`,
    `DB Album: ${meta.album}`,
    `DB Genre: ${meta.genre}`,
    `Duration (sec): ${meta.duration}`,
    meta.ytTitle ? `YouTube Title: ${meta.ytTitle}` : '',
    meta.ytChannel ? `YouTube Channel: ${meta.ytChannel}` : '',
    meta.ytCategoryId ? `YouTube CategoryId: ${meta.ytCategoryId} (10=Music)` : '',
    meta.ytTags?.length ? `YouTube Tags: ${meta.ytTags.join(', ')}` : '',
    meta.ytDescription ? `YouTube Description: ${meta.ytDescription.replace(/\s+/g, ' ')}` : ''
  ].filter(Boolean).join('\n');
}

function parseAiCategoryJson(rawText, fallbackGenre = '') {
  if (!rawText || typeof rawText !== 'string') return null;
  const cleaned = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const cat = String(parsed.category || '').trim().toLowerCase();
    if (VALID_CATEGORIES.has(cat)) {
      const genre = normalizeCanonicalGenre(parsed.genre, cat, fallbackGenre);
      return { category: cat, genre, reason: String(parsed.reason || 'ai').slice(0, 120) };
    }
  } catch {}
  return null;
}

async function classifyWithGemini(prompt, fallbackGenre, signal) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  for (const model of models) {
    if (signal?.aborted) return null;
    const { signal: reqSignal, cleanup } = buildCombinedSignal(12000, signal);
    try {
      const genConfig = {
        temperature: 0,
        maxOutputTokens: 250,
        responseMimeType: 'application/json'
      };
      if (model.startsWith('gemini-2.5')) {
        genConfig.thinkingConfig = { thinkingBudget: 0 };
      }
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: genConfig
          }),
          signal: reqSignal
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = parseAiCategoryJson(text, fallbackGenre);
      if (parsed) return parsed;
    } catch {} finally {
      cleanup();
    }
  }
  return null;
}

async function classifyWithGroq(prompt, fallbackGenre, signal) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-20b'];
  for (const model of models) {
    if (signal?.aborted) return null;
    const { signal: reqSignal, cleanup } = buildCombinedSignal(12000, signal);
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
          max_tokens: 250
        }),
        signal: reqSignal
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || '';
      const parsed = parseAiCategoryJson(text, fallbackGenre);
      if (parsed) return parsed;
    } catch {} finally {
      cleanup();
    }
  }
  return null;
}

/**
 * Classifies a track using local rules + YouTube metadata + AI awareness before downloading.
 */
async function classifyTrackBeforeMigration(track, videoId, signal) {
  const ytMeta = videoId ? await fetchYouTubeVideoMetadata(videoId, signal) : null;
  const effectiveDuration = Number(ytMeta?.ytDuration || track.duration || 0);
  const title = track.title || '';
  const artist = track.artist || '';
  const album = track.album || '';
  const genre = track.genre || '';
  const combined = `${title} ${artist} ${album} ${genre} ${ytMeta?.ytTitle || ''} ${ytMeta?.ytChannel || ''}`;

  // 0. Blacklisted Artist Check (Permanently excluded: Mahmoud El Leithy)
  if (BLACKLISTED_ARTISTS_REGEX.test(artist) || BLACKLISTED_ARTISTS_REGEX.test(title) || BLACKLISTED_ARTISTS_REGEX.test(combined)) {
    return { category: 'blacklisted', genre: 'Blacklisted', reason: 'blacklisted_artist:mahmoud_el_leithy', source: 'rules', ytMeta };
  }

  // 1. Fast deterministic checks
  if (track.isQuran || track.contentType === 'quran' || isQuranContent(title, artist, album, genre)) {
    return { category: 'quran', genre: 'Holy Quran', reason: 'quran_rule', source: 'rules', ytMeta };
  }
  if (track.isPodcast || track.contentType === 'podcast' || isPodcastContent(title, artist, album, genre)) {
    return { category: 'podcast', genre: 'Podcast', reason: 'podcast_rule', source: 'rules', ytMeta };
  }

  const ruleCls = classifyGenre({
    title,
    artist,
    album,
    genre,
    tags: ytMeta?.ytTags,
    description: ytMeta?.ytDescription
  });

  const isConfirmedNonIndicArtist = ruleCls.matchedBy === 'artist_match' && ruleCls.genre !== 'Bollywood / Indic';
  if (!isConfirmedNonIndicArtist && (ruleCls.genre === 'Bollywood / Indic' || INDIC_SCRIPT_REGEX.test(combined) || HINDI_HINT_REGEX.test(combined))) {
    return { category: 'hindi', genre: 'Bollywood / Indic', reason: 'indian_bollywood_rule', source: 'rules', ytMeta };
  }

  // 2. Real AI awareness (Gemini primary, Groq fallback)
  const metaPayload = {
    title,
    artist,
    album,
    genre: ruleCls.genre || genre,
    duration: effectiveDuration,
    ytTitle: ytMeta?.ytTitle || '',
    ytChannel: ytMeta?.ytChannel || '',
    ytCategoryId: ytMeta?.ytCategoryId || '',
    ytTags: ytMeta?.ytTags || [],
    ytDescription: ytMeta?.ytDescription || ''
  };
  const prompt = buildClassifierPrompt(metaPayload);
  const aiResult =
    (await classifyWithGemini(prompt, ruleCls.genre, signal)) ||
    (await classifyWithGroq(prompt, ruleCls.genre, signal));
  if (aiResult) {
    return { ...aiResult, genre: aiResult.genre || ruleCls.genre, source: 'ai', ytMeta };
  }

  // 3. Fallback heuristics if AI providers are unreachable
  if (NON_MUSIC_REGEX.test(combined) || EXTRA_NON_MUSIC_REGEX.test(combined)) {
    return { category: 'non_music_video', genre: ruleCls.genre || '', reason: 'non_music_keyword_fallback', source: 'fallback', ytMeta };
  }
  if (effectiveDuration > 1800 && ruleCls.genre !== 'Tarab') {
    return { category: 'non_music_video', genre: ruleCls.genre || '', reason: 'excessive_duration_fallback', source: 'fallback', ytMeta };
  }
  return { category: 'music', genre: ruleCls.genre || 'Pop', reason: 'music_fallback', source: 'fallback', ytMeta };
}

module.exports = {
  CANONICAL_GENRES,
  normalizeCanonicalGenre,
  fetchYouTubeVideoMetadata,
  classifyTrackBeforeMigration
};
