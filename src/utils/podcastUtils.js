/**
 * Rivo Intelligent Podcast Detection, Classification & Seed Queue Engine
 * Handles accurate recognition, category classification, title cleanup, and queue generation for podcasts.
 */

export const PODCAST_REGEX = /(?:بودكاست|podcast|podcasts|\bحلقة\b|\bحلقه\b|\bepisode\b|\bepisodes\b|كبريت|فنجان|ثمانية|ثمانيه|\bبودكاست\s*وعي\b|\bبرنامج\s*وعي\b|دوباميكافين|ساندوتش\s*ورقي|دروس\s*أونلاين|دروس\s*اونلاين|السندباد|سندباد|مربع|طحالب|بدون\s*ورق|أبجورة|ابجورة|ابجوره|سوالف\s*بزنس|مرتدة|مرتده|إيه\s*المشكلة|ايه\s*المشكلة|ايه\s*المشكله|الدحيح|دحيح|سين\s*وجيم|تيك\s*فويس|\bحوار\s*مع\b|بودكاست\s*الماتش)/i;

export const PODCAST_CREATORS = [
  'كبريت', 'كبريت ai', 'كبريت ai+', 'aj+ كبريت', 'aj+',
  'بودكاست وعي', 'برنامج وعي',
  'بودكاست فنجان', 'فنجان', 'ثمانية', 'ثَمانية', 'thmanyah', 'عبدالرحمن أبومالح', 'عبد الرحمن أبو مالح',
  'الدحيح', 'احمد الغندور', 'أحمد الغندور', 'الغندور',
  'دوباميكافين', 'ناصر العقيل',
  'ساندوتش ورقي', 'أنس بن حسين', 'انس بن حسين',
  'دروس أونلاين', 'احمد ابو زيد', 'أحمد أبو زيد',
  'بودكاست السندباد', 'السندباد', 'سندباد', 'إسلام عادل',
  'سوالف بزنس', 'مشهور الدبيان',
  'بودكاست مرتدة', 'مرتدة', 'رياضة ثمانية',
  'إيه المشكلة', 'ايه المشكلة', 'ايه المشكله', 'أمير منير', 'امير منير', 'أحمد عامر', 'احمد عامر', 'ياسر ممدوح', 'محمد الغليظ',
  'بودكاست الماتش', 'الماتش', 'إسلام مجدي', 'محمود شوقي', 'نصوحي',
  'بدون ورق', 'فيصل العقل', 'مربع', 'أبجورة', 'لبنى الخميس', 'طحالب', 'سين وجيم'
];

/**
 * Normalizes text for robust Arabic & Latin search/matching.
 */
export function normalizePodcastSearchText(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // strip tashkeel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ـ_]/g, ' ')
    .trim();
}

/**
 * Check if a track, episode, or metadata represents Podcast content.
 */
export function isPodcastContent(item, artist = '', album = '') {
  if (!item) return false;

  if (typeof item === 'object') {
    // 1. Explicit metadata flags
    if (item.isPodcast === true || item.contentType === 'podcast') return true;
    if (item.genre === 'Podcast' || item.genre === 'بودكاست' || item.arabicGenre === 'بودكاست') return true;

    // Never misidentify Holy Quran as podcast unless explicitly flagged
    if (item.isQuran === true || item.isQuran === 'true' || item.category === 'quran' || item.contentType === 'quran' || item.genre === 'quran-radio') return false;

    const combined = `${item.title || item.name || ''} ${item.artist || ''} ${item.album || ''} ${item.genre || ''} ${item.description || ''}`;
    if (PODCAST_REGEX.test(combined)) return true;

    const norm = normalizePodcastSearchText(combined);
    for (const creator of PODCAST_CREATORS) {
      const normCreator = normalizePodcastSearchText(creator);
      if (normCreator.length >= 3 && norm.includes(normCreator)) {
        return true;
      }
    }
    return false;
  }

  // String overload
  const str = `${item} ${artist} ${album}`;
  if (PODCAST_REGEX.test(str)) return true;

  const norm = normalizePodcastSearchText(str);
  for (const creator of PODCAST_CREATORS) {
    const normCreator = normalizePodcastSearchText(creator);
    if (normCreator.length >= 3 && norm.includes(normCreator)) {
      return true;
    }
  }

  return false;
}

