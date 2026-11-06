import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Globe, Check } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { useTranslation } from '../../context/LocalizationContext';
import { useToast } from '../../context/ToastContext';

export const LanguageSettingCard = React.memo(function LanguageSettingCard({
  cardBg,
  borderColor,
  textTitle,
  textMuted,
  isDark,
}) {
  const { language, setLanguage, t, isRTL } = useTranslation();
  const rtlTextStyle = isRTL ? { letterSpacing: 0, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' } : null;
  const { showToast } = useToast?.() || {};

  const handleSelectLanguage = useCallback((newLang) => {
    if (newLang === language) return;
    setLanguage(newLang);
    if (showToast) {
      showToast(
        newLang === 'ar' ? 'تم تغيير اللغة إلى العربية' : 'Language switched to English',
        'info'
      );
    }
  }, [language, setLanguage, showToast]);

  return (
    <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
      <View style={[styles.sectionHeader, { borderBottomColor: borderColor }]}>
        <Globe size={18} color={colors.mint} />
        <Text style={[styles.sectionTitle, { color: textTitle }, rtlTextStyle]}>
          {t('settings.languageTitle')}
        </Text>
      </View>

      <View style={{ paddingTop: 10 }}>
        <Text style={[styles.descText, { color: textMuted }]}>
          {t('settings.languageDesc')}
        </Text>

        <View style={styles.optionsRow}>
          {/* English Option */}
          <TouchableOpacity
            style={[
              styles.langBtn,
              language === 'en' && styles.langBtnActive,
              { borderColor, backgroundColor: language === 'en' ? (isDark ? '#17362f' : '#d1fae5') : (isDark ? '#1a2624' : '#f8fafc') },
            ]}
            onPress={() => handleSelectLanguage('en')}
            activeOpacity={0.8}
          >
            <View style={styles.btnContent}>
              <View style={[styles.radioDot, language === 'en' && styles.radioDotActive]}>
                {language === 'en' && <View style={styles.radioInnerDot} />}
              </View>
              <View style={{ marginLeft: 8 }}>
                <Text
                  style={[
                    styles.langLabel,
                    language === 'en' ? styles.langLabelActive : { color: textTitle },
                  ]}
                >
                  English
                </Text>
                <Text style={[styles.langSub, { color: textMuted }]}>
                  LTR • Default
                </Text>
              </View>
            </View>
            {language === 'en' && (
              <Check size={16} color={colors.mint} strokeWidth={2.5} />
            )}
          </TouchableOpacity>

          {/* Arabic Option */}
          <TouchableOpacity
            style={[
              styles.langBtn,
              language === 'ar' && styles.langBtnActive,
              { borderColor, backgroundColor: language === 'ar' ? (isDark ? '#17362f' : '#d1fae5') : (isDark ? '#1a2624' : '#f8fafc') },
            ]}
            onPress={() => handleSelectLanguage('ar')}
            activeOpacity={0.8}
          >
            <View style={styles.btnContent}>
              <View style={[styles.radioDot, language === 'ar' && styles.radioDotActive]}>
                {language === 'ar' && <View style={styles.radioInnerDot} />}
              </View>
              <View style={{ marginLeft: 8 }}>
                <Text
                  style={[
                    styles.langLabel,
                    language === 'ar' ? styles.langLabelActive : { color: textTitle },
                    { letterSpacing: 0, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' },
                  ]}
                >
                  العربية
                </Text>
                <Text style={[styles.langSub, { color: textMuted }, { letterSpacing: 0, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }]}>
                  RTL • المحاذاة لليمين
                </Text>
              </View>
            </View>
            {language === 'ar' && (
              <Check size={16} color={colors.mint} strokeWidth={2.5} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  sectionCard: {
    borderWidth: 2,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  descText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  optionsRow: {
    flexDirection: 'column',
    gap: 10,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  langBtnActive: {
    borderColor: colors.mint,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#64748b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDotActive: {
    borderColor: colors.mint,
  },
  radioInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.mint,
  },
  langLabel: {
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontSize: 13,
    fontWeight: '800',
  },
  langLabelActive: {
    color: colors.mint,
  },
  langSub: {
    fontSize: 10,
    marginTop: 2,
  },
});

export default LanguageSettingCard;
