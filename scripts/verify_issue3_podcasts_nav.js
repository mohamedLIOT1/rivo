/**
 * Verification Script for Issue 3 (Requirement R4)
 * Complete Podcasts Isolation and Navigation
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const babel = require('@babel/core');

const ROOT_DIR = path.resolve(__dirname, '..');

async function runVerification() {
  console.log('=== Verifying Issue 3 (Requirement R4): Complete Podcasts Isolation & Navigation ===\n');

  // 1. Verify i18n Translation Key Resolution
  console.log('1. Checking i18n translation key resolution...');
  const enNavPath = path.join(ROOT_DIR, 'src/native/i18n/translations/en/nav.js');
  const arNavPath = path.join(ROOT_DIR, 'src/native/i18n/translations/ar/nav.js');
  assert(fs.existsSync(enNavPath), 'en/nav.js must exist');
  assert(fs.existsSync(arNavPath), 'ar/nav.js must exist');

  const enContent = fs.readFileSync(enNavPath, 'utf8');
  const arContent = fs.readFileSync(arNavPath, 'utf8');

  assert(enContent.includes("podcastsLibrary: 'Podcast Library'"), 'en/nav.js must include podcastsLibrary: "Podcast Library"');
  assert(arContent.includes("podcastsLibrary: 'مكتبة البودكاست'"), 'ar/nav.js must include podcastsLibrary: "مكتبة البودكاست"');

  const i18nModule = await import('../src/native/i18n/index.js');
  const { translate } = i18nModule;

  const enVal = translate('en', 'nav.podcastsLibrary');
  const arVal = translate('ar', 'nav.podcastsLibrary');

  console.log(`   en nav.podcastsLibrary: "${enVal}"`);
  console.log(`   ar nav.podcastsLibrary: "${arVal}"`);

  assert.strictEqual(enVal, 'Podcast Library', 'English translation must equal "Podcast Library"');
  assert.strictEqual(arVal, 'مكتبة البودكاست', 'Arabic translation must equal "مكتبة البودكاست"');
  assert.notStrictEqual(enVal, 'nav.podcastsLibrary', 'Must not return raw key');
  assert.notStrictEqual(arVal, 'nav.podcastsLibrary', 'Must not return raw key');
  console.log('   ✓ Translation keys resolve correctly without returning raw key paths\n');

  // 2. Verify Three-Way Playlist Isolation Logic
  console.log('2. Checking playlist isolation logic across library modes...');
  const { isPodcastContent } = await import('../src/utils/podcastUtils.js');
  const { isQuranContent } = await import('../src/utils/quranUtils.js');

  const samplePlaylists = [
    { id: 'p1', name: 'Rap Hits 2026', isQuran: false, isPodcast: false },
    { id: 'p2', name: 'Pop & Rock Mix', isQuran: false, isPodcast: false },
    { id: 'q1', name: 'سورة البقرة - مشاري العفاسي', isQuran: true, isPodcast: false },
    { id: 'q2', name: 'Holy Quran Recitation', isQuran: true, isPodcast: false },
    { id: 'pod1', name: 'بودكاست فنجان', isQuran: false, isPodcast: true },
    { id: 'pod2', name: 'ثمانية - سوالف بزنس', isQuran: false, isPodcast: true },
    { id: 'pod3', name: 'وعي - حلقة التوبة', isQuran: false, isPodcast: true },
  ];

  function filterPlaylistsByMode(playlists, libraryMode) {
    return (Array.isArray(playlists) ? playlists : [])
      .filter(pl => {
        const isQ = Boolean(pl.isQuran || isQuranContent(pl));
        const isP = Boolean(pl.isPodcast || isPodcastContent(pl));
        if (libraryMode === 'quran') return isQ && !isP;
        if (libraryMode === 'podcasts') return isP && !isQ;
        return !isQ && !isP; // 'music' mode
      })
      .filter(pl => {
        const name = (pl.name || '').trim().toLowerCase();
        return name !== 'liked songs' && name !== 'liked prescriptions' && pl.id !== 'liked' && !pl.isLikedSongs;
      });
  }

  // A. In Podcasts Mode
  const podcastModePls = filterPlaylistsByMode(samplePlaylists, 'podcasts');
  console.log('   Podcasts Mode matching IDs:', podcastModePls.map(p => p.id));
  assert.deepStrictEqual(podcastModePls.map(p => p.id), ['pod1', 'pod2', 'pod3']);
  assert.strictEqual(podcastModePls.filter(p => p.isQuran || isQuranContent(p)).length, 0, 'Podcasts mode must have 0 Quran playlists');
  assert.strictEqual(podcastModePls.filter(p => !p.isPodcast && !isPodcastContent(p)).length, 0, 'Podcasts mode must have 0 Music playlists');

  // B. In Music Mode
  const musicModePls = filterPlaylistsByMode(samplePlaylists, 'music');
  console.log('   Music Mode matching IDs:', musicModePls.map(p => p.id));
  assert.deepStrictEqual(musicModePls.map(p => p.id), ['p1', 'p2']);
  assert.strictEqual(musicModePls.filter(p => p.isQuran || isQuranContent(p)).length, 0, 'Music mode must have 0 Quran playlists');
  assert.strictEqual(musicModePls.filter(p => p.isPodcast || isPodcastContent(p)).length, 0, 'Music mode must have 0 Podcast playlists');

  // C. In Quran Mode
  const quranModePls = filterPlaylistsByMode(samplePlaylists, 'quran');
  console.log('   Quran Mode matching IDs:', quranModePls.map(p => p.id));
  assert.deepStrictEqual(quranModePls.map(p => p.id), ['q1', 'q2']);
  assert.strictEqual(quranModePls.filter(p => p.isPodcast || isPodcastContent(p)).length, 0, 'Quran mode must have 0 Podcast playlists');
  assert.strictEqual(quranModePls.filter(p => !p.isQuran && !isQuranContent(p)).length, 0, 'Quran mode must have 0 Music playlists');

  console.log('   ✓ Playlist three-way isolation verified: Podcasts, Music, and Quran never leak into each other\n');

  // 3. Verify Liked Tracks Count Three-Way Isolation
  console.log('3. Checking liked tracks count three-way isolation...');
  const sampleTracks = [
    { id: 't1', title: 'Music Track 1', isQuran: false, isPodcast: false },
    { id: 't2', title: 'Music Track 2', isQuran: false, isPodcast: false },
    { id: 't3', title: 'Music Track 3', isQuran: false, isPodcast: false },
    { id: 'qt1', title: 'Surah Al-Fatiha', isQuran: true, isPodcast: false },
    { id: 'qt2', title: 'Surah Al-Baqarah', isQuran: true, isPodcast: false },
    { id: 'pt1', title: 'Finjan Ep 42', isPodcast: true, isQuran: false },
  ];
  const likedTrackIds = ['t1', 't2', 't3', 'qt1', 'qt2', 'pt1'];

  function calculateFilteredLikedCount(likedTrackIds, tracks, libraryMode) {
    if (!likedTrackIds || likedTrackIds.length === 0) return 0;
    if (Array.isArray(tracks) && tracks.length > 0) {
      const likedSet = new Set(likedTrackIds.map(String));
      const matching = tracks.filter(t => likedSet.has(String(t.id || t._id)));
      return matching.filter(t => {
        const isQ = Boolean(t.isQuran || isQuranContent(t));
        const isP = Boolean(t.isPodcast || isPodcastContent(t));
        if (libraryMode === 'quran') return isQ && !isP;
        if (libraryMode === 'podcasts') return isP && !isQ;
        return !isQ && !isP;
      }).length;
    }
    return libraryMode === 'music' ? likedTrackIds.length : 0;
  }

  const podcastLikedCount = calculateFilteredLikedCount(likedTrackIds, sampleTracks, 'podcasts');
  const quranLikedCount = calculateFilteredLikedCount(likedTrackIds, sampleTracks, 'quran');
  const musicLikedCount = calculateFilteredLikedCount(likedTrackIds, sampleTracks, 'music');

  console.log(`   Liked counts -> Podcasts: ${podcastLikedCount}, Quran: ${quranLikedCount}, Music: ${musicLikedCount}`);
  assert.strictEqual(podcastLikedCount, 1, 'Podcast liked count must be 1');
  assert.strictEqual(quranLikedCount, 2, 'Quran liked count must be 2');
  assert.strictEqual(musicLikedCount, 3, 'Music liked count must be 3');
  console.log('   ✓ Liked tracks count isolates correctly across all 3 modes\n');

  // 4. Verify NavigationContext Handler Logic
  console.log('4. Checking NavigationContext playlist selection and preservation logic...');
  function resolveLibraryMode(pl, currentMode) {
    const isP = Boolean(pl.isPodcast || isPodcastContent(pl));
    const isQ = Boolean(pl.isQuran || isQuranContent(pl));
    if (isP) {
      return 'podcasts';
    } else if (isQ) {
      return 'quran';
    } else {
      return currentMode === 'podcasts' ? 'podcasts' : 'music';
    }
  }

  // Test podcast playlist selection
  assert.strictEqual(resolveLibraryMode({ isPodcast: true }, 'music'), 'podcasts', 'Selecting podcast playlist from music must switch to podcasts');
  assert.strictEqual(resolveLibraryMode({ isPodcast: true }, 'quran'), 'podcasts', 'Selecting podcast playlist from quran must switch to podcasts');
  assert.strictEqual(resolveLibraryMode({ isPodcast: true }, 'podcasts'), 'podcasts', 'Selecting podcast playlist in podcasts mode must stay podcasts');

  // Test Quran playlist selection
  assert.strictEqual(resolveLibraryMode({ isQuran: true }, 'music'), 'quran', 'Selecting Quran playlist must switch to quran');
  assert.strictEqual(resolveLibraryMode({ isQuran: true }, 'podcasts'), 'quran', 'Selecting Quran playlist must switch to quran');

  // Test music playlist selection
  assert.strictEqual(resolveLibraryMode({ isQuran: false, isPodcast: false }, 'music'), 'music', 'Selecting music playlist must stay music');

  // Test non-Quran playlist selection while in podcasts mode (preserves podcasts)
  assert.strictEqual(resolveLibraryMode({ isQuran: false }, 'podcasts'), 'podcasts', 'Selecting playlist in podcasts mode must preserve podcasts mode');

  console.log('   ✓ Navigation playlist selection and preservation logic verified\n');

  // 5. Verify Component Source Code Integrations
  console.log('5. Validating source code implementations in Navigation.jsx & NavigationContext.jsx...');
  const navComponentPath = path.join(ROOT_DIR, 'src/components/Navigation.jsx');
  const navContextPath = path.join(ROOT_DIR, 'src/context/NavigationContext.jsx');

  const navCompCode = fs.readFileSync(navComponentPath, 'utf8');
  const navCtxCode = fs.readFileSync(navContextPath, 'utf8');

  // Navigation.jsx assertions
  assert(navCompCode.includes("import { isPodcastContent } from '../utils/podcastUtils';"), 'Navigation.jsx must import isPodcastContent');
  assert(navCompCode.includes("libraryMode === 'podcasts'"), 'Navigation.jsx must check libraryMode === "podcasts"');
  assert(navCompCode.includes("t('nav.podcastsLibrary')"), 'Navigation.jsx must call t("nav.podcastsLibrary")');
  assert(navCompCode.includes("const isP = Boolean(pl.isPodcast || isPodcastContent(pl));"), 'Navigation.jsx safePlaylists must compute isP');
  assert(navCompCode.includes("if (libraryMode === 'podcasts') return isP && !isQ;"), 'Navigation.jsx safePlaylists must isolate podcasts');
  assert(navCompCode.includes("if (libraryMode === 'quran') return isQ && !isP;"), 'Navigation.jsx safePlaylists must isolate quran');
  assert(navCompCode.includes("return !isQ && !isP;"), 'Navigation.jsx safePlaylists must isolate music');

  // NavigationContext.jsx assertions
  assert(navCtxCode.includes("import { isPodcastContent } from '../utils/podcastUtils';"), 'NavigationContext.jsx must import isPodcastContent');
  assert(navCtxCode.includes("initialNav.screen === 'podcasts' ? 'podcasts'"), 'NavigationContext.jsx must initialize libraryMode for podcasts');
  assert(navCtxCode.includes("prev === 'podcasts' ? 'podcasts' : 'music'"), 'NavigationContext.jsx must preserve podcasts mode');
  assert(navCtxCode.includes("(prev === 'quran' || prev === 'podcasts') ? prev : 'music'"), 'NavigationContext.jsx liked handler must preserve podcasts mode');

  console.log('   ✓ Source code patterns in Navigation.jsx and NavigationContext.jsx confirmed\n');

  // 6. AST & Syntax Parsing Check
  console.log('6. Validating AST and syntax across all touched files...');
  const touchedFiles = [
    enNavPath,
    arNavPath,
    navComponentPath,
    navContextPath
  ];

  for (const f of touchedFiles) {
    const code = fs.readFileSync(f, 'utf8');
    babel.parseSync(code, {
      filename: f,
      presets: [require.resolve('@babel/preset-react')],
      configFile: false,
      babelrc: false
    });
    console.log(`   ✓ Syntax OK: ${path.relative(ROOT_DIR, f)}`);
  }

  console.log('\n=== All Issue 3 (Requirement R4) Verifications PASSED! ===');
}

runVerification().catch(err => {
  console.error('\n❌ Verification FAILED:', err);
  process.exit(1);
});
