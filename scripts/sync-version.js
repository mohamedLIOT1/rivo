const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function syncVersion(customVersion, customBuild) {
  const pkgPath = path.join(rootDir, 'package.json');
  let pkg = {};
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (e) {}

  const version = customVersion || pkg.version || '2.4.41';
  let buildNumber = customBuild;

  if (!buildNumber) {
    // Derive build number or increment: 2.4.41 -> 154
    const versionJsPath = path.join(rootDir, 'src', 'native', 'version.js');
    if (fs.existsSync(versionJsPath)) {
      const match = fs.readFileSync(versionJsPath, 'utf8').match(/ANDROID_BUILD\s*=\s*'(\d+)'/);
      if (match) {
        buildNumber = String(parseInt(match[1], 10) + 1);
      }
    }
  }
  if (!buildNumber) {
    buildNumber = '154';
  }

  const today = new Date().toISOString().split('T')[0];

  console.log(`[sync-version] Synchronizing codebase to v${version} (Build ${buildNumber})...`);

  // 1. package.json
  if (pkg.version !== version) {
    pkg.version = version;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log(`  -> Updated package.json`);
  }

  // 2. src/native/version.js
  const versionJsContent = `import { Platform } from 'react-native';

// Centralized Application Versions for Mobile Layer (APK / IPA)
export const ANDROID_VERSION = '${version}';
export const ANDROID_BUILD = '${buildNumber}';

export const IOS_VERSION = '${version}';
export const IOS_BUILD = '${buildNumber}';

export const isAndroid = Platform.OS === 'android';
export const APP_PLATFORM = isAndroid ? 'android' : 'ios';
export const APP_VERSION = isAndroid ? ANDROID_VERSION : IOS_VERSION;
export const BUILD_NUMBER = isAndroid ? ANDROID_BUILD : IOS_BUILD;
export const PLATFORM_NAME = isAndroid ? 'Rivo for Android (APK)' : 'Rivo for iOS (IPA)';
export const FULL_VERSION = \`v\${APP_VERSION} (Build \${BUILD_NUMBER}) [\${isAndroid ? 'APK' : 'IPA'}]\`;
export const BUILD_DATE = '${today}';

export default {
  version: APP_VERSION,
  build: BUILD_NUMBER,
  platform: APP_PLATFORM,
  platformName: PLATFORM_NAME,
  fullVersion: FULL_VERSION,
  buildDate: BUILD_DATE,
};
`;
  const versionJsPath = path.join(rootDir, 'src', 'native', 'version.js');
  fs.writeFileSync(versionJsPath, versionJsContent, 'utf8');
  console.log(`  -> Updated src/native/version.js`);

  // 3. app.json
  const appJsonPath = path.join(rootDir, 'app.json');
  if (fs.existsSync(appJsonPath)) {
    try {
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
      if (appJson.expo) {
        appJson.expo.version = version;
        if (appJson.expo.android) {
          appJson.expo.android.versionCode = parseInt(buildNumber, 10);
        }
        if (appJson.expo.ios) {
          appJson.expo.ios.buildNumber = String(buildNumber);
        }
        fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf8');
        console.log(`  -> Updated app.json`);
      }
    } catch (e) {
      console.warn(`  [WARN] Failed to update app.json:`, e.message);
    }
  }

  // 4. android/app/build.gradle
  const buildGradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
  if (fs.existsSync(buildGradlePath)) {
    try {
      let gradle = fs.readFileSync(buildGradlePath, 'utf8');
      gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${buildNumber}`);
      gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);
      fs.writeFileSync(buildGradlePath, gradle, 'utf8');
      console.log(`  -> Updated android/app/build.gradle`);
    } catch (e) {
      console.warn(`  [WARN] Failed to update build.gradle:`, e.message);
    }
  }

  // 5. scripts/repack_ios_ipa.py
  const repackPyPath = path.join(rootDir, 'scripts', 'repack_ios_ipa.py');
  if (fs.existsSync(repackPyPath)) {
    try {
      let py = fs.readFileSync(repackPyPath, 'utf8');
      py = py.replace(/VERSION\s*=\s*'[^']+'/, `VERSION = '${version}'`);
      py = py.replace(/BUILD_NUM\s*=\s*'[^']+'/, `BUILD_NUM = '${buildNumber}'`);
      fs.writeFileSync(repackPyPath, py, 'utf8');
      console.log(`  -> Updated scripts/repack_ios_ipa.py`);
    } catch (e) {
      console.warn(`  [WARN] Failed to update repack_ios_ipa.py:`, e.message);
    }
  }

  console.log(`✅ All version references synchronized to v${version} (${buildNumber}).\n`);
  return { version, buildNumber };
}

if (require.main === module) {
  const argVer = process.argv[2];
  const argBuild = process.argv[3];
  syncVersion(argVer, argBuild);
}

module.exports = { syncVersion };
