import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Switch, Platform } from 'react-native';
import { Cpu } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { useTranslation, useLiteMode } from '../../context/LocalizationContext';
import { useToast } from '../../context/ToastContext';

const LiteModeSettingCard = React.memo(function LiteModeSettingCard({
  cardBg,
  borderColor,
  textTitle,
  textMuted,
  isDark,
}) {
  const { t, isRTL } = useTranslation();
  const { isLiteMode, isLowEndAndroid, toggleLiteMode } = useLiteMode();
  const { showToast } = useToast?.() || {};

  const rtlTextStyle = useMemo(() => (
    isRTL ? { letterSpacing: 0, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' } : null
  ), [isRTL]);

  const handleToggle = useCallback((val) => {
    toggleLiteMode(val);
    if (showToast) {
      showToast(
        val ? t('settings.liteModeEnabledToast') : t('settings.liteModeDisabledToast'),
        'info'
      );
    }
  }, [toggleLiteMode, showToast, t]);

  return (
    <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
      <View style={[styles.sectionHeader, { borderBottomColor: borderColor }, isRTL && styles.rowReverse]}>
        <Cpu size={18} color={colors.mint} />
        <Text style={[styles.sectionTitle, { color: textTitle }, rtlTextStyle]}>
          {t('settings.liteModeSectionTitle')}
        </Text>
      </View>

      <View style={[styles.switchRow, isRTL && styles.rowReverse]}>
        <View style={{ flex: 1, paddingRight: isRTL ? 0 : 10, paddingLeft: isRTL ? 10 : 0 }}>
          <Text style={[styles.switchTitle, { color: textTitle }, isRTL && styles.textRight, rtlTextStyle]}>
            {t('settings.liteModeTitle')}
          </Text>
          <Text style={[styles.switchDesc, { color: textMuted }, isRTL && styles.textRight, rtlTextStyle]}>
            {t('settings.liteModeDesc')}
          </Text>
          {isLowEndAndroid && (
            <View style={[styles.autoBadge, isRTL && styles.alignEnd]}>
              <Text style={[styles.autoBadgeText, rtlTextStyle]}>
                {t('settings.liteModeAutoNote')}
              </Text>
            </View>
          )}
        </View>
        <Switch
          value={Boolean(isLiteMode)}
          onValueChange={handleToggle}
          trackColor={{ false: isDark ? '#1a2624' : '#cbd5e1', true: colors.mint }}
          thumbColor="#fdfbf7"
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  sectionCard: {
    borderWidth: 2,
    borderRadius: 10,
    padding: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1.5,
    paddingBottom: 8,
    marginBottom: 8,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  sectionTitle: {
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  switchDesc: {
    fontSize: 11,
    marginTop: 3,
    lineHeight: 16,
  },
  textRight: {
    textAlign: 'right',
  },
  alignEnd: {
    alignSelf: 'flex-end',
  },
  autoBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: 'rgba(23, 163, 152, 0.14)',
    borderWidth: 1,
    borderColor: colors.mint,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  autoBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.mint,
  },
});

export default LiteModeSettingCard;
