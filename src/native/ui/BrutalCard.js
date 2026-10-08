import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export default function BrutalCard({ children, style, shadowColor = colors.ink, offset = 4, bg = colors.surfaceDark }) {
  return (
    <View style={[styles.wrapper, { marginBottom: offset, marginRight: offset }]}>
      <View
        style={[
          styles.shadow,
          {
            backgroundColor: shadowColor,
            top: offset,
            left: offset,
            right: -offset,
            bottom: -offset,
          },
        ]}
      />
      <View style={[styles.card, { backgroundColor: bg }, style]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  shadow: {
    position: 'absolute',
    borderRadius: 2,
    zIndex: 0,
  },
  card: {
    borderWidth: 2.5,
    borderColor: colors.ink,
    position: 'relative',
    zIndex: 1,
    borderRadius: 2,
  },
});
