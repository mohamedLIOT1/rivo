const fs = require('fs');
const path = require('path');
const assert = require('assert');

const baseDir = path.resolve(__dirname, '..');
const parser = require(path.join(baseDir, 'node_modules/@babel/parser'));
const traverse = require(path.join(baseDir, 'node_modules/@babel/traverse')).default;

console.log('--- STARTING MEDIA CONTROLS & LOCK SCREEN TEST SUITE ---');

// TEST 1: Check 400-line limit across all modified and created files
console.log('\n[TEST 1] AGENTS.md 400-Line Limit Check:');
const monitoredFiles = [
  'modules/media-controls/RivoMediaControls.m',
  'modules/media-controls/RivoMediaControls.h',
  'modules/media-controls/RivoArtworkLoader.m',
  'modules/media-controls/RivoArtworkLoader.h',
  'android/app/src/main/java/com/rivo/app/MediaControlsModule.kt',
  'android/app/src/main/java/com/rivo/app/MediaNotificationService.kt',
  'android/app/src/main/java/com/rivo/app/MediaNotificationBuilder.kt',
  'android/app/src/main/java/com/rivo/app/MediaArtworkHelper.kt',
  'android/app/src/main/java/com/rivo/app/RivoOtaHelper.kt',
  'android/app/src/main/java/com/rivo/app/LockScreenActivity.kt',
  'src/native/services/mediaControls.js',
  'src/native/components/settings/LockscreenSettingCard.js',
  'src/native/context/audio/useAudioMediaSession.js'
];

for (const relFile of monitoredFiles) {
  const fullPath = path.join(baseDir, relFile);
  assert(fs.existsSync(fullPath), `File does not exist: ${relFile}`);
  const lines = fs.readFileSync(fullPath, 'utf8').split('\n').length;
  assert(lines <= 400, `File ${relFile} exceeds 400 lines: ${lines}`);
  console.log(`  PASS: ${relFile} (${lines} lines <= 400)`);
}

// TEST 2: Syntax & AST validation for JS files
console.log('\n[TEST 2] JS Syntax & AST Validation:');
const jsFiles = [
  'src/native/services/mediaControls.js',
  'src/native/components/settings/LockscreenSettingCard.js',
  'src/native/context/audio/useAudioMediaSession.js'
];

for (const relFile of jsFiles) {
  const fullPath = path.join(baseDir, relFile);
  const code = fs.readFileSync(fullPath, 'utf8');
  try {
    parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx']
    });
    console.log(`  PASS: ${relFile} parsed cleanly`);
  } catch (err) {
    console.error(`  FAIL: ${relFile} parse error:`, err.message);
    process.exit(1);
  }
}

// TEST 3: iOS Audio Session & Remote Commands Verification
console.log('\n[TEST 3] iOS Audio Session & Remote Commands Verification:');
const objcCode = fs.readFileSync(path.join(baseDir, 'modules/media-controls/RivoMediaControls.m'), 'utf8');
assert(!objcCode.includes('AVAudioSessionCategoryOptionDefaultToSpeaker'), 'RivoMediaControls.m must NOT contain AVAudioSessionCategoryOptionDefaultToSpeaker with Playback category');
assert(objcCode.includes('AVAudioSessionCategoryPlayback'), 'RivoMediaControls.m must set AVAudioSessionCategoryPlayback');
assert(objcCode.includes('MPMediaItemPropertyMediaType'), 'RivoMediaControls.m must set MPMediaItemPropertyMediaType for Dynamic Island');
assert(objcCode.includes('checkNotificationPermission:'), 'RivoMediaControls.m must export checkNotificationPermission:');
assert(objcCode.includes('requestNotificationPermission:'), 'RivoMediaControls.m must export requestNotificationPermission:');
console.log('  PASS: iOS AudioSession category is valid and free of invalid DefaultToSpeaker option');
console.log('  PASS: Dynamic Island MPMediaTypeMusic metadata & permission methods present');

// TEST 4: Android Channel & Permission Verification
console.log('\n[TEST 4] Android Channel & Permission Verification:');
const builderCode = fs.readFileSync(path.join(baseDir, 'android/app/src/main/java/com/rivo/app/MediaNotificationBuilder.kt'), 'utf8');
assert(builderCode.includes('lockscreenVisibility = Notification.VISIBILITY_PUBLIC'), 'Notification channel must set lockscreenVisibility to VISIBILITY_PUBLIC');
assert(builderCode.includes('build('), 'MediaNotificationBuilder must define build()');

