/**
 * User Taste Profile & Diverse Candidate Sampling Helpers
 * Strictly modularized (< 400 lines).
 */

const mongoose = require('mongoose');
const { Track, User } = require('../../models');
const { escapeRegex } = require('../../utils/helpers');
const { getPrimaryArtistNormalized, CANONICAL_ARTIST_MAP } = require('../../utils/artistAliases');
const { isMusicEligibleTrack, buildBaseQuery, isTrackEligibleForMode } = require('./aiHelpers');

const RELATED_ARTIST_CLUSTERS = [
  ['lege-cy', 'cairokee', 'wegz', 'marwan pablo', 'marwan moussa', 'abyusif', 'afroto', 'shabjdeed', 'ziad zaza', 'santa', 'abo el anwar', 'karim osama', 'mousa sam', 'shehab', 'flx', 'arsenic'],
  ['cairokee', 'amir eid', 'massar egbari', 'sharmoofers', 'hamza namira', 'aziz maraka', 'autostrad', 'jadal', 'disco misr'],
  ['amr diab', 'tamer hosny', 'mohamed hamaki', 'sherine', 'asala', 'elissa', 'nancy ajram', 'bahaa sultan', 'tamer ashoor', 'rami sabry', 'ahmed saad'],
  ['essam sasa', 'hamo bika', 'hassan shakosh', 'omar kamal', '3enba', 'double zuksh', 'houda bondok', 'reda el bahrawy', 'mahmoud el leithy', 'ahmed sheba']
];

const MOOD_GENRE_HINTS = {
  morning: ['Indie / Alternative', 'Arabic Pop', 'Pop', 'Jazz / Blues'],
  fresh: ['Indie / Alternative', 'Arabic Pop', 'Pop', 'Jazz / Blues'],
  afternoon: ['Lo-Fi', 'Classical', 'Soundtrack / Instrumental', 'Jazz / Blues', 'Indie / Alternative'],
  flow: ['Lo-Fi', 'R&B / Soul', 'Indie / Alternative', 'Arabic Pop'],
  focus: ['Lo-Fi', 'Classical', 'Soundtrack / Instrumental', 'Jazz / Blues'],
  study: ['Lo-Fi', 'Classical', 'Soundtrack / Instrumental'],
  evening: ['Rap / Hip-Hop', 'Mahraganat', 'EDM / Electronic', 'Shaabi', 'Pop'],
  hype: ['Rap / Hip-Hop', 'Mahraganat', 'EDM / Electronic', 'Shaabi'],
  workout: ['Rap / Hip-Hop', 'EDM / Electronic', 'Mahraganat', 'Rock', 'Metal'],
  party: ['Mahraganat', 'Shaabi', 'EDM / Electronic', 'Arabic Pop', 'Pop'],
  night: ['Tarab', 'Lo-Fi', 'R&B / Soul', 'Indie / Alternative', 'Arabic Pop'],
  chill: ['Lo-Fi', 'R&B / Soul', 'Indie / Alternative', 'Tarab', 'Jazz / Blues'],
  sad: ['Tarab', 'Arabic Pop', 'R&B / Soul', 'Indie / Alternative'],
  melancholy: ['Tarab', 'Arabic Pop', 'Indie / Alternative', 'Lo-Fi'],
  tarab: ['Tarab', 'Arabic Pop', 'Khaleeji'],
  shaabi: ['Shaabi', 'Mahraganat', 'Arabic Pop'],
  rap: ['Rap / Hip-Hop', 'Mahraganat', 'R&B / Soul']
};

const NON_MUSIC_GENRE_RE = /^(?:Holy\s*)?Quran$|^Podcast$|^Audiobook$/i;

function getEffectiveArtist(track) {
  if (!track) return 'unknown';
  const normArt = getPrimaryArtistNormalized(track.artist || '');
  const generic = new Set(['zk studios', 'dark side', 'sherif', 'official', 'records', 'music', 'unknown']);
  if (generic.has(normArt) || !normArt || normArt === 'unknown') {
    const title = String(track.title || '').toLowerCase();
    for (const [alias, canonical] of Object.entries(CANONICAL_ARTIST_MAP)) {
      if (title.includes(alias)) return canonical;
    }
  }
  return normArt;
}

function getRelatedArtists(artists) {
  const related = new Set();
  for (const art of artists) {
    for (const cluster of RELATED_ARTIST_CLUSTERS) {
      if (cluster.includes(art)) cluster.forEach((a) => { if (a !== art) related.add(a); });
    }
  }
  return related;
}

