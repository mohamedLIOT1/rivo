import React from 'react';
import { View, Text, Image, Animated, Platform } from 'react-native';
import { styles } from './fullPlayerStyles';

export const FullPlayerArtwork = React.memo(function FullPlayerArtwork({
  currentTrack,
  coverUri,
  isPlaying,
  isDark,
  spin,
  isCurQuran,
  isCurRadio,
}) {
  return (
    <View style={styles.tvEnclosure}>
      <View style={styles.tvScreen}>
        <Image
          source={{ uri: coverUri }}
          style={styles.coverImage}
          resizeMode="cover"
          fadeDuration={0}
        />
        <View style={styles.tvScanlines} pointerEvents="none" />
      </View>

      <View style={styles.cassetteSpoolBar}>
        <View style={styles.spoolLeft}>
          <View
            style={[
              styles.liveDot,
              { backgroundColor: isPlaying ? '#10b981' : '#ef4444' }
            ]}
          />
          <Text style={styles.spoolText}>
            {isCurQuran ? 'QURAN TAPE' : (isCurRadio ? 'LIVE STREAM' : 'RIVO TAPE DECK')}
          </Text>
        </View>

        <View style={styles.spoolWheels}>
          <Animated.View
            style={[
              styles.spoolWheel,
              { transform: [{ rotate: spin }] }
            ]}
          >
            <View style={styles.spoolInnerDot} />
          </Animated.View>
          <View style={styles.spoolBelt} />
          <Animated.View
            style={[
              styles.spoolWheel,
              { transform: [{ rotate: spin }] }
            ]}
          >
            <View style={styles.spoolInnerDot} />
          </Animated.View>
        </View>
      </View>
    </View>
  );
});

export default FullPlayerArtwork;
