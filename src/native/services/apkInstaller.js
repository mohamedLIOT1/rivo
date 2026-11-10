import { Platform, Alert, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { installApk } from './mediaControls';

export const cleanupOldApkInstallers = async () => {
  try {
    const dirs = [FileSystem.cacheDirectory, FileSystem.documentDirectory];
    for (const dir of dirs) {
      if (!dir) continue;
      const normalizedDir = dir.endsWith('/') ? dir : `${dir}/`;
      const files = await FileSystem.readDirectoryAsync(normalizedDir).catch(() => []);
      for (const file of files) {
        const lower = file.toLowerCase();
        if (lower.endsWith('.apk') || lower.endsWith('.ipa') || lower.startsWith('rivo_ota_temp')) {
          await FileSystem.deleteAsync(`${normalizedDir}${file}`, { idempotent: true }).catch(() => {});
        }
      }
    }
  } catch {}
};

/**
 * Downloads and installs full APK on Android or opens IPA link on iOS
 */
export const downloadAndInstallApk = async ({ updateInfo, onProgress }) => {
  if (Platform.OS === 'ios') {
    if (updateInfo?.downloadUrl) {
      Linking.openURL(updateInfo.downloadUrl);
    }
    return { success: true, openedBrowser: true };
  }

  await cleanupOldApkInstallers();

  const downloadUrl = updateInfo.downloadUrl;
  const targetUri = `${FileSystem.cacheDirectory}Rivo-v${updateInfo.remoteVersion}.apk`;

  try {
    const fileInfo = await FileSystem.getInfoAsync(targetUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(targetUri, { idempotent: true });
    }
  } catch (e) {}

  const downloadResumable = FileSystem.createDownloadResumable(
    downloadUrl,
    targetUri,
    {},
    (progress) => {
      const written = progress.totalBytesWritten;
      const total = progress.totalBytesExpectedToWrite;
      if (typeof onProgress === 'function') {
        onProgress(total > 0 ? Math.min(1, written / total) : 0, written, total);
      }
    }
  );

  const result = await downloadResumable.downloadAsync();
  if (result && result.uri) {
    try {
      await installApk(result.uri);
      return { success: true };
    } catch (e) {
      console.warn('installApk error:', e);
      const msg = e?.message || 'Could not launch package installer.';
      if (e?.code === 'PERMISSION_REQUIRED') {
        Alert.alert(
          'Permission Required',
          'Please allow Rivo to install apps from this source in the settings page that just opened, then tap update again.'
        );
      } else {
        Alert.alert(
          'Installation Error',
          `${msg}\n\nWould you like to open the download in your browser?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Browser', onPress: () => Linking.openURL(downloadUrl) },
          ]
        );
      }
      throw e;
    }
  }
  throw new Error('Download failed: empty response');
};
