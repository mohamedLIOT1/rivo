/** Rivo Native Smart Taste & Mood Engine */
import { classifyGenre } from './genreClassifier';
import { resolveCanonicalArtist } from './artistAliases';

export const GENRE_MAP = {
  'Holy Quran': { keywords: ['قرآن', 'سورة', 'مصحف', 'تلاوة', 'تراويح', 'quran', 'surah', 'abdulbasit', 'al-afasy', 'minshawi', 'al-sudais', 'maher al-muaiqly'], artists: ['مشاري العفاسي', 'عبد الباسط عبد الصمد', 'المنشاوي', 'ماهر المعيقلي', 'سعد الغامدي', 'ياسر الدوسري', 'محمود خليل الحصري', 'احمد العجمي', 'ناصر القطامي'] },
  'Mahraganat': { keywords: ['مهرجان', 'مهرجانات', 'شعبي', 'شعبيات', 'مولد', 'سرسجي', 'دبكة', 'mahragan', 'shaabi'], artists: ['عصام صاصا', 'essam sasa', 'مسلم', 'muslim', 'حمو بيكا', 'hamo bika', 'حسن شاكوش', 'hassan shakosh', 'عمر كمال', 'omar kamal', 'رضا البحراوي', 'reda el bahrawy', 'محمود الليثي', 'mahmoud el leithy', 'طارق الشيخ', 'tarek el sheikh', 'احمد شيبة', 'ahmed sheba', 'عنبة', '3enba', 'عنبه', 'دبل زوكش', 'double zuksh', 'شواحة', 'المدفعجية', 'فيجو الدخلاوي', 'حودة بندق', 'houda bondok', 'سيف مجدي', 'اسلام كابونجا', 'سامر المدني', 'فيلو', 'شحتة كاريكا'] },
  'Rap / Hip-Hop': { keywords: ['راب', 'تراب', 'دريل', 'فري ستايل', 'ديس', 'سين', 'rap', 'trap', 'drill', 'hip-hop', 'hiphop', 'freestyle', 'diss'], artists: ['ويجز', 'wegz', 'مروان بابلو', 'marwan pablo', 'مروان موسى', 'marwan moussa', 'عفروتو', 'afroto', 'شب جديد', 'shabjdeed', 'ابو الانوار', 'abo el anwar', 'سانتا', 'كريم اسامة', 'karim osama', 'موسى سام', 'mousa sam', 'شهاب', 'shehab', 'فليكس', 'flx', 'زياد ظاظا', 'ziad zaza', 'مهاب', 'mohab', 'ارسينك', 'arsenic', 'الجوكر', 'el joker', 'ابيوسف', 'abyusif', 'شاهين', 'shaheen', 'باتستوتا', 'احمد سانتا', 'الضبع', 'ليجي', 'lege-cy', 'lege cy', 'drake', 'travis scott', 'kendrick lamar', 'eminem', 'kanye', 'j. cole', 'future', 'metro boomin', '21 savage'] },
  'Classic / Tarab': { keywords: ['طرب', 'كلاسيك', 'تراث', 'موشح', 'سلطنة', 'tarab', 'classic'], artists: ['أم كلثوم', 'ام كلثوم', 'om kalthoum', 'um kalthoum', 'عبد الحليم حافظ', 'عبد الحليم', 'abdel halim', 'فيروز', 'fairouz', 'fayrouz', 'وردة', 'وردة الجزائرية', 'warda', 'نجاة الصغيرة', 'نجاة', 'محمد عبد الوهاب', 'mohamed abdel wahab', 'سيد درويش', 'طلال مداح', 'صباح فخري', 'صباح', 'فريد الأطرش', 'farid el atrache', 'اسمهان', 'وديع الصافي', 'جورج وسوف', 'george wassouf', 'ميادة الحناوي'] },
  'Indie / Alternative': { keywords: ['إندي', 'اندي', 'بديل', 'أندرجراوند', 'اندرجراوند', 'روك', 'indie', 'alternative', 'underground', 'acoustic', 'rock'], artists: ['كايروكي', 'cairokee', 'مسار إجباري', 'مسار اجباري', 'massar egbari', 'شارموفرز', 'sharmoofers', 'حمزة نمرة', 'حمزه نمره', 'hamza namira', 'امير عيد', 'amir eid', 'أوتوستراد', 'autostrad', 'جدل', 'jadal', 'مشروع ليلى', 'mashrou leila', 'المربع', 'el morabba3', 'عزيز مرقة', 'aziz maraka', 'ديسكو مصر', 'disco misr', 'اخر زفير', 'akher zapheer', 'هوس', 'أدونيس', 'adonis', 'تامر نفار', 'فلكلور'] },
  'Arabic Pop': { keywords: ['بوب عربي', 'رومانسي', 'دراما', 'صيف', 'arabic pop'], artists: ['عمرو دياب', 'amr diab', 'تامر حسني', 'tamer hosny', 'محمد حماقي', 'حماقي', 'mohamed hamaki', 'شيرين', 'sherine', 'شرين', 'أصالة', 'اصالة', 'asala', 'اليسا', 'elissa', 'نانسي عجرم', 'nancy ajram', 'بهاء سلطان', 'bahaa sultan', 'تامر عاشور', 'tamer ashoor', 'رامي صبري', 'rami sabry', 'فضل شاكر', 'fadel shaker', 'احمد سعد', 'ahmed saad', 'حسين الجسمي', 'hussain al jassmi', 'أنغام', 'angham', 'وائل كفوري', 'wael kfoury', 'راغب علامة', 'ragheb alama', 'نوال الزغبي', 'كارول سماحة', 'بلقيس', 'سعد لمجرد', 'saad lamjarred', 'صابر الرباعي', 'محمد فؤاد', 'مصطفى قمر', 'هشام عباس', 'إيهاب توفيق', 'ehab tawfik', 'ساندي'] },
  'Khaleeji': { keywords: ['شيلات', 'شيلة', 'خليجي', 'جلسة', 'سامري', 'khaleeji'], artists: ['محمد عبده', 'راشد الماجد', 'عبد المجيد عبد الله', 'ماجد المهندس', 'نبيل شعيل', 'رابح صقر', 'احلام', 'فؤاد عبد الواحد'] },
  'R&B / Soul': { keywords: ['r&b', 'soul', 'neo-soul'], artists: ['the weeknd', 'sza', 'frank ocean', 'brent faiyaz', 'daniel caesar', 'bryson tiller'] },
  'Electronic': { keywords: ['edm', 'electronic', 'remix', 'house', 'techno', 'dance', 'club', 'ريمكس', 'مكس', 'توزيع جديد'], artists: ['marshmello', 'david guetta', 'calvin harris', 'avicii', 'tiesto', 'alan walker'] },
  'Bollywood / Indian': { keywords: ['bollywood', 'hindi', 'punjabi', 'desi', 'bhangra', 'filmi', 'بوليوود', 'هندي'], artists: ['arijit singh', 'neha kakkar', 'badshah', 'shreya ghoshal', 'diljit dosanjh', 'lata mangeshkar', 'kishore kumar', 'alka yagnik', 'sonu nigam', 'kumar sanu', 'udit narayan', 'a r rahman', 'pritam', 'jubin nautiyal'] },
};

