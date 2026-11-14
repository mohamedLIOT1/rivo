const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const curVersion = pkg.version || '2.4.45';
const parts = curVersion.split('.').map(Number);
parts[2] = (parts[2] || 0) + 1;
const newVersion = parts.join('.');
const newBuild = String(parseInt(parts[2], 10) + 119); // e.g. 165

console.log(`[Version Bumper] Bumping version from ${curVersion} -> ${newVersion} (Build ${newBuild})`);

// 1. package.json
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('✅ Updated package.json');

// 2. app.json
const appJsonPath = path.join(root, 'app.json');
if (fs.existsSync(appJsonPath)) {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  if (appJson.expo) {
    appJson.expo.version = newVersion;
    if (appJson.expo.android) appJson.expo.android.versionCode = parseInt(newBuild, 10);
    if (appJson.expo.ios) appJson.expo.ios.buildNumber = newBuild;
  }
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
  console.log('✅ Updated app.json');
}

// 3. src/native/version.js
const versionJsPath = path.join(root, 'src', 'native', 'version.js');
if (fs.existsSync(versionJsPath)) {
  let content = fs.readFileSync(versionJsPath, 'utf8');
  content = content.replace(/ANDROID_VERSION = '[^']+'/, `ANDROID_VERSION = '${newVersion}'`);
  content = content.replace(/ANDROID_BUILD = '[^']+'/, `ANDROID_BUILD = '${newBuild}'`);
  content = content.replace(/IOS_VERSION = '[^']+'/, `IOS_VERSION = '${newVersion}'`);
  content = content.replace(/IOS_BUILD = '[^']+'/, `IOS_BUILD = '${newBuild}'`);
  content = content.replace(/BUILD_DATE = '[^']+'/, `BUILD_DATE = '${new Date().toISOString().split('T')[0]}'`);
  fs.writeFileSync(versionJsPath, content);
  console.log('✅ Updated src/native/version.js');
}

// 4. src-tauri/tauri.conf.json
const tauriConfPath = path.join(root, 'src-tauri', 'tauri.conf.json');
if (fs.existsSync(tauriConfPath)) {
  try {
    const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
    if (tauriConf.package) tauriConf.package.version = newVersion;
    fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
    console.log('✅ Updated src-tauri/tauri.conf.json');
  } catch {}
}

// 5. server/ota-manifest.json
const otaManifestPath = path.join(root, 'server', 'ota-manifest.json');
if (fs.existsSync(otaManifestPath)) {
  try {
    const ota = JSON.parse(fs.readFileSync(otaManifestPath, 'utf8'));
    ota.version = newVersion;
    ota.releaseDate = new Date().toISOString();
    fs.writeFileSync(otaManifestPath, JSON.stringify(ota, null, 2) + '\n');
    console.log('✅ Updated server/ota-manifest.json');
  } catch {}
}

console.log(`🎉 Version successfully bumped to ${newVersion} across all manifests!`);
