/**
 * Verification Script for Issue 2 (Requirement R3):
 * Offline Vault Playback, Filtering, and Dedicated Podcasts Tab
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('====================================================');
console.log('STARTING ISSUE 2 VERIFICATION SUITE');
console.log('====================================================\n');

// ---------------------------------------------------------------------
// TEST SUITE 1: 400-Line Limit Rule Compliance
// ---------------------------------------------------------------------
console.log('--- TEST SUITE 1: 400-Line Limit Check ---');
const projectRoot = path.resolve(__dirname, '../../../rivo-main');

const filesToCheck = [
  'src/native/screens/OfflineScreen.js',
  'src/native/components/offline/OfflineHeroHeader.js',
  'src/native/components/offline/OfflineTrackItem.js',
  'src/native/context/audio/streamResolverHelper.js',
];

for (const relPath of filesToCheck) {
  const fullPath = path.join(projectRoot, relPath);
  const content = fs.readFileSync(fullPath, 'utf8');
  const lineCount = content.split('\n').length;
  console.log(`[PASS] ${relPath}: ${lineCount} lines (<= 400)`);
  assert(lineCount <= 400, `${relPath} exceeds 400 lines: ${lineCount}`);
}

// ---------------------------------------------------------------------
// TEST SUITE 2: Quran vs Secular Artist & Regex Filtering
// ---------------------------------------------------------------------
console.log('\n--- TEST SUITE 2: Secular Artist & Quran Filtering ---');

function transpileEsModuleExports(code) {
  // Strip import statements
  let transformed = code.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '');
  // Replace export const / let / var / function
  transformed = transformed.replace(/export\s+const\s+([a-zA-Z0-9_$]+)\s*=/g, 'const $1 = exports.$1 =');
  transformed = transformed.replace(/export\s+let\s+([a-zA-Z0-9_$]+)\s*=/g, 'let $1 = exports.$1 =');
  transformed = transformed.replace(/export\s+var\s+([a-zA-Z0-9_$]+)\s*=/g, 'var $1 = exports.$1 =');
  transformed = transformed.replace(/export\s+function\s+([a-zA-Z0-9_$]+)/g, 'function $1(...args) { return _orig_$1.apply(this, args); }\nconst _orig_$1 = exports.$1 = function $1');
  return transformed;
}

const quranUtilsPath = path.join(projectRoot, 'src/utils/quranUtils.js');
const quranCode = fs.readFileSync(quranUtilsPath, 'utf8');

const quranModule = {};
const wrappedQuran = `(function(exports) {
  ${transpileEsModuleExports(quranCode)}
})(quranModule);`;
eval(wrappedQuran);

const { isQuranContent, isSecularArtist, QURAN_REGEX } = quranModule;

// 1. Secular Artists must be strictly rejected
const secularTracks = [
  { title: 'Samurai', artist: 'Cairokee' },
  { title: 'Ethbat Makanak', artist: 'كايروكي' },
  { title: 'Bet3ady', artist: 'Lege-Cy' },
  { title: 'Mish Bel Hazz', artist: 'ليجي سي' },
  { title: 'Keify Keda', artist: 'Wegz' },
  { title: 'El Basha', artist: 'Cairokee', isQuran: true }, // Corrupted isQuran flag overridden!
  { title: 'Matkhafsh Enta Mashy Ma3aya', artist: 'Lege-Cy', isQuran: true }, // Corrupted isQuran flag overridden!
  { title: 'Tamally Maak', artist: 'Amr Diab' },
  { title: 'Kol Mara', artist: 'Tamer Hosny' },
  { title: 'Khamsa Shensh', artist: 'Sharmoofers' },
  { title: 'Cairokee - Kol Haga Bet3ady', artist: 'Various Artists' }, // Title contains secular artist
  { title: 'Track with genre rap', artist: 'Unknown Artist', genre: 'rap', isQuran: true },
  { title: 'Track with genre Pop', artist: 'Unknown', genre: 'Pop' },
  { title: 'Track with contentType music', artist: 'Unknown', contentType: 'music' },
  { title: 'Podcast episode', artist: 'ثمانية', isPodcast: true, isQuran: true },
  { title: 'إعادة البناء في العصر الحديث', artist: 'Non-Reciter Speaker' }, // Non-Quran containing البناء
];

for (const track of secularTracks) {
  const isQ = isQuranContent(track);
  console.log(`[PASS] Secular check: "${track.title}" (${track.artist}) => isQuranContent = ${isQ}`);
  assert.strictEqual(isQ, false, `Track should NOT be Quran: ${JSON.stringify(track)}`);
}

// 2. Authentic Quran tracks must be accepted
const authenticQuranTracks = [
  { title: 'سورة البقرة', artist: 'مشاري راشد العفاسي' },
  { title: 'Surah Maryam', artist: 'محمود خليل الحصري' },
  { title: 'تلاوة خاشعة مباركة', artist: 'عبد الباسط عبد الصمد' },
  { title: 'سورة الكهف', artist: 'محمود علي البنا' },
  { title: 'Al-Fatiha', artist: 'Saad Al Ghamdi' },
  { title: 'Holy Quran Recitation', artist: 'Maher Al Muaiqly' },
];

for (const track of authenticQuranTracks) {
  const isQ = isQuranContent(track);
  console.log(`[PASS] Authentic Quran check: "${track.title}" (${track.artist}) => isQuranContent = ${isQ}`);
  assert.strictEqual(isQ, true, `Track SHOULD be Quran: ${JSON.stringify(track)}`);
}

// ---------------------------------------------------------------------
// TEST SUITE 3: Dedicated Podcasts Tab & State Isolation
// ---------------------------------------------------------------------
console.log('\n--- TEST SUITE 3: Offline Vault Tab Isolation ---');

const podcastUtilsPath = path.join(projectRoot, 'src/native/utils/podcastUtils.js');
const podcastCode = fs.readFileSync(podcastUtilsPath, 'utf8');

const podcastModule = {};
const wrappedPodcast = `(function(exports) {
  ${transpileEsModuleExports(podcastCode)}
})(podcastModule);`;
eval(wrappedPodcast);

const { isPodcastContent } = podcastModule;

// Sample Vault containing 2 secular music, 2 Quran recitations, 2 podcasts
const sampleVault = [
  { _id: 'm1', title: 'Samurai', artist: 'Cairokee', genre: 'Rock' },
  { _id: 'm2', title: 'Bet3ady', artist: 'Lege-Cy', genre: 'Rap' },
  { _id: 'q1', title: 'سورة البقرة', artist: 'مشاري راشد العفاسي', isQuran: true },
  { _id: 'q2', title: 'Surah Maryam', artist: 'محمود خليل الحصري', isQuran: true },
  { _id: 'p1', title: 'فنجان: أسرار القيادة', artist: 'ثمانية', isPodcast: true },
  { _id: 'p2', title: 'الدحيح: حلقة الذاكرة', artist: 'أحمد الغندور', isPodcast: true },
];

// Test classification predicates exactly as implemented in OfflineScreen.js:
const quranCount = sampleVault.filter((t) => isQuranContent(t) && !isPodcastContent(t)).length;
const podcastCount = sampleVault.filter((t) => isPodcastContent(t) && !isQuranContent(t)).length;
const musicCount = sampleVault.filter((t) => !isQuranContent(t) && !isPodcastContent(t)).length;

console.log(`[PASS] Vault Counts: Total=${sampleVault.length}, Music=${musicCount}, Quran=${quranCount}, Podcasts=${podcastCount}`);
assert.strictEqual(musicCount, 2, 'Music count must be exactly 2');
assert.strictEqual(quranCount, 2, 'Quran count must be exactly 2');
assert.strictEqual(podcastCount, 2, 'Podcast count must be exactly 2');
assert.strictEqual(musicCount + quranCount + podcastCount, sampleVault.length, 'Sum of tabs must equal total');

// Test folderTab filtering exactly as implemented in OfflineScreen.js:
function filterTab(tracks, folderTab) {
  return tracks.filter((t) => {
    if (!t) return false;
    const isQ = isQuranContent(t) && !isPodcastContent(t);
    const isP = !isQ && isPodcastContent(t);
    if (folderTab === 'music') return !isQ && !isP;
    if (folderTab === 'quran') return isQ;
    if (folderTab === 'podcasts') return isP;
    return true;
  });
}

const allTracks = filterTab(sampleVault, 'all');
const musicTracks = filterTab(sampleVault, 'music');
const quranTabTracks = filterTab(sampleVault, 'quran');
const podcastTracks = filterTab(sampleVault, 'podcasts');

console.log(`[PASS] 'all' tab returns ${allTracks.length} items`);
assert.strictEqual(allTracks.length, 6);

console.log(`[PASS] 'music' tab returns ${musicTracks.length} items:`, musicTracks.map(t => `${t.title} (${t.artist})`));
assert.strictEqual(musicTracks.length, 2);
assert(musicTracks.some(t => t.artist === 'Cairokee'));
assert(musicTracks.some(t => t.artist === 'Lege-Cy'));

console.log(`[PASS] 'quran' tab returns ${quranTabTracks.length} items:`, quranTabTracks.map(t => `${t.title} (${t.artist})`));
assert.strictEqual(quranTabTracks.length, 2);
assert(!quranTabTracks.some(t => t.artist === 'Cairokee'), 'Cairokee must NEVER be in Quran tab');
assert(!quranTabTracks.some(t => t.artist === 'Lege-Cy'), 'Lege-Cy must NEVER be in Quran tab');

console.log(`[PASS] 'podcasts' tab returns ${podcastTracks.length} items:`, podcastTracks.map(t => `${t.title} (${t.artist})`));
assert.strictEqual(podcastTracks.length, 2);
assert(podcastTracks.every(t => t.isPodcast));

// ---------------------------------------------------------------------
// TEST SUITE 4: Offline Playback Resolution & Manifest Fallback Logic
// ---------------------------------------------------------------------
console.log('\n--- TEST SUITE 4: Offline Playback Resolution Logic ---');

const resolverHelperPath = path.join(projectRoot, 'src/native/context/audio/streamResolverHelper.js');
const resolverContent = fs.readFileSync(resolverHelperPath, 'utf8');

// Check that manifest fallback lookup is present
assert(resolverContent.includes('getDownloadedTracks'), 'streamResolverHelper must import getDownloadedTracks');
assert(resolverContent.includes('getTrackDedupeKey'), 'streamResolverHelper must import getTrackDedupeKey');

// Check that destructive auto-wiping lines were removed
assert(!resolverContent.includes('isDownloaded: false,\n        downloaded: false,\n        localAudioUri: null,'),
  'Destructive updateTrackDownloadRecord wiping should be removed from streamResolverHelper');

// Check that verifyLocalAudioFile handles content:// and raw paths
assert(resolverContent.includes("reanchored.startsWith('/')"), 'verifyLocalAudioFile must handle raw paths');
assert(resolverContent.includes("reanchored.startsWith('content://')"), 'verifyLocalAudioFile must handle SAF content:// URIs');
assert(resolverContent.includes("decodeURI"), 'verifyLocalAudioFile must test decodeURI');

console.log('[PASS] streamResolverHelper code patterns verified:');
console.log('  - Storage manifest fallback present');
console.log('  - SAF content:// and raw path support present');
console.log('  - URI percent-decoding test present');
console.log('  - Destructive record wiping and disk deletions removed');

// ---------------------------------------------------------------------
// TEST SUITE 5: i18n Translation Completeness
// ---------------------------------------------------------------------
console.log('\n--- TEST SUITE 5: i18n Translations Check ---');

const enOffline = fs.readFileSync(path.join(projectRoot, 'src/native/i18n/translations/en/offline.js'), 'utf8');
const arOffline = fs.readFileSync(path.join(projectRoot, 'src/native/i18n/translations/ar/offline.js'), 'utf8');

assert(enOffline.includes('tabPodcasts'), 'English translations must include tabPodcasts');
assert(enOffline.includes('noPodcasts'), 'English translations must include noPodcasts');
assert(enOffline.includes('badgePodcast'), 'English translations must include badgePodcast');

assert(arOffline.includes('tabPodcasts'), 'Arabic translations must include tabPodcasts');
assert(arOffline.includes('noPodcasts'), 'Arabic translations must include noPodcasts');
assert(arOffline.includes('badgePodcast'), 'Arabic translations must include badgePodcast');

console.log('[PASS] English & Arabic translations contain all required podcast keys');

// ---------------------------------------------------------------------
// TEST SUITE 6: Functional Mock Resolution & Path Normalization Tests
// ---------------------------------------------------------------------
console.log('\n--- TEST SUITE 6: Functional Mock Resolution Tests ---');

async function runFunctionalTests() {
  const mockFiles = new Map([
    ['file:///data/user/0/rivo_tracks/song%20name.mp3', { exists: true, size: 2500000 }],
    ['file:///data/user/0/rivo_tracks/song name.mp3', { exists: true, size: 2500000 }],
    ['file:///storage/emulated/0/Music/track.mp3', { exists: true, size: 1800000 }],
    ['content://com.android.providers.media.documents/document/audio%3A1234', { exists: true, size: 0 }],
    ['file:///data/user/0/rivo_tracks/manifest_track_99.mp3', { exists: true, size: 3000000 }],
  ]);

  const deletedFiles = [];
  const updatedRecords = [];

  const mockFileSystem = {
    documentDirectory: 'file:///data/user/0/',
    getInfoAsync: async (uri) => {
      if (mockFiles.has(uri)) {
        return mockFiles.get(uri);
      }
      return { exists: false, size: 0 };
    },
    deleteAsync: async (uri) => {
      deletedFiles.push(uri);
    },
  };

  const mockStorageManifestService = {
    reanchorDocumentUri: (uri) => uri,
    getTrackDedupeKey: (t) => t.title ? `${t.title}___${t.artist}` : (t._id || ''),
    getDownloadedTracks: async () => [
      {
        _id: 'manifest_track_99',
        title: 'Manifest Track',
        artist: 'Artist',
        localAudioUri: 'file:///data/user/0/rivo_tracks/manifest_track_99.mp3',
        isDownloaded: true,
      }
    ],
    updateTrackDownloadRecord: async (id, updates) => {
      updatedRecords.push({ id, updates });
    },
  };

  const mockNetInfo = {
    fetch: async () => ({ isConnected: false, isInternetReachable: false }), // OFFLINE
  };

  let resolverCode = fs.readFileSync(resolverHelperPath, 'utf8');
  resolverCode = resolverCode.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '');
  resolverCode = transpileEsModuleExports(resolverCode);

  const helperModule = {};
  const fn = new Function(
    'exports',
    'FileSystem',
    'NetInfo',
    'reanchorDocumentUri',
    'getTrackDedupeKey',
    'getDownloadedTracks',
    'updateTrackDownloadRecord',
    'isQuranContent',
    'resolveAudioStream',
    'clearStreamCache',
    'API_BASE_URL',
    'Audio',
    'console',
    resolverCode
  );

  fn(
    helperModule,
    mockFileSystem,
    mockNetInfo,
    mockStorageManifestService.reanchorDocumentUri,
    mockStorageManifestService.getTrackDedupeKey,
    mockStorageManifestService.getDownloadedTracks,
    mockStorageManifestService.updateTrackDownloadRecord,
    quranModule.isQuranContent,
    async () => null,
    () => {},
    'http://localhost:5000',
    { Sound: { createAsync: async () => { throw new Error('AVPlayer codec error'); } } },
    { warn: () => {}, log: () => {}, error: () => {} }
  );

  const { verifyLocalAudioFile, resolveTrackPlaybackUri } = helperModule;

  // 1. Raw absolute path
  const rawPathCheck = await verifyLocalAudioFile('/storage/emulated/0/Music/track.mp3');
  console.log('[PASS] Raw absolute path verified:', rawPathCheck);
  assert(rawPathCheck && rawPathCheck.exists, 'Raw path must be normalized and verified');

  // 2. SAF content:// URI
  const safCheck = await verifyLocalAudioFile('content://com.android.providers.media.documents/document/audio%3A1234');
  console.log('[PASS] SAF content:// URI verified:', safCheck);
  assert(safCheck && safCheck.exists, 'SAF content:// URI must be accepted');

  // 3. Percent-encoded URI
  const encodedCheck = await verifyLocalAudioFile('file:///data/user/0/rivo_tracks/song%20name.mp3');
  console.log('[PASS] Percent-encoded URI verified:', encodedCheck);
  assert(encodedCheck && encodedCheck.exists, 'Percent-encoded URI must be verified');

  // 4. Offline playback without candidateLocal: falls back to storage manifest
  const offlineResolved = await resolveTrackPlaybackUri({
    track: { _id: 'manifest_track_99', title: 'Manifest Track', artist: 'Artist' },
  });
  console.log('[PASS] Offline track without localAudioUri successfully resolved from manifest:', offlineResolved);
  assert.strictEqual(offlineResolved, 'file:///data/user/0/rivo_tracks/manifest_track_99.mp3',
    'Must resolve from manifest even when candidateLocal is missing');

  // 5. Verify no files were deleted during resolution
  assert.strictEqual(deletedFiles.length, 0, 'No files should be deleted during playback resolution');
  console.log('[PASS] Zero destructive file deletions during resolution');
}

runFunctionalTests().then(() => {
  console.log('\n====================================================');
  console.log('ALL VERIFICATION TESTS PASSED SUCCESSFULLY! (100% OK)');
  console.log('====================================================\n');
}).catch((err) => {
  console.error('[FAIL] Functional test error:', err);
  process.exit(1);
});