export const INDIC_SCRIPT_REGEX = /[\u0900-\u0D7F]/;
export const ARABIC_SCRIPT_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function hasIndicScript(text) {
  return Boolean(text && typeof text === 'string' && INDIC_SCRIPT_REGEX.test(text));
}

export function hasArabicScript(text) {
  return Boolean(text && typeof text === 'string' && ARABIC_SCRIPT_REGEX.test(text));
}

export const INDIC_ARTISTS = new Set([
  'arijit singh', 'neha kakkar', 'badshah', 'shreya ghoshal', 'diljit dosanjh', 'lata mangeshkar', 'kishore kumar', 'alka yagnik', 'sonu nigam', 'kumar sanu',
  'udit narayan', 'a r rahman', 'ar rahman', 'pritam', 'jubin nautiyal', 'atif aslam', 'rahat fateh ali khan', 'sidhu moose wala', 'karan aujla', 'yo yo honey singh',
  'honey singh', 'armaan malik', 'darshan raval', 'anuv jain', 'vishal mishra', 'mc stan', 'king', 'guru randhawa', 'sunidhi chauhan', 'mohit chauhan', 'arijit', 'neha',
  'mohammed rafi', 'asha bhosle', 'jasleen royal', 'b praak', 'ap dhillon', 'anirudh ravichander', 'devi sri prasad', 'sid sriram', 'harrdy sandhu', 'mika singh',
  'kanika kapoor', 'shaan', 'kk', 'alisha chinai', 'monali thakur', 'shankar mahadevan', 'javed ali', 'pankaj udhas', 'jagjit singh', 'hariharan', 'kavita krishnamurthy',
  'أريجيت سينغ', 'نيها كاكار', 'بادشاه'
]);