/**
 * Classify podcast track into one of 6 core Rivo categories:
 * 'religious' | 'science' | 'sports' | 'stories' | 'business' | 'culture'
 */
export function getPodcastCategory(track = {}) {
  if (!track) return 'culture';

  // Explicit category already present
  if (track.category && ['religious', 'science', 'sports', 'stories', 'business', 'culture'].includes(track.category)) {
    return track.category;
  }
  if (track.podcastCategory && ['religious', 'science', 'sports', 'stories', 'business', 'culture'].includes(track.podcastCategory)) {
    return track.podcastCategory;
  }

  const text = normalizePodcastSearchText(
    `${track.title || track.name || ''} ${track.artist || ''} ${track.album || ''} ${track.description || ''} ${track.genre || ''}`
  );

  // 1. Religious & Faith
  if (
    /(?:وعي|\bدين\b|\bديني\b|\bأديان\b|\bاديان\b|تزكية|تزكيه|\bفقه\b|\bفقهي\b|اسلام|تفسير|عقيدة|عقيده|\bسيرة\b|\bسيره\b|خطبة|خطبه|ايه المشكلة|ايه المشكله|امير منير|احمد عامر|ياسر ممدوح|الشنواني|موعظة|مواعظ|اخلاق|قلوب|ايمان|هداية|صلاة|رمضان)/i.test(text)
  ) {
    return 'religious';
  }

  // 2. Science & Tech
  if (
    /(?:كبريت|ai|ذكاء اصطناعي|دحيح|الدحيح|غندور|علوم|\bعلم\b|تكنولوجي|تقنية|تقنيه|فيزياء|فلك|كيمياء|فضاء|كوانتم|برمجة|تيك فويس|\btech\b|\bscience\b|حاسوب|روبوت)/i.test(text)
  ) {
    return 'science';
  }

  // 3. Sports & Football
  if (
    /(?:كورة|كوره|رياضة|رياضه|كروي|الماتش|\bماتش\b|الاهلي|الأهلي|الزمالك|زمالك|دوري|كرة القدم|ميسي|رونالدو|نصوحي|\bsport\b|\bfootball\b|\bكاس\b|\bكأس\b|ملعب)/i.test(text)
  ) {
    return 'sports';
  }

  // 4. Stories, Crime & Mystery
  if (
    /(?:سندباد|السندباد|قصة|قصه|قصص|جريمة|جريمه|جرائم|غموض|رعب|\bتاريخ\b|حكاية|حكايه|حكايات|جنائي|وثائقي|ملفات|\bstory\b|\bcrime\b|\bmystery\b|اسطورة|اساطير)/i.test(text)
  ) {
    return 'stories';
  }

  // 5. Business & Entrepreneurship
  if (
    /(?:سوالف بزنس|بزنس|بيزنس|ثمانية|مشهور الدبيان|ريادة|استثمار|مال|اقتصاد|تسويق|شركات|مشاريع|\bstartup\b|\bbusiness\b|\bfinance\b|اسهم|بورصة|ارباح)/i.test(text)
  ) {
    return 'business';
  }

  // 6. Culture & Self-Development (Default for thoughtful shows)
  return 'culture';
}

/**
 * Clean clutter from podcast episode titles (e.g. "| بودكاست فنجان", "[حلقة 42]").
 */
export function cleanPodcastTrackTitle(title = '') {
  if (!title || typeof title !== 'string') return '';

  let cleaned = title
    // Strip show suffixes like "| بودكاست فنجان" or "- بودكاست وعي"
    .replace(/[|\-–—:]\s*بودكاست\s+[\u0600-\u06FF\w\s]+/gi, '')
    .replace(/[|\-–—:]\s*كبريت\s*AI\+?/gi, '')
    .replace(/[|\-–—:]\s*ثمانية/gi, '')
    .replace(/[|\-–—:]\s*الدحيح/gi, '')
    // Strip episode brackets: [حلقة 42], (حلقة 15), [Episode 10]
    .replace(/\[\s*(?:حلقة|حلقه|episode|ep)\s*\d+\s*\]/gi, '')
    .replace(/\(\s*(?:حلقة|حلقه|episode|ep)\s*\d+\s*\)/gi, '')
    // Strip trailing or leading punctuation
    .replace(/^[\s|\-–—:]+/, '')
    .replace(/[\s|\-–—:]+$/, '')
    .trim();

  return cleaned || title;
}

