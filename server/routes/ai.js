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
const mongoose = require('mongoose');
const { auth, adminAuth, optionalAuth } = require('../middleware/auth');
const { Track, SongLyrics } = require('../models');
const { fetchLrclibLyrics, getTrackKey, parsePlain } = require('../utils/helpers');

const genAI = (process.env.GEMINI_API_KEY && GoogleGenerativeAI) ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

function getGeminiModel() {
  if (!genAI) return null;
  const models = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-1.5-flash'];
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
        const model = getGeminiModel();
        if (model) {
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
        }
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
    const model = getGeminiModel();
    if (!model) return res.json({ success: false, bio: '' });
    const prompt = `Write a professional music artist bio for "${artistName}" ${genres.length ? `who creates ${genres.join(', ')} music` : ''}. 
Keep it 2-3 sentences, engaging, and suitable for a music streaming platform. Write in English.`;
    const result = await model.generateContent(prompt);
    res.json({ success: true, bio: result.response.text().trim() });
  } catch (e) {
    res.json({ success: false, bio: '' });
  }
});

// ج. Lyrics Translation
router.post('/translate-lyrics', auth, async (req, res) => {
  try {
    const { lyrics, targetLang = 'ar' } = req.body;
    if (!lyrics) return res.status(400).json({ error: 'Lyrics required' });
    if (!process.env.GEMINI_API_KEY || !genAI) {
      return res.json({ success: false, translation: '' });
    }
    const model = getGeminiModel();
    if (!model) return res.json({ success: false, translation: '' });
    const langName = targetLang === 'ar' ? 'Arabic' : targetLang === 'en' ? 'English' : targetLang;
    const lyricsContent = typeof lyrics === 'string' ? lyrics : (Array.isArray(lyrics) ? lyrics.map(l => l.text).join('\n') : JSON.stringify(lyrics));
    const prompt = `Translate these song lyrics to ${langName}. Preserve the poetic style and rhythm. Return only the translation, no explanations:\n\n${lyricsContent}`;
    const result = await model.generateContent(prompt);
    res.json({ success: true, translation: result.response.text().trim() });
  } catch (e) {
    res.json({ success: false, translation: '' });
  }
});

// د. AI & Online Song Lyrics Generator / Search
router.post('/generate-song-lyrics', optionalAuth, async (req, res) => {
  try {
    const { trackId, title, artist, duration = 180 } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: 'Title required', lyrics: [] });
    }

    const dur = Math.max(30, parseInt(duration, 10) || 180);
    const cleanTitle = (title || '')
      .replace(/\(.*?\)|\[.*?\]|\|.*$/g, '')
      .replace(/(?:ft\.?|feat\.?|featuring)\s+.*$/i, '')
      .trim();
    const cleanArtist = (artist || '')
      .split(/[|/•,]/)[0]
      .replace(/\(.*?\)|\[.*?\]/g, '')
      .trim();

    const trackKey = getTrackKey(title, artist);

    // 1. Check database first (SongLyrics or Track)
    if (trackKey && trackKey !== '___') {
      const found = await SongLyrics.findOne({ trackKey }).lean();
      if (found && Array.isArray(found.lyrics) && found.lyrics.length > 0) {
        return res.json({
          success: true,
          lyrics: found.lyrics,
          source: found.source || 'db',
          isVerified: Boolean(found.isVerified),
          verifiedBy: found.verifiedBy || ''
        });
      }
    }

    if (trackId && mongoose.isValidObjectId(trackId)) {
      const trk = await Track.findById(trackId).lean();
      if (trk && Array.isArray(trk.lyrics) && trk.lyrics.length > 0) {
        return res.json({
          success: true,
          lyrics: trk.lyrics,
          source: trk.isVerified ? 'verified' : 'manual',
          isVerified: Boolean(trk.isVerified || trk.isVerifiedLyrics),
          verifiedBy: trk.verifiedBy || ''
        });
      }
    }

    // 2. Fetch from LRCLIB / lyrics.ovh
    const onlineLyrics = await fetchLrclibLyrics(cleanTitle || title, cleanArtist || artist, dur);
    if (onlineLyrics && Array.isArray(onlineLyrics) && onlineLyrics.length > 0) {
      if (trackKey && trackKey !== '___') {
        await SongLyrics.findOneAndUpdate(
          { trackKey },
          {
            trackKey,
            trackId: trackId ? String(trackId) : undefined,
            title,
            artist,
            lyrics: onlineLyrics,
            source: 'synced',
            isVerified: false
          },
          { upsert: true, new: true }
        ).catch(() => {});
      }
      return res.json({ success: true, lyrics: onlineLyrics, source: 'synced', isVerified: false });
    }

    // 3. Fallback: AI Generation with Gemini
    if (process.env.GEMINI_API_KEY && genAI) {
      try {
        const model = getGeminiModel();
        if (model) {
          const prompt = `You are an expert music lyrics researcher and archivist. Provide the exact song lyrics for "${title}" by artist "${artist || 'Unknown'}".
Duration: approximately ${dur} seconds.
Output requirements:
Return ONLY a valid JSON array of objects with "time" (in seconds, numbers starting from 0, increasing chronologically up to ${dur}) and "text" (the line of lyrics in its original language, e.g. Arabic, English, etc.).
Example format:
[
  {"time": 0, "text": "First line"},
  {"time": 12, "text": "Second line"}
]
Rules:
- DO NOT wrap in markdown code blocks (\`\`\`json).
- Return ONLY the raw JSON array.
- If you do not know the lyrics for this song, return: []`;

          const result = await model.generateContent(prompt);
          const rawText = result.response.text().trim();
          const jsonMatch = rawText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsedAi = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsedAi) && parsedAi.length > 0) {
              const valid = parsedAi
                .map(l => ({
                  time: typeof l.time === 'number' ? Math.max(0, l.time) : (parseFloat(l.time) || 0),
                  text: String(l.text || '').trim()
                }))
                .filter(l => l.text.length > 0)
                .sort((a, b) => a.time - b.time);

              if (valid.length > 0) {
                if (trackKey && trackKey !== '___') {
                  await SongLyrics.findOneAndUpdate(
                    { trackKey },
                    {
                      trackKey,
                      trackId: trackId ? String(trackId) : undefined,
                      title,
                      artist,
                      lyrics: valid,
                      source: 'ai',
                      isVerified: false
                    },
                    { upsert: true, new: true }
                  ).catch(() => {});
                }
                return res.json({ success: true, lyrics: valid, source: 'ai', isVerified: false });
              }
            }
          }
        }
      } catch (geminiErr) {
        console.warn('[AI generate-song-lyrics Gemini]', geminiErr.message);
      }
    }

    return res.json({ success: false, lyrics: [], message: 'No lyrics found for this song' });
  } catch (err) {
    console.error('[generate-song-lyrics error]', err);
    res.status(500).json({ success: false, error: err.message, lyrics: [] });
  }
});

module.exports = router;
