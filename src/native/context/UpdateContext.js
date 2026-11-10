import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Platform, Alert, AppState, InteractionManager, BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_VERSION } from '../version';
import { API_BASE_URL } from '../config';
import { useSocket } from './SocketContext';
import { useUser } from './UserContext';
import {
  initOtaCrashGuard,
  checkAndDownloadOta,
  restartToApplyOta,
  getCurrentOtaVersion,
  getBaseAppVersion,
  compareVersions as otaCompareVersions,
} from '../services/otaService';
import {
  hasNativeProcessRestart,
  requestNotificationPermission,
} from '../services/mediaControls';
import { cleanupOldApkInstallers, downloadAndInstallApk } from '../services/apkInstaller';
import { evaluateUpdateManifest } from '../services/updateManifestChecker';

const UpdateContext = createContext(null);

export function UpdateProvider({ children }) {
  const { socket } = useSocket();
  const { currentUser } = useUser();

  const [activeOtaVersion, setActiveOtaVersion] = useState(null);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [otaUpdateInfo, setOtaUpdateInfo] = useState(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isOtaModalOpen, setIsOtaModalOpen] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  // OTA state
  const [isDownloadingOta, setIsDownloadingOta] = useState(false);
  const [otaProgress, setOtaProgress] = useState(0);
  const [otaBytes, setOtaBytes] = useState({ written: 0, total: 0 });
  const [isOtaReadyToRestart, setIsOtaReadyToRestart] = useState(false);
  const [otaError, setOtaError] = useState(null);

  // APK state
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadBytes, setDownloadBytes] = useState({ written: 0, total: 0 });
  const [downloadError, setDownloadError] = useState(null);

  const checkAbortRef = useRef(null);

  useEffect(() => {
    getCurrentOtaVersion().then((v) => {
      if (v) setActiveOtaVersion(v);
    }).catch(() => {});
  }, []);

  const handleRemoteUpdateManifest = useCallback(async (data) => {
    const result = await evaluateUpdateManifest(data, currentUser);
    if (!result || result.isUpToDate) {
      setOtaUpdateInfo(null);
      setUpdateInfo(null);
      return;
    }
    if (result.type === 'ota') {
      setOtaUpdateInfo(result.otaInfo);
      setUpdateInfo(null);
    } else if (result.type === 'apk') {
      setUpdateInfo(result.apkInfo);
      setOtaUpdateInfo(null);
    }
    // Note: Do NOT open disruptive modals automatically!
  }, [currentUser]);

  const checkAppUpdates = useCallback(async () => {
    try {
      checkAbortRef.current?.abort();
      const controller = new AbortController();
      checkAbortRef.current = controller;

      const token = (await AsyncStorage.getItem('rivo_token')) || (await AsyncStorage.getItem('token')) || currentUser?.token;
      let email = (currentUser?.email || '').trim().toLowerCase();
      if (!email) {
        try {
          const cachedUserStr = (await AsyncStorage.getItem('rivo_user')) || (await AsyncStorage.getItem('user'));
          if (cachedUserStr) {
            const cachedUser = JSON.parse(cachedUserStr);
            email = (cachedUser?.email || '').trim().toLowerCase();
          }
        } catch {}
      }
      const params = new URLSearchParams();
      if (email) params.set('email', email);
      const currentOta = await getCurrentOtaVersion().catch(() => null);
      const safeVersion = (currentOta && otaCompareVersions(currentOta, APP_VERSION) > 0)
        ? currentOta
        : (APP_VERSION || getBaseAppVersion());
      params.set('currentVersion', safeVersion);
      params.set('platform', Platform.OS);
      const query = `?${params.toString()}`;
      const headers = {
        'x-app-version': safeVersion,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const res = await fetch(`${API_BASE_URL}/api/app/version${query}`, {
        headers,
        signal: controller.signal,
      });
      if (!res.ok || controller.signal.aborted) return;
      const data = await res.json();
      if (!controller.signal.aborted) {
        handleRemoteUpdateManifest(data);
      }
    } catch (e) {
      if (e?.name !== 'AbortError') {
        // silent fail
      }
    }
  }, [currentUser, handleRemoteUpdateManifest]);

  useEffect(() => {
    initOtaCrashGuard();
    requestNotificationPermission().catch(() => {});
    const task = InteractionManager.runAfterInteractions(() => {
      cleanupOldApkInstallers();
      checkAppUpdates();
    });

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setTimeout(() => {
          if (AppState.currentState === 'active') {
            checkAppUpdates();
          }
        }, 2500);
      }
    });

    return () => {
      checkAbortRef.current?.abort();
      if (task && typeof task.cancel === 'function') task.cancel();
      sub.remove();
    };
  }, [checkAppUpdates]);

  useEffect(() => {
    if (!socket) return;
    const onUpdateManifest = (data) => {
      handleRemoteUpdateManifest(data);
    };
    socket.on('app:update_manifest', onUpdateManifest);
    socket.on('app:update_available', onUpdateManifest);
    return () => {
      socket.off('app:update_manifest', onUpdateManifest);
      socket.off('app:update_available', onUpdateManifest);
    };
  }, [socket, handleRemoteUpdateManifest]);

  useEffect(() => {
    if (currentUser?.email) {
      checkAppUpdates();
    }
  }, [currentUser?.email, checkAppUpdates]);

  const handleDownloadOta = useCallback(async () => {
    if (!otaUpdateInfo) return;
    try {
      setIsDownloadingOta(true);
      setOtaError(null);
      setOtaProgress(0);

      const res = await checkAndDownloadOta(otaUpdateInfo, (progress, written, total) => {
        setOtaProgress(progress);
        setOtaBytes({ written, total });
      });

      if (res?.success) {
        setIsOtaReadyToRestart(true);
        if (res.version) setActiveOtaVersion(res.version);
      } else if (res?.reason === 'already_up_to_date') {
        Alert.alert('محدث بالفعل', 'تطبيق ريفو محدث بالفعل لآخر إصدار هوائي.');
        setOtaUpdateInfo(null);
        setIsOtaModalOpen(false);
      } else {
        setOtaError(res?.reason || 'تعذر استكمال التحديث');
      }
    } catch (err) {
      console.warn('OTA Download error:', err);
      setOtaError(err?.message || 'Error downloading fast update');
    } finally {
      setIsDownloadingOta(false);
    }
  }, [otaUpdateInfo]);

  const handleApplyOtaRestart = useCallback(async () => {
    try {
      setIsOtaModalOpen(false);
      const hasNativeColdRestart = hasNativeProcessRestart();
      if (hasNativeColdRestart) {
        await restartToApplyOta().catch(() => {});
        return;
      }

      Alert.alert(
        'تم تثبيت التحديث بنجاح! 🎉',
        'لتفعيل التحديث على هذا الإصدار:\nيرجى مسح التطبيق من شاشة التطبيقات الحديثة (Recent Apps) ثم إعادة فتحه ليتم تحميل الإصدار الجديد فوراً.',
        [
          {
            text: 'إغلاق التطبيق الآن',
            onPress: () => {
              if (Platform.OS === 'android') {
                BackHandler.exitApp();
              }
            },
          },
          { text: 'لاحقاً', style: 'cancel' },
        ],
        { cancelable: false }
      );
    } catch (err) {
      if (Platform.OS === 'android') {
        BackHandler.exitApp();
      }
    }
  }, []);

  const handleDownloadAndInstall = useCallback(async () => {
    if (!updateInfo) return;
    try {
      setIsDownloadingUpdate(true);
      setDownloadError(null);
      setDownloadProgress(0);

      await downloadAndInstallApk({
        updateInfo,
        onProgress: (pct, written, total) => {
          setDownloadProgress(pct);
          setDownloadBytes({ written, total });
        },
      });
      setIsUpdateModalOpen(false);
    } catch (err) {
      setDownloadError(err.message || 'Download error');
    } finally {
      setIsDownloadingUpdate(false);
    }
  }, [updateInfo]);

  const updateType = useMemo(() => {
    if (otaUpdateInfo) return 'ota';
    if (updateInfo) return 'apk';
    return null;
  }, [otaUpdateInfo, updateInfo]);

  const isUpdateAvailable = Boolean(updateType);

  const targetVersion = useMemo(() => {
    if (otaUpdateInfo?.version) return otaUpdateInfo.version;
    if (updateInfo?.remoteVersion) return updateInfo.remoteVersion;
    return null;
  }, [otaUpdateInfo, updateInfo]);

  const runningVersion = useMemo(() => {
    return (activeOtaVersion && otaCompareVersions(activeOtaVersion, APP_VERSION) > 0)
      ? activeOtaVersion
      : (APP_VERSION || getBaseAppVersion());
  }, [activeOtaVersion]);

  const isDownloading = isDownloadingOta || isDownloadingUpdate;
  const downloadPct = updateType === 'ota' ? otaProgress : downloadProgress;
  const currentBytes = updateType === 'ota' ? otaBytes : downloadBytes;
  const currentError = updateType === 'ota' ? otaError : downloadError;

  const startUpdate = useCallback(() => {
    if (updateType === 'ota') {
      return handleDownloadOta();
    }
    if (updateType === 'apk') {
      return handleDownloadAndInstall();
    }
  }, [updateType, handleDownloadOta, handleDownloadAndInstall]);

  const dismissBanner = useCallback(() => {
    setIsBannerDismissed(true);
  }, []);

  const openUpdateModal = useCallback(() => {
    if (updateType === 'ota') {
      setIsOtaModalOpen(true);
    } else if (updateType === 'apk') {
      setIsUpdateModalOpen(true);
    }
  }, [updateType]);

  const contextValue = useMemo(() => ({
    updateType,
    isUpdateAvailable,
    updateInfo,
    otaUpdateInfo,
    activeOtaVersion,
    runningVersion,
    targetVersion,
    isUpdateModalOpen,
    setIsUpdateModalOpen,
    isOtaModalOpen,
    setIsOtaModalOpen,
    isBannerDismissed,
    dismissBanner,
    isDownloading,
    downloadProgress: downloadPct,
    downloadBytes: currentBytes,
    isOtaReadyToRestart,
    error: currentError,
    startUpdate,
    applyRestart: handleApplyOtaRestart,
    openUpdateModal,
    checkAppUpdates,
  }), [
    updateType,
    isUpdateAvailable,
    updateInfo,
    otaUpdateInfo,
    activeOtaVersion,
    runningVersion,
    targetVersion,
    isUpdateModalOpen,
    isOtaModalOpen,
    isBannerDismissed,
    dismissBanner,
    isDownloading,
    downloadPct,
    currentBytes,
    isOtaReadyToRestart,
    currentError,
    startUpdate,
    handleApplyOtaRestart,
    openUpdateModal,
    checkAppUpdates,
  ]);

  return (
    <UpdateContext.Provider value={contextValue}>
      {children}
    </UpdateContext.Provider>
  );
}

export const useUpdate = () => {
  const context = useContext(UpdateContext);
  if (!context) {
    throw new Error('useUpdate must be used within an UpdateProvider');
  }
  return context;
};
