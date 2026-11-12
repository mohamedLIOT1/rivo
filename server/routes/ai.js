const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { adminAuth, optionalAuth } = require('../middleware/auth');
const { Track, SongLyrics, User } = require('../models');
const { fetchLrclibLyrics, fetchGeniusLyrics, cleanLyricsMetadata, getTrackKey } = require('../utils/helpers');
const { generateAiJson, generateAiText, QURAN_REGEX } = require('./ai/aiHelpers');
const { fetchUserTasteProfile } = require('./ai/userTasteHelper');
const {
  getCuratedRecommendations,
  getSmartShuffleTracks,
  getPersonalizedMoodMix,
  getPersonalizedQuickMix
} = require('./ai/recommendationService');

function createRequestAbortSignal(res) {
  const controller = new AbortController();
  const onClose = () => { if (!res.writableEnded) controller.abort(); };
  res.on('close', onClose);
  return { signal: controller.signal, cleanup: () => res.off('close', onClose) };
}

function resolveQuranModeFlag(explicitIsQuran, userTaste, nameHint = '') {
  if (explicitIsQuran !== undefined && explicitIsQuran !== null && explicitIsQuran !== '') {
    return Boolean(explicitIsQuran === true || explicitIsQuran === 'true' || QURAN_REGEX.test(nameHint));
  }
  if (QURAN_REGEX.test(nameHint)) return true;
  return Boolean(userTaste?.contentModes && userTaste.contentModes.music === false && userTaste.contentModes.quran === true);
}

