const fs = require('fs');
const path = require('path');
const babel = require('c:/Users/mohamed/Downloads/rivo-main/rivo-main/node_modules/@babel/core');

const repoRoot = path.resolve('c:/Users/mohamed/Downloads/rivo-main/rivo-main');
const outerRoot = path.resolve('c:/Users/mohamed/Downloads/rivo-main');

console.log('--- INDEPENDENT REVIEWER VERIFICATION SUITE ---');

let failureCount = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('❌ FAIL:', msg);
    failureCount++;
  } else {
    console.log('✅ PASS:', msg);
  }
}

// 1. Verify 7 dead components deleted
const deadComponents = [
  'src/native/screens/OnlineWebView.js',
  'src/screens/MixesScreen.jsx',
  'src/native/screens/MixesScreen.js',
  'src/components/EqualizerModal.jsx',
  'src/native/components/EqualizerModal.js',
  'src/native/components/ModeToggle.js',
  'src/native/ui/BrutalButton.js'
];
for (const comp of deadComponents) {
  const full = path.join(repoRoot, comp);
  assert(!fs.existsSync(full), `Dead component deleted: ${comp}`);
}

// 2. Verify CachedImage.js preserved
const cachedImage = path.join(repoRoot, 'src/native/components/CachedImage.js');
assert(fs.existsSync(cachedImage) && fs.statSync(cachedImage).size > 100, 'CachedImage.js preserved and non-empty');

// 3. Verify active scripts preserved
const activeScripts = [
  'scripts/generate_splash.ps1',
  'scripts/publish-ota.js',
  'scripts/benchmark_fallbacks.py',
  'scripts/run_e2e_tests.py'
];
for (const scr of activeScripts) {
  const full = path.join(repoRoot, scr);
  assert(fs.existsSync(full), `Active script preserved: ${scr}`);
}

// Verify root test scripts preserved
const rootTestScripts = [
  'benchmark_playback.py',
  'test_stream_proxy.py',
  'verify_duckdns_playback.py',
  'test_duckdns_timeout.py'
];
for (const scr of rootTestScripts) {
  const full = path.join(outerRoot, scr);
  assert(fs.existsSync(full), `Root test script preserved: ${scr}`);
}

// Verify obsolete script archive deleted
assert(!fs.existsSync(path.join(repoRoot, 'scripts/archive')), 'scripts/archive/ directory deleted');

// 4. Verify abandoned subprojects and binary bloat deleted
const bloatPaths = [
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
for (const b of bloatPaths) {
  const full = path.join(repoRoot, b);
  assert(!fs.existsSync(full), `Bloat path deleted: ${b}`);
}

// 5. Deep AST & Import resolution check across all JS/JSX files
console.log('\n--- Scanning All Source Files for Broken Imports & Syntax Errors ---');
let filesChecked = 0;
let brokenImports = [];
let syntaxErrors = [];

const candidateExtensions = ['', '.js', '.jsx', '.json', '.ts', '.tsx', '/index.js', '/index.jsx'];

function checkCodeFile(file) {
  filesChecked++;
  const content = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);

  // Parse syntax
  try {
    babel.parseSync(content, {
      filename: file,
      presets: [
        require.resolve('c:/Users/mohamed/Downloads/rivo-main/rivo-main/node_modules/@babel/preset-react')
      ],
      configFile: false,
      babelrc: false
    });
  } catch (err) {
    syntaxErrors.push({ file: path.relative(repoRoot, file), error: err.message });
  }

  // Check imports
  const importRegex = /(?:import\s+(?:[\s\S]*?from\s+)?['"](\.[^'"]+)['"]|require\(['"](\.[^'"]+)['"]\)|import\(['"](\.[^'"]+)['"]\))/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const relTarget = match[1] || match[2] || match[3];
    const resolvedBase = path.resolve(dir, relTarget);

    const exists = candidateExtensions.some(ext => {
      try {
        const p = resolvedBase + ext;
        return fs.existsSync(p) && fs.statSync(p).isFile();
      } catch (e) {
        return false;
      }
    });

    if (!exists) {
      brokenImports.push({
        source: path.relative(repoRoot, file),
        target: relTarget,
        resolvedBase
      });
    }
  }
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', 'build', '.git', '.gradle', 'android', 'src-tauri', '.artifacts'].includes(entry.name)) {
        walkDir(fullPath);
      }
    } else if (/\.(jsx?|tsx?)$/.test(entry.name)) {
      checkCodeFile(fullPath);
    }
  }
}

// Check root files
['App.js', 'index.js'].forEach(f => {
  const p = path.join(repoRoot, f);
  if (fs.existsSync(p)) checkCodeFile(p);
});

// Check src, server, scripts
['src', 'server', 'scripts'].forEach(d => {
  const p = path.join(repoRoot, d);
  if (fs.existsSync(p)) walkDir(p);
});

console.log(`Scanned ${filesChecked} files.`);
if (syntaxErrors.length > 0) {
  console.error(`❌ Found ${syntaxErrors.length} syntax errors:`);
  syntaxErrors.forEach(e => console.error(`  - ${e.file}: ${e.error}`));
  failureCount += syntaxErrors.length;
} else {
  console.log('✅ ZERO syntax errors across all checked files.');
}

if (brokenImports.length > 0) {
  console.error(`❌ Found ${brokenImports.length} broken imports:`);
  brokenImports.forEach(b => console.error(`  - In ${b.source}: cannot resolve "${b.target}"`));
  failureCount += brokenImports.length;
} else {
  console.log('✅ ZERO broken local imports across all checked files.');
}

console.log('\n--- VERIFICATION SUMMARY ---');
if (failureCount === 0) {
  console.log('🎉 ALL INDEPENDENT VERIFICATION CHECKS PASSED PERFECTLY!');
  process.exit(0);
} else {
  console.error(`💥 TOTAL FAILURES: ${failureCount}`);
  process.exit(1);
}
