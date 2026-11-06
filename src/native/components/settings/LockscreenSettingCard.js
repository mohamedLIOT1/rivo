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
import { useTranslation } from '../../context/LocalizationContext';
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
  const { t, isRTL } = useTranslation();
  const rtlTextStyle = isRTL ? { letterSpacing: 0, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' } : null;
  const isAndroid = Platform.OS === 'android';
  const isIos = Platform.OS === 'ios';

  const [hasNotificationPermission, setHasNotificationPermission] = useState(true);
  const [hasOverlayPermission, setHasOverlayPermission] = useState(true);
  const [isPermissionChecked, setIsPermissionChecked] = useState(false);

  const checkPermissions = useCallback(async () => {
    if (isIos) {
      setHasNotificationPermission(true);
      setHasOverlayPermission(true);
      setIsPermissionChecked(true);
      return;
    }

    try {
      const notifAllowed = await checkNotificationPermission();
      setHasNotificationPermission(Boolean(notifAllowed));
    } catch (_e) {
      setHasNotificationPermission(false);
    }

    if (isAndroid) {
      try {
        const overlayAllowed = await canDrawOverlays();
        setHasOverlayPermission(Boolean(overlayAllowed));
      } catch (_e) {
        setHasOverlayPermission(false);
      }
    }
    setIsPermissionChecked(true);
  }, [isAndroid, isIos]);

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
    try {
      const granted = await requestNotificationPermission();
      if (!granted) {
        await openNotificationSettings();
      }
    } catch (_e) {
      await openNotificationSettings();
    } finally {
      await checkPermissions();
    }
  }, [checkPermissions]);

  const handleGrantOverlayPermission = useCallback(async () => {
    try {
      await requestOverlayPermission();
    } finally {
      await checkPermissions();
    }
  }, [checkPermissions]);

  const handleToggle = useCallback(async (val) => {
    onToggle?.(val);
    if (val && !isIos) {
      try {
        const notifAllowed = await checkNotificationPermission();
        if (!notifAllowed) {
          await requestNotificationPermission();
        }
        if (isAndroid) {
          const overlayAllowed = await canDrawOverlays();
          if (!overlayAllowed) {
            await requestOverlayPermission();
          }
        }
      } catch (_e) {}
      await checkPermissions();
    }
  }, [isAndroid, isIos, onToggle, checkPermissions]);

  const allPermissionsGranted = isIos || (hasNotificationPermission && (!isAndroid || hasOverlayPermission));

  return (
    <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
      <View style={[styles.sectionHeader, { borderBottomColor: borderColor }]}>
        <Smartphone size={18} color={colors.mint} />
        <Text style={[styles.sectionTitle, { color: textTitle }, rtlTextStyle]}>
          {isIos
            ? (isRTL ? 'شاشة القفل والدايناميك آيلاند' : 'LOCK SCREEN & DYNAMIC ISLAND')
            : (isRTL ? 'شاشة القفل وعناصر التحكم' : 'LOCKSCREEN & MEDIA OVERLAY')}
        </Text>
      </View>

      <View style={styles.switchRow}>
        <View style={{ flex: 1, paddingRight: isRTL ? 0 : 10, paddingLeft: isRTL ? 10 : 0 }}>
          <Text style={[styles.switchTitle, { color: textTitle }, isRTL && { textAlign: 'right' }, rtlTextStyle]}>
            {isIos
              ? (isRTL ? 'شاشة القفل والدايناميك آيلاند (Dynamic Island)' : 'Lock Screen & Dynamic Island')
              : (isRTL ? 'مشغل شاشة القفل التفاعلي' : 'Immersive Lockscreen Overlay')}
          </Text>
          <Text style={[styles.switchDesc, { color: textMuted }, isRTL && { textAlign: 'right' }, rtlTextStyle]}>
            {isIos
              ? (isRTL
                  ? 'يعرض لوحة التحكم بالصوت وصورة الغلاف في شاشة القفل والدايناميك آيلاند عند قفل الهاتف.'
                  : 'Controls the native iOS Lock Screen media player and Dynamic Island now playing info')
              : (isRTL
                  ? 'يعرض لوحة تحكم كاملة وصورة الغلاف عند قفل الهاتف'
                  : 'Displays immersive full-screen playback controls and album artwork when phone is locked')}
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
          {/* iOS NEVER shows red notification warning! */}
          {!isIos && !hasNotificationPermission && (
            <View style={[styles.warningBox, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2', borderColor: '#ef4444' }]}>
              <View style={styles.warningHeader}>
                <Bell size={16} color="#ef4444" />
                <Text style={[styles.warningTitle, rtlTextStyle]}>
                  {isRTL ? 'إذن الإشعارات مطلوب' : 'Notification Permission Required'}
                </Text>
              </View>
              <Text style={[styles.warningDesc, { color: isDark ? '#fca5a5' : '#b91c1c' }, isRTL && { textAlign: 'right' }, rtlTextStyle]}>
                {isRTL
                  ? 'يتطلب أندرويد إذن الإشعارات لعرض عناصر التحكم في مشغل الوسائط على شاشة القفل.'
                  : 'Android requires notification permission to display Now Playing media playback controls on the lock screen.'}
              </Text>
              <TouchableOpacity
                style={styles.grantButton}
                activeOpacity={0.8}
                onPress={handleGrantNotificationPermission}
              >
                <Text style={[styles.grantButtonText, rtlTextStyle]}>
                  {isRTL ? 'تفعيل الإشعارات' : 'Enable Notifications'}
                </Text>
                <ExternalLink size={13} color="#ffffff" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          )}

          {!isIos && isAndroid && !hasOverlayPermission && (
            <View style={[
              styles.warningBox,
              {
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2',
                borderColor: '#ef4444',
                marginTop: !hasNotificationPermission ? 10 : 0,
              }
            ]}>
              <View style={styles.warningHeader}>
                <ShieldAlert size={16} color="#ef4444" />
                <Text style={[styles.warningTitle, rtlTextStyle]}>
                  {isRTL ? 'إذن الظهور فوق التطبيقات مطلوب' : 'Overlay Permission Required'}
                </Text>
              </View>
              <Text style={[styles.warningDesc, { color: isDark ? '#fca5a5' : '#b91c1c' }, isRTL && { textAlign: 'right' }, rtlTextStyle]}>
                {isRTL
                  ? 'يتطلب أندرويد إذن "الظهور فوق التطبيقات الأخرى" لعرض المشغل الكامل عند قفل الجهاز.'
                  : 'Android requires "Display over other apps" permission to present the full-screen player when your device is locked.'}
              </Text>
              <TouchableOpacity
                style={styles.grantButton}
                activeOpacity={0.8}
                onPress={handleGrantOverlayPermission}
              >
                <Text style={[styles.grantButtonText, rtlTextStyle]}>
                  {isRTL ? 'منح إذن الظهور' : 'Grant Overlay Permission'}
                </Text>
                <ExternalLink size={13} color="#ffffff" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          )}

          {isPermissionChecked && allPermissionsGranted && (
            <View style={[styles.successBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : '#f0fdf4', borderColor: isDark ? '#059669' : '#86efac' }]}>
              <CheckCircle2 size={15} color={colors.mint} />
              <Text style={[styles.successText, { color: isDark ? '#6ee7b7' : '#047857' }, rtlTextStyle]}>
                {isIos
                  ? (isRTL ? 'مشغل شاشة القفل والدايناميك آيلاند مفعل ونشط' : 'iOS Native Lock Screen & Dynamic Island Active')
                  : (isRTL ? 'مشغل شاشة القفل وعناصر التحكم نشطة وجاهزة' : 'Lockscreen & Media Controls Active & Ready')}
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
