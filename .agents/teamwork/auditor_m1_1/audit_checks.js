const fs = require('fs');
const path = require('path');

const root = 'c:/Users/mohamed/Downloads/rivo-main/rivo-main';

const deletedTargets = [
  'src/native/screens/OnlineWebView.js',
  'src/screens/MixesScreen.jsx',
  'src/native/screens/MixesScreen.js',
  'src/components/EqualizerModal.jsx',
  'src/native/components/EqualizerModal.js',
  'src/native/components/ModeToggle.js',
  'src/native/ui/BrutalButton.js',
  'scripts/archive',
  'android-webview',
  'desktop-app',
  'release-desktop/Rivo.exe',
  'release-desktop/Rivo.pdb',
  'ios_main.hermes.bundle',
  'ios_main.jsbundle',
  'assets-ios',
  'ios_assets',
  'assets/assets/assets'
];

const keptTargets = [
  'src/native/components/CachedImage.js',
  'scripts/generate_splash.ps1',
  'scripts/publish-ota.js',
  'scripts/benchmark_fallbacks.py',
  '../benchmark_playback.py',
  '../test_stream_proxy.py',
  '../verify_duckdns_playback.py',
  '../test_duckdns_timeout.py'
];

console.log('=== CHECKING DELETED TARGETS ===');
let deletionViolations = 0;
for (const rel of deletedTargets) {
  const full = path.resolve(root, rel);
  const exists = fs.existsSync(full);
  console.log(`[DELETED CHECK] ${rel}: ${exists ? 'STILL EXISTS (VIOLATION)' : 'CONFIRMED DELETED (PASS)'}`);
  if (exists) deletionViolations++;
}

console.log('\n=== CHECKING KEPT TARGETS ===');
let keptViolations = 0;
for (const rel of keptTargets) {
  const full = path.resolve(root, rel);
  const exists = fs.existsSync(full);
  const size = exists ? fs.statSync(full).size : 0;
  console.log(`[KEPT CHECK] ${rel}: ${exists ? `EXISTS (${size} bytes) (PASS)` : 'MISSING (VIOLATION)'}`);
  if (!exists) keptViolations++;
}

console.log('\n=== SUMMARY ===');
console.log(`Deletion violations: ${deletionViolations}`);
console.log(`Kept asset violations: ${keptViolations}`);

process.exit(deletionViolations + keptViolations);