/**
 * Build a queue exclusively of podcasts, prioritizing:
 * 1. Same show / same artist / same album as seedTrack
 * 2. Same podcast category
 * 3. Other podcasts
 */
export function buildPodcastSeedQueue(seedTrack, allTracks = [], limit = 20) {
  if (!seedTrack) return [];

  const seedId = String(seedTrack.id || seedTrack._id || '');
  const seedArtistNorm = normalizePodcastSearchText(seedTrack.artist || '');
  const seedAlbumNorm = normalizePodcastSearchText(seedTrack.album || '');
  const seedCategory = getPodcastCategory(seedTrack);

  // Filter pool strictly for podcast content only, excluding the seed track itself
  const candidatePool = (Array.isArray(allTracks) ? allTracks : [])
    .filter(t => t && isPodcastContent(t) && String(t.id || t._id) !== seedId);

  const sameShow = [];
  const sameCategory = [];
  const otherPodcasts = [];

  for (const track of candidatePool) {
    const tArtistNorm = normalizePodcastSearchText(track.artist || '');
    const tAlbumNorm = normalizePodcastSearchText(track.album || '');

    const isMatchShow =
      (seedArtistNorm && tArtistNorm && (tArtistNorm.includes(seedArtistNorm) || seedArtistNorm.includes(tArtistNorm))) ||
      (seedAlbumNorm && tAlbumNorm && (tAlbumNorm.includes(seedAlbumNorm) || seedAlbumNorm.includes(tAlbumNorm)));

    if (isMatchShow) {
      sameShow.push(track);
    } else if (getPodcastCategory(track) === seedCategory) {
      sameCategory.push(track);
    } else {
      otherPodcasts.push(track);
    }
  }

  // Deduplicate and assemble
  const seenIds = new Set();
  if (seedId) seenIds.add(seedId);

  const prioritized = [];
  for (const track of [...sameShow, ...sameCategory, ...otherPodcasts]) {
    const id = String(track.id || track._id || `${track.title}-${track.artist}`);
    if (!seenIds.has(id)) {
      seenIds.add(id);
      prioritized.push(track);
      if (prioritized.length >= limit - 1) break;
    }
  }

  return [seedTrack, ...prioritized].slice(0, limit);
}

/**
 * Format duration in seconds to "H:MM:SS" or "MM:SS"
 */
export function formatPodcastDuration(secs) {
  if (!secs || isNaN(secs) || secs < 0 || !isFinite(secs)) return '0:00';
  const sVal = (secs > 86400 && Math.round(secs / 1000) <= 86400) ? Math.round(secs / 1000) : Math.round(secs);
  const h = Math.floor(sVal / 3600);
  const m = Math.floor((sVal % 3600) / 60);
  const s = Math.floor(sVal % 60);
  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Progress resumption utilities
 */
export function getPodcastProgress(episodeId) {
  if (!episodeId || typeof window === 'undefined') return 0;
  try {
    const val = localStorage.getItem(`rivo_podcast_progress_${episodeId}`);
    const parsed = parseFloat(val);
    return !isNaN(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function setPodcastProgress(episodeId, seconds) {
  if (!episodeId || typeof window === 'undefined') return;
  try {
    const s = Math.max(0, Math.floor(seconds || 0));
    localStorage.setItem(`rivo_podcast_progress_${episodeId}`, String(s));
  } catch {}
}

export function clearPodcastProgress(episodeId) {
  if (!episodeId || typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`rivo_podcast_progress_${episodeId}`);
  } catch {}
}

export const PODCAST_SPEEDS = [1.0, 1.25, 1.5, 2.0];

export function getPodcastSpeed() {
  if (typeof window === 'undefined') return 1.0;
  try {
    const saved = parseFloat(localStorage.getItem('rivo_podcast_speed'));
    if (PODCAST_SPEEDS.includes(saved)) return saved;
  } catch {}
  return 1.0;
}

export function setPodcastSpeed(speed) {
  if (typeof window === 'undefined') return 1.0;
  try {
    const val = Number(speed) || 1.0;
    localStorage.setItem('rivo_podcast_speed', String(val));
    return val;
  } catch {
    return 1.0;
  }
}