function resolveEffectiveMood(mood = '', timeOfDay = '') {
  const raw = String(mood || timeOfDay || '').trim().toLowerCase();
  if (raw && MOOD_GENRE_HINTS[raw]) return raw;
  for (const key of Object.keys(MOOD_GENRE_HINTS)) {
    if (raw && raw.includes(key)) return key;
  }
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 23) return 'evening';
  return 'night';
}

function addArtistWeight(map, rawArtist, weight) {
  const norm = getPrimaryArtistNormalized(rawArtist);
  if (norm && norm !== 'unknown') map.set(norm, (map.get(norm) || 0) + weight);
}

function buildGuestTasteProfile(hints = {}) {
  const followedArtists = Array.isArray(hints.followedArtists)
    ? hints.followedArtists.map((a) => String(a).trim()).filter(Boolean)
    : [];
  const topArtistWeights = new Map();
  followedArtists.forEach((a) => addArtistWeight(topArtistWeights, a, 25));
  return {
    userId: null,
    likedTrackIds: [],
    likedTrackIdSet: new Set(),
    playlistTrackIdSet: new Set(),
    followedArtists,
    followedArtistSet: new Set(followedArtists.map((a) => getPrimaryArtistNormalized(a)).filter((a) => a && a !== 'unknown')),
    topTrack: null,
    recentHistory: [],
    recentTrackIdSet: new Set(),
    topGenres: {},
    topGenresRanked: [],
    topArtistWeights,
    topArtists: [...topArtistWeights.keys()],
    contentModes: { music: true, quran: true, podcasts: true, audiobooks: true },
    language: 'ar',
    summaryText: followedArtists.length ? `Followed artists: ${followedArtists.slice(0, 6).join(', ')}` : ''
  };
}

