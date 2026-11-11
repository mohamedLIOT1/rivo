/**
 * Recommendation, Smart Shuffle & Personalized Mix Curators
 * Strictly modularized (< 400 lines).
 */

const { generateAiJson, isQuranTrack, isPodcastOrAudiobookTrack } = require('./aiHelpers');
const {
  getEffectiveArtist,
  getRelatedArtists,
  resolveEffectiveMood,
  isTrackEligibleForMode,
  fetchDiverseCandidatePool,
  selectAiPromptCandidates,
  scoreTrackPersonalized
} = require('./userTasteHelper');

function buildExcludedIdSet(trackIds = [], rawSeeds = [], excludeTrackIds = []) {
  const excluded = new Set();
  for (const id of (trackIds || [])) {
    if (id) excluded.add(String(id));
  }
  for (const s of (rawSeeds || [])) {
    if (s && typeof s === 'object' && (s.id || s._id)) {
      excluded.add(String(s.id || s._id));
    }
  }
  for (const id of (excludeTrackIds || [])) {
    if (id) excluded.add(String(id));
  }
  return excluded;
}

function capTracksByArtist(tracks, limit = 10, maxPerArtist = 2, preSeededCounts = new Map()) {
  const selected = [];
  const seenIds = new Set();
  const artistCounts = new Map(preSeededCounts);

  const runPass = (cap) => {
    for (const t of tracks) {
      if (!t || selected.length >= limit) break;
      const tId = String(t._id || t.id);
      if (seenIds.has(tId)) continue;
      const art = getEffectiveArtist(t);
      const count = artistCounts.get(art) || 0;
      if (count < cap) {
        selected.push(t);
        seenIds.add(tId);
        artistCounts.set(art, count + 1);
      }
    }
  };

  runPass(maxPerArtist);
  if (selected.length < limit) runPass(maxPerArtist + 1);
  return selected;
}

function matchAiTitlesToPool(suggested, pool) {
  if (!Array.isArray(suggested) || suggested.length === 0) return [];
  const matched = [];
  const seen = new Set();
  for (const item of suggested) {
    const rawTitle = typeof item === 'object' && item !== null ? (item.title || item.name || '') : String(item || '');
    const cleanTarget = rawTitle.toLowerCase().trim();
    if (!cleanTarget) continue;
    const found = pool.find((t) => {
      const id = String(t._id || t.id);
      if (seen.has(id)) return false;
      const tTitle = String(t.title || '').toLowerCase().trim();
      return tTitle === cleanTarget ||
        (tTitle.length >= 4 && cleanTarget.includes(tTitle.slice(0, 8))) ||
        (cleanTarget.length >= 4 && tTitle.includes(cleanTarget.slice(0, 8)));
    });
    if (found) {
      seen.add(String(found._id || found.id));
      matched.push(found);
    }
  }
  return matched;
}

function buildSeedContext(rawSeeds = []) {
  const seedArtists = new Set();
  const seedGenres = new Set();
  for (const t of rawSeeds) {
    if (t && typeof t === 'object') {
      if (t.artist) seedArtists.add(getEffectiveArtist(t));
      if (t.genre) seedGenres.add(String(t.genre).trim());
    }
  }
  return { seedArtists, relatedArtists: getRelatedArtists(seedArtists), seedGenres };
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
  refresh = false,
  userTaste = null,
  signal = null
}) {
  const mode = isQuran ? 'quran' : 'music';
  const rawSeeds = (recentTracks && recentTracks.length > 0) ? recentTracks : seedTracks;
  const normalizedSeeds = rawSeeds
    .map((t) => (typeof t === 'string' ? t : `${t.title || ''} ${t.artist || ''}`.trim()))
    .filter(Boolean);
  const excludedIds = buildExcludedIdSet(trackIds, rawSeeds, excludeTrackIds);

  let pool = [];
  let buckets = null;
  let seedCtx = buildSeedContext(rawSeeds);

  if (Array.isArray(availableTracks) && availableTracks.length > 0) {
    pool = availableTracks.filter((t) => !excludedIds.has(String(t._id || t.id)) && isTrackEligibleForMode(t, mode));
  } else {
    const diverse = await fetchDiverseCandidatePool({
      mode,
      userTaste,
      seedTracks: rawSeeds,
      mood: mood || timeOfDay || '',
      excludeIds: excludedIds,
      refresh
    });
    pool = diverse.candidates;
    buckets = diverse.buckets;
    seedCtx = {
      seedArtists: diverse.seedArtists,
      relatedArtists: diverse.relatedArtists,
      seedGenres: diverse.seedGenres
    };
  }

  if (pool.length === 0) return [];

  const promptPool = buckets
    ? selectAiPromptCandidates(buckets, pool, 60)
    : [...pool].sort(() => Math.random() - 0.5).slice(0, 60);

  const trackList = promptPool
    .map((t) => `"${t.title}" by ${t.artist}${t.genre ? ` [${t.genre}]` : ''}`)
    .join(', ');
  const tasteLine = userTaste?.summaryText ? `User taste profile: ${userTaste.summaryText}.` : '';
  const prompt = `You are an expert ${isQuran ? 'Quran recitation' : 'music'} curator.
Available catalog: ${trackList}
Context: ${isQuran ? 'Quran Recitations' : 'Music Playlist'}, Name: "${effectiveName || 'My Playlist'}", Mood: ${mood || 'balanced'}, Time: ${timeOfDay || 'any'}, Seeds: ${normalizedSeeds.slice(0, 5).join(', ') || 'none'}.
${tasteLine}
Select the 10 best matching tracks from the available catalog that match the playlist vibe AND the user's personal listening taste.
Return ONLY a valid JSON array of track titles exactly as written. No markdown, no explanation.`;

  const suggested = await generateAiJson(prompt, { signal, maxTokens: 500 });
  const matched = matchAiTitlesToPool(suggested, pool);
  if (matched.length > 0) {
    return capTracksByArtist(matched, 10, 2);
  }

  const scored = pool.map((t) => ({
    track: t,
    score: scoreTrackPersonalized(t, {
      userTaste,
      seedArtists: seedCtx.seedArtists,
      relatedArtists: seedCtx.relatedArtists,
      seedGenres: seedCtx.seedGenres,
      mood: mood || timeOfDay || '',
      preferFamiliar: false,
      penalizeRecent: true,
      refresh
    })
  }));
  scored.sort((a, b) => b.score - a.score);
  return capTracksByArtist(scored.map((s) => s.track), 10, 2);
}

