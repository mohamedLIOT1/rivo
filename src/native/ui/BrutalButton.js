import React, { useState } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export default function BrutalButton({
  children,
  onPress,
  style,
  bg = colors.teal,
  textStyle,
  title,
  icon,
  offset = 3,
  disabled = false,
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <View style={[styles.wrapper, { marginRight: offset, marginBottom: offset }]}>
      {/* Background hard shadow */}
      <View
        style={[
          styles.shadow,
          {
            top: offset,
            left: offset,
            right: -offset,
            bottom: -offset,
          },
        ]}
      />
      {/* Interactive top face */}
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        disabled={disabled}
        style={[
          styles.btn,
          { backgroundColor: bg },
          pressed && {
            transform: [{ translateX: offset - 1 }, { translateY: offset - 1 }],
          },
          disabled && { opacity: 0.6 },
          style,
        ]}
      >
        {icon && <View style={styles.iconBox}>{icon}</View>}
        {title ? (
          <Text style={[styles.title, textStyle]}>{title}</Text>
        ) : (
          children
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  shadow: {
    position: 'absolute',
    backgroundColor: colors.ink,
    borderRadius: 2,
    zIndex: 0,
  },
  btn: {
    borderWidth: 2.5,
    borderColor: colors.ink,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 1,
    borderRadius: 2,
  },
  iconBox: {
    marginRight: 6,
  },
  title: {
    color: colors.ink,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
