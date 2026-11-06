import React, { memo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors } from '../theme/colors';
import { isArabicText } from '../theme/typography';
import { useTranslation } from '../context/LocalizationContext';

function CassetteTag({ label, bg = colors.deepForest, textColor = colors.tealLight, style }) {
  let isRTL = false;
  try {
    const translation = useTranslation();
    isRTL = translation?.isRTL || false;
  } catch {}
  const isAr = isArabicText(label) || (isRTL && typeof label === 'string' && /[\u0600-\u06FF]/.test(label));

  return (
    <View style={[styles.tag, { backgroundColor: bg }, style]}>
      <Text
        style={[
          styles.text,
          { color: textColor },
          isAr && styles.textArabic
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export default memo(CassetteTag);

const styles = StyleSheet.create({
  tag: {
    borderWidth: 1.5,
    borderColor: colors.ink,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 2,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  textArabic: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    letterSpacing: 0,
    textTransform: 'none',
    lineHeight: 15,
  },
});