async function fetchUserTasteProfile(userId, clientHints = {}) {
  const guest = buildGuestTasteProfile(clientHints);
  if (!userId || !mongoose.isValidObjectId(userId)) return guest;

  const user = await User.findById(userId)
    .select('likedTrackIds playlists following topTrack recentHistory topGenres preferences trackStats')
    .lean();
  if (!user) return guest;

  const likedTrackIds = (user.likedTrackIds || []).map(String);
  const likedTrackIdSet = new Set(likedTrackIds);
  const playlistTrackIds = [];
  for (const pl of (user.playlists || [])) {
    if (pl && !pl.isQuran && Array.isArray(pl.trackIds)) {
      pl.trackIds.forEach((tid) => { if (tid) playlistTrackIds.push(String(tid)); });
    }
  }

  const sampleObjectIds = [...new Set([...likedTrackIds.slice(-35), ...playlistTrackIds.slice(0, 35)])]
    .filter((id) => mongoose.isValidObjectId(id)).slice(0, 50).map((id) => new mongoose.Types.ObjectId(id));
  const followingIds = (user.following || []).map(String).filter((id) => mongoose.isValidObjectId(id)).slice(0, 25);

  const [tasteTracks, followedUsers] = await Promise.all([
    sampleObjectIds.length > 0
      ? Track.find({ _id: { $in: sampleObjectIds } }).select('title artist genre isQuran isPodcast contentType').lean()
      : Promise.resolve([]),
    followingIds.length > 0
      ? User.find({ _id: { $in: followingIds } }).select('name topTrack').lean()
      : Promise.resolve([])
  ]);

  const topArtistWeights = new Map(guest.topArtistWeights);
  const genreTotals = {};
  if (user.topGenres && typeof user.topGenres === 'object') {
    for (const [g, secs] of Object.entries(user.topGenres)) {
      if (g && Number(secs) > 0) genreTotals[g] = Number(secs);
    }
  }

  const recentHistory = Array.isArray(user.recentHistory) ? user.recentHistory.slice(0, 40) : [];
  const recentTrackIdSet = new Set();
  recentHistory.forEach((item, idx) => {
    if (!item) return;
    if (item.trackId) recentTrackIdSet.add(String(item.trackId));
    const w = Math.max(4, 24 - idx);
    if (item.artist) addArtistWeight(topArtistWeights, item.artist, w);
    if (item.genre && !NON_MUSIC_GENRE_RE.test(item.genre)) {
      genreTotals[item.genre] = (genreTotals[item.genre] || 0) + w * 5;
    }
  });

  for (const t of tasteTracks) {
    if (!isMusicEligibleTrack(t)) continue;
    const isLiked = likedTrackIdSet.has(String(t._id));
    addArtistWeight(topArtistWeights, t.artist, isLiked ? 16 : 8);
    if (t.genre) genreTotals[t.genre] = (genreTotals[t.genre] || 0) + (isLiked ? 90 : 45);
  }

  if (user.topTrack?.artist) addArtistWeight(topArtistWeights, user.topTrack.artist, 28);
  if (user.trackStats && typeof user.trackStats === 'object') {
    for (const st of Object.values(user.trackStats)) {
      if (st?.artist) {
        const w = Math.min(24, Math.floor((Number(st.seconds) || 0) / 45) + (Number(st.plays) || 0) * 4);
        if (w > 0) addArtistWeight(topArtistWeights, st.artist, w);
      }
    }
  }
  for (const fu of followedUsers) {
    if (fu?.topTrack?.artist) addArtistWeight(topArtistWeights, fu.topTrack.artist, 10);
  }

  const topGenresRanked = Object.entries(genreTotals)
    .filter(([g]) => g && !NON_MUSIC_GENRE_RE.test(g))
    .map(([genre, seconds]) => ({ genre, seconds }))
    .sort((a, b) => b.seconds - a.seconds);

  const topArtists = [...topArtistWeights.entries()].sort((a, b) => b[1] - a[1]).map(([art]) => art).slice(0, 15);
  const summaryParts = [];
  if (topGenresRanked.length > 0) summaryParts.push(`Top genres: ${topGenresRanked.slice(0, 4).map((g) => g.genre).join(', ')}`);
  if (topArtists.length > 0) summaryParts.push(`Favorite artists: ${topArtists.slice(0, 6).join(', ')}`);
  if (recentHistory.length > 0) summaryParts.push(`Recent plays: ${recentHistory.slice(0, 5).map((r) => `${r.title} - ${r.artist}`).join('; ')}`);

  return {
    userId: String(user._id),
    likedTrackIds,
    likedTrackIdSet,
    playlistTrackIdSet: new Set(playlistTrackIds),
    followedArtists: guest.followedArtists,
    followedArtistSet: guest.followedArtistSet,
    topTrack: user.topTrack || null,
    recentHistory,
    recentTrackIdSet,
    topGenres: user.topGenres || {},
    topGenresRanked,
    topArtistWeights,
    topArtists,
    contentModes: user.preferences?.contentModes || guest.contentModes,
    language: user.preferences?.language || 'ar',
    summaryText: summaryParts.join(' | ')
  };
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function fetchDiverseCandidatePool({
  mode = 'music',
  userTaste = null,
  seedTracks = [],
  currentTrack = null,
  mood = '',
  excludeIds = new Set(),
  refresh = false
}) {
  const baseQuery = buildBaseQuery(mode);
  const topGenres = (userTaste?.topGenresRanked || []).slice(0, 4).map((g) => g.genre);
  const topArtists = (userTaste?.topArtists || []).slice(0, 8).filter((a) => a && a.length >= 2);

  const seedArtists = new Set();
  const seedGenres = new Set();
  if (currentTrack?.artist) seedArtists.add(getEffectiveArtist(currentTrack));
  if (currentTrack?.genre) seedGenres.add(currentTrack.genre);
  for (const s of (seedTracks || [])) {
    if (s && typeof s === 'object') {
      if (s.artist) seedArtists.add(getEffectiveArtist(s));
      if (s.genre) seedGenres.add(s.genre);
    }
  }
  const relatedArtists = getRelatedArtists(seedArtists);
  const moodGenres = mode === 'music' ? (MOOD_GENRE_HINTS[resolveEffectiveMood(mood)] || []) : [];

  const tasteOr = [];
  if (mode === 'music' && topGenres.length > 0) tasteOr.push({ genre: { $in: topGenres } });
  for (const art of topArtists) tasteOr.push({ artist: new RegExp(escapeRegex(art), 'i') });
  const tasteQuery = tasteOr.length > 0 ? { $and: [baseQuery, { $or: tasteOr }] } : baseQuery;

  const contextOr = [];
  const ctxGenres = [...new Set([...seedGenres, ...moodGenres])].filter(Boolean);
  if (mode === 'music' && ctxGenres.length > 0) contextOr.push({ genre: { $in: ctxGenres } });
  for (const art of [...seedArtists, ...relatedArtists].slice(0, 8)) {
    if (art && art !== 'unknown' && art.length >= 2) contextOr.push({ artist: new RegExp(escapeRegex(art), 'i') });
  }
  const contextQuery = contextOr.length > 0 ? { $and: [baseQuery, { $or: contextOr }] } : baseQuery;

  const sortOrder = refresh ? { createdAt: -1 } : { plays: -1 };
  const [tasteRaw, contextRaw, discoveryRaw] = await Promise.all([
    Track.find(tasteQuery, { lyrics: 0 }).sort(sortOrder).limit(80).lean().catch(() => []),
    Track.find(contextQuery, { lyrics: 0 }).sort(sortOrder).limit(70).lean().catch(() => []),
    Track.aggregate([{ $match: baseQuery }, { $sample: { size: 80 } }, { $project: { lyrics: 0 } }]).catch(() => [])
  ]);

  const seen = new Set();
  const candidates = [];
  const buckets = { taste: [], context: [], discovery: [] };

  const ingest = (list, bucketName) => {
    for (const t of list) {
      if (!t || !t._id) continue;
      const id = String(t._id);
      if (seen.has(id) || excludeIds.has(id) || !isTrackEligibleForMode(t, mode)) continue;
      seen.add(id);
      candidates.push(t);
      buckets[bucketName].push(t);
    }
  };

  ingest(tasteRaw, 'taste');
  ingest(contextRaw, 'context');
  ingest(discoveryRaw, 'discovery');
  return { candidates, buckets, seedArtists, relatedArtists, seedGenres };
}

function selectAiPromptCandidates(buckets, allCandidates, limit = 60) {
  const picked = [];
  const seen = new Set();
  const addSlice = (arr, max) => {
    for (const t of shuffleArray(arr)) {
      if (picked.length >= limit || max <= 0) break;
      const id = String(t._id || t.id);
      if (seen.has(id)) continue;
      seen.add(id);
      picked.push(t);
      max--;
    }
  };
  addSlice(buckets?.taste || [], 24);
  addSlice(buckets?.context || [], 20);
  addSlice(buckets?.discovery || [], 16);
  addSlice(allCandidates || [], limit - picked.length);
  return shuffleArray(picked);
}

function scoreTrackPersonalized(track, {
  userTaste = null,
  seedArtists = new Set(),
  relatedArtists = new Set(),
  seedGenres = new Set(),
  mood = '',
  preferFamiliar = false,
  penalizeRecent = true,
  refresh = false
} = {}) {
  const tId = String(track._id || track.id || '');
  const effArt = getEffectiveArtist(track);
  const tGenre = String(track.genre || '').trim();
  const moodKey = mood ? resolveEffectiveMood(mood) : '';
  const moodGenres = moodKey ? (MOOD_GENRE_HINTS[moodKey] || []) : [];
  let score = Math.random() * (refresh ? 20 : 10);

  if (userTaste) {
    const genreRankIdx = (userTaste.topGenresRanked || []).findIndex((g) => g.genre.toLowerCase() === tGenre.toLowerCase());
    if (genreRankIdx !== -1) score += Math.max(12, 36 - genreRankIdx * 6);
    const artWeight = userTaste.topArtistWeights?.get(effArt) || 0;
    if (artWeight > 0) score += Math.min(38, 10 + Math.log2(artWeight + 1) * 5);
    if (userTaste.followedArtistSet?.has(effArt)) score += 28;
    if (userTaste.likedTrackIdSet?.has(tId)) score += preferFamiliar ? 18 : 8;
    if (penalizeRecent && userTaste.recentTrackIdSet?.has(tId)) score -= 22;
  }

  if (seedArtists.has(effArt)) score += refresh ? 14 : 28;
  else if (relatedArtists.has(effArt)) score += refresh ? 30 : 22;
  if (seedGenres.has(tGenre)) score += 20;
  if (moodGenres.includes(tGenre)) score += 22;
  score += Math.min(10, Math.log10((Number(track.plays) || 0) + 1) * 3);
  return score;
}

module.exports = {
  RELATED_ARTIST_CLUSTERS,
  MOOD_GENRE_HINTS,
  getEffectiveArtist,
  getRelatedArtists,
  resolveEffectiveMood,
  isTrackEligibleForMode,
  fetchUserTasteProfile,
  buildGuestTasteProfile,
  fetchDiverseCandidatePool,
  selectAiPromptCandidates,
  scoreTrackPersonalized
};
