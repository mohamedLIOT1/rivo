import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import { applyOtaBundle, reloadApp, clearOtaBundle, getOtaInfo } from './mediaControls';
import { ANDROID_VERSION, APP_VERSION } from '../version';
import { API_BASE_URL } from '../config';

const STORAGE_KEYS = {
  OTA_VERSION: 'rivo_ota_version',
  OTA_BOOT_FLAG: 'rivo_ota_boot_flag',
  OTA_CRASH_COUNT: 'rivo_ota_crash_count'
};

/**
 * Normalize version strings to handle legacy OTA numbering schemes.
 * In Rivo 2.4.x, OTAs were auto-incremented as 2.4.14, 2.4.15, 2.4.16 where:
 *   - 2.4.14 corresponds to patch 4 (base APK 2.4.4 / 2.4.1.4)
 *   - 2.4.15 corresponds to patch 5 (base APK 2.4.5)
 *   - 2.4.16 corresponds to patch 6 (base APK 2.4.6)
 * Mapping 2.4.1X to 2.4.X guarantees that a newer APK (e.g. 2.4.6) is recognized
 * as >= 2.4.16 and > 2.4.15, preventing stale older OTAs from being offered.
 */
export const normalizeVersion = (v) => {
  if (!v) return '0.0.0';
  let str = String(v).trim().replace(/^v/i, '');
  if (/^2\.4\.(1[4-9]|2\d)(\.|$)/.test(str)) {
    const match = str.match(/^2\.4\.(1[4-9]|2\d)(.*)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      const patch = num - 10;
      str = `2.4.${patch}${match[2] || ''}`;
    }
  }
  return str;
};

/**
 * Compare two semver-like strings (e.g. "2.4.6" vs "2.4.15")
 * Returns >0 if v1 > v2, <0 if v1 < v2, 0 if equal
 */
export const compareVersions = (v1, v2) => {
  if (!v1 && !v2) return 0;
  if (!v1) return -1;
  if (!v2) return 1;
  const s1 = normalizeVersion(v1);
  const s2 = normalizeVersion(v2);
  const p1 = s1.replace(/[^0-9.]/g, '').split('.').map(Number);
  const p2 = s2.replace(/[^0-9.]/g, '').split('.').map(Number);
  const maxLen = Math.max(p1.length, p2.length);
  for (let i = 0; i < maxLen; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
};

/**
 * Returns the underlying installed base APK binary version
 */
export const getBaseAppVersion = () => {
  return (
    APP_VERSION ||
    ANDROID_VERSION ||
    Constants?.nativeAppVersion ||
    Constants?.expoConfig?.version ||
    '2.4.1'
  );
};

/**
 * Get current installed OTA version (or null if running default APK bundle)
 * If the installed base APK is >= stored OTA version, the stale stored OTA
 * record is purged and null is returned.
 */
export const getCurrentOtaVersion = async () => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.OTA_VERSION);
    if (!stored) return null;

    const baseVersion = getBaseAppVersion();
    // Guard: If base APK version is >= stored OTA version, the stored OTA is obsolete!
    if (baseVersion && compareVersions(baseVersion, stored) >= 0) {
      await AsyncStorage.removeItem(STORAGE_KEYS.OTA_VERSION).catch(() => {});
      if (Platform.OS === 'android') {
        await clearOtaBundle().catch(() => {});
      }
      return null;
    }

    if (Platform.OS === 'android') {
      const info = await getOtaInfo().catch(() => null);
      if (info && info.exists === false) {
        await AsyncStorage.removeItem(STORAGE_KEYS.OTA_VERSION).catch(() => {});
        return null;
      }
    }
    return stored;
  } catch {
    return null;
  }
};

/**
 * Check if an OTA update should be prompted / applied
 */
export const isOtaUpdateAvailable = (otaManifest, currentOta, baseVersion = getBaseAppVersion()) => {
  if (Platform.OS !== 'android') return false;
  if (!otaManifest || otaManifest.enabled === false || !otaManifest.version) return false;
  const base = APP_VERSION || baseVersion;

  // 1. If base APK is already newer than or equal to the OTA release, NEVER offer it!
  // (e.g. Base APK 2.4.6 must NOT be offered OTA 2.4.15 or 2.4.16)
  if (base && compareVersions(base, otaManifest.version) >= 0) {
    return false;
  }

  // 2. Active version check: if running an OTA that is already >= manifest version
  const activeVer = (currentOta && compareVersions(currentOta, base) > 0) ? currentOta : base;
  if (activeVer && compareVersions(activeVer, otaManifest.version) >= 0) {
    return false;
  }

  // 3. Binary compatibility check: APK must satisfy minimum required binary version
  const minRequired = otaManifest.minAppVersion || '1.0.0';
  if (compareVersions(base, minRequired) < 0) {
    return false;
  }
  return true;
};

/**
 * Poll dedicated server OTA endpoint
 */
