const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const otaOutputDir = path.join(rootDir, 'public', 'downloads', 'ota');
const bundlePath = path.join(otaOutputDir, 'index.android.bundle');
const manifestPath = path.join(rootDir, 'server', 'ota-manifest.json');

// Ensure output dir exists
if (!fs.existsSync(otaOutputDir)) {
  fs.mkdirSync(otaOutputDir, { recursive: true });
}

// 1. Determine version number
const argVersion = process.argv[2];
let targetVersion = argVersion;

if (!targetVersion) {
  let prevVersion = '1.9.5.0';
  if (fs.existsSync(manifestPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (existing?.version) prevVersion = existing.version;
    } catch (e) {}
  }
  const parts = prevVersion.split('.');
  const lastNum = parseInt(parts.pop() || '0', 10) + 1;
  parts.push(String(lastNum));
  targetVersion = parts.join('.');
}

const notes = process.argv[3] || 'تحديث هوائي فوري (حجم 3 ميجابايت فقط) • بدون إعادة تثبيت التطبيق • أحدث التحسينات والإصلاحات';
const notesEn = process.argv[4] || 'Instant in-app OTA update (3MB only) • No reinstall required • Performance improvements and bug fixes.';

console.log(`\n========================================`);
console.log(`🚀 Building Rivo OTA Fast Update v${targetVersion}...`);
console.log(`========================================\n`);

const cmd = `node node_modules/@expo/cli/build/bin/cli export:embed --entry-file index.js --platform android --dev false --bundle-output "${bundlePath}" --assets-dest "${path.join(rootDir, 'android', 'app', 'src', 'main', 'res')}"`;

try {
  console.log('Running Metro bundler (takes ~30-60s)...');
  execSync(cmd, { cwd: rootDir, stdio: 'inherit' });

  if (!fs.existsSync(bundlePath)) {
    throw new Error('Bundle file was not generated!');
  }

  const stat = fs.statSync(bundlePath);
  const sizeMb = (stat.size / 1024 / 1024).toFixed(2);
  const realSizeFormatted = `${sizeMb} MB`;
  const notes = userNotes || `تحديث هوائي فوري (${realSizeFormatted}) • بدون إعادة تثبيت التطبيق • أحدث التحسينات والإصلاحات`;
  const notesEn = userNotesEn || `Instant in-app OTA update (${realSizeFormatted}) • No reinstall required • Performance improvements and bug fixes.`;

  // 2. Update server/ota-manifest.json
  const manifest = {
    enabled: true,
    version: targetVersion,
    bundleUrl: '/downloads/ota/index.android.bundle',
    minAppVersion: '1.9.6',
    notes,
    notesEn,
    bundleSize: stat.size,
    sizeMb: realSizeFormatted,
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`\n✅ OTA Update Published Successfully!`);
  console.log(`- Version: v${targetVersion}`);
  console.log(`- Bundle Size: ${sizeMb} MB`);
  console.log(`- Manifest: ${manifestPath}`);
  console.log(`\nAll mobile users will now receive this update in seconds without reinstalling APK!\n`);
} catch (err) {
  console.error('\n❌ OTA Build Failed:', err.message);
  process.exit(1);
}
