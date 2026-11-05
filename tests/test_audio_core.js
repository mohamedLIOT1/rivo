const fs = require('fs');
const path = require('path');
const assert = require('assert');

const baseDir = path.resolve(__dirname, '..');
const parser = require(path.join(baseDir, 'node_modules/@babel/parser'));
const traverse = require(path.join(baseDir, 'node_modules/@babel/traverse')).default;

console.log('--- STARTING AUDIO CORE TEST SUITE ---');

const files = [
  'src/native/context/audio/useAudioPlaybackCore.js',
  'src/native/context/audio/streamResolverHelper.js',
  'src/native/context/audio/playbackEngine.js',
  'src/native/context/audio/useJamPlaybackSync.js',
  'src/native/context/AudioContext.js',
  'src/native/context/audio/useAudioDownloads.js',
  'src/native/context/audio/useAudioPersistence.js',
  'src/native/context/audio/useAudioQueue.js'
];

// TEST 1: Babel Parser & Line Count Limit (AGENTS.md)
console.log('\n[TEST 1] Syntax Validation & 400-Line Limit Check:');
for (const relFile of files) {
  const fullPath = path.join(baseDir, relFile);
  const code = fs.readFileSync(fullPath, 'utf8');
  const lineCount = code.split('\n').length;
  
  assert(lineCount <= 400, `File ${relFile} exceeds 400 lines: ${lineCount}`);
  
  // Babel AST parse
  try {
    parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx']
    });
    console.log(`  PASS: ${relFile} (${lineCount} lines, valid AST)`);
  } catch (err) {
    console.error(`  FAIL: ${relFile} parse error:`, err.message);
    process.exit(1);
  }
}

// TEST 2: Undeclared Variable Scope Check
console.log('\n[TEST 2] Undeclared Variable Scope Check:');
const jsGlobals = new Set([
  'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'Promise', 'Math', 'Date', 'Boolean', 'Number', 'String', 'Array', 'Object',
  'Error', 'isNaN', 'isFinite', 'JSON', 'AbortController', 'fetch',
  'encodeURIComponent', 'decodeURIComponent', 'RegExp', 'Map', 'Set',
  'window', 'global', 'globalThis', 'alert', 'FormData', 'process',
  'requestAnimationFrame', 'cancelAnimationFrame', 'navigator', 'URL',
  'Intl', 'Uint8Array', 'ArrayBuffer', 'Blob', 'Headers', 'Request', 'Response',
  'Symbol'
]);

for (const relFile of files) {
  const fullPath = path.join(baseDir, relFile);
  const code = fs.readFileSync(fullPath, 'utf8');
  const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });
  
  const undeclared = [];
  traverse(ast, {
    ReferencedIdentifier(p) {
      const name = p.node.name;
      if (jsGlobals.has(name)) return;
      if (!p.scope.hasBinding(name)) {
        undeclared.push(`${name} at line ${p.node.loc?.start?.line}`);
      }
    }
  });

  assert.strictEqual(undeclared.length, 0, `Undeclared variables found in ${relFile}: ${undeclared.join(', ')}`);
  console.log(`  PASS: ${relFile} has 0 undeclared variables`);
}

// TEST 3: Verify isRemote fix specifically
console.log('\n[TEST 3] Verify isRemote fix in useAudioPlaybackCore.js:');
const coreCode = fs.readFileSync(path.join(baseDir, 'src/native/context/audio/useAudioPlaybackCore.js'), 'utf8');
assert(coreCode.includes('if (!Boolean(isRemoteParam) && jamSyncRef?.current?.jamSession && canControlJam())'), 'Expected `if (!Boolean(isRemoteParam) && jamSyncRef?.current?.jamSession && canControlJam())` in useAudioPlaybackCore.js');
console.log('  PASS: isRemote has been properly changed to Boolean(isRemoteParam)');