const serviceCode = fs.readFileSync(path.join(baseDir, 'android/app/src/main/java/com/rivo/app/MediaNotificationService.kt'), 'utf8');
assert(serviceCode.includes('buildMediaNotification(withFullScreenLock)'), 'updateNotification must forward withFullScreenLock to buildMediaNotification');
assert(serviceCode.includes('setSessionActivity(sessionActivityIntent)'), 'MediaSessionCompat must set session activity intent for SystemUI');

const moduleCode = fs.readFileSync(path.join(baseDir, 'android/app/src/main/java/com/rivo/app/MediaControlsModule.kt'), 'utf8');
assert(moduleCode.includes('checkNotificationPermission'), 'MediaControlsModule must implement checkNotificationPermission');
assert(moduleCode.includes('requestNotificationPermission'), 'MediaControlsModule must implement requestNotificationPermission');
assert(moduleCode.includes('POST_NOTIFICATIONS'), 'MediaControlsModule must handle POST_NOTIFICATIONS');
console.log('  PASS: Android MediaNotificationService lockscreen visibility & fullScreenLock fixed');
console.log('  PASS: Android MediaControlsModule POST_NOTIFICATIONS permission methods implemented');

// TEST 5: Media Controls JS API & Action Subscription Unit Test
console.log('\n[TEST 5] Media Controls JS API & Subscription Unit Test:');
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

let registeredListener = null;
const mockDeviceEventEmitter = {
  addListener: (event, callback) => {
    if (event === 'onMediaAction') {
      registeredListener = callback;
    }
    return { remove: () => { registeredListener = null; } };
  }
};

const mediaControlsCode = fs.readFileSync(path.join(baseDir, 'src/native/services/mediaControls.js'), 'utf8');
const mediaControls = evaluateEsmModule(mediaControlsCode, {
  'react-native': {
    NativeModules: {
      RivoMediaControls: {
        showNotification: () => {},
        updatePlayback: () => {},
        hideNotification: () => {},
        checkNotificationPermission: async () => true,
        requestNotificationPermission: async () => true,
        openNotificationSettings: async () => true,
        addListener: () => {},
        removeListeners: () => {},
      }
    },
    DeviceEventEmitter: mockDeviceEventEmitter,
    NativeEventEmitter: function() { return mockDeviceEventEmitter; },
    Platform: { OS: 'android', Version: 34 },
    PermissionsAndroid: {
      PERMISSIONS: { POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS' },
      RESULTS: { GRANTED: 'granted' },
      check: async () => true,
      request: async () => 'granted',
    }
  },
  '../utils/coverUtils': { normalizeCoverUri: (uri) => uri || '' }
});

assert(typeof mediaControls.checkNotificationPermission === 'function', 'checkNotificationPermission must be exported');
assert(typeof mediaControls.requestNotificationPermission === 'function', 'requestNotificationPermission must be exported');
assert(typeof mediaControls.openNotificationSettings === 'function', 'openNotificationSettings must be exported');
assert(typeof mediaControls.subscribeToMediaActions === 'function', 'subscribeToMediaActions must be exported');

// Test action routing
let playCalled = false;
let pauseCalled = false;
let seekValue = null;

const sub = mediaControls.subscribeToMediaActions({
  onPlay: () => { playCalled = true; },
  onPause: () => { pauseCalled = true; },
  onSeek: (pos) => { seekValue = pos; },
});

assert(registeredListener, 'Listener must be registered on emitter');
registeredListener('play');
assert.strictEqual(playCalled, true, 'onPlay should be triggered on "play" event');

registeredListener('pause');
assert.strictEqual(pauseCalled, true, 'onPause should be triggered on "pause" event');

registeredListener('seek:45.5');
assert.strictEqual(seekValue, 45.5, 'onSeek should receive 45.5 seconds');

sub();
assert.strictEqual(registeredListener, null, 'Unsubscribe must detach the listener');
console.log('  PASS: Media controls subscription and event routing works with 100% precision');

console.log('\n--- ALL MEDIA CONTROLS & LOCK SCREEN TESTS PASSED! ---');