export function isIndicTrack(track) {
  if (!track) return false;
  const title = (track.title || '').toLowerCase();
  const artist = (track.artist || '').toLowerCase();
  const album = (track.album || '').toLowerCase();
  const genre = (track.genre || '').toLowerCase();
  const text = `${title} ${artist} ${album} ${genre}`;

  if (hasIndicScript(text)) return true;
  if (/bollywood|hindi|indic|desi|punjabi|tollywood|kollywood|bhangra|filmi/.test(genre)) return true;

  const normArt = getPrimaryArtistNormalized(artist);
  if (normArt && INDIC_ARTISTS.has(normArt)) return true;
  for (const art of INDIC_ARTISTS) {
    if (artist.includes(art) || normArt.includes(art)) return true;
  }

  if (/(?:^|\s|[_\-–—])(bollywood|hindi|punjabi|desi|bhangra|filmi|tollywood|kollywood|qawwali|ghazal)(?:$|\s|[_\-–—])/i.test(text)) return true;
  if (/بوليوود|هندي|بنجابي|أوردو/.test(text)) return true;

  return false;
}

export const GENRE_COMPATIBILITY = {
  'Holy Quran': { compatible: ['Holy Quran'], incompatible: ['Mahraganat', 'Rap / Hip-Hop', 'Classic / Tarab', 'Indie / Alternative', 'Arabic Pop', 'Khaleeji', 'R&B / Soul', 'Electronic', 'Pop', 'Rock', 'Metal', 'Bollywood / Indian', 'Podcast'] },
  'Rap / Hip-Hop': { compatible: ['Rap / Hip-Hop', 'Mahraganat', 'R&B / Soul', 'Electronic', 'Pop'], incompatible: ['Holy Quran', 'Classic / Tarab', 'Classical', 'Bollywood / Indian', 'Podcast'] },
  'Mahraganat': { compatible: ['Mahraganat', 'Rap / Hip-Hop', 'Arabic Pop', 'Electronic', 'Pop'], incompatible: ['Holy Quran', 'Classic / Tarab', 'Classical', 'Jazz', 'Rock', 'Metal', 'Bollywood / Indian', 'Podcast'] },
  'Arabic Pop': { compatible: ['Arabic Pop', 'Indie / Alternative', 'Khaleeji', 'Classic / Tarab', 'Pop', 'Mahraganat', 'R&B / Soul'], incompatible: ['Holy Quran', 'Metal', 'Rock', 'Bollywood / Indian', 'Podcast'] },
  'Classic / Tarab': { compatible: ['Classic / Tarab', 'Arabic Pop', 'Khaleeji', 'Classical'], incompatible: ['Holy Quran', 'Rap / Hip-Hop', 'Mahraganat', 'Metal', 'Electronic', 'Bollywood / Indian', 'Podcast'] },
  'Khaleeji': { compatible: ['Khaleeji', 'Arabic Pop', 'Classic / Tarab', 'Pop'], incompatible: ['Holy Quran', 'Metal', 'Rock', 'Rap / Hip-Hop', 'Bollywood / Indian', 'Podcast'] },
  'Indie / Alternative': { compatible: ['Indie / Alternative', 'Arabic Pop', 'Pop', 'Rock', 'R&B / Soul', 'Lofi'], incompatible: ['Holy Quran', 'Mahraganat', 'Metal', 'Bollywood / Indian', 'Podcast'] },
  'R&B / Soul': { compatible: ['R&B / Soul', 'Rap / Hip-Hop', 'Pop', 'Indie / Alternative', 'Electronic', 'Arabic Pop'], incompatible: ['Holy Quran', 'Classic / Tarab', 'Classical', 'Metal', 'Bollywood / Indian', 'Podcast'] },
  'Electronic': { compatible: ['Electronic', 'Rap / Hip-Hop', 'Pop', 'R&B / Soul', 'Mahraganat'], incompatible: ['Holy Quran', 'Classic / Tarab', 'Classical', 'Bollywood / Indian', 'Podcast'] },
  'Pop': { compatible: ['Pop', 'Arabic Pop', 'Indie / Alternative', 'R&B / Soul', 'Electronic', 'Rap / Hip-Hop'], incompatible: ['Holy Quran', 'Metal', 'Classical', 'Podcast'] },
  'Bollywood / Indian': { compatible: ['Bollywood / Indian', 'Pop'], incompatible: ['Holy Quran', 'Classic / Tarab', 'Khaleeji', 'Mahraganat', 'Rap / Hip-Hop', 'Arabic Pop', 'Rock', 'Metal'] },
  'Podcast': { compatible: ['Podcast'], incompatible: ['Holy Quran', 'Mahraganat', 'Rap / Hip-Hop', 'Classic / Tarab', 'Indie / Alternative', 'Arabic Pop', 'Khaleeji', 'R&B / Soul', 'Electronic', 'Pop', 'Rock', 'Metal', 'Bollywood / Indian'] },
};

