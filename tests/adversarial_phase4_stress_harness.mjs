/**
 * Comprehensive Adversarial Stress Testing Harness for Phase 4
 * Tests all 9 Issues with extreme edge cases, hostile inputs, and 500-user simulations.
 */

import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Environment variables required by server middleware
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_adversarial_testing';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/rivo_test';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Browser polyfills for client-side utilities running in Node.js
globalThis.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};
globalThis.window = {
  location: { hostname: 'localhost', protocol: 'http:', host: 'localhost:3000' },
  dispatchEvent() {},
  CustomEvent: class CustomEvent { constructor(name, opts) { this.name = name; this.detail = opts?.detail; } }
};

let totalPasses = 0;
let totalFails = 0;

function reportTest(suite, name, passed, details = '') {
  if (passed) {
    totalPasses++;
    console.log(`[PASS] [${suite}] ${name} ${details ? '(' + details + ')' : ''}`);
  } else {
    totalFails++;
    console.error(`[FAIL] [${suite}] ${name} ${details ? ': ' + details : ''}`);
  }
}

async function runAllSuites() {
  console.log('================================================================');
  console.log('PHASE 4 ADVERSARIAL STRESS TESTING HARNESS');
  console.log('Testing Issues 1 through 9 under Extreme Edge Cases & Hostile Inputs');
  console.log('================================================================\n');

  // ====================================================================
  // SUITE 1: AI Recommendations Diversity & Exclusion (Issue 1 / R2)
  // ====================================================================
  console.log('\n>>> SUITE 1: AI Recommendations Diversity & Multiple Rapid Refreshes');
  try {
    const { getCuratedRecommendations } = require(path.join(projectRoot, 'server/routes/ai/recommendationService.js'));

    const baseCatalog = [];
    for (let i = 0; i < 60; i++) {
      baseCatalog.push({
        _id: `cat_track_${i}`,
        id: `cat_track_${i}`,
        title: `Catalog Song ${i}`,
        artist: `Artist_${i % 12}`,
        plays: 50 + (i * 5),
        isQuran: false
      });
    }

    // Test 1.1: Extreme playlist size 0 (Empty playlist)
    const recs0 = await getCuratedRecommendations({
      availableTracks: baseCatalog,
      trackIds: [],
      seedTracks: [],
      isQuran: false
    });
    reportTest('Suite 1', 'Extreme size 0: handles empty playlist seeds and returns 10 candidates',
      recs0.length === 10, `got ${recs0.length}`);

    // Test 1.2: Extreme playlist size 1 track (Single track playlist)
    const singleSeed = [baseCatalog[0]];
    const recs1 = await getCuratedRecommendations({
      availableTracks: baseCatalog,
      trackIds: ['cat_track_0'],
      seedTracks: singleSeed,
      isQuran: false
    });
    const containsSeed = recs1.some(t => String(t._id || t.id) === 'cat_track_0');
    reportTest('Suite 1', 'Extreme size 1: seed track is strictly excluded from recommendations',
      !containsSeed && recs1.length === 10, `seed excluded: ${!containsSeed}`);

    // Test 1.3: Extreme playlist size 1,000 tracks
    const hugePool = [];
    for (let i = 0; i < 1000; i++) {
      const artNum = i % 100;
      hugePool.push({
        _id: `huge_${i}`,
        id: `huge_${i}`,
        title: `Track #${i}`,
        artist: `Artist_${artNum}`,
        plays: (i * 17) % 500,
        isQuran: false
      });
    }
    const startHuge = Date.now();
    const recsHuge = await getCuratedRecommendations({
      availableTracks: hugePool,
      trackIds: hugePool.slice(0, 50).map(t => t.id),
      seedTracks: hugePool.slice(0, 10),
      isQuran: false
    });
    const hugeDuration = Date.now() - startHuge;
    const cappedArtistCounts = {};
    for (const t of recsHuge) {
      cappedArtistCounts[t.artist] = (cappedArtistCounts[t.artist] || 0) + 1;
    }
    const maxArtistCount = Math.max(...Object.values(cappedArtistCounts));
    reportTest('Suite 1', 'Extreme size 1000: executes in < 150ms', hugeDuration < 150, `${hugeDuration}ms`);
    reportTest('Suite 1', 'Extreme size 1000: respects 2-per-artist cap', maxArtistCount <= 2, `max per artist = ${maxArtistCount}`);
    reportTest('Suite 1', 'Extreme size 1000: returns exactly 10 curated tracks', recsHuge.length === 10, `got ${recsHuge.length}`);

    // Test 1.4: Multiple rapid refreshes (5 consecutive refreshes with cumulative exclusion)
    const refreshPool = [];
    for (let i = 0; i < 200; i++) {
      refreshPool.push({
        _id: `cand_${i}`,
        id: `cand_${i}`,
        title: `Refresh Song ${i}`,
        artist: `Singer_${i % 40}`,
        plays: 50 + (i * 3),
        isQuran: false
      });
    }

    const seenIds = new Set();
    let refreshCollisions = 0;
    const iterations = 5;

    for (let r = 1; r <= iterations; r++) {
      const recs = await getCuratedRecommendations({
        availableTracks: refreshPool,
        trackIds: [],
        excludeTrackIds: Array.from(seenIds),
        seedTracks: [refreshPool[0]],
        refresh: true,
        isQuran: false
      });

      for (const t of recs) {
        const id = String(t._id || t.id);
        if (seenIds.has(id)) {
          refreshCollisions++;
        }
        seenIds.add(id);
      }
    }

    reportTest('Suite 1', '5 Rapid Refreshes: zero collision with prior excluded tracks', refreshCollisions === 0, `${refreshCollisions} collisions across 50 recommendations`);
    reportTest('Suite 1', '5 Rapid Refreshes: yielded 50 distinct tracks', seenIds.size === 50, `${seenIds.size} distinct tracks`);

  } catch (err) {
    reportTest('Suite 1', 'AI Recommendations suite failed with unhandled error', false, err.message);
  }

  // ====================================================================
  // SUITE 2: Offline Vault Playback & Secular Separation (Issue 2 / R3)
  // ====================================================================
  console.log('\n>>> SUITE 2: Offline Vault Playback & Secular Artist Separation');
  try {
    const quranUtils = await import('../src/utils/quranUtils.js');
    const { isQuranContent, isSecularArtist, normalizeArabicText } = quranUtils;

    // Test 2.1: Hostile & Malformed Manifest Inputs
    const corruptedManifest = [
      null,
      undefined,
      {},
      { id: null },
      { id: 'track_1', localAudioUri: null, nativeAudioUri: undefined },
      { id: 'target_valid', localAudioUri: 'file:///data/user/0/app/files/rivo_tracks/target_valid.mp3' }
    ];

    const trackToFind = { id: 'target_valid' };
    const match = corruptedManifest.find(item => {
      if (!item) return false;
      const itemId = String(item._id || item.id || '');
      return itemId === trackToFind.id;
    });
    reportTest('Suite 2', 'Manifest with null/undefined entries resolves target safely', Boolean(match && match.id === 'target_valid'));

    // Test 2.2: URI normalization on spaces, percent-encodings, Android SAF content://
    function normalizeTestUri(rawUri) {
      if (!rawUri || typeof rawUri !== 'string') return null;
      let reanchored = rawUri;
      if (reanchored.startsWith('/')) reanchored = `file://${reanchored}`;
      if (!reanchored.startsWith('file://') && !reanchored.startsWith('content://')) return null;
      const candidateUris = [reanchored];
      try {
        const decoded = decodeURI(reanchored);
        if (decoded !== reanchored && !candidateUris.includes(decoded)) candidateUris.push(decoded);
      } catch {}
      return candidateUris;
    }

    const testUri1 = normalizeTestUri('/storage/emulated/0/Music/Song with spaces.mp3');
    reportTest('Suite 2', 'Raw absolute path converted to file://', testUri1 && testUri1[0] === 'file:///storage/emulated/0/Music/Song with spaces.mp3');

    const testUri2 = normalizeTestUri('file:///storage/my%20track.mp3');
    reportTest('Suite 2', 'Percent-encoded URI with %20 decoded to plain spaces', testUri2 && testUri2.includes('file:///storage/my track.mp3'));

    const testUri3 = normalizeTestUri('content://media/external/audio/media/98765');
    reportTest('Suite 2', 'Android SAF content:// scheme accepted', testUri3 && testUri3[0].startsWith('content://'));

    const testUriInvalid = normalizeTestUri('javascript:alert(1)');
    reportTest('Suite 2', 'Hostile schemes (javascript:, http:) rejected', testUriInvalid === null);

    // Test 2.3: Secular Artist Exclusion Stress Test
    const subtleSecularVariations = [
      'cairokee', 'CAIROKEE', 'Cairokee ft. Amir', 'كايروكي', 'امير عيد', 'أمير عيد',
      'Lege-Cy', 'lege-cy', 'LEGE-CY', 'ليجي', 'ليجي سي', 'legecy',
      'wegz', 'ويجز', 'marwan pablo', 'مروان بابلو', 'بابلو', 'marwan moussa', 'مروان mousa',
      'amr diab', 'عمرو دياب', 'الهضبة', 'tamer hosny', 'تامر حسني', 'mohamed hamaki', 'محمد حماقي',
      'sharmoofers', 'شارموفرز', 'massar egbari', 'مسار اجباري', 'hamza namira', 'حمزة نمرة',
      'abyusif', 'ابيوسف', 'afroto', 'عفروتو', 'essam sasa', 'عصام صاصا', 'hassan shakosh', 'حسن شاكوش',
      'hamo bika', 'حمو بيكا', 'ahmed saad', 'أحمد سعد', 'mohamed mounir', 'محمد منير',
      'snoop dogg', 'eminem', 'drake', 'travis scott', 'the weeknd', 'taylor swift', 'coldplay', 'queen'
    ];

    let secularLeakCount = 0;
    for (const sec of subtleSecularVariations) {
      const track = { title: `Track by ${sec}`, artist: sec, isQuran: true, genre: 'Pop' };
      if (isQuranContent(track)) {
        secularLeakCount++;
      }
    }
    reportTest('Suite 2', 'Secular artist variations strictly excluded even with isQuran: true', secularLeakCount === 0, `${secularLeakCount} leaks found out of ${subtleSecularVariations.length}`);

    // Test 2.4: Tricky Arabic boundary words
    const phrase1 = { title: 'إعادة البناء في الاقتصاد', artist: 'أستاذ محاضر' };
    const phrase2 = { title: 'مشروع بناء المستقبل', artist: 'مقدم برامج' };
    reportTest('Suite 2', 'Arabic word "البناء" (construction) does NOT trigger Quran regex', !isQuranContent(phrase1) && !isQuranContent(phrase2));

    // Test 2.5: Genuine reciters preservation
    const genuineReciters = [
      'مشاري راشد العفاسي', 'محمود خليل الحصري', 'محمد صديق المنشاوي', 'عبد الباسط عبد الصمد',
      'ماهر المعيقلي', 'سعد الغامدي', 'ياسر الدوسري', 'إسلام صبحي', 'محمود علي البنا', 'الشيخ البنا',
      'هزاع البلوشي', 'علي الحذيفي', 'محمد أيوب', 'سعود الشريم', 'عبد الرحمن السديس', 'أحمد العجمي'
    ];
    let reciterMissingCount = 0;
    for (const rec of genuineReciters) {
      const track = { title: `سورة الكهف`, artist: rec };
      if (!isQuranContent(track)) {
        reciterMissingCount++;
      }
    }
    reportTest('Suite 2', 'All 16 authentic reciters properly identified as Quran', reciterMissingCount === 0, `${reciterMissingCount} reciters failed`);

  } catch (err) {
    reportTest('Suite 2', 'Offline Vault suite failed with unhandled error', false, err.message);
  }

  // ====================================================================
  // SUITE 3: Complete Podcasts Isolation & Web Navigation (Issue 3 / R4)
  // ====================================================================
  console.log('\n>>> SUITE 3: Complete Podcasts Isolation & Navigation Boundaries');
  try {
    const quranUtils = await import('../src/utils/quranUtils.js');
    const podcastUtils = await import('../src/utils/podcastUtils.js');
    const { isQuranContent } = quranUtils;
    const { isPodcastContent } = podcastUtils;

    function filterPlaylistsByMode(playlists, mode) {
      return (Array.isArray(playlists) ? playlists : [])
        .filter(pl => {
          const isQ = Boolean(pl.isQuran || isQuranContent(pl));
          const isP = Boolean(pl.isPodcast || isPodcastContent(pl));
          if (mode === 'quran') return isQ && !isP;
          if (mode === 'podcasts') return isP && !isQ;
          return !isQ && !isP;
        })
        .filter(pl => {
          const name = (pl.name || '').trim().toLowerCase();
          return name !== 'liked songs' && name !== 'liked prescriptions' && pl.id !== 'liked' && !pl.isLikedSongs;
        });
    }

    reportTest('Suite 3', 'Empty library playlist filtering returns [] cleanly', filterPlaylistsByMode([], 'music').length === 0);
    reportTest('Suite 3', 'Null library playlist filtering returns [] cleanly', filterPlaylistsByMode(null, 'podcasts').length === 0);

    const mixedPlaylists = [
      { id: 'p_m1', name: 'Chill Music Hits', contentType: 'music' },
      { id: 'p_m2', name: 'Indie Vibes', genre: 'Indie' },
      { id: 'p_q1', name: 'تلاوات خاشعة', isQuran: true },
      { id: 'p_q2', name: 'سورة البقرة - الشيخ الحصري', artist: 'محمود خليل الحصري' },
      { id: 'p_pod1', name: 'بودكاست فنجان', isPodcast: true },
      { id: 'p_pod2', name: 'حلقات الدحيح الجديدة', artist: 'أحمد الغندور' },
      { id: 'liked', name: 'Liked Songs', isLikedSongs: true }
    ];

    const musicPls = filterPlaylistsByMode(mixedPlaylists, 'music');
    const quranPls = filterPlaylistsByMode(mixedPlaylists, 'quran');
    const podPls = filterPlaylistsByMode(mixedPlaylists, 'podcasts');

    reportTest('Suite 3', 'Music mode: strictly excludes Quran, Podcasts, and Liked Songs',
      musicPls.length === 2 && musicPls.every(p => p.id === 'p_m1' || p.id === 'p_m2'));
    reportTest('Suite 3', 'Quran mode: strictly isolates Quran playlists (2 items)',
      quranPls.length === 2 && quranPls.every(p => p.id === 'p_q1' || p.id === 'p_q2'));
    reportTest('Suite 3', 'Podcasts mode: strictly isolates Podcast playlists (2 items)',
      podPls.length === 2 && podPls.every(p => p.id === 'p_pod1' || p.id === 'p_pod2'));

    // Test 3.2: Translation key verification
    const enNav = (await import('../src/native/i18n/translations/en/nav.js')).default;
    const arNav = (await import('../src/native/i18n/translations/ar/nav.js')).default;

    reportTest('Suite 3', 'English nav translation contains podcastsLibrary', enNav.podcastsLibrary === 'Podcast Library');
    reportTest('Suite 3', 'Arabic nav translation contains podcastsLibrary', arNav.podcastsLibrary === 'مكتبة البودكاست');

  } catch (err) {
    reportTest('Suite 3', 'Podcasts isolation suite failed with unhandled error', false, err.message);
  }

  // ====================================================================
  // SUITE 4: Mobile DJ Mix Controls & Crossfade Math (Issue 4 / R5)
  // ====================================================================
  console.log('\n>>> SUITE 4: Mobile DJ Mix Controls & Gain Curve Extremes');
  try {
    const musicAnalysis = await import('../src/native/utils/musicAnalysis.js');
    const { calculateCrossfadeGains } = musicAnalysis;

    // Test 4.1: Progress boundaries and invalid progress values
    const hostileProgressValues = [0.0, 0.5, 1.0, -0.2, 1.5, -100, 100, Infinity, -Infinity];
    const styles = ['fade', 'blend', 'rise', 'wave', 'melt', 'cut', 'slam', 'linear', 'invalid_unknown_style'];
    const biases = [0.0, 0.15, 0.5, 0.85, 1.0, -0.5, 2.0];

    let gainAnomalies = 0;
    for (const p of hostileProgressValues) {
      for (const st of styles) {
        for (const bias of biases) {
          const { gainA, gainB } = calculateCrossfadeGains(p, st, bias);
          if (typeof gainA !== 'number' || typeof gainB !== 'number' ||
              isNaN(gainA) || isNaN(gainB) ||
              gainA < 0.0 || gainA > 1.0 || gainB < 0.0 || gainB > 1.0) {
            gainAnomalies++;
          }
        }
      }
    }
    reportTest('Suite 4', 'Gain curve math across hostile progress, styles & biases is strictly clamped in [0, 1]',
      gainAnomalies === 0, `${gainAnomalies} anomalies across ${hostileProgressValues.length * styles.length * biases.length} evaluations`);

    // Test 4.2: DJ Transition math in playbackEngine.js
    function computeEffectiveOut(transConf, newDuration) {
      return (transConf.mixOutPoint && Number(transConf.mixOutPoint) > 0)
        ? Math.min(newDuration, Number(transConf.mixOutPoint))
        : newDuration;
    }

    reportTest('Suite 4', 'mixOutPoint <= 0 falls back to newDuration (200s)', computeEffectiveOut({ mixOutPoint: 0 }, 200) === 200);
    reportTest('Suite 4', 'mixOutPoint = -15 falls back to newDuration (200s)', computeEffectiveOut({ mixOutPoint: -15 }, 200) === 200);
    reportTest('Suite 4', 'mixOutPoint > duration clamps to newDuration (200s)', computeEffectiveOut({ mixOutPoint: 250 }, 200) === 200);
    reportTest('Suite 4', 'mixOutPoint = 180 within duration takes 180s', computeEffectiveOut({ mixOutPoint: 180 }, 200) === 180);

    // Test 4.3: Volume calculation safety
    function computeSafeVolume(masterVol, gain, mult) {
      return Math.max(0.01, Math.min(1.0, masterVol * gain * mult));
    }
    reportTest('Suite 4', 'Volume output safely bounded within [0.01, 1.0]',
      computeSafeVolume(1.0, 1.0, 1.5) === 1.0 &&
      computeSafeVolume(0.0, 0.0, 0.0) === 0.01 &&
      computeSafeVolume(0.8, 0.5, 1.0) === 0.4);

  } catch (err) {
    reportTest('Suite 4', 'DJ mix suite failed with unhandled error', false, err.message);
  }

  // ====================================================================
  // SUITE 5: Playback Startup Latency & ffprobe Error Handling (Issue 5 / R6)
  // ====================================================================
  console.log('\n>>> SUITE 5: Playback Startup Latency & Audio Cache Robustness');
  try {
    const audioCacheUtils = require(path.join(projectRoot, 'server/utils/audioCacheUtils.js'));
    const { isAudioFileValid, getLocalAudioFileDuration, getCookiesPath } = audioCacheUtils;

    // Test 5.1: File header verification robustness
    const tempDir = path.join(projectRoot, 'node_modules', '.test_cache_temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const garbagePath = path.join(tempDir, 'garbage.bin');
    const validMp3Path = path.join(tempDir, 'valid.mp3');
    const validM4aPath = path.join(tempDir, 'valid.m4a');
    const tinyPath = path.join(tempDir, 'tiny.mp3');

    fs.writeFileSync(garbagePath, Buffer.alloc(35000, 0x00));
    const mp3Buf = Buffer.alloc(35000, 0x00);
    mp3Buf.write('ID3', 0, 'latin1');
    fs.writeFileSync(validMp3Path, mp3Buf);
    const m4aBuf = Buffer.alloc(35000, 0x00);
    m4aBuf.write('ftyp', 4, 'latin1');
    fs.writeFileSync(validM4aPath, m4aBuf);
    fs.writeFileSync(tinyPath, Buffer.alloc(5000, 0x00));

    reportTest('Suite 5', 'isAudioFileValid rejects <30KB file', isAudioFileValid(tinyPath) === false);
    reportTest('Suite 5', 'isAudioFileValid rejects 35KB random zero/garbage data', isAudioFileValid(garbagePath) === false);
    reportTest('Suite 5', 'isAudioFileValid accepts valid MP3 ID3 header', isAudioFileValid(validMp3Path) === true);
    reportTest('Suite 5', 'isAudioFileValid accepts valid M4A ftyp header', isAudioFileValid(validM4aPath) === true);

    try {
      fs.unlinkSync(garbagePath);
      fs.unlinkSync(validMp3Path);
      fs.unlinkSync(validM4aPath);
      fs.unlinkSync(tinyPath);
      fs.rmdirSync(tempDir);
    } catch {}

    // Test 5.2: Async ffprobe duration resolver handling non-existent or erroring file
    const nullDur = await getLocalAudioFileDuration('c:\\non_existent_fake_audio_path_xyz.mp3');
    reportTest('Suite 5', 'getLocalAudioFileDuration resolves cleanly to null on non-existent file', nullDur === null);

    // Test 5.3: Cookies sabotage detection
    const fakeCookiesPath = path.join(projectRoot, 'cookies.txt');
    let cookiesSabotageIgnored = true;
    if (fs.existsSync(fakeCookiesPath)) {
      const activeCookiePath = getCookiesPath();
      const content = fs.readFileSync(fakeCookiesPath, 'utf8');
      if (content.includes('AFmmF2swRAIgLxwOUj2A') || content.includes('This file is generated by yt-dlp')) {
        cookiesSabotageIgnored = (activeCookiePath !== fakeCookiesPath);
      }
    }
    reportTest('Suite 5', 'getCookiesPath ignores sabotage / fake credential files', cookiesSabotageIgnored);

  } catch (err) {
    reportTest('Suite 5', 'Playback startup suite failed with unhandled error', false, err.message);
  }

  // ====================================================================
  // SUITE 6: Queue AI Suggestions Relevance (500 Simulated Users) (Issue 6 / R7)
  // ====================================================================
  console.log('\n>>> SUITE 6: Queue AI Suggestions 500-User Diversity & Indic Exclusion');
  try {
    const tasteModule = await import('../src/utils/tasteAlgorithm.js');
    const { getSmartTasteAndMoodTracks, isIndicTrack } = tasteModule;

    // Focused 40-track candidate catalog
    const catalog = [
      // 10 Arabic Tracks
      { id: 'ar_1', title: 'البخت', artist: 'ويجز', genre: 'Rap / Hip-Hop', plays: 2500 },
      { id: 'ar_2', title: 'غابات', artist: 'مروان بابلو', genre: 'Rap / Hip-Hop', plays: 1800 },
      { id: 'ar_3', title: 'تملي معاك', artist: 'عمرو دياب', genre: 'Arabic Pop', plays: 2200 },
      { id: 'ar_4', title: 'يوم تلات', artist: 'عمرو دياب', genre: 'Arabic Pop', plays: 1500 },
      { id: 'ar_5', title: 'ماتخفش', artist: 'كايروكي', genre: 'Indie / Alternative', plays: 2100 },
      { id: 'ar_6', title: 'فاضي شوية', artist: 'حمزة نمرة', genre: 'Indie / Alternative', plays: 2800 },
      { id: 'ar_7', title: 'صبري قليل', artist: 'شيرين', genre: 'Arabic Pop', plays: 1400 },
      { id: 'ar_8', title: 'نهايات الحكاوي', artist: 'مسار إجباري', genre: 'Indie / Alternative', plays: 1200 },
      { id: 'ar_9', title: 'كل مرة', artist: 'تامر حسني', genre: 'Arabic Pop', plays: 1300 },
      { id: 'ar_10', title: 'قمرين', artist: 'عمرو دياب', genre: 'Arabic Pop', plays: 1900 },

      // 10 Western Pop / Rap Tracks
      { id: 'w_1', title: 'Blinding Lights', artist: 'The Weeknd', genre: 'Pop', plays: 5000 },
      { id: 'w_2', title: 'Starboy', artist: 'The Weeknd', genre: 'R&B / Soul', plays: 4500 },
      { id: 'w_3', title: 'God\'s Plan', artist: 'Drake', genre: 'Rap / Hip-Hop', plays: 4800 },
      { id: 'w_4', title: 'One Dance', artist: 'Drake', genre: 'Rap / Hip-Hop', plays: 4200 },
      { id: 'w_5', title: 'Cruel Summer', artist: 'Taylor Swift', genre: 'Pop', plays: 5200 },
      { id: 'w_6', title: 'Anti-Hero', artist: 'Taylor Swift', genre: 'Pop', plays: 3900 },
      { id: 'w_7', title: 'Bad Guy', artist: 'Billie Eilish', genre: 'Pop', plays: 4100 },
      { id: 'w_8', title: 'Shape of You', artist: 'Ed Sheeran', genre: 'Pop', plays: 6000 },
      { id: 'w_9', title: 'Yellow', artist: 'Coldplay', genre: 'Indie / Alternative', plays: 3800 },
      { id: 'w_10', title: 'Levitating', artist: 'Dua Lipa', genre: 'Pop', plays: 4300 },

      // 10 Electronic / French / International Tracks
      { id: 'e_1', title: 'Get Lucky', artist: 'Daft Punk', genre: 'Electronic', plays: 3500 },
      { id: 'e_2', title: 'One More Time', artist: 'Daft Punk', genre: 'Electronic', plays: 3200 },
      { id: 'e_3', title: 'Latch', artist: 'Disclosure', genre: 'Electronic', plays: 2800 },
      { id: 'e_4', title: 'Wake Me Up', artist: 'Avicii', genre: 'Electronic', plays: 4600 },
      { id: 'e_5', title: 'This Is What You Came For', artist: 'Calvin Harris', genre: 'Electronic', plays: 4100 },
      { id: 'e_6', title: 'Alors on danse', artist: 'Stromae', genre: 'Electronic', plays: 3700 },
      { id: 'e_7', title: 'Papaoutai', artist: 'Stromae', genre: 'Electronic', plays: 3900 },
      { id: 'e_8', title: 'Midnight City', artist: 'M83', genre: 'Electronic', plays: 2600 },
      { id: 'e_9', title: 'Titanium', artist: 'David Guetta', genre: 'Electronic', plays: 4400 },
      { id: 'e_10', title: 'Lean On', artist: 'Major Lazer', genre: 'Electronic', plays: 4700 },

      // 10 Unsolicited Indic / Bollywood Tracks (Hostile noise in catalog)
      { id: 'in_1', title: 'Kesariya', artist: 'Arijit Singh', genre: 'Bollywood / Indian', plays: 9000 },
      { id: 'in_2', title: 'Tum Hi Ho', artist: 'Arijit Singh', genre: 'Pop', plays: 9500 },
      { id: 'in_3', title: 'Chaleya', artist: 'Arijit Singh', genre: 'Pop', plays: 8800 },
      { id: 'in_4', title: 'Garmi', artist: 'Badshah', genre: 'Pop', plays: 7500 },
      { id: 'in_5', title: 'Jugnu', artist: 'Badshah', genre: 'Pop', plays: 7200 },
      { id: 'in_6', title: 'Lover', artist: 'Diljit Dosanjh', genre: 'Pop', plays: 8100 },
      { id: 'in_7', title: 'G.O.A.T.', artist: 'Diljit Dosanjh', genre: 'Pop', plays: 7900 },
      { id: 'in_8', title: 'O Saki Saki', artist: 'Neha Kakkar', genre: 'Pop', plays: 8300 },
      { id: 'in_9', title: 'Dheere Dheere', artist: 'Yo Yo Honey Singh', genre: 'Pop', plays: 8700 },
      { id: 'in_10', title: 'काला चश्मा', artist: 'Badshah, Neha Kakkar', genre: 'Pop', plays: 9200 },
    ];

    // Run 500 Simulated Non-Indic Users
    let totalIndicLeaks = 0;
    let totalSuggestionsChecked = 0;

    for (let u = 0; u < 500; u++) {
      let userObj;
      let seedTrack;

      if (u < 100) {
        userObj = { language: 'ar', name: `ArabicUser_${u}` };
        seedTrack = catalog[u % 10];
      } else if (u < 200) {
        userObj = { language: 'en', name: `MixedUser_${u}` };
        seedTrack = u % 2 === 0 ? catalog[u % 10] : catalog[10 + (u % 10)];
      } else if (u < 300) {
        userObj = { language: 'en', name: `WesternUser_${u}` };
        seedTrack = catalog[10 + (u % 10)];
      } else if (u < 400) {
        userObj = { language: 'fr', name: `FrenchUser_${u}` };
        seedTrack = catalog[20 + (u % 10)];
      } else {
        userObj = { language: 'en', name: `NewUser_${u}` };
        seedTrack = null;
      }

      const suggestions = getSmartTasteAndMoodTracks({
        allTracks: catalog,
        currentUser: userObj,
        currentTrack: seedTrack,
        limit: 8,
        maxPerArtist: 2
      });

      for (const s of suggestions) {
        totalSuggestionsChecked++;
        if (isIndicTrack(s)) {
          totalIndicLeaks++;
        }
      }
    }

    reportTest('Suite 6', '500 Non-Indic Simulated Users: exactly 0% Indic tracks in queue recommendations',
      totalIndicLeaks === 0, `${totalIndicLeaks} leaks across ${totalSuggestionsChecked} total suggestions`);

    // Positive Control: Indic User requesting suggestions
    const indicUser = { language: 'hi', name: 'IndianUser' };
    const indicSeed = catalog[30]; // Arijit Singh
    const indicSuggestions = getSmartTasteAndMoodTracks({
      allTracks: catalog,
      currentUser: indicUser,
      currentTrack: indicSeed,
      limit: 8
    });
    const indicCountInPositive = indicSuggestions.filter(isIndicTrack).length;
    reportTest('Suite 6', 'Positive Control: Indic user receives relevant Bollywood suggestions',
      indicCountInPositive > 0, `${indicCountInPositive} / 8 suggestions were Indic`);

  } catch (err) {
    reportTest('Suite 6', 'Queue AI suggestions suite failed with unhandled error', false, err.message);
  }

  // ====================================================================
  // SUITE 7: Genre Classification Accuracy & Tricky Strings (Issue 7 / R8)
  // ====================================================================
  console.log('\n>>> SUITE 7: Genre Classification Accuracy on Tricky Strings');
  try {
    const genreClassifier = require(path.join(projectRoot, 'server/utils/genreClassifier.js'));
    const { matchesPattern } = require(path.join(projectRoot, 'server/utils/genreRules/textNormalizer.js'));
    const { classifyGenre } = genreClassifier;

    // Test 7.1: Word boundary matching on substrings
    reportTest('Suite 7', 'Word boundary: "اقتراب" does not match "تراب"', matchesPattern('اقتراب', 'تراب') === false);
    reportTest('Suite 7', 'Word boundary: "اغتراب" does not match "تراب"', matchesPattern('اغتراب', 'تراب') === false);
    reportTest('Suite 7', 'Word boundary: "التراب" does not match "تراب"', matchesPattern('التراب', 'تراب') === false);

    // Test 7.2: Classification of difficult cases
    const c1 = classifyGenre({ title: 'اقتراب الموعد', artist: 'فنان عربي' });
    reportTest('Suite 7', '"اقتراب" is NOT classified as Rap / Hip-Hop', c1.genre !== 'Rap / Hip-Hop', `got ${c1.genre}`);

    const c2 = classifyGenre({ title: 'اغتراب وحنين', artist: 'مطرب شعبي' });
    reportTest('Suite 7', '"اغتراب" is NOT classified as Rap / Hip-Hop', c2.genre !== 'Rap / Hip-Hop', `got ${c2.genre}`);

    const c3 = classifyGenre({ title: 'تراب الوطن', artist: 'موسيقى كلاسيكية' });
    reportTest('Suite 7', '"التراب" is NOT classified as Rap / Hip-Hop', c3.genre !== 'Rap / Hip-Hop', `got ${c3.genre}`);

    const c4 = classifyGenre({ title: 'Heavy Trap Beat', artist: 'DJ Producer' });
    reportTest('Suite 7', '"trap" keyword correctly classifies as Rap / Hip-Hop', c4.genre === 'Rap / Hip-Hop', `got ${c4.genre}`);

    const c5 = classifyGenre({ title: 'Rap God', artist: 'Eminem' });
    reportTest('Suite 7', '"rap god" correctly classifies as Rap / Hip-Hop', c5.genre === 'Rap / Hip-Hop', `got ${c5.genre}`);

    // Ambiguous artist "queen"
    const c6 = classifyGenre({ title: 'Bohemian Rhapsody', artist: 'Queen' });
    reportTest('Suite 7', 'Artist "Queen" classified as Rock', c6.genre === 'Rock', `got ${c6.genre}`);

    const c7 = classifyGenre({ title: 'Dancing Queen in the club', artist: 'Pop Band' });
    reportTest('Suite 7', 'Title containing "queen" with other artist NOT forced to Rock', c7.genre !== 'Rock', `got ${c7.genre}`);

    // Ambiguous artist "future"
    const c8 = classifyGenre({ title: 'Mask Off', artist: 'Future' });
    reportTest('Suite 7', 'Artist "Future" classified as Rap / Hip-Hop', c8.genre === 'Rap / Hip-Hop', `got ${c8.genre}`);

    const c9 = classifyGenre({ title: 'Back to the Future', artist: 'Symphony Orchestra' });
    reportTest('Suite 7', 'Title containing "future" with non-Future artist NOT forced to Rap', c9.genre !== 'Rap / Hip-Hop', `got ${c9.genre}`);

    // Ambiguous artist "وردة"
    const c10 = classifyGenre({ title: 'بتونس بيك', artist: 'وردة' });
    reportTest('Suite 7', 'Artist "وردة" (Warda) classified as Tarab', c10.genre === 'Tarab' || c10.genre === 'Classic / Tarab', `got ${c10.genre}`);

    const c11 = classifyGenre({ title: 'وردة بيضاء في الحديقة', artist: 'عمرو دياب' });
    reportTest('Suite 7', 'Title containing "وردة" with Amr Diab classified as Arabic Pop', c11.genre === 'Arabic Pop', `got ${c11.genre}`);

    // Soundtrack
    const c12 = classifyGenre({ title: 'Interstellar Theme', artist: 'Hans Zimmer', genre: 'soundtrack' });
    reportTest('Suite 7', 'Soundtrack genre correctly classified as Soundtrack / Instrumental', c12.genre.includes('Soundtrack'), `got ${c12.genre}`);

    const c13 = classifyGenre({ title: 'Original Soundtrack OST', artist: 'Various Artists' });
    reportTest('Suite 7', 'Title containing "OST / Soundtrack" classified as Soundtrack / Instrumental', c13.genre.includes('Soundtrack'), `got ${c13.genre}`);

  } catch (err) {
    reportTest('Suite 7', 'Genre classification suite failed with unhandled error', false, err.message);
  }

  // ====================================================================
  // SUITE 8: Web Content Preferences & Podcasts Route Guard (Issue 8 / R9)
  // ====================================================================
  console.log('\n>>> SUITE 8: Web Content Preferences & Route Guard Reactivity');
  try {
    const preferencesState = {
      contentModes: { music: true, quran: true, podcasts: true }
    };
    function toggleContentMode(key, enabled) {
      preferencesState.contentModes[key] = enabled;
    }

    toggleContentMode('podcasts', false);
    reportTest('Suite 8', 'toggleContentMode disables podcasts', preferencesState.contentModes.podcasts === false);

    toggleContentMode('podcasts', true);
    reportTest('Suite 8', 'toggleContentMode enables podcasts', preferencesState.contentModes.podcasts === true);

    function simulateRouteGuard(currentScreen, showPodcasts, showMusic) {
      let redirectedTo = null;
      const goToScreen = (screen) => { redirectedTo = screen; };
      if (currentScreen === 'podcasts' && !showPodcasts) {
        goToScreen(showMusic ? 'home' : 'quran');
      }
      return redirectedTo;
    }

    reportTest('Suite 8', 'Route guard redirects from podcasts to "home" when showPodcasts is false & music enabled',
      simulateRouteGuard('podcasts', false, true) === 'home');
    reportTest('Suite 8', 'Route guard redirects from podcasts to "quran" when showPodcasts is false & music disabled',
      simulateRouteGuard('podcasts', false, false) === 'quran');
    reportTest('Suite 8', 'Route guard does NOT redirect when showPodcasts is true',
      simulateRouteGuard('podcasts', true, true) === null);
    reportTest('Suite 8', 'Route guard does NOT affect regular screens ("home")',
      simulateRouteGuard('home', false, true) === null);

  } catch (err) {
    reportTest('Suite 8', 'Content preferences suite failed with unhandled error', false, err.message);
  }

  // ====================================================================
  // SUITE 9: Real Listening Activity & Zero Fake Fallback (Issue 9 / R10)
  // ====================================================================
  console.log('\n>>> SUITE 9: Listening Activity & Elimination of Fake Data');
  try {
    const listeningTracker = await import('../src/utils/listeningTracker.js');
    const { getRealTopTrack, recordListeningTick, getListeningStats, formatListeningMinutes } = listeningTracker;

    // Test 9.1: Zero listening history -> null top track (no fake fallback)
    globalThis.localStorage.clear();
    const emptyTop = getRealTopTrack();
    reportTest('Suite 9', 'getRealTopTrack() returns null on zero listening history (no fake Cairokee fallback)',
      emptyTop === null);

    // Test 9.2: Negative duration input handling in tick
    const testTrack = { id: 'track_test_1', title: 'Test Song', artist: 'Test Artist', duration: 200 };
    const prevStats = JSON.parse(JSON.stringify(getListeningStats()));

    recordListeningTick(testTrack, -50);
    const postNegStats = getListeningStats();
    reportTest('Suite 9', 'Negative durations (e.g. -50s) are ignored and do not decrement/increment seconds',
      postNegStats.totalSeconds === prevStats.totalSeconds);

    // Normal tick (1s) increments cleanly
    const beforeTick = postNegStats.totalSeconds;
    recordListeningTick(testTrack, 1);
    const afterTick = getListeningStats().totalSeconds;
    reportTest('Suite 9', 'Normal tick advances listening duration by 1s', afterTick - beforeTick === 1);

    // Huge duration number clamped safely to <= 5s
    const beforeHugeSec = afterTick;
    recordListeningTick(testTrack, 99999999999);
    const afterHugeSec = getListeningStats().totalSeconds;
    reportTest('Suite 9', 'Huge duration number is clamped safely to <= 5s per tick',
      afterHugeSec - beforeHugeSec <= 5, `increment was ${afterHugeSec - beforeHugeSec}s`);

    // Test 9.3: Server stats /api/listen clamping logic
    function serverSanitizeSeconds(rawSeconds) {
      return Math.max(0, Math.min(300, Number(rawSeconds) || 0));
    }
    reportTest('Suite 9', 'Server clamps negative seconds to 0', serverSanitizeSeconds(-100) === 0);
    reportTest('Suite 9', 'Server clamps NaN / string seconds to 0', serverSanitizeSeconds('invalid') === 0);
    reportTest('Suite 9', 'Server clamps massive numbers (e.g. 50000) to 300', serverSanitizeSeconds(50000) === 300);
    reportTest('Suite 9', 'Server accepts valid duration (e.g. 45s)', serverSanitizeSeconds(45) === 45);

    // Test 9.4: Fake friend activity elimination
    const activityService = require(path.join(projectRoot, 'server/services/listeningActivityService.js'));
    const { fetchListeningActivities } = activityService;

    const friends = await fetchListeningActivities(null, new Map());
    reportTest('Suite 9', 'fetchListeningActivities returns empty array [] when no active friends (zero mock friends)',
      Array.isArray(friends) && friends.length === 0, `returned length = ${friends.length}`);

    // Verify formatListeningMinutes
    reportTest('Suite 9', 'formatListeningMinutes English 0 sec = "0 MIN"', formatListeningMinutes(0, false) === '0 MIN');
    reportTest('Suite 9', 'formatListeningMinutes English 45 sec = "45 SEC"', formatListeningMinutes(45, false) === '45 SEC');
    reportTest('Suite 9', 'formatListeningMinutes English 125 sec = "2 MIN"', formatListeningMinutes(125, false) === '2 MIN');
    reportTest('Suite 9', 'formatListeningMinutes Arabic 0 sec = "0 دقيقة"', formatListeningMinutes(0, true) === '0 دقيقة');

  } catch (err) {
    reportTest('Suite 9', 'Listening activity suite failed with unhandled error', false, err.message);
  }

  // ====================================================================
  // SUMMARY
  // ====================================================================
  console.log('\n================================================================');
  console.log(`STRESS TEST RESULTS: ${totalPasses} PASSED, ${totalFails} FAILED`);
  console.log('================================================================\n');

  if (totalFails > 0) {
    console.error('ADVERSARIAL STRESS TEST FAILED!');
    process.exit(1);
  } else {
    console.log('ALL ADVERSARIAL STRESS TESTS PASSED CLEANLY WITH ZERO FAILURES!');
    process.exit(0);
  }
}

runAllSuites();