async function getSmartShuffleTracks({
  currentTrack,
  seedTracks = [],
  followedArtists = [],
  userTaste = null,
  limit = 8,
  signal = null
}) {
  const isCurQuran = isQuranTrack(currentTrack);
  const isCurPodcast = !isCurQuran && isPodcastOrAudiobookTrack(currentTrack);
  const mode = isCurQuran ? 'quran' : (isCurPodcast ? 'podcast' : 'music');
  const safeLimit = Math.max(1, Math.min(25, Number(limit) || 8));

  const excludeIds = buildExcludedIdSet([], [currentTrack, ...(seedTracks || [])], []);
  const { candidates, buckets, seedArtists, relatedArtists, seedGenres } = await fetchDiverseCandidatePool({
    mode,
    userTaste,
    seedTracks,
    currentTrack,
    excludeIds,
    refresh: true
  });

  if (candidates.length === 0) return [];

  const curArtistNorm = currentTrack ? getEffectiveArtist(currentTrack) : '';
  const preSeeded = new Map();
  if (curArtistNorm && curArtistNorm !== 'unknown') preSeeded.set(curArtistNorm, 1);

  if (candidates.length >= Math.min(3, safeLimit)) {
    const sampleList = selectAiPromptCandidates(buckets, candidates, 55)
      .map((t) => `"${t.title}" by ${t.artist}${t.genre ? ` [${t.genre}]` : ''}`)
      .join(', ');
    const seedStr = currentTrack ? `"${currentTrack.title}" by ${currentTrack.artist}` : 'General mix';
    const tasteLine = userTaste?.summaryText ? `Listener profile: ${userTaste.summaryText}.` : '';
    const prompt = `You are an expert streaming radio DJ. The listener is currently playing: ${seedStr}.
${tasteLine}
Candidate tracks: ${sampleList}.
Select ${safeLimit} tracks from the candidates that flow best sonically after the current track while matching the listener's taste.
Return ONLY a valid JSON array of track titles exactly as written. No markdown, no explanation.`;

    const aiTitles = await generateAiJson(prompt, { signal, maxTokens: 450 });
    const matched = matchAiTitlesToPool(aiTitles, candidates);
    if (matched.length >= Math.min(3, safeLimit)) {
      return capTracksByArtist(matched, safeLimit, 2, preSeeded);
    }
  }

  const extraFollowed = new Set((followedArtists || []).map((a) => String(a).toLowerCase().trim()).filter(Boolean));
  const scored = candidates.map((t) => {
    let score = scoreTrackPersonalized(t, {
      userTaste,
      seedArtists,
      relatedArtists,
      seedGenres,
      preferFamiliar: false,
      penalizeRecent: true,
      refresh: true
    });
    const effArt = getEffectiveArtist(t);
    if (extraFollowed.has(effArt)) score += 30;
    return { track: t, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return capTracksByArtist(scored.map((s) => s.track), safeLimit, 2, preSeeded);
}

async function getPersonalizedMoodMix({
  mood = '',
  timeOfDay = '',
  userTaste = null,
  seedTracks = [],
  excludeTrackIds = [],
  isQuran = false,
  limit = 15,
  refresh = true,
  signal = null
}) {
  const mode = isQuran ? 'quran' : 'music';
  const effectiveMood = resolveEffectiveMood(mood, timeOfDay);
  const safeLimit = Math.max(1, Math.min(30, Number(limit) || 15));
  const excludeIds = buildExcludedIdSet([], seedTracks, excludeTrackIds);

  const { candidates, buckets, seedArtists, relatedArtists, seedGenres } = await fetchDiverseCandidatePool({
    mode,
    userTaste,
    seedTracks,
    mood: effectiveMood,
    excludeIds,
    refresh
  });
  if (candidates.length === 0) return { mood: effectiveMood, tracks: [] };

  const sampleList = selectAiPromptCandidates(buckets, candidates, 60)
    .map((t) => `"${t.title}" by ${t.artist}${t.genre ? ` [${t.genre}]` : ''}`)
    .join(', ');
  const tasteLine = userTaste?.summaryText ? `User taste: ${userTaste.summaryText}.` : '';
  const prompt = `You are a personalized mood mix DJ. Build a "${effectiveMood}" ${isQuran ? 'Quran recitation' : 'music'} mix for this user.
${tasteLine}
Candidate pool: ${sampleList}.
Select ${safeLimit} tracks from the candidate pool that fit the "${effectiveMood}" mood AND match the user's personal genres/artists.
Return ONLY a valid JSON array of track titles exactly as written.`;

  const aiTitles = await generateAiJson(prompt, { signal, maxTokens: 550 });
  const matched = matchAiTitlesToPool(aiTitles, candidates);
  if (matched.length >= Math.min(5, safeLimit)) {
    return { mood: effectiveMood, tracks: capTracksByArtist(matched, safeLimit, 2) };
  }

  const scored = candidates.map((t) => ({
    track: t,
    score: scoreTrackPersonalized(t, {
      userTaste,
      seedArtists,
      relatedArtists,
      seedGenres,
      mood: effectiveMood,
      preferFamiliar: true,
      penalizeRecent: false,
      refresh
    })
  }));
  scored.sort((a, b) => b.score - a.score);
  return { mood: effectiveMood, tracks: capTracksByArtist(scored.map((s) => s.track), safeLimit, 2) };
}

async function getPersonalizedQuickMix({
  userTaste = null,
  seedTracks = [],
  currentTrack = null,
  excludeTrackIds = [],
  isQuran = false,
  limit = 12,
  refresh = true,
  signal = null
}) {
  const mode = isQuran ? 'quran' : 'music';
  const safeLimit = Math.max(1, Math.min(30, Number(limit) || 12));
  const excludeIds = buildExcludedIdSet([], [currentTrack, ...(seedTracks || [])], excludeTrackIds);

  const { candidates, buckets, seedArtists, relatedArtists, seedGenres } = await fetchDiverseCandidatePool({
    mode,
    userTaste,
    seedTracks,
    currentTrack,
    excludeIds,
    refresh
  });
  if (candidates.length === 0) return [];

  const sampleList = selectAiPromptCandidates(buckets, candidates, 60)
    .map((t) => `"${t.title}" by ${t.artist}${t.genre ? ` [${t.genre}]` : ''}`)
    .join(', ');
  const tasteLine = userTaste?.summaryText ? `User listening profile: ${userTaste.summaryText}.` : 'User has no history yet, build a vibrant discovery mix.';
  const prompt = `You are a Spotify-style personalized mix generator creating a Quick Mix (${safeLimit} tracks).
${tasteLine}
Available tracks: ${sampleList}.
Blend familiar favorites from the user's genres/artists with complementary discovery picks.
Return ONLY a valid JSON array of ${safeLimit} track titles exactly as written.`;

  const aiTitles = await generateAiJson(prompt, { signal, maxTokens: 500 });
  const matched = matchAiTitlesToPool(aiTitles, candidates);
  if (matched.length >= Math.min(4, safeLimit)) {
    return capTracksByArtist(matched, safeLimit, 2);
  }

  const scored = candidates.map((t) => ({
    track: t,
    score: scoreTrackPersonalized(t, {
      userTaste,
      seedArtists,
      relatedArtists,
      seedGenres,
      preferFamiliar: true,
      penalizeRecent: false,
      refresh
    })
  }));
  scored.sort((a, b) => b.score - a.score);
  return capTracksByArtist(scored.map((s) => s.track), safeLimit, 2);
}

module.exports = {
  getCuratedRecommendations,
  getSmartShuffleTracks,
  getPersonalizedMoodMix,
  getPersonalizedQuickMix
};