function parseIdList(val) {
  if (Array.isArray(val)) return val.map(String).filter(Boolean);
  if (typeof val === 'string' && val.trim()) return val.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

async function saveCachedSongLyrics({ trackKey, trackId, title, artist, lyrics, source }) {
  if (!trackKey || trackKey === '___' || !Array.isArray(lyrics) || lyrics.length === 0) return;
  await SongLyrics.findOneAndUpdate(
    { trackKey },
    { trackKey, trackId: trackId ? String(trackId) : undefined, title, artist, lyrics, source, isVerified: false },
    { upsert: true, new: true }
  ).catch(() => {});
}

// Recommendations for Playlists and Moods
router.post('/recommendations', optionalAuth, async (req, res) => {
  const { signal, cleanup } = createRequestAbortSignal(res);
  try {
    const {
      mood, timeOfDay, recentTracks = [], seedTracks = [], availableTracks = [],
      isQuran, name = '', playlistName = '', trackIds = [], excludeTrackIds = [],
      followedArtists = [], refresh = false
    } = req.body || {};

    const effectiveName = name || playlistName || '';
    const userTaste = req.user?.id ? await fetchUserTasteProfile(req.user.id, { followedArtists }) : null;
    const isPlQuran = resolveQuranModeFlag(isQuran, userTaste, effectiveName);

    const finalRecs = await getCuratedRecommendations({
      mood, timeOfDay, recentTracks, seedTracks, availableTracks,
      isQuran: isPlQuran, effectiveName, trackIds, excludeTrackIds, refresh, userTaste, signal
    });
    res.json({ success: true, recommendations: finalRecs, tracks: finalRecs });
  } catch (e) {
    console.warn('[AI Recommendations]', e.message);
    res.json({ success: true, recommendations: [], tracks: [] });
  } finally {
    cleanup();
  }
});

// Smart Shuffle
router.post('/smart-shuffle', optionalAuth, async (req, res) => {
  const { signal, cleanup } = createRequestAbortSignal(res);
  try {
    const { currentTrack, seedTracks = [], followedArtists = [], limit = 8 } = req.body || {};
    const userTaste = req.user?.id ? await fetchUserTasteProfile(req.user.id, { followedArtists }) : null;
    const finalTracks = await getSmartShuffleTracks({ currentTrack, seedTracks, followedArtists, userTaste, limit, signal });
    res.json({ success: true, tracks: finalTracks });
  } catch (err) {
    console.error('[smart-shuffle error]', err.message);
    res.json({ success: true, tracks: [] });
  } finally {
    cleanup();
  }
});

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const guestMoodMixCache = new Map();
const moodMixInflight = new Map();

function getServer12hBucket(now = Date.now()) {
  return Math.floor(now / TWELVE_HOURS_MS);
}

async function hydrateTracksByIds(trackIds = []) {
  const validIds = (Array.isArray(trackIds) ? trackIds : [])
    .map(String)
    .filter((id) => mongoose.isValidObjectId(id));
  if (validIds.length === 0) return [];
  const docs = await Track.find({ _id: { $in: validIds } }).lean();
  const byId = new Map(docs.map((doc) => [String(doc._id), { ...doc, id: String(doc._id) }]));
  return validIds.map((id) => byId.get(id)).filter(Boolean);
}

function setGuestMoodMixCache(key, value) {
  if (guestMoodMixCache.size >= 24) {
    const oldest = guestMoodMixCache.keys().next().value;
    if (oldest) guestMoodMixCache.delete(oldest);
  }
  guestMoodMixCache.set(key, value);
}

// Personalized Mood Mix (GET & POST — synced across Web & Mobile for each 12h window)
const moodMixHandler = async (req, res) => {
  const { signal, cleanup } = createRequestAbortSignal(res);
  try {
    const params = { ...(req.query || {}), ...(req.body || {}) };
    const { mood = '', timeOfDay = '', limit = 15, isQuran, forceRefresh = false, seedTracks = [], followedArtists = [] } = params;
    const excludeTrackIds = parseIdList(params.excludeTrackIds);
    const bucket12h = getServer12hBucket();
    const userId = req.user?.id ? String(req.user.id) : '';
    const userTaste = userId ? await fetchUserTasteProfile(userId, { followedArtists }) : null;
    const isMixQuran = resolveQuranModeFlag(isQuran, userTaste, String(mood || ''));
    const shouldForce = forceRefresh === true || forceRefresh === 'true';

    // 1. Check persisted canonical 12-hour mix so Web, Desktop, iOS & Android show the exact same playlist
    if (!shouldForce && !isMixQuran) {
      if (userId) {
        const userDoc = await User.findById(userId).select('aiMoodMixCache').lean();
        const cachedMix = userDoc?.aiMoodMixCache;
        if (cachedMix?.bucket12h === bucket12h && Array.isArray(cachedMix.trackIds) && cachedMix.trackIds.length >= 10) {
          const hydrated = await hydrateTracksByIds(cachedMix.trackIds);
          if (hydrated.length >= 10) {
            return res.json({
              success: true,
              mood: cachedMix.moodId || 'balanced',
              bucket12h,
              personalized: true,
              cached: true,
              tracks: hydrated,
              recommendations: hydrated
            });
          }
        }
      } else {
        const guestHit = guestMoodMixCache.get(`${bucket12h}:music`);
        if (guestHit && Array.isArray(guestHit.tracks) && guestHit.tracks.length >= 10) {
          return res.json({
            success: true,
            mood: guestHit.mood || 'balanced',
            bucket12h,
            personalized: false,
            cached: true,
            tracks: guestHit.tracks,
            recommendations: guestHit.tracks
          });
        }
      }
    }

    // 2. Deduplicate simultaneous generation across devices of the same user
    const inflightKey = `${userId || 'guest'}:${bucket12h}:${isMixQuran ? 'quran' : 'music'}`;
    let generator = !shouldForce ? moodMixInflight.get(inflightKey) : null;
    if (!generator) {
      generator = (async () => {
        const result = await getPersonalizedMoodMix({
          mood, timeOfDay, userTaste,
          seedTracks: Array.isArray(seedTracks) ? seedTracks : [],
          excludeTrackIds,
          isQuran: isMixQuran,
          limit,
          refresh: true,
          signal
        });
        const formatted = (result.tracks || []).map((t) => ({ ...t, id: String(t._id || t.id) }));
        if (!isMixQuran && formatted.length > 0) {
          const trackIds = formatted.map((t) => String(t._id || t.id)).filter(Boolean);
          if (userId) {
            await User.updateOne(
              { _id: userId },
              { $set: { aiMoodMixCache: { bucket12h, moodId: result.mood, savedAt: new Date(), trackIds } } }
            ).catch(() => {});
          } else {
            setGuestMoodMixCache(`${bucket12h}:music`, { mood: result.mood, tracks: formatted });
          }
        }
        return { mood: result.mood, tracks: formatted };
      })().finally(() => {
        if (moodMixInflight.get(inflightKey) === generator) {
          moodMixInflight.delete(inflightKey);
        }
      });
      if (!shouldForce) moodMixInflight.set(inflightKey, generator);
    }

    const generated = await generator;
    res.json({
      success: true,
      mood: generated.mood,
      bucket12h,
      personalized: Boolean(userId),
      cached: false,
      tracks: generated.tracks,
      recommendations: generated.tracks
    });
  } catch (err) {
    console.warn('[AI Mood Mix]', err.message);
    res.json({ success: true, mood: 'balanced', personalized: false, tracks: [], recommendations: [] });
  } finally {
    cleanup();
  }
};
router.post('/mood-mix', optionalAuth, moodMixHandler);
router.get('/mood-mix', optionalAuth, moodMixHandler);

// Personalized Quick Mix (GET & POST)
const quickMixHandler = async (req, res) => {
  const { signal, cleanup } = createRequestAbortSignal(res);
  try {
    const params = { ...(req.query || {}), ...(req.body || {}) };
    const { limit = 12, isQuran, refresh = true, currentTrack = null, seedTracks = [], followedArtists = [] } = params;
    const excludeTrackIds = parseIdList(params.excludeTrackIds);
    const userTaste = req.user?.id ? await fetchUserTasteProfile(req.user.id, { followedArtists }) : null;
    const isMixQuran = resolveQuranModeFlag(isQuran, userTaste);

    const tracks = await getPersonalizedQuickMix({
      userTaste, currentTrack,
      seedTracks: Array.isArray(seedTracks) ? seedTracks : [],
      excludeTrackIds,
      isQuran: isMixQuran,
      limit,
      refresh: refresh !== false && refresh !== 'false',
      signal
    });
    res.json({
      success: true,
      personalized: Boolean(userTaste?.userId),
      topGenres: (userTaste?.topGenresRanked || []).slice(0, 5),
      tracks,
      recommendations: tracks
    });
  } catch (err) {
    console.warn('[AI Quick Mix]', err.message);
    res.json({ success: true, personalized: false, topGenres: [], tracks: [], recommendations: [] });
  } finally {
    cleanup();
  }
};
router.post('/quick-mix', optionalAuth, quickMixHandler);
router.get('/quick-mix', optionalAuth, quickMixHandler);

// Artist Bio Generator (Admin only)
router.post('/generate-artist-bio', adminAuth, async (req, res) => {
  const { signal, cleanup } = createRequestAbortSignal(res);
  try {
    const { artistName, genres = [] } = req.body || {};
    if (!artistName || typeof artistName !== 'string') {
      return res.status(400).json({ error: 'Valid artist name is required' });
    }
    const genreHint = Array.isArray(genres) && genres.length ? `who creates ${genres.join(', ')} music` : '';
    const prompt = `Write a professional music artist bio for "${artistName.trim()}" ${genreHint}. Keep it 2-3 sentences, engaging, and suitable for a music streaming platform. Write in English.`;
    const bio = await generateAiText(prompt, { signal, maxTokens: 300 });
    res.json({ success: Boolean(bio), bio: bio || '' });
  } catch {
    res.json({ success: false, bio: '' });
  } finally {
    cleanup();
  }
});

// AI & Online Song Lyrics Generator / Search
router.post('/generate-song-lyrics', optionalAuth, async (req, res) => {
  const { signal, cleanup } = createRequestAbortSignal(res);
  try {
    const { trackId, title, artist, duration = 180 } = req.body || {};
    if (!title) return res.status(400).json({ success: false, error: 'Title required', lyrics: [] });

    const dur = Math.max(30, parseInt(duration, 10) || 180);
    const meta = cleanLyricsMetadata ? cleanLyricsMetadata(title, artist) : { cleanTitle: title, cleanArtist: artist };
    const cleanTitle = meta.cleanTitle || title;
    const cleanArtist = meta.cleanArtist || artist;
    const trackKey = getTrackKey(title, artist);
    const cachedDoc = (trackKey && trackKey !== '___') ? await SongLyrics.findOne({ trackKey }).lean() : null;

    if (cachedDoc?.lyrics?.length > 0 &&
      (cachedDoc.isVerified || ['verified', 'synced', 'genius'].includes(cachedDoc.source))) {
      return res.json({
        success: true, lyrics: cachedDoc.lyrics, source: cachedDoc.source || 'db',
        isVerified: Boolean(cachedDoc.isVerified), verifiedBy: cachedDoc.verifiedBy || ''
      });
    }

    if (trackId && mongoose.isValidObjectId(trackId)) {
      const trk = await Track.findById(trackId).lean();
      if (trk?.lyrics?.length > 0 && (trk.isVerified || trk.isVerifiedLyrics || trk.lyricsVerified)) {
        return res.json({ success: true, lyrics: trk.lyrics, source: 'verified', isVerified: true, verifiedBy: trk.verifiedBy || '' });
      }
    }

    let onlineLyrics = await fetchLrclibLyrics(cleanTitle, cleanArtist, dur);
    let lyricsSource = 'synced';
    if ((!onlineLyrics || onlineLyrics.length === 0) && fetchGeniusLyrics) {
      onlineLyrics = await fetchGeniusLyrics(cleanTitle, cleanArtist, dur);
      if (onlineLyrics && onlineLyrics.length > 0) lyricsSource = 'genius';
    }

    if (Array.isArray(onlineLyrics) && onlineLyrics.length > 0) {
      await saveCachedSongLyrics({ trackKey, trackId, title, artist, lyrics: onlineLyrics, source: lyricsSource });
      return res.json({ success: true, lyrics: onlineLyrics, source: lyricsSource, isVerified: false });
    }

    if (cachedDoc?.lyrics?.length > 0) {
      return res.json({
        success: true, lyrics: cachedDoc.lyrics, source: cachedDoc.source || 'db',
        isVerified: Boolean(cachedDoc.isVerified), verifiedBy: cachedDoc.verifiedBy || ''
      });
    }

    const prompt = `You are a music lyrics researcher. Provide the exact, official, real-world song lyrics for "${cleanTitle}" by "${cleanArtist}".
Duration: approximately ${dur} seconds.
Return ONLY a valid JSON array of objects with "time" (in seconds starting from 0, chronological up to ${dur}) and "text" (original language line).
CRITICAL: Do NOT invent or hallucinate lyrics. If you do not know the exact official lyrics, return ONLY []. No markdown.`;

    const parsedAi = await generateAiJson(prompt, { signal, maxTokens: 1800, temperature: 0.1 });
    if (Array.isArray(parsedAi) && parsedAi.length > 0) {
      const valid = parsedAi
        .map((l) => ({ time: typeof l.time === 'number' ? Math.max(0, l.time) : (parseFloat(l.time) || 0), text: String(l.text || '').trim() }))
        .filter((l) => l.text.length > 0)
        .sort((a, b) => a.time - b.time);

      if (valid.length > 0) {
        await saveCachedSongLyrics({ trackKey, trackId, title, artist, lyrics: valid, source: 'ai' });
        return res.json({ success: true, lyrics: valid, source: 'ai', isVerified: false });
      }
    }

    return res.json({ success: false, lyrics: [], message: 'No lyrics found for this song' });
  } catch (err) {
    console.error('[generate-song-lyrics error]', err.message);
    res.status(500).json({ success: false, error: err.message, lyrics: [] });
  } finally {
    cleanup();
  }
});

// AI Lyrics Timestamps Synchronization
router.post('/sync-timestamps', optionalAuth, async (req, res) => {
  const { signal, cleanup } = createRequestAbortSignal(res);
  try {
    const { rawText = '', title = '', artist = '', duration = 180 } = req.body || {};
    if (!rawText || !rawText.trim()) return res.status(400).json({ success: false, error: 'rawText is required' });

    const dur = Math.max(30, Number(duration) || 180);
    const cleanLines = rawText.split('\n').map((l) => l.replace(/^\[\d{2}:\d{2}(?:\.\d{2,3})?\]\s*/, '').trim()).filter(Boolean);
    if (cleanLines.length === 0) return res.json({ success: true, timestampedText: rawText });

    const prompt = `You are a professional audio & lyrics sync engineer.
Song: "${title}" by "${artist}". Total duration: ${dur} seconds.
Unsynced lyrics lines:\n${cleanLines.map((l, i) => `${i + 1}. ${l}`).join('\n')}
Format each line with a realistic LRC timestamp starting around 00:05.00 up to ${Math.floor(dur * 0.95)} seconds in [mm:ss.xx] format.
Return ONLY the synced lyrics lines with [mm:ss.xx] prefix. No explanations, no markdown.`;

    const aiText = await generateAiText(prompt, { signal, maxTokens: 2000, temperature: 0.2 });
    const cleaned = aiText ? aiText.replace(/```lrc|```/gi, '').trim() : '';
    let timestampedLines = (cleaned && cleaned.includes('[') && cleaned.includes(']')) ? cleaned : null;

    if (!timestampedLines) {
      const startSec = 5;
      const step = (Math.max(startSec + 10, dur - 8) - startSec) / Math.max(1, cleanLines.length);
      timestampedLines = cleanLines.map((line, idx) => {
        const lineTime = startSec + (idx * step);
        const mins = Math.floor(lineTime / 60);
        const secs = (lineTime % 60).toFixed(2).padStart(5, '0');
        return `[${String(mins).padStart(2, '0')}:${secs}] ${line}`;
      }).join('\n');
    }

    res.json({ success: true, timestampedText: timestampedLines });
  } catch (err) {
    console.error('[sync-timestamps error]', err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    cleanup();
  }
});

module.exports = router;
