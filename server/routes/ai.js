const express = require('express');
const router = express.Router();
let GoogleGenerativeAI;
try {
  GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
} catch (e) {
  try {
    GoogleGenerativeAI = require('../../node_modules/@google/generative-ai').GoogleGenerativeAI;
  } catch (err) {}
}
const { auth, adminAuth, optionalAuth } = require('../middleware/auth');
const { Track, SongLyrics } = require('../models');

const genAI = (process.env.GEMINI_API_KEY && GoogleGenerativeAI) ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

const QURAN_REGEX = /(سورة|سوره|قرآن|قران|المصحف|مصحف|تلاوة|تلاوه|ترتيل|تجويد|المنشاوي|عبد\s*الباسط|الحصري|البناء|الطبلاوي|العفاسي|ماهر\s*المعيقلي|السديس|الشريم|ياسر\s*الدوسري|مشاري\s*العفاسي|أحمد\s*العجمي|سعد\s*الغامدي|\bsurah\b|\bquran\b|\bkoran\b|\brecitation\b|\btajweed\b|\btartil\b|\bmushaf\b)/i;

const isQuranTrack = (t) => {
  if (!t) return false;
  if (t.isQuran === true || t.category === 'quran' || t.genre === 'Quran') return true;
  const str = `${t.title || ''} ${t.artist || ''} ${t.album || ''}`;
  return QURAN_REGEX.test(str);
};

// أ. Smart Recommendations for Playlists and Moods
router.post('/recommendations', optionalAuth, async (req, res) => {
  try {
    const { mood, timeOfDay, recentTracks = [], availableTracks = [], isQuran = false, name = '', trackIds = [] } = req.body;
    const isPlQuran = Boolean(isQuran || QURAN_REGEX.test(name));
    let pool = availableTracks;
    if (!pool || pool.length === 0) {
      if (isPlQuran) {
        pool = await Track.find({
          $or: [
            { isQuran: true },
            { category: 'quran' },
            { genre: 'Quran' },
            { title: /سورة|سوره|قرآن|قران/i }
          ]
        }).limit(150).lean();
      } else {
        pool = await Track.find({
          isQuran: { $ne: true },
          category: { $ne: 'quran' },
          genre: { $ne: 'Quran' }
        }).limit(150).lean();
      }
    }
    const excludedIds = new Set((trackIds || []).map(String));
    const filteredPool = pool.filter(t => {
      if (excludedIds.has(String(t._id || t.id))) return false;
      const q = isQuranTrack(t);
      return isPlQuran ? q : !q;
    });

    let finalRecs = [];
    if (process.env.GEMINI_API_KEY && genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
        const trackList = filteredPool.slice(0, 50).map(t => `"${t.title}" by ${t.artist}`).join(', ');
        const prompt = `You are a music and recitation curator. Given these available tracks: ${trackList}
Context: ${isPlQuran ? 'Quran Recitations' : 'Music Playlist'}, Name: "${name || 'My Playlist'}", User mood: ${mood || 'neutral'}, Time of day: ${timeOfDay || 'evening'}, Recently played: ${(recentTracks || []).slice(0,5).join(', ')}.
Select the 10 best matching tracks from the available list. Return ONLY a JSON array of track titles exactly as written. No explanation.`;
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const suggested = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        const matched = filteredPool.filter(t =>
          suggested.some(s => s.toLowerCase().includes(t.title.toLowerCase().slice(0, 10)))
        );
        if (matched.length > 0) finalRecs = matched.slice(0, 10);
      } catch (geminiErr) {
        console.warn('[AI Recommendations Gemini]', geminiErr.message);
      }
    }

    if (finalRecs.length === 0) {
      finalRecs = [...filteredPool].sort(() => 0.5 - Math.random()).slice(0, 10);
    }

    res.json({ success: true, recommendations: finalRecs, tracks: finalRecs });
  } catch (e) {
    console.warn('[AI Recommendations]', e.message);
    res.json({ success: true, recommendations: [], tracks: [] });
  }
});

// ب. Artist Bio Generator (للـ Admin)
router.post('/generate-artist-bio', adminAuth, async (req, res) => {
  try {
    const { artistName, genres = [] } = req.body;
    if (!artistName) return res.status(400).json({ error: 'Artist name required' });
    if (!process.env.GEMINI_API_KEY || !genAI) {
      return res.json({ success: false, bio: '' });
    }
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Write a professional music artist bio for "${artistName}" ${genres.length ? `who creates ${genres.join(', ')} music` : ''}. 
Keep it 2-3 sentences, engaging, and suitable for a music streaming platform. Write in English.`;
    const result = await model.generateContent(prompt);
    res.json({ success: true, bio: result.response.text().trim() });
  } catch (e) {
    res.json({ success: false, bio: '' });
  }
});

// ج. Lyrics Translation (تحسين الموجود)
router.post('/translate-lyrics', auth, async (req, res) => {
  try {
    const { lyrics, targetLang = 'ar' } = req.body;
    if (!lyrics) return res.status(400).json({ error: 'Lyrics required' });
    if (!process.env.GEMINI_API_KEY || !genAI) {
      return res.json({ success: false, translation: '' });
    }
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const langName = targetLang === 'ar' ? 'Arabic' : targetLang === 'en' ? 'English' : targetLang;
    const lyricsContent = typeof lyrics === 'string' ? lyrics : (Array.isArray(lyrics) ? lyrics.map(l => l.text).join('\n') : JSON.stringify(lyrics));
    const prompt = `Translate these song lyrics to ${langName}. Preserve the poetic style and rhythm. Return only the translation, no explanations:\n\n${lyricsContent}`;
    const result = await model.generateContent(prompt);
    res.json({ success: true, translation: result.response.text().trim() });
  } catch (e) {
    res.json({ success: false, translation: '' });
  }
});

module.exports = router;
