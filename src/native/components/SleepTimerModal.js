import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { X, Moon, Clock, Ban } from 'lucide-react-native';
import { useSleepTimer, useSleepTimerRemaining } from '../context/SleepTimerContext';
import { useAudioPlayer } from '../context/AudioContext';
import { useTranslation, useLiteMode } from '../context/LocalizationContext';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';

const formatRemaining = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const SleepTimerCountdownText = React.memo(function SleepTimerCountdownText({
  visible,
  sleepTimerMode,
  isRTL,
}) {
  const sleepTimerRemaining = useSleepTimerRemaining(visible && sleepTimerMode === 'minutes');
  return (
    <Text style={[styles.activeTime, isRTL && { letterSpacing: 0 }]}>
      {sleepTimerMode === 'end_of_track'
        ? (isRTL ? 'إيقاف التشغيل عند نهاية المقطع الحالي' : 'Stopping when current track ends')
        : (isRTL ? `إيقاف التشغيل خلال ${formatRemaining(sleepTimerRemaining || 0)}` : `Auto-stop in ${formatRemaining(sleepTimerRemaining || 0)}`)}
    </Text>
  );
});

export default function SleepTimerModal({ visible, onClose }) {
  const { isRTL } = useTranslation();
  const { isLiteMode } = useLiteMode();
  const { isDark } = useTheme();
  const sleepTimer = useSleepTimer();
  const audioPlayer = useAudioPlayer();

  // Support both isolated SleepTimerContext and AudioPlayer fallback
  const sleepTimerMode = sleepTimer?.sleepTimerMode ?? 'off';
  const startSleepTimer = sleepTimer?.startSleepTimer || audioPlayer?.startSleepTimer;
  const cancelSleepTimer = sleepTimer?.cancelSleepTimer || audioPlayer?.cancelSleepTimer;

  const isTimerActive = sleepTimerMode !== 'off';

  const timerOptions = useMemo(() => [
    { label: isRTL ? '١٥ دقيقة' : '15 Minutes', minutes: 15 },
    { label: isRTL ? '٣٠ دقيقة' : '30 Minutes', minutes: 30 },
    { label: isRTL ? '٤٥ دقيقة' : '45 Minutes', minutes: 45 },
    { label: isRTL ? '٦٠ دقيقة' : '60 Minutes', minutes: 60 },
    { label: isRTL ? 'نهاية المقطع الحالي' : 'End of Current Track', minutes: 'end_of_track' },
  ], [isRTL]);

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 99999, elevation: Platform.OS === 'android' ? 8 : 0 }]}>
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.sheetOuter}>
          {!isLiteMode && !isDark && <View style={styles.hardShadow} />}
          <View style={[
            styles.sheet,
            {
              backgroundColor: isDark ? '#111a18' : colors.paper,
              borderColor: isDark ? '#27272a' : colors.ink,
            }
          ]}>
            {/* Header */}
            <View style={styles.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.iconBox, isDark && { borderColor: '#27272a' }]}>
                  <Moon size={18} color={isDark ? '#26c4b7' : colors.ink} />
                </View>
                <View>
                  <Text style={[
                    styles.title,
                    { color: isDark ? '#ffffff' : colors.ink },
                    isRTL && { letterSpacing: 0, fontFamily: Platform.OS === 'ios' ? 'System' : 'normal' }
                  ]}>
                    {isRTL ? 'مؤقت النوم' : 'SLEEP TIMER'}
                  </Text>
                  <CassetteTag
                    label={isRTL ? 'إيقاف تلقائي' : 'AUTO-SUSPEND DECK'}
                    bg={isDark ? '#141d1b' : colors.ink}
                    textColor={isDark ? '#26c4b7' : colors.sky}
                  />
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color={isDark ? '#e4e4e7' : colors.ink} />
              </TouchableOpacity>
            </View>

            {/* Active countdown / status card */}
            {isTimerActive && (
              <View style={[
                styles.activeCard,
                isDark && { backgroundColor: '#08110f', borderColor: '#26c4b7' }
              ]}>
                <View style={{ flex: 1 }}>
                  <Text style={[
                    styles.activeLabel,
                    isDark && { color: '#26c4b7' },
                    isRTL && { letterSpacing: 0 }
                  ]}>
                    {isRTL ? 'المؤقت مفعّل حالياً' : 'TIMER CURRENTLY ACTIVE'}
                  </Text>
                  <SleepTimerCountdownText
                    visible={visible}
                    sleepTimerMode={sleepTimerMode}
                    isRTL={isRTL}
                  />
                </View>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    if (cancelSleepTimer) cancelSleepTimer();
                    onClose();
                  }}
                >
                  <Ban size={14} color={colors.cardBg} />
                  <Text style={[styles.cancelBtnText, isRTL && { letterSpacing: 0 }]}>
                    {isRTL ? 'إلغاء' : 'CANCEL'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={[
              styles.subText,
              { color: isDark ? '#9ca3af' : colors.ink },
              isRTL && { letterSpacing: 0 }
            ]}>
              {isRTL ? 'إيقاف التشغيل بعد:' : 'Suspend playback after:'}
            </Text>
            <View style={styles.optionsList}>
              {timerOptions.map((opt) => (
                <TouchableOpacity
                  key={String(opt.minutes)}
                  style={[
                    styles.optionBtn,
                    {
                      backgroundColor: isDark ? '#141d1b' : colors.cardBg,
                      borderColor: isDark ? '#27272a' : colors.ink,
                    }
                  ]}
                  onPress={() => {
                    if (startSleepTimer) startSleepTimer(opt.minutes);
                    onClose();
                  }}
                  activeOpacity={0.8}
                >
                  <Clock size={16} color={isDark ? '#26c4b7' : colors.ink} />
                  <Text style={[
                    styles.optionLabel,
                    { color: isDark ? '#ffffff' : colors.ink },
                    isRTL && { letterSpacing: 0, fontFamily: Platform.OS === 'ios' ? 'System' : 'normal' }
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 38, 33, 0.85)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  sheetOuter: {
    position: 'relative',
  },
  hardShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: -6,
    bottom: -6,
    backgroundColor: colors.ink,
  },
  sheet: {
    backgroundColor: colors.paper,
    borderWidth: 3.5,
    borderColor: colors.ink,
    padding: 18,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconBox: {
    width: 32,
    height: 32,
    backgroundColor: colors.sky,
    borderWidth: 2,
    borderColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.ink,
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 6,
  },
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ink,
    padding: 12,
    borderWidth: 2,
    borderColor: colors.teal,
    marginBottom: 16,
  },
  activeLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.tealLight,
    letterSpacing: 0.5,
  },
  activeTime: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.cardBg,
    marginTop: 2,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.crimson,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: colors.cardBg,
  },
  cancelBtnText: {
    color: colors.cardBg,
    fontWeight: '900',
    fontSize: 10,
  },
  subText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.ink,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  optionsList: {
    gap: 8,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.cardBg,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: 14,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.ink,
  },
});
