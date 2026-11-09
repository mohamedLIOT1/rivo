import React, { useRef, useMemo } from 'react';
import { View, PanResponder } from 'react-native';
import { styles } from './miniMixerStyles';

/**
 * TouchSlider: PanResponder-based slider using screen-space pageX bounds.
 * Eliminates erratic jumps from child view locationX targeting and prevents
 * parent ScrollView interception during dragging gestures.
 */
export default function TouchSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  trackColor = '#10b981',
  inactiveColor = '#27272a',
  onDragStart,
  onDragEnd,
}) {
  const containerRef = useRef(null);
  const layoutRef = useRef({ pageX: 0, width: 240 });

  const measureContainer = () => {
    if (containerRef.current && typeof containerRef.current.measureInWindow === 'function') {
      containerRef.current.measureInWindow((x, _y, width) => {
        if (width > 0) {
          layoutRef.current = { pageX: x, width };
        }
      });
    }
  };

  const updateValue = (pageX, locationX) => {
    const { pageX: startX, width } = layoutRef.current;
    let localX = 0;
    if (pageX !== undefined && startX > 0) {
      localX = pageX - startX;
    } else if (locationX !== undefined) {
      localX = locationX;
    }
    const pct = Math.max(0, Math.min(1, localX / (width || 1)));
    const rawVal = min + pct * (max - min);
    const stepped = Math.round(rawVal / step) * step;
    const clamped = Math.max(min, Math.min(max, Number(stepped.toFixed(2))));
    onChange?.(clamped);
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
        updateValue(evt.nativeEvent.pageX, evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt) => {
        updateValue(evt.nativeEvent.pageX, evt.nativeEvent.locationX);
      },
      onPanResponderRelease: () => {
        onDragEnd?.();
      },
      onPanResponderTerminate: () => {
        onDragEnd?.();
      },
    })
  ), [min, max, step, onChange, onDragStart, onDragEnd]);

  const onLayout = (e) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0) {
      layoutRef.current.width = width;
    }
    measureContainer();
  };

  const safeVal = Number.isFinite(value) ? value : min;
  const pct = Math.max(0, Math.min(100, ((safeVal - min) / (max - min || 1)) * 100));

  return (
    <View
      ref={containerRef}
      onLayout={onLayout}
      {...panResponder.panHandlers}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={styles.touchSliderContainer}
    >
      <View style={[styles.touchSliderTrack, { backgroundColor: inactiveColor }]} pointerEvents="none">
        <View style={[styles.touchSliderFill, { width: `${pct}%`, backgroundColor: trackColor }]} />
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.touchSliderThumb,
          {
            left: `${pct}%`,
            borderColor: trackColor,
          },
        ]}
      />
    </View>
  );
}
