/**
 * Recommendation & Smart Shuffle Curators
 * Strictly modularized (< 400 lines).
 */

const { Track } = require('../../models');
const { genAI, getGeminiModel, isQuranTrack } = require('./aiHelpers');
const { getPrimaryArtistNormalized, CANONICAL_ARTIST_MAP } = require('../../utils/artistAliases');

const RELATED_ARTIST_CLUSTERS = [
  ['lege-cy', 'cairokee', 'wegz', 'marwan pablo', 'marwan moussa', 'abyusif', 'afroto', 'shabjdeed', 'ziad zaza', 'santa', 'abo el anwar', 'karim osama', 'mousa sam', 'shehab', 'flx', 'arsenic'],
  ['cairokee', 'amir eid', 'massar egbari', 'sharmoofers', 'hamza namira', 'aziz maraka', 'autostrad', 'jadal', 'disco misr'],
  ['amr diab', 'tamer hosny', 'hamaki', 'sherine', 'asala', 'elissa', 'nancy ajram', 'bahaa sultan', 'tamer ashoor', 'rami sabry'],
  ['essam sasa', 'hamo bika', 'hassan shakosh', 'omar kamal', '3enba', 'double zuksh', 'houda bondok', 'reda el bahrawy', 'mahmoud el leithy', 'ahmed sheba']
];

function getEffectiveArtist(track) {
  if (!track) return 'unknown';
  const rawArtist = track.artist || '';
  const normArt = getPrimaryArtistNormalized(rawArtist);
  const GENERIC_UPLOADERS = new Set(['zk studios', 'dark side', 'sherif', 'official', 'records', 'music', 'unknown']);
  if (GENERIC_UPLOADERS.has(normArt) || !normArt || normArt === 'unknown') {
    const title = (track.title || '').toLowerCase();
    for (const [alias, canonical] of Object.entries(CANONICAL_ARTIST_MAP)) {
      if (title.includes(alias)) {
        return canonical;
      }
    }
  }
  return normArt;
}

function getRelatedArtists(artists) {
  const related = new Set();
  for (const art of artists) {
    for (const cluster of RELATED_ARTIST_CLUSTERS) {
      if (cluster.includes(art)) {
        cluster.forEach(a => { if (a !== art) related.add(a); });
      }
    }
  }
  return related;
}

async function getCuratedRecommendations({
  mood,
  timeOfDay,
  recentTracks = [],
  seedTracks = [],
  availableTracks = [],
  isQuran = false,
  effectiveName = '',
  trackIds = [],
  excludeTrackIds = [],
  refresh = false
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
  (excludeTrackIds || []).forEach(id => {
    if (id) incomingIds.push(String(id));
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
      }).sort(refresh ? { _id: -1 } : { plays: -1 }).limit(250).lean();
    } else {
      const skipCount = refresh ? Math.floor(Math.random() * 40) : 0;
      pool = await Track.find({
        isQuran: { $ne: true },
        category: { $ne: 'quran' },
        genre: { $ne: 'Quran' }
      }).sort(refresh ? { createdAt: -1 } : { plays: -1 }).skip(skipCount).limit(250).lean();
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
        // Diversely sample candidate tracks rather than a static slice(0, 50)
        let candidatePoolForPrompt = [...filteredPool];
        if (refresh || candidatePoolForPrompt.length > 50) {
          candidatePoolForPrompt.sort(() => Math.random() - 0.5);
        }
        const trackList = candidatePoolForPrompt.slice(0, 50).map(t => `"${t.title}" by ${t.artist}`).join(', ');
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
      if (typeof t === 'object' && t.artist) seedArtists.add(getEffectiveArtist(t));
    });
    const relatedArtists = getRelatedArtists(seedArtists);

    const scoredPool = filteredPool.map(t => {
      let score = Math.random() * 20;
      const art = getEffectiveArtist(t);
      if (seedArtists.has(art)) {
        score += refresh ? 15 : 35;
      } else if (relatedArtists.has(art)) {
        score += refresh ? 35 : 20; // On refresh, boost similar artists over repeating seed artists!
      }
      if (refresh) {
        score += Math.random() * 30; // Exploration bonus
      }
      score += Math.min(15, Math.log10((Number(t.plays) || 0) + 1) * 4);
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
    const art = getEffectiveArtist(t);
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
      const art = getEffectiveArtist(t);
      const count = artistCounts.get(art) || 0;
      if (count < maxPerArtist + 1) {
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
