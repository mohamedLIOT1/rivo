const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { auth, adminAuth, optionalAuth } = require('../middleware/auth');
const { Track, SongLyrics } = require('../models');
const { fetchLrclibLyrics, fetchGeniusLyrics, cleanLyricsMetadata, getTrackKey } = require('../utils/helpers');
const { genAI, getGeminiModel, QURAN_REGEX } = require('./ai/aiHelpers');
const { getCuratedRecommendations, getSmartShuffleTracks } = require('./ai/recommendationService');

// Recommendations for Playlists and Moods
router.post('/recommendations', optionalAuth, async (req, res) => {
  try {
    const { 
      mood, 
      timeOfDay, 
      recentTracks = [], 
      seedTracks = [], 
      availableTracks = [], 
      isQuran = false, 
      name = '', 
      playlistName = '', 
      trackIds = [],
      excludeTrackIds = [],
      refresh = false
    } = req.body || {};

    const effectiveName = name || playlistName || '';
    const isPlQuran = Boolean(isQuran || QURAN_REGEX.test(effectiveName));

    const finalRecs = await getCuratedRecommendations({
      mood,
      timeOfDay,
      recentTracks,
      seedTracks,
      availableTracks,
      isQuran: isPlQuran,
      effectiveName,
      trackIds,
      excludeTrackIds,
      refresh
    });

    res.json({ success: true, recommendations: finalRecs, tracks: finalRecs });
  } catch (e) {
    console.warn('[AI Recommendations]', e.message);
    res.json({ success: true, recommendations: [], tracks: [] });
  }
});

// Artist Bio Generator (Admin only)
router.post('/generate-artist-bio', adminAuth, async (req, res) => {
  try {
    const { artistName, genres = [] } = req.body || {};
    if (!artistName || typeof artistName !== 'string') return res.status(400).json({ error: 'Valid artist name is required' });
    if (!process.env.GEMINI_API_KEY || !genAI) {
      return res.json({ success: false, bio: '' });
    }
    const model = getGeminiModel();
    if (!model) return res.json({ success: false, bio: '' });
    const prompt = `Write a professional music artist bio for "${artistName.trim()}" ${Array.isArray(genres) && genres.length ? `who creates ${genres.join(', ')} music` : ''}. 
Keep it 2-3 sentences, engaging, and suitable for a music streaming platform. Write in English.`;
    const result = await model.generateContent(prompt);
    res.json({ success: true, bio: result.response.text().trim() });
  } catch (e) {
    res.json({ success: false, bio: '' });
  }
});

