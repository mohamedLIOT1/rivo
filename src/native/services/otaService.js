import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { applyOtaBundle, reloadApp, clearOtaBundle, getOtaInfo } from './mediaControls';
import { APP_VERSION } from '../version';

const STORAGE_KEYS = {
  OTA_VERSION: 'rivo_ota_version',
  OTA_BOOT_FLAG: 'rivo_ota_boot_flag',
  OTA_CRASH_COUNT: 'rivo_ota_crash_count'
};

/**
 * Compare two semver-like strings (e.g. "1.9.5.1" vs "1.9.5")
 * Returns >0 if v1 > v2, <0 if v1 < v2, 0 if equal
 */
export const compareVersions = (v1, v2) => {
  if (!v1 || !v2) return 0;
  const p1 = String(v1).replace(/[^0-9.]/g, '').split('.').map(Number);
  const p2 = String(v2).replace(/[^0-9.]/g, '').split('.').map(Number);
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
 * Get current installed OTA version (or null if running default APK bundle)
 */
export const getCurrentOtaVersion = async () => {
  try {
    if (Platform.OS === 'android') {
      const info = await getOtaInfo().catch(() => null);
      if (!info || !info.exists || info.size < 50000) {
        await AsyncStorage.removeItem(STORAGE_KEYS.OTA_VERSION).catch(() => {});
        return null;
      }
    }
    return await AsyncStorage.getItem(STORAGE_KEYS.OTA_VERSION);
  } catch {
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
    const bootFlag = await AsyncStorage.getItem(STORAGE_KEYS.OTA_BOOT_FLAG);
    if (bootFlag === 'booting') {
      // App crashed before completing startup!
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

    // Mark as booting
    await AsyncStorage.setItem(STORAGE_KEYS.OTA_BOOT_FLAG, 'booting');

    // After 6 seconds of smooth operation, mark boot as successful
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

  // Check minimum binary compatibility
  if (otaManifest.minAppVersion && compareVersions(APP_VERSION, otaManifest.minAppVersion) < 0) {
    return { available: false, reason: 'requires_full_apk', minAppVersion: otaManifest.minAppVersion };
  }

  const currentOta = await getCurrentOtaVersion();
  // If already running this or newer OTA version, no update needed
  if (currentOta && compareVersions(currentOta, otaManifest.version) >= 0) {
    return { available: false, reason: 'already_up_to_date' };
  }

  // If no OTA installed yet, verify that OTA version is newer than the APK base version
  if (!currentOta && compareVersions(APP_VERSION, otaManifest.version) >= 0) {
    return { available: false, reason: 'apk_is_newer' };
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
      notes: otaManifest.notes || 'تحسينات وإصلاحات جديدة',
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