// Helper to evaluate ESM file in a sandbox with mocked imports
function evaluateEsmModule(code, mocks = {}) {
  let cjs = code.replace(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g, (match, names, mod) => {
    return names.split(',').map(n => {
      const parts = n.trim().split(/\s+as\s+/);
      const imported = parts[0].trim();
      const local = parts[1] ? parts[1].trim() : imported;
      return `const ${local} = (mocks['${mod}'] && mocks['${mod}']['${imported}']) || (() => {});`;
    }).join('\n');
  });

  cjs = cjs.replace(/import\s+(\w+)\s+from\s*['"]([^'"]+)['"];?/g, (match, defaultName, mod) => {
    return `const ${defaultName} = (mocks['${mod}'] && mocks['${mod}']['default']) || (mocks['${mod}']) || {};`;
  });

  cjs = cjs.replace(/export\s+const\s+(\w+)\s*=/g, 'const $1 = module.exports.$1 =');
  cjs = cjs.replace(/export\s+default\s+/g, 'module.exports =');

  const mockExports = {};
  const mockModule = { exports: mockExports };
  const fn = new Function('mocks', 'module', 'exports', cjs);
  fn(mocks, mockModule, mockExports);
  return mockModule.exports;
}

// TEST 4: Unit Test playbackEngine.handlePlaybackStatusUpdate logic
console.log('\n[TEST 4] Unit Test playbackEngine logic:');
const engineCode = fs.readFileSync(path.join(baseDir, 'src/native/context/audio/playbackEngine.js'), 'utf8');
const { handlePlaybackStatusUpdate } = evaluateEsmModule(engineCode, {
  '../AudioProgressContext': { updateAudioProgress: () => {} },
  '../../services/youtubeResolver': { clearStreamCache: () => {} },
  '../../../utils/quranUtils': { isQuranContent: () => false },
});

assert(typeof handlePlaybackStatusUpdate === 'function', 'handlePlaybackStatusUpdate should be a function');

// Scenario 4A: Normal position update
const playbackStatusRef = { current: { currentTime: 0, duration: 100 } };
const progressRef = { current: { currentTime: 0, duration: 100 } };
const currentTrackRef = { current: { _id: 'track1', duration: 100 } };

handlePlaybackStatusUpdate({
  status: { isLoaded: true, isPlaying: true, positionMillis: 15000, durationMillis: 100000 },
  playbackStatusRef,
  progressRef,
  currentTrackRef,
  soundRef: { current: null },
  shouldBePlayingRef: { current: true },
  isLoadingRef: { current: false },
  loadedTrackIdRef: { current: 'track1' },
  isSeekingRef: { current: false },
  lastSeekTimestampRef: { current: 0 },
  stallRecoveryTimerRef: { current: null },
  isMixModeRef: { current: false },
  activeTransRef: { current: null },
  queueRef: { current: [] },
  volumeRef: { current: 0.8 },
  lastMixBridgeUpdateRef: { current: 0 },
  nextSoundRef: { current: null },
  isMixTransitioningRef: { current: false },
  completeSeamlessHandoff: () => {},
  preloadNextTrackForDjMix: () => {},
  playTrack: () => {},
  playNextTrack: () => {},
  repeatModeRef: { current: 'off' },
  autoPersistFinishedTrack: () => {},
  handleDownloadTrack: () => {},
  autoDownloadFinishedRef: { current: false },
  updateMediaNotification: () => {},
  likedTrackIds: [],
  isShuffleRef: { current: false },
});

assert.strictEqual(playbackStatusRef.current.currentTime, 15, 'Current time should update to 15s');
console.log('  PASS: Normal position update processed correctly (currentTime = 15s)');