// AI & Online Song Lyrics Generator / Search
router.post('/generate-song-lyrics', optionalAuth, async (req, res) => {
  try {
    const { trackId, title, artist, duration = 180 } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: 'Title required', lyrics: [] });
    }

    const dur = Math.max(30, parseInt(duration, 10) || 180);
    const meta = cleanLyricsMetadata ? cleanLyricsMetadata(title, artist) : { cleanTitle: title, cleanArtist: artist, arabicTitle: '' };
    const cleanTitle = meta.cleanTitle || title;
    const cleanArtist = meta.cleanArtist || artist;

    const trackKey = getTrackKey(title, artist);

    // 1. Check database first (SongLyrics or Track)
    if (trackKey && trackKey !== '___') {
      const found = await SongLyrics.findOne({ trackKey }).lean();
      if (found && Array.isArray(found.lyrics) && found.lyrics.length > 0) {
        if (found.isVerified || found.source === 'verified' || found.source === 'synced' || found.source === 'genius') {
          return res.json({
            success: true,
            lyrics: found.lyrics,
            source: found.source || 'db',
            isVerified: Boolean(found.isVerified),
            verifiedBy: found.verifiedBy || ''
          });
        }
      }
    }

    if (trackId && mongoose.isValidObjectId(trackId)) {
      const trk = await Track.findById(trackId).lean();
      if (trk && Array.isArray(trk.lyrics) && trk.lyrics.length > 0) {
        if (trk.isVerified || trk.isVerifiedLyrics || trk.lyricsVerified) {
          return res.json({
            success: true,
            lyrics: trk.lyrics,
            source: 'verified',
            isVerified: true,
            verifiedBy: trk.verifiedBy || ''
          });
        }
      }
    }

    // 2. Fetch from LRCLIB / lyrics.ovh (synced lyrics preferred)
    let onlineLyrics = await fetchLrclibLyrics(cleanTitle, cleanArtist, dur);
    let lyricsSource = 'synced';

    // 3. Fallback to Genius Scraper
    if ((!onlineLyrics || onlineLyrics.length === 0) && fetchGeniusLyrics) {
      onlineLyrics = await fetchGeniusLyrics(cleanTitle, cleanArtist, dur);
      if (onlineLyrics && onlineLyrics.length > 0) {
        lyricsSource = 'genius';
      }
    }

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
            source: lyricsSource,
            isVerified: false
          },
          { upsert: true, new: true }
        ).catch(() => {});
      }
      return res.json({ success: true, lyrics: onlineLyrics, source: lyricsSource, isVerified: false });
    }

    // 4. Return cached unverified DB lyrics if online search gave nothing
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

    // 5. Fallback: AI Generation with Gemini (Strict Real Lyrics Only)
    if (process.env.GEMINI_API_KEY && genAI) {
      try {
        const model = getGeminiModel();
        if (model) {
          const prompt = `You are a music lyrics researcher. Provide the exact, official, real-world song lyrics for the song "${cleanTitle}" by artist "${cleanArtist}".
Duration: approximately ${dur} seconds.
Output requirements:
Return ONLY a valid JSON array of objects with "time" (in seconds, numbers starting from 0, increasing chronologically up to ${dur}) and "text" (the line of lyrics in its original language).
Example format:
[
  {"time": 0, "text": "First line"},
  {"time": 12, "text": "Second line"}
]
CRITICAL RULES:
- DO NOT invent, hallucinate, rhyme, or make up lyrics under ANY circumstances.
- If you do not know the exact, real-world official lyrics to this specific song, you MUST return ONLY an empty array: []
- DO NOT wrap in markdown code blocks.
- Return ONLY the raw JSON array.`;
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

// Smart Shuffle
router.post('/smart-shuffle', optionalAuth, async (req, res) => {
  try {
    const { currentTrack, seedTracks = [], followedArtists = [], limit = 8 } = req.body;
    const finalTracks = await getSmartShuffleTracks({ currentTrack, seedTracks, followedArtists, limit });
    res.json({ success: true, tracks: finalTracks });
  } catch (err) {
    console.error('[smart-shuffle error]', err);
    res.json({ success: true, tracks: [] });
  }
});

// AI Lyrics Timestamps Synchronization
router.post('/sync-timestamps', optionalAuth, async (req, res) => {
  try {
    const { rawText = '', title = '', artist = '', duration = 180 } = req.body;
    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ success: false, error: 'rawText is required' });
    }

    const dur = Math.max(30, Number(duration) || 180);
    const cleanLines = rawText
      .split('\n')
      .map(l => l.replace(/^\[\d{2}:\d{2}(?:\.\d{2,3})?\]\s*/, '').trim())
      .filter(l => l.length > 0);

    if (cleanLines.length === 0) {
      return res.json({ success: true, timestampedText: rawText });
    }

    let timestampedLines = null;

    if (process.env.GEMINI_API_KEY && genAI) {
      try {
        const model = getGeminiModel();
        if (model) {
          const prompt = `You are a professional audio & lyrics sync engineer.
Song: "${title}" by "${artist}". Total duration: ${dur} seconds.
Here are the unsynced lyrics lines:
${cleanLines.map((l, i) => `${i + 1}. ${l}`).join('\n')}

Format each line with a realistic LRC timestamp starting around 00:05.00 and distributed evenly up to ${Math.floor(dur * 0.95)} seconds in standard [mm:ss.xx] format.
Output requirements:
Return ONLY the synced lyrics lines with [mm:ss.xx] prefix. No explanations, no markdown blocks.`;

          const result = await model.generateContent(prompt);
          const text = result.response.text().trim().replace(/```lrc|```/g, '').trim();
          if (text.includes('[') && text.includes(']')) {
            timestampedLines = text;
          }
        }
      } catch (e) {
        console.warn('[AI sync-timestamps Gemini]', e.message);
      }
    }

    if (!timestampedLines) {
      const startSec = 5;
      const endSec = Math.max(startSec + 10, dur - 8);
      const step = (endSec - startSec) / Math.max(1, cleanLines.length);

      timestampedLines = cleanLines.map((line, idx) => {
        const lineTime = startSec + (idx * step);
        const mins = Math.floor(lineTime / 60);
        const secs = (lineTime % 60).toFixed(2).padStart(5, '0');
        const stamp = `[${String(mins).padStart(2, '0')}:${secs}]`;
        return `${stamp} ${line}`;
      }).join('\n');
    }

    res.json({ success: true, timestampedText: timestampedLines });
  } catch (err) {
    console.error('[sync-timestamps error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
