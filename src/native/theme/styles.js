import { StyleSheet, Platform } from 'react-native';
import { colors } from './colors';

export const brutalStyles = StyleSheet.create({
  border: {
    borderWidth: 2.5,
    borderColor: colors.ink,
  },
  borderThick: {
    borderWidth: 3.5,
    borderColor: colors.ink,
  },
  borderTeal: {
    borderWidth: 2.5,
    borderColor: colors.teal,
  },
  monoText: {
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  shadowOffset: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: colors.ink,
    zIndex: -1,
  },
  shadowOffsetSmall: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: -2,
    bottom: -2,
    backgroundColor: colors.ink,
    zIndex: -1,
  },
});
