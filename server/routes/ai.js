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
const { auth, adminAuth } = require('../middleware/auth');
const { Track, SongLyrics } = require('../models');

const genAI = (process.env.GEMINI_API_KEY && GoogleGenerativeAI) ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// أ. Smart Mood Playlist (بدلاً من الـ hardcoded rules)
router.post('/recommendations', auth, async (req, res) => {
  try {
    const { mood, timeOfDay, recentTracks = [], availableTracks = [] } = req.body;
    if (!process.env.GEMINI_API_KEY || !genAI) {
      // Fallback to old logic if no API key
      return res.json({ success: false, error: 'AI not configured' });
    }
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const trackList = (availableTracks || []).slice(0, 50).map(t => `"${t.title}" by ${t.artist}`).join(', ');
    const prompt = `You are a music curator. Given these available tracks: ${trackList}
User mood: ${mood || 'neutral'}, Time of day: ${timeOfDay || 'evening'}, Recently played: ${(recentTracks || []).slice(0,5).join(', ')}.
Select the 10 best matching tracks from the available list. Return ONLY a JSON array of track titles exactly as written. No explanation.`;
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const suggested = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    const matched = availableTracks.filter(t =>
      suggested.some(s => s.toLowerCase().includes(t.title.toLowerCase().slice(0, 10)))
    );
    res.json({ success: true, tracks: matched.slice(0, 10) });
  } catch (e) {
    console.warn('[AI Recommendations]', e.message);
    res.json({ success: false, tracks: [] });
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
