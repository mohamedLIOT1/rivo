import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Platform,
  AppState,
} from 'react-native';
import { Smartphone, ShieldAlert, CheckCircle2, ExternalLink, Bell } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import {
  canDrawOverlays,
  requestOverlayPermission,
  checkNotificationPermission,
  requestNotificationPermission,
  openNotificationSettings,
} from '../../services/mediaControls';

function LockscreenSettingCard({
  isEnabled,
  onToggle,
  isDark,
  cardBg,
  borderColor,
  textTitle,
  textMuted,
}) {
  const isAndroid = Platform.OS === 'android';
  const isIos = Platform.OS === 'ios';

  const [hasNotificationPermission, setHasNotificationPermission] = useState(true);
  const [hasOverlayPermission, setHasOverlayPermission] = useState(true);

  const checkPermissions = useCallback(async () => {
    try {
      const notifAllowed = await checkNotificationPermission();
      setHasNotificationPermission(Boolean(notifAllowed));
    } catch (_e) {
      setHasNotificationPermission(true);
    }

    if (isAndroid) {
      try {
        const overlayAllowed = await canDrawOverlays();
        setHasOverlayPermission(Boolean(overlayAllowed));
      } catch (_e) {
        setHasOverlayPermission(true);
      }
    }
  }, [isAndroid]);

  useEffect(() => {
    checkPermissions();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkPermissions();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkPermissions]);

  const handleGrantNotificationPermission = useCallback(async () => {
    const granted = await requestNotificationPermission();
    if (!granted) {
      await openNotificationSettings();
    }
    await checkPermissions();
  }, [checkPermissions]);

  const handleGrantOverlayPermission = useCallback(async () => {
    await requestOverlayPermission();
    await checkPermissions();
  }, [checkPermissions]);

  const handleToggle = useCallback(async (val) => {
    if (val && !hasNotificationPermission) {
      await requestNotificationPermission();
      await checkPermissions();
    }
    onToggle?.(val);
  }, [hasNotificationPermission, onToggle, checkPermissions]);

  return (
    <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
      <View style={[styles.sectionHeader, { borderBottomColor: borderColor }]}>
        <Smartphone size={18} color={colors.mint} />
        <Text style={[styles.sectionTitle, { color: textTitle }]}>
          {isIos ? 'LOCK SCREEN & DYNAMIC ISLAND' : 'LOCKSCREEN & MEDIA OVERLAY'}
        </Text>
      </View>

      <View style={styles.switchRow}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={[styles.switchTitle, { color: textTitle }]}>
            {isIos ? 'Lock Screen & Dynamic Island' : 'Immersive Lockscreen Overlay'}
          </Text>
          <Text style={[styles.switchDesc, { color: textMuted }]}>
            {isIos
              ? 'Controls the native iOS Lock Screen media player and Dynamic Island now playing info'
              : 'Displays immersive full-screen playback controls and album artwork when phone is locked'}
          </Text>
        </View>
        <Switch
          value={isEnabled}
          onValueChange={handleToggle}
          trackColor={{ false: isDark ? '#1a2624' : '#e2e8f0', true: colors.mint }}
          thumbColor="#ffffff"
        />
      </View>

      {/* Permission & Status Guidance Banner */}
      {isEnabled && (
        <View style={styles.statusContainer}>
          {!hasNotificationPermission && (
            <View style={[styles.warningBox, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2', borderColor: '#ef4444' }]}>
              <View style={styles.warningHeader}>
                <Bell size={16} color="#ef4444" />
                <Text style={styles.warningTitle}>Notification Permission Required</Text>
              </View>
              <Text style={[styles.warningDesc, { color: isDark ? '#fca5a5' : '#b91c1c' }]}>
                {isIos
                  ? 'Enable notifications to display Now Playing media controls and Dynamic Island info on your device.'
                  : 'Android 13+ requires notification permission to display Now Playing media playback controls on the lock screen.'}
              </Text>
              <TouchableOpacity
                style={styles.grantButton}
                activeOpacity={0.8}
                onPress={handleGrantNotificationPermission}
              >
                <Text style={styles.grantButtonText}>Enable Notifications</Text>
                <ExternalLink size={13} color="#ffffff" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          )}

          {isAndroid && !hasOverlayPermission && hasNotificationPermission && (
            <View style={[styles.warningBox, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2', borderColor: '#ef4444' }]}>
              <View style={styles.warningHeader}>
                <ShieldAlert size={16} color="#ef4444" />
                <Text style={styles.warningTitle}>Overlay Permission Required</Text>
              </View>
              <Text style={[styles.warningDesc, { color: isDark ? '#fca5a5' : '#b91c1c' }]}>
                Android requires "Display over other apps" permission to present the full-screen player when your device is locked.
              </Text>
              <TouchableOpacity
                style={styles.grantButton}
                activeOpacity={0.8}
                onPress={handleGrantOverlayPermission}
              >
                <Text style={styles.grantButtonText}>Grant Overlay Permission</Text>
                <ExternalLink size={13} color="#ffffff" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          )}

          {hasNotificationPermission && (!isAndroid || hasOverlayPermission) && (
            <View style={[styles.successBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#f0fdf4', borderColor: isDark ? '#059669' : '#86efac' }]}>
              <CheckCircle2 size={15} color={colors.mint} />
              <Text style={[styles.successText, { color: isDark ? '#6ee7b7' : '#047857' }]}>
                {isIos
                  ? 'iOS Native Lock Screen & Dynamic Island Active'
                  : 'Lockscreen & Media Controls Active & Ready'}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  switchDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  statusContainer: {
    marginTop: 12,
  },
  warningBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  warningTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#ef4444',
  },
  warningDesc: {
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 10,
  },
  grantButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  grantButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  successText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

export default React.memo(LockscreenSettingCard);