export function normalizeString(str) {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase().replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '').replace(/[\-_|–—:]/g, ' ').replace(/[^a-zA-Z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]/g, '').replace(/\s+/g, ' ').trim();
}

export function getPrimaryArtistNormalized(artist) {
  if (!artist || typeof artist !== 'string') return 'unknown';
  const clean = artist.toLowerCase().split(/\b(ft\.?|feat\.?|featuring|with|x|vs\.?)\b|[,&،\+\/]/i)[0];
  return resolveCanonicalArtist(normalizeString(clean)) || 'unknown';
}

export function getTrackDedupeKey(track) {
  if (!track) return '';
  const normTitle = normalizeString(track.title);
  const normArtist = getPrimaryArtistNormalized(track.artist);
  return normTitle ? `${normTitle}:::${normArtist}` : String(track._id || track.id || '');
}

export function detectTrackGenre(track) {
  if (!track) return 'Pop';
  if (isIndicTrack(track)) return 'Bollywood / Indian';
  const res = classifyGenre(track);
  return res?.genre || 'Pop';
}

export function getCurrentTimeMood() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { id: 'morning', label: 'Morning Fresh', keywords: ['acoustic', 'indie', 'morning', 'fresh', 'light', 'روقان', 'صباح', 'هادي', 'فيروز'], energy: 'fresh' };
  if (hour >= 12 && hour < 17) return { id: 'afternoon', label: 'Afternoon Flow', keywords: ['chill', 'lofi', 'focus', 'flow', 'smooth', 'موسيقى', 'تركيز', 'عصر', 'رايق'], energy: 'chill' };
  if (hour >= 17 && hour < 23) return { id: 'evening', label: 'Evening Hype', keywords: ['rap', 'trap', 'drill', 'hype', 'party', 'حماس', 'راب', 'سهرة', 'مهرجان', 'طاقة', 'ويجز', 'مروان', 'ليجي'], energy: 'hype' };
  return { id: 'night', label: 'Night Melancholy', keywords: ['slowed', 'night', 'deep', 'sad', 'melancholy', 'chill', 'ليل', 'سفر', 'هادية', 'حزين', 'روما', 'دواير'], energy: 'deep' };
}

const recentSuggestionsCooldown = new Map();
const COOLDOWN_DURATION_MS = 20 * 60 * 1000;

function cleanupSuggestionCooldown() {
  const now = Date.now();
  for (const [key, ts] of recentSuggestionsCooldown.entries()) {
    if (now - ts > COOLDOWN_DURATION_MS) recentSuggestionsCooldown.delete(key);
  }
}

