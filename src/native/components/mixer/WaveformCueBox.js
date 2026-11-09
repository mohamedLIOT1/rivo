import React, { useRef, useMemo } from 'react';
import { View, Text, PanResponder } from 'react-native';
import { styles } from './miniMixerStyles';

function formatTime(seconds) {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Memoized peak bars view: prevents re-rendering all 75 bars during high-frequency cue scrubbing
 */
const MemoizedPeaks = React.memo(function MemoizedPeaks({ peaks }) {
  if (!peaks || !peaks.length) return null;
  return (
    <View style={styles.peaksWrapper} pointerEvents="none">
      {peaks.map((p, idx) => (
        <View
          key={idx}
          style={[
            styles.peakBar,
            {
              height: `${Math.max(10, p * 100)}%`,
            },
          ]}
        />
      ))}
    </View>
  );
});

/**
 * Interactive Waveform Cue Scrub Box with PanResponder
 */
export default function WaveformCueBox({
  peaks = [],
  duration = 210,
  position = 0,
  overlapDuration = 6,
  mode = 'out',
  onSeek,
  accentColor = '#ef4444',
  tagText = 'Overlap',
  isPlaying = false,
  cursorProgress = 0,
  onDragStart,
  onDragEnd,
}) {
  const containerRef = useRef(null);
  const layoutRef = useRef({ pageX: 0, width: 300 });

  const measureContainer = () => {
    if (containerRef.current && typeof containerRef.current.measureInWindow === 'function') {
      containerRef.current.measureInWindow((x, _y, width) => {
        if (width > 0) {
          layoutRef.current = { pageX: x, width };
        }
      });
    }
  };

  const updateSeek = (pageX, locationX) => {
    const { pageX: startX, width } = layoutRef.current;
    let localX = 0;
    if (pageX !== undefined && startX > 0) {
      localX = pageX - startX;
    } else if (locationX !== undefined) {
      localX = locationX;
    }
    const safeDur = Math.max(1, duration);
    const pct = Math.max(0, Math.min(1, localX / (width || 1)));
    const sec = Math.round(pct * safeDur);

    if (mode === 'out') {
      onSeek?.(Math.max(5, Math.min(safeDur, sec)));
    } else {
      onSeek?.(Math.max(0, Math.min(Math.max(0, safeDur - 5), sec)));
    }
  };

  const panResponder = useMemo(() => (
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        onDragStart?.();
        measureContainer();
        updateSeek(evt.nativeEvent.pageX, evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt) => {
        updateSeek(evt.nativeEvent.pageX, evt.nativeEvent.locationX);
      },
      onPanResponderRelease: () => {
        onDragEnd?.();
      },
      onPanResponderTerminate: () => {
        onDragEnd?.();
      },
    })
  ), [duration, mode, onSeek, onDragStart, onDragEnd]);

  const onLayout = (e) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0) {
      layoutRef.current.width = width;
    }
    measureContainer();
  };

  const safeDur = Math.max(1, duration);
  const posPct = Math.max(0, Math.min(100, (position / safeDur) * 100));

  let shadedStartPct = 0;
  let shadedWidthPct = 0;
  if (mode === 'out') {
    shadedStartPct = Math.max(0, ((position - overlapDuration) / safeDur) * 100);
    shadedWidthPct = Math.max(1, posPct - shadedStartPct);
  } else {
    shadedStartPct = posPct;
    const endPct = Math.min(100, ((position + overlapDuration) / safeDur) * 100);
    shadedWidthPct = Math.max(1, endPct - posPct);
  }

  return (
    <View
      ref={containerRef}
      onLayout={onLayout}
      {...panResponder.panHandlers}
      style={styles.waveformContainer}
    >
      {/* Background audio peaks - Memoized */}
      <MemoizedPeaks peaks={peaks} />

      {/* Shaded Overlap / Entry region */}
      <View
        pointerEvents="none"
        style={[
          styles.shadedRegion,
          {
            left: `${shadedStartPct}%`,
            width: `${shadedWidthPct}%`,
            backgroundColor: mode === 'out' ? 'rgba(239, 68, 68, 0.28)' : 'rgba(16, 185, 129, 0.28)',
            borderLeftWidth: mode === 'out' ? 1 : 2,
            borderRightWidth: mode === 'out' ? 2 : 1,
            borderColor: accentColor,
          },
        ]}
      >
        <Text
          style={[
            styles.shadedText,
            { color: mode === 'out' ? '#fca5a5' : '#6ee7b7' },
          ]}
        >
          {tagText} ({overlapDuration}s)
        </Text>
      </View>

      {/* Cue Marker Handle */}
      <View
        pointerEvents="none"
        style={[
          styles.markerHandle,
          {
            left: `${posPct}%`,
            backgroundColor: accentColor,
            shadowColor: accentColor,
          },
        ]}
      >
        <View style={styles.markerInnerLine} />
        <View
          style={[
            styles.markerLabel,
            {
              backgroundColor: accentColor,
              transform: [{ translateX: posPct > 80 ? -45 : posPct < 20 ? 0 : -22 }],
            },
          ]}
        >
          <Text
            style={[
              styles.markerLabelText,
              { color: mode === 'out' ? '#ffffff' : '#000000' },
            ]}
          >
            {mode === 'out' ? `Mix-Out: ${formatTime(position)}` : `Mix-In: ${formatTime(position)}`}
          </Text>
        </View>
      </View>

      {/* Audition Playback Cursor */}
      {isPlaying && (
        <View
          pointerEvents="none"
          style={[
            styles.auditionCursor,
            {
              left: `${shadedStartPct + cursorProgress * shadedWidthPct}%`,
            },
          ]}
        />
      )}
    </View>
  );
}