// Scenario 4B: didJustFinish triggers next track
let nextTrackCalled = false;
let persistedTrack = null;
handlePlaybackStatusUpdate({
  status: { isLoaded: true, isPlaying: false, didJustFinish: true, positionMillis: 100000, durationMillis: 100000 },
  playbackStatusRef,
  progressRef,
  currentTrackRef,
  soundRef: { current: null },
  shouldBePlayingRef: { current: true },
  isLoadingRef: { current: false },
  loadedTrackIdRef: { current: 'track1' },
  isSeekingRef: { current: false },
  lastSeekTimestampRef: { current: 0 },
  stallRecoveryTimerRef: { current: null },
  isMixModeRef: { current: false },
  activeTransRef: { current: null },
  queueRef: { current: [] },
  volumeRef: { current: 0.8 },
  lastMixBridgeUpdateRef: { current: 0 },
  nextSoundRef: { current: null },
  isMixTransitioningRef: { current: false },
  completeSeamlessHandoff: () => {},
  preloadNextTrackForDjMix: () => {},
  playTrack: () => {},
  playNextTrack: () => { nextTrackCalled = true; },
  repeatModeRef: { current: 'off' },
  autoPersistFinishedTrack: (t) => { persistedTrack = t; },
  handleDownloadTrack: () => {},
  autoDownloadFinishedRef: { current: false },
  updateMediaNotification: () => {},
  likedTrackIds: [],
  isShuffleRef: { current: false },
});

assert.strictEqual(nextTrackCalled, true, 'playNextTrack should be called on finish');
assert.strictEqual(persistedTrack?._id, 'track1', 'Finished track should be auto-persisted');
console.log('  PASS: Track completion handles auto-persist and playNextTrack');

// TEST 5: Verify useAudioPlaybackCore mock execution
console.log('\n[TEST 5] Unit Test useAudioPlaybackCore instantiation:');
const hookCode = fs.readFileSync(path.join(baseDir, 'src/native/context/audio/useAudioPlaybackCore.js'), 'utf8');
const { useAudioPlaybackCore } = evaluateEsmModule(hookCode, {
  'react': {
    useState: (init) => [init, () => {}],
    useRef: (init) => ({ current: init }),
    useEffect: () => {},
    useCallback: (fn) => fn,
  },
  '@react-native-async-storage/async-storage': { getItem: async () => null, setItem: async () => null },
  '../../services/mediaControls': { updateMediaNotification: () => {} },
  '../AudioProgressContext': { updateAudioProgress: () => {} },
  './playbackEngine': { handlePlaybackStatusUpdate: () => {} },
  './streamResolverHelper': { resolveTrackPlaybackUri: async () => 'test-uri', createAudioSound: async () => ({ sound: {}, status: {} }) },
  './useAudioPersistence': { saveLastPlayedState: async () => {} },
});

const coreInstance = useAudioPlaybackCore({
  likedTrackIds: [],
  showToast: () => {},
  queueRef: { current: [] },
  setQueue: () => {},
  isShuffleRef: { current: false },
  repeatModeRef: { current: 'off' },
  isMixModeRef: { current: false },
  activeTransRef: { current: null },
  setActiveTransitions: () => {},
  nextSoundRef: { current: null },
  nextTrackRef: { current: null },
  nextSoundPlayingRef: { current: false },
  preloadNextTrackForDjMix: () => {},
  completeSeamlessHandoff: () => {},
  isMixTransitioningRef: { current: false },
  lastMixBridgeUpdateRef: { current: 0 },
  autoDownloadFinishedRef: { current: false },
  handleDownloadTrack: () => {},
  autoPersistFinishedTrack: () => {},
  broadcastListeningActivity: () => {},
  jamSyncRef: { current: { jamSession: null } },
  canControlJam: () => true,
});

assert(coreInstance.playTrack, 'playTrack must exist');
assert(coreInstance.togglePlay, 'togglePlay must exist');
assert(coreInstance.seekTo, 'seekTo must exist');
assert(coreInstance.playPlaylist, 'playPlaylist must exist');
console.log('  PASS: useAudioPlaybackCore initializes cleanly and exposes all playback API controls');

// Test playTrack with isRemoteParam = false without crashing!
coreInstance.playTrack({ _id: 'test_track', title: 'Test', duration: 180 }, [], false, 0, false);
console.log('  PASS: playTrack executes without ReferenceError (isRemoteParam resolved)');

console.log('\n--- ALL AUDIO CORE TESTS PASSED SUCCESSFULLY! ---');