export const fetchOtaManifest = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/app/ota`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
};

/**
 * Safety mechanism: Guard against faulty bundles.
 * If the app crashes during boot on an OTA bundle, rollback to APK assets.
 */
export const initOtaCrashGuard = async () => {
  if (Platform.OS !== 'android') return;
  try {
    // Proactively verify & purge stale stored OTA if newer base APK was installed
    await getCurrentOtaVersion().catch(() => {});

    const bootFlag = await AsyncStorage.getItem(STORAGE_KEYS.OTA_BOOT_FLAG);
    if (bootFlag === 'booting') {
      let crashCount = parseInt((await AsyncStorage.getItem(STORAGE_KEYS.OTA_CRASH_COUNT)) || '0', 10) + 1;
      if (crashCount >= 5) {
        console.warn('[RivoOTA] Crash detected on OTA bundle! Rolling back to stock bundle...');
        await clearOtaBundle();
        await AsyncStorage.removeItem(STORAGE_KEYS.OTA_VERSION);
        await AsyncStorage.removeItem(STORAGE_KEYS.OTA_BOOT_FLAG);
        await AsyncStorage.removeItem(STORAGE_KEYS.OTA_CRASH_COUNT);
        return;
      }
      await AsyncStorage.setItem(STORAGE_KEYS.OTA_CRASH_COUNT, String(crashCount));
    }

    await AsyncStorage.setItem(STORAGE_KEYS.OTA_BOOT_FLAG, 'booting');

    setTimeout(async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.OTA_BOOT_FLAG, 'healthy');
        await AsyncStorage.setItem(STORAGE_KEYS.OTA_CRASH_COUNT, '0');
      } catch {}
    }, 2500);
  } catch (err) {
    console.warn('[RivoOTA] Crash guard check failed:', err);
  }
};

/**
 * Check and download an OTA update if available and newer
 * @param {Object} otaManifest - { enabled, version, bundleUrl, minAppVersion, notes }
 * @param {Function} onProgress - Callback (progress: 0 to 1, bytesWritten, totalBytes)
 */
export const checkAndDownloadOta = async (otaManifest, onProgress) => {
  if (Platform.OS !== 'android') {
    return { available: false, reason: 'unsupported_platform' };
  }

  const isEnabled = otaManifest && otaManifest.enabled !== false;
  if (!otaManifest || !isEnabled || !otaManifest.bundleUrl || !otaManifest.version) {
    return { available: false, reason: 'manifest_empty' };
  }

  const baseVersion = APP_VERSION || getBaseAppVersion();

  // Guard: If base APK is already newer than or equal to the OTA release, no update needed!
  if (baseVersion && compareVersions(baseVersion, otaManifest.version) >= 0) {
    return { available: false, reason: 'already_up_to_date' };
  }

  // Check minimum binary compatibility
  const minRequired = otaManifest.minAppVersion || '1.0.0';
  if (compareVersions(baseVersion, minRequired) < 0) {
    return { available: false, reason: 'requires_full_apk', minAppVersion: minRequired };
  }

  const currentOta = await getCurrentOtaVersion();
  // If already running this or newer OTA version, no update needed
  const activeVer = (currentOta && compareVersions(currentOta, baseVersion) > 0) ? currentOta : baseVersion;
  if (activeVer && compareVersions(activeVer, otaManifest.version) >= 0) {
    return { available: false, reason: 'already_up_to_date' };
  }

  // Download the bundle
  const tempFileUri = `${FileSystem.cacheDirectory}rivo_ota_temp_${Date.now()}.bundle`;

  try {
    const downloadResumable = FileSystem.createDownloadResumable(
      otaManifest.bundleUrl,
      tempFileUri,
      {},
      (downloadProgress) => {
        const total = downloadProgress.totalBytesExpectedToWrite;
        const written = downloadProgress.totalBytesWritten;
        const ratio = total > 0 ? Math.min(1, written / total) : 0;
        if (typeof onProgress === 'function') {
          onProgress(ratio, written, total);
        }
      }
    );

    const downloadResult = await downloadResumable.downloadAsync();
    if (!downloadResult || !downloadResult.uri) {
      throw new Error('Download failed: empty response');
    }

    // Verify downloaded file size (should be at least 50KB)
    const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
    if (!fileInfo.exists || fileInfo.size < 50000) {
      await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
      throw new Error(`Downloaded bundle is invalid or too small (${fileInfo?.size || 0} bytes)`);
    }

    // Atomically move bundle to app internal storage via native module
    const appliedPath = await applyOtaBundle(downloadResult.uri);
    if (!appliedPath) {
      throw new Error('Native applyOtaBundle failed');
    }

    // Persist new OTA version in AsyncStorage and reset crash counter
    await AsyncStorage.setItem(STORAGE_KEYS.OTA_VERSION, otaManifest.version);
    await AsyncStorage.setItem(STORAGE_KEYS.OTA_BOOT_FLAG, 'healthy');
    await AsyncStorage.setItem(STORAGE_KEYS.OTA_CRASH_COUNT, '0');

    return {
      available: true,
      success: true,
      version: otaManifest.version,
      notes: otaManifest.notes || 'New improvements and bug fixes',
      bundleSize: fileInfo.size
    };
  } catch (err) {
    try {
      await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
    } catch {}
    throw err;
  }
};

/**
 * Restart the app to immediately apply the loaded OTA bundle
 */
export const restartToApplyOta = async () => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.OTA_BOOT_FLAG, 'healthy');
    await AsyncStorage.setItem(STORAGE_KEYS.OTA_CRASH_COUNT, '0');
  } catch {}
  return reloadApp();
};
