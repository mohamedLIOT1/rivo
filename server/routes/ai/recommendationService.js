/**
 * Recommendation & Smart Shuffle Curators
 * Strictly modularized (< 400 lines).
 */

const { Track } = require('../../models');
const { genAI, getGeminiModel, isQuranTrack } = require('./aiHelpers');
const { getPrimaryArtistNormalized } = require('../../utils/artistAliases');

async function getCuratedRecommendations({
  mood,
  timeOfDay,
  recentTracks = [],
  seedTracks = [],
  availableTracks = [],
  isQuran = false,
  effectiveName = '',
  trackIds = []
}) {
  const isPlQuran = Boolean(isQuran);
  const rawSeeds = (recentTracks && recentTracks.length > 0) ? recentTracks : seedTracks;
  const normalizedSeeds = rawSeeds.map(t => {
    if (typeof t === 'string') return t;
    return `${t.title || ''} ${t.artist || ''}`.trim();
  }).filter(Boolean);

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
        if (matched.length > 0) {
          finalRecs = capTracksByArtist(matched, 10, 2);
        }
      }
    } catch (geminiErr) {
      console.warn('[AI Recommendations Gemini]', geminiErr.message);
    }
  }

  if (finalRecs.length === 0) {
    const seedArtists = new Set();
    rawSeeds.forEach(t => {
      if (typeof t === 'object' && t.artist) seedArtists.add(getPrimaryArtistNormalized(t.artist));
    });

    const scoredPool = filteredPool.map(t => {
      let score = Math.random() * 15;
      const art = getPrimaryArtistNormalized(t.artist);
      if (seedArtists.has(art)) score += 30;
      score += Math.min(20, Math.log10((Number(t.plays) || 0) + 1) * 5);
      return { track: t, score };
    });

    scoredPool.sort((a, b) => b.score - a.score);
    finalRecs = capTracksByArtist(scoredPool.map(s => s.track), 10, 2);
  }

  return finalRecs;
}

function capTracksByArtist(tracks, limit = 10, maxPerArtist = 2, preSeededCounts = new Map()) {
  const selected = [];
  const seenIds = new Set();
  const artistCounts = new Map(preSeededCounts);

  for (const t of tracks) {
    if (!t || selected.length >= limit) break;
    const tId = String(t._id || t.id);
    if (seenIds.has(tId)) continue;
    const art = getPrimaryArtistNormalized(t.artist);
    const count = artistCounts.get(art) || 0;
    if (count < maxPerArtist) {
      selected.push(t);
      seenIds.add(tId);
      artistCounts.set(art, count + 1);
    }
  }

  if (selected.length < limit) {
    for (const t of tracks) {
      if (!t || selected.length >= limit) break;
      const tId = String(t._id || t.id);
      if (seenIds.has(tId)) continue;
      const art = getPrimaryArtistNormalized(t.artist);
      const count = artistCounts.get(art) || 0;
      if (count < Math.min(maxPerArtist + 1, 3)) {
        selected.push(t);
        seenIds.add(tId);
        artistCounts.set(art, count + 1);
      }
    }
  }

  return selected;
}

async function getSmartShuffleTracks({ currentTrack, seedTracks = [], followedArtists = [], limit = 8 }) {
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

  if (available.length === 0) return [];

  let finalTracks = [];

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
            const curArtistNorm = currentTrack ? getPrimaryArtistNormalized(currentTrack.artist) : '';
            const preSeeded = new Map();
            if (curArtistNorm) preSeeded.set(curArtistNorm, 1);
            finalTracks = capTracksByArtist(matched, limit, 2, preSeeded);
          }
        }
      }
    } catch (e) {
      console.warn('[Smart Shuffle Gemini]', e.message);
    }
  }

  if (finalTracks.length === 0) {
    const curArtistNorm = currentTrack ? getPrimaryArtistNormalized(currentTrack.artist) : '';
    const curGenre = (currentTrack?.genre || '').toLowerCase().trim();
    const preSeeded = new Map();
    if (curArtistNorm) preSeeded.set(curArtistNorm, 1);

    const scored = available.map(t => {
      let score = Math.random() * 12;
      const tArtistNorm = getPrimaryArtistNormalized(t.artist);
      const tGenre = (t.genre || '').toLowerCase().trim();

      if (followedSet.has(tArtistNorm) || [...followedSet].some(fa => tArtistNorm.includes(fa))) {
        score += 45;
      }
      if (curArtistNorm && tArtistNorm === curArtistNorm) {
        score += 25;
      }
      if (curGenre && tGenre && (curGenre === tGenre || curGenre.includes(tGenre))) {
        score += 35;
      }
      score += Math.min(15, Math.log10((Number(t.plays) || 0) + 1) * 4);

      return { track: t, score };
    });

    scored.sort((a, b) => b.score - a.score);
    finalTracks = capTracksByArtist(scored.map(s => s.track), limit, 2, preSeeded);
  }

  return finalTracks;
}

module.exports = {
  getCuratedRecommendations,
  getSmartShuffleTracks
};
