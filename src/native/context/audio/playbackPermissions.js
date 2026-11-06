import {
  isLockScreenEnabled,
  checkNotificationPermission,
  requestNotificationPermission,
} from '../../services/mediaControls';

let hasCheckedPermissionsOnPlay = false;

/**
 * Proactively verifies and requests notification permission on first playback
 * if Lock Screen & Dynamic Island is enabled, so media controls appear immediately.
 */
export const ensurePlaybackPermissions = async () => {
  if (hasCheckedPermissionsOnPlay) return;
  hasCheckedPermissionsOnPlay = true;

  try {
    const lockEnabled = await isLockScreenEnabled();
    if (lockEnabled) {
      const hasPermission = await checkNotificationPermission();
      if (!hasPermission) {
        await requestNotificationPermission();
      }
    }
  } catch (_e) {
    // Fail gracefully without interrupting playback
  }
};

export const resetPlaybackPermissionsState = () => {
  hasCheckedPermissionsOnPlay = false;
};