export function getSmartTasteAndMoodTracks({
  allTracks = [],
  currentUser = null,
  followedArtists = [],
  likedTrackIds = [],
  excludeTrackIds = new Set(),
  limit = 20,
  listeningStats = null,
  currentTrack = null,
  maxPerArtist = 2,
}) {
  if (!Array.isArray(allTracks) || allTracks.length === 0) return [];
  cleanupSuggestionCooldown();

  const mood = getCurrentTimeMood();
  const maxCap = Math.max(1, Number(maxPerArtist) || 2);
  const followedSet = new Set((followedArtists || []).map(a => getPrimaryArtistNormalized(a)));
  if (currentUser?.following && Array.isArray(currentUser.following)) {
    currentUser.following.forEach(f => {
      const name = typeof f === 'string' ? f : f?.name || f?.username;
      if (name) followedSet.add(getPrimaryArtistNormalized(name));
    });
  }

  const likedSet = new Set((likedTrackIds || []).map(id => String(id)));
  const likedArtistSet = new Set();
  let likedHasIndic = false;
  allTracks.forEach(t => {
    const id = String(t._id || t.id);
    if (likedSet.has(id)) {
      if (t.artist) likedArtistSet.add(getPrimaryArtistNormalized(t.artist));
      if (isIndicTrack(t)) likedHasIndic = true;
    }
  });

  const userTopTrackTitle = normalizeString(currentUser?.topTrack?.title || '');
  const userTopTrackArtist = getPrimaryArtistNormalized(currentUser?.topTrack?.artist || '');
  const trackStatsMap = listeningStats?.trackStats || {};
  const historyList = Array.isArray(listeningStats?.history) ? listeningStats.history : [];
  const listenedArtistWeights = new Map();
  let historyHasIndic = false;
  let statsHasIndic = false;

  for (const h of historyList) {
    if (h && isIndicTrack(h)) { historyHasIndic = true; break; }
  }

  if (trackStatsMap && typeof trackStatsMap === 'object') {
    Object.values(trackStatsMap).forEach(ts => {
      if (ts && ts.artist) {
        const a = getPrimaryArtistNormalized(ts.artist);
        const weight = (Number(ts.plays) || 0) * 10 + Math.floor((Number(ts.seconds) || 0) / 30);
        listenedArtistWeights.set(a, (listenedArtistWeights.get(a) || 0) + weight);
        if ((Number(ts.plays) > 0 || Number(ts.seconds) >= 20) && isIndicTrack(ts)) statsHasIndic = true;
      }
    });
  }

  const recentHistorySet = new Set(historyList.slice(0, 25).map(h => String(h.id || h._id)));
  const userLang = (currentUser?.preferences?.language || currentUser?.language || '').toLowerCase();
  const prefersIndic = userLang === 'hi' || userLang.includes('hindi') || userLang.includes('indic') || userLang === 'pa' || userLang === 'ta' || userLang === 'te';
  const currentIsIndic = Boolean(currentTrack && isIndicTrack(currentTrack));
  const topTrackIsIndic = Boolean(currentUser?.topTrack && isIndicTrack(currentUser.topTrack));

  let followedHasIndic = false;
  for (const followed of followedSet) {
    if (followed && (INDIC_ARTISTS.has(followed) || isIndicTrack({ artist: followed }))) { followedHasIndic = true; break; }
  }

  const userHasIndicAffinity = prefersIndic || currentIsIndic || historyHasIndic || statsHasIndic || topTrackIsIndic || followedHasIndic || likedHasIndic;
  const seedArtist = currentTrack ? getPrimaryArtistNormalized(currentTrack.artist) : userTopTrackArtist;
  const seedGenre = currentTrack ? detectTrackGenre(currentTrack) : (userTopTrackTitle ? detectTrackGenre({ title: userTopTrackTitle, artist: userTopTrackArtist }) : null);
  const contextIsArabic = Boolean(
    (currentTrack && (hasArabicScript(currentTrack.title) || hasArabicScript(currentTrack.artist))) ||
    ['Arabic Pop', 'Mahraganat', 'Classic / Tarab', 'Khaleeji'].includes(seedGenre) ||
    userLang === 'ar'
  );

  const preferredGenreSet = new Set();
  if (seedGenre) preferredGenreSet.add(seedGenre);
  const sampleArtists = [...likedArtistSet, ...followedSet, seedArtist].filter(Boolean);
  for (const art of sampleArtists.slice(0, 15)) {
    const g = detectTrackGenre({ artist: art });
    if (g && g !== 'Pop') preferredGenreSet.add(g);
  }

  const excludeIdSet = new Set();
  const excludeKeySet = new Set();
  if (excludeTrackIds) {
    const arr = excludeTrackIds instanceof Set ? Array.from(excludeTrackIds) : (Array.isArray(excludeTrackIds) ? excludeTrackIds : []);
    arr.forEach(val => {
      const s = String(val || '');
      if (s.includes(':::')) excludeKeySet.add(s); else excludeIdSet.add(s);
    });
  }

  if (currentTrack) {
    const curId = String(currentTrack._id || currentTrack.id || '');
    if (curId) excludeIdSet.add(curId);
    const curKey = getTrackDedupeKey(currentTrack);
    if (curKey) excludeKeySet.add(curKey);
  }

  // Deduplicate pool
  const uniquePool = [];
  const poolKeyMap = new Map();
  for (const t of allTracks) {
    if (!t) continue;
    const key = getTrackDedupeKey(t);
    if (!poolKeyMap.has(key)) {
      poolKeyMap.set(key, t);
      uniquePool.push(t);
    } else {
      const existing = poolKeyMap.get(key);
      const curScore = (Number(t.plays) || 0) + (Number(t.duration) > 0 ? 10 : 0);
      const exScore = (Number(existing.plays) || 0) + (Number(existing.duration) > 0 ? 10 : 0);
      if (curScore > exScore) {
        poolKeyMap.set(key, t);
        const idx = uniquePool.indexOf(existing);
        if (idx !== -1) uniquePool[idx] = t;
      }
    }
  }

  // Prioritize unplayed candidates
  const unplayedCandidates = uniquePool.filter(t => {
    const id = String(t._id || t.id || '');
    const key = getTrackDedupeKey(t);
    return !excludeIdSet.has(id) && !excludeKeySet.has(key);
  });

  let candidates = [];
  if (unplayedCandidates.length >= limit) {
    candidates = unplayedCandidates;
  } else {
    const curKey = currentTrack ? getTrackDedupeKey(currentTrack) : '';
    const curId = currentTrack ? String(currentTrack._id || currentTrack.id || '') : '';
    const unplayedKeys = new Set(unplayedCandidates.map(t => getTrackDedupeKey(t)));
    const olderSupplements = uniquePool
      .filter(t => {
        const id = String(t._id || t.id || '');
        const key = getTrackDedupeKey(t);
        if (id === curId || key === curKey) return false;
        return !unplayedKeys.has(key);
      })
      .map(t => ({ ...t, _wasExcluded: true }));
    candidates = [...unplayedCandidates, ...olderSupplements];
  }

  // Score candidates
  const scored = candidates.map(track => {
    let score = 0;
    const normTitle = normalizeString(track.title);
    const primaryArt = getPrimaryArtistNormalized(track.artist);
    const dedupeKey = getTrackDedupeKey(track);
    const tGenre = detectTrackGenre(track);
    const tText = `${normTitle} ${primaryArt} ${tGenre}`.toLowerCase();
    const tId = String(track._id || track.id || '');
    const trackKey = String(track.id || track._id || dedupeKey);

    if (userTopTrackTitle && (normTitle.includes(userTopTrackTitle) || userTopTrackTitle.includes(normTitle))) score += 12;
    if (userTopTrackArtist && (primaryArt.includes(userTopTrackArtist) || userTopTrackArtist.includes(primaryArt))) score += 10;

    const realStat = trackStatsMap[trackKey] || trackStatsMap[tId] || trackStatsMap[String(track._id)] || trackStatsMap[String(track.id)];
    if (realStat) {
      const realPlays = Number(realStat.plays) || 0;
      const realSecs = Number(realStat.seconds) || 0;
      if (realPlays > 0 || realSecs >= 20) {
        score += 8 + Math.min(6, Math.log2(realPlays + 1) * 2);
      }
    }

    const artistListeningWeight = listenedArtistWeights.get(primaryArt) || 0;
    if (artistListeningWeight > 0) {
      score += Math.min(12, 4 + Math.log10(artistListeningWeight + 1) * 3);
    }

    if (recentHistorySet.has(trackKey) || recentHistorySet.has(tId)) score -= 40;
    if (recentSuggestionsCooldown.has(dedupeKey) || recentSuggestionsCooldown.has(tId)) score -= 35;
    if (track._wasExcluded) score -= 55;

    for (const followed of followedSet) {
      if (followed && (primaryArt.includes(followed) || followed.includes(primaryArt))) {
        score += 20;
        break;
      }
    }

    if (likedSet.has(tId)) score += 15;
    if (likedArtistSet.has(primaryArt)) score += 12;

    if (seedArtist && (primaryArt === seedArtist || primaryArt.includes(seedArtist) || seedArtist.includes(primaryArt))) {
      score += 32;
    }

    if (seedGenre) {
      if (tGenre === seedGenre) score += 28;
      else if (GENRE_COMPATIBILITY[seedGenre]?.compatible?.includes(tGenre)) score += 20;
      else if (GENRE_COMPATIBILITY[seedGenre]?.incompatible?.includes(tGenre)) score -= 60;
    } else if (preferredGenreSet.has(tGenre)) {
      score += 28;
    }

    if (isIndicTrack(track)) {
      if (!userHasIndicAffinity) score -= 300;
      else score += 20;
    }

    const candidateIsArabic = hasArabicScript(track.title) || hasArabicScript(track.artist) || ['Arabic Pop', 'Mahraganat', 'Classic / Tarab', 'Khaleeji'].includes(tGenre);
    if (contextIsArabic && candidateIsArabic) score += 25;

    for (const kw of mood.keywords) {
      if (tText.includes(kw.toLowerCase())) { score += 15; break; }
    }

    const plays = Number(track.plays || track.playCount || 0);
    score += Math.min(10, Math.log10(plays + 1) * 3);
    score += Math.random() * 5; // Controlled organic micro-jitter (0 to 5 pts)
    if (!realStat && !track._wasExcluded) score += 15;

    return { track, score, primaryArt, dedupeKey, tGenre };
  });

  scored.sort((a, b) => b.score - a.score);

  // Artist Diversity Capping & Selection
  const candidatePool = [];
  const artistCounts = new Map();
  const selectedKeys = new Set();
  if (seedArtist) artistCounts.set(seedArtist, 1);

  for (const item of scored) {
    if (candidatePool.length >= limit * 2) break;
    if (selectedKeys.has(item.dedupeKey)) continue;
    const currentArtistCount = artistCounts.get(item.primaryArt) || 0;
    if (currentArtistCount < maxCap) {
      candidatePool.push(item);
      selectedKeys.add(item.dedupeKey);
      artistCounts.set(item.primaryArt, currentArtistCount + 1);
    }
  }

  if (candidatePool.length < limit) {
    for (const item of scored) {
      if (candidatePool.length >= limit) break;
      if (selectedKeys.has(item.dedupeKey)) continue;
      const currentArtistCount = artistCounts.get(item.primaryArt) || 0;
      if (currentArtistCount < Math.min(maxCap + 1, 3)) {
        candidatePool.push(item);
        selectedKeys.add(item.dedupeKey);
        artistCounts.set(item.primaryArt, currentArtistCount + 1);
      }
    }
  }

  const selected = candidatePool.slice(0, limit);
  const now = Date.now();
  selected.forEach(item => {
    if (item.dedupeKey) recentSuggestionsCooldown.set(item.dedupeKey, now);
    const id = String(item.track?._id || item.track?.id || '');
    if (id) recentSuggestionsCooldown.set(id, now);
  });

  return selected.map(item => ({
    ...item.track,
    genre: item.tGenre || detectTrackGenre(item.track),
  }));
}

export function buildSmartSeedQueue(track, pool = [], options = {}) {
  if (!track) return [];
  const smartTracks = getSmartTasteAndMoodTracks({
    ...options,
    allTracks: pool,
    currentTrack: track,
    limit: options.limit || 20,
    maxPerArtist: options.maxPerArtist || 2,
  });
  return [track, ...smartTracks];
}
