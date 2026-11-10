import { Platform } from 'react-native';
import { APP_VERSION } from '../version';
import { API_BASE_URL } from '../config';
import {
  getCurrentOtaVersion,
  getBaseAppVersion,
  isOtaUpdateAvailable,
  fetchOtaManifest,
  compareVersions as otaCompareVersions,
} from './otaService';

export const BETA_TESTER_EMAILS = [
  'whooareyou152@gmail.com',
  'alicrafter85@gmail.com',
  'test@liofy.com',
  'lio@gmail.com',
  'test1@gmail.com',
  'test@gmail.com',
  't1@gmail.com',
];

export const isUserEligibleForBeta = (currentUser) => {
  const userEmail = (currentUser?.email || '').toLowerCase().trim();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.isAdmin;
  return isAdmin || BETA_TESTER_EMAILS.includes(userEmail) || APP_VERSION.startsWith('1.9.6');
};

/**
 * Evaluates remote manifest and determines if an OTA or binary APK update is available
 */
export const evaluateUpdateManifest = async (data, currentUser) => {
  if (!data) return null;

  if (data?.channel === 'beta' && !isUserEligibleForBeta(currentUser)) {
    return null;
  }

  const currentPlatform = Platform.OS === 'ios' ? 'ios' : 'android';
  const remotePlatform = data?.platforms?.[currentPlatform];
  const remoteVersion = remotePlatform?.version || data?.version;
  if (!remoteVersion) return null;

  const currentOta = await getCurrentOtaVersion().catch(() => null);
  const activeVersion = (currentOta && otaCompareVersions(currentOta, APP_VERSION) > 0)
    ? currentOta
    : (APP_VERSION || getBaseAppVersion());

  // If remoteVersion <= activeVersion, app is fully up-to-date
  if (otaCompareVersions(remoteVersion, activeVersion) <= 0) {
    return { isUpToDate: true };
  }

  // 1. Check Fast OTA Update first (Android only)
  if (Platform.OS === 'android') {
    try {
      let ota = remotePlatform?.ota;
      if (!ota || !ota.enabled) {
        ota = await fetchOtaManifest();
      }
      if (ota && ota.enabled && isOtaUpdateAvailable(ota, currentOta, activeVersion)) {
        return {
          type: 'ota',
          otaInfo: {
            enabled: true,
            version: ota.version,
            notes: ota.notes || remotePlatform?.notes || 'تحديث هوائي سريع فوري بدون إعادة تثبيت التطبيق • إصلاحات في الأداء وسرعة الاستجابة',
            notesEn: ota.notesEn || ota.notes_en || 'Instant in-app OTA update • Performance enhancements, smoother audio playback, and bug fixes.',
            bundleUrl: ota.bundleUrl?.startsWith('http') ? ota.bundleUrl : `${API_BASE_URL}${ota.bundleUrl || '/downloads/ota/index.android.bundle'}`,
            minAppVersion: ota.minAppVersion || '1.0.0',
            bundleSize: ota.bundleSize,
            sizeMb: ota.sizeMb || (ota.bundleSize ? `${(ota.bundleSize / 1048576).toFixed(2)} MB` : null),
          },
        };
      }
    } catch (e) {
      console.warn('OTA manifest check error:', e);
    }
  }

  // 2. Fallback to full binary update (APK / IPA)
  if (otaCompareVersions(remoteVersion, activeVersion) > 0) {
    return {
      type: 'apk',
      apkInfo: {
        remoteVersion,
        releaseNotes: remotePlatform?.notesEn || remotePlatform?.notes || data?.releaseNotes || 'New improvements and bug fixes.',
        downloadUrl: remotePlatform?.downloadUrl
          ? (remotePlatform.downloadUrl.startsWith('http') ? remotePlatform.downloadUrl : `${API_BASE_URL}${remotePlatform.downloadUrl}`)
          : `${API_BASE_URL}/downloads/Rivo.${Platform.OS === 'ios' ? 'ipa' : 'apk'}`,
      },
    };
  }

  return { isUpToDate: true };
};
