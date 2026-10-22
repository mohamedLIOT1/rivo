const express = require('express');
const router = express.Router();
let GoogleGenerativeAI;
try {
  GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
} catch (e) {
  GoogleGenerativeAI = null;
}
const mongoose = require('mongoose');
const { auth, adminAuth, optionalAuth } = require('../middleware/auth');
const { Track, SongLyrics } = require('../models');
const { fetchLrclibLyrics, fetchGeniusLyrics, cleanLyricsMetadata, getTrackKey, parsePlain } = require('../utils/helpers');

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
    const { 
      mood, 
      timeOfDay, 
      recentTracks = [], 
      seedTracks = [], 
      availableTracks = [], 
      isQuran = false, 
      name = '', 
      playlistName = '', 
      trackIds = [] 
    } = req.body;

    const effectiveName = name || playlistName || '';
    const isPlQuran = Boolean(isQuran || QURAN_REGEX.test(effectiveName));

    // Normalize incoming seed/recent tracks
    const rawSeeds = (recentTracks && recentTracks.length > 0) ? recentTracks : seedTracks;
    const normalizedSeeds = rawSeeds.map(t => {
      if (typeof t === 'string') return t;
      return `${t.title || ''} ${t.artist || ''}`.trim();
    }).filter(Boolean);

    // Extract seed track IDs to exclude from recommendations
    const incomingIds = (trackIds || []).map(String);
    rawSeeds.forEach(t => {
      if (typeof t === 'object' && (t.id || t._id)) {
        incomingIds.push(String(t.id || t._id));
      }
    });
    const excludedIds = new Set(incomingIds);

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
        }).sort({ plays: -1 }).limit(200).lean();
      } else {
        pool = await Track.find({
          isQuran: { $ne: true },
          category: { $ne: 'quran' },
          genre: { $ne: 'Quran' }
        }).sort({ plays: -1 }).limit(200).lean();
      }
    }

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
          const prompt = `You are an expert music and recitation curator. Given these available tracks: ${trackList}
Context: ${isPlQuran ? 'Quran Recitations' : 'Music Playlist'}, Name: "${effectiveName || 'My Playlist'}", User mood: ${mood || 'neutral'}, Time of day: ${timeOfDay || 'evening'}, Seed / Recent tracks: ${normalizedSeeds.slice(0, 5).join(', ')}.
Select the 10 best matching tracks from the available list that fit the style and mood. Return ONLY a valid JSON array of track titles exactly as written. No markdown, no explanation.`;
          const result = await model.generateContent(prompt);
          const text = result.response.text().trim();
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          const suggested = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
          const matched = filteredPool.filter(t =>
            suggested.some(s => {
              const sClean = String(s).toLowerCase();
              const tClean = String(t.title).toLowerCase();
              return sClean.includes(tClean.slice(0, 8)) || tClean.includes(sClean.slice(0, 8));
            })
          );
          if (matched.length > 0) finalRecs = matched.slice(0, 10);
        }
      } catch (geminiErr) {
        console.warn('[AI Recommendations Gemini]', geminiErr.message);
      }
    }

    // High-quality heuristic fallback if AI not configured or yields empty
    if (finalRecs.length === 0) {
      // Extract seed artists
      const seedArtists = new Set();
      rawSeeds.forEach(t => {
        if (typeof t === 'object' && t.artist) seedArtists.add(t.artist.toLowerCase().trim());
      });

      const scoredPool = filteredPool.map(t => {
        let score = Math.random() * 15;
        const art = (t.artist || '').toLowerCase().trim();
        if (seedArtists.has(art)) score += 50;
        score += Math.min(20, Math.log10((Number(t.plays) || 0) + 1) * 5);
        return { track: t, score };
      });

      scoredPool.sort((a, b) => b.score - a.score);
      finalRecs = scoredPool.slice(0, 10).map(s => s.track);
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
    const meta = cleanLyricsMetadata ? cleanLyricsMetadata(title, artist) : { cleanTitle: title, cleanArtist: artist, arabicTitle: '' };
    const cleanTitle = meta.cleanTitle || title;
    const cleanArtist = meta.cleanArtist || artist;

    const trackKey = getTrackKey(title, artist);

    // 1. Check database first (SongLyrics or Track)
    // If lyrics are verified, or from trusted sources ('verified', 'synced', 'genius'), return them
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

    // 3. Fallback to Genius Scraper (real, official lyrics)
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

    // If SongLyrics had an unverified cached entry and online search gave nothing, return it
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

    // 4. Fallback: AI Generation with Gemini (Strict Real Lyrics Only - NO Hallucination)
    if (process.env.GEMINI_API_KEY && genAI) {
      try {
        const model = getGeminiModel();
        if (model) {
          const prompt = `You are a music lyrics researcher. Provide the exact, official, real-world song lyrics for the song "${cleanTitle}" by artist "${cleanArtist}".
Duration: approximately ${dur} seconds.
Output requirements:
Return ONLY a valid JSON array of objects with "time" (in seconds, numbers starting from 0, increasing chronologically up to ${dur}) and "text" (the line of lyrics in its original language, e.g. Arabic, English, etc.).
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

// د. AI & Online Song Lyrics Generator / Search
router.post('/smart-shuffle', optionalAuth, async (req, res) => {
  try {
    const { currentTrack, seedTracks = [], followedArtists = [], limit = 8 } = req.body;
    const isCurQuran = isQuranTrack(currentTrack);

    const excludeIds = new Set();
    if (currentTrack) excludeIds.add(String(currentTrack.id || currentTrack._id));
    (seedTracks || []).forEach(s => {
      if (s) excludeIds.add(String(s.id || s._id));
    });

    const followedSet = new Set((followedArtists || []).map(a => String(a).toLowerCase().trim()));

    let query = isCurQuran
      ? {
          $or: [
            { isQuran: true },
            { category: 'quran' },
            { genre: 'Quran' },
            { title: /سورة|سوره|قرآن|قران/i }
          ]
        }
      : {
          isQuran: { $ne: true },
          category: { $ne: 'quran' },
          genre: { $ne: 'Quran' }
        };

    const candidatePool = await Track.find(query).sort({ plays: -1 }).limit(150).lean();
    const available = candidatePool.filter(t => !excludeIds.has(String(t._id || t.id)));

    if (available.length === 0) {
      return res.json({ success: true, tracks: [] });
    }

    let finalTracks = [];

    // Optional Gemini Curation
    if (process.env.GEMINI_API_KEY && genAI && available.length >= limit) {
      try {
        const model = getGeminiModel();
        if (model) {
          const sampleList = available.slice(0, 45).map(t => `"${t.title}" by ${t.artist}`).join(', ');
          const seedStr = currentTrack ? `"${currentTrack.title}" by ${currentTrack.artist}` : 'General music';
          const prompt = `You are an expert streaming radio DJ. The user is listening to: ${seedStr}.
Available tracks in library: ${sampleList}.
Select the top ${limit} tracks from this list that flow best sonically and stylistically after the seed track.
Return ONLY a valid JSON array of track titles exactly as written. No explanations, no markdown.`;
          const result = await model.generateContent(prompt);
          const raw = result.response.text().trim();
          const jsonMatch = raw.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const titles = JSON.parse(jsonMatch[0]);
            const matched = available.filter(t =>
              titles.some(titleStr => {
                const a = String(titleStr).toLowerCase();
                const b = String(t.title).toLowerCase();
                return a.includes(b.slice(0, 8)) || b.includes(a.slice(0, 8));
              })
            );
            if (matched.length >= Math.min(3, limit)) {
              finalTracks = matched.slice(0, limit);
            }
          }
        }
      } catch (e) {
        console.warn('[Smart Shuffle Gemini]', e.message);
      }
    }

    // High quality intelligent scoring fallback
    if (finalTracks.length === 0) {
      const curArtist = (currentTrack?.artist || '').toLowerCase().trim();
      const curGenre = (currentTrack?.genre || '').toLowerCase().trim();

      const scored = available.map(t => {
        let score = Math.random() * 12; // Natural variety jitter
        const tArtist = (t.artist || '').toLowerCase().trim();
        const tGenre = (t.genre || '').toLowerCase().trim();

        // Followed artists
        if (followedSet.has(tArtist) || [...followedSet].some(fa => tArtist.includes(fa))) {
          score += 45;
        }

        // Matching seed artist
        if (curArtist && (tArtist.includes(curArtist) || curArtist.includes(tArtist))) {
          score += 40;
        }

        // Matching genre
        if (curGenre && tGenre && (curGenre === tGenre || curGenre.includes(tGenre))) {
          score += 25;
        }

        // Play count popularity
        score += Math.min(15, Math.log10((Number(t.plays) || 0) + 1) * 4);

        return { track: t, score };
      });

      scored.sort((a, b) => b.score - a.score);
      finalTracks = scored.slice(0, limit).map(s => s.track);
    }

    res.json({ success: true, tracks: finalTracks });
  } catch (err) {
    console.error('[smart-shuffle error]', err);
    res.json({ success: true, tracks: [] });
  }
});

// و. AI Lyrics Timestamps Synchronization
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

    // Optional Gemini Timestamp Estimation
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

    // Reliable Algorithmic Interpolation Fallback
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
