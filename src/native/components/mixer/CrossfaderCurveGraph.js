import React, { useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, PanResponder, Platform } from 'react-native';
import Svg, { Line, Polyline, Circle } from 'react-native-svg';
import { calculateCrossfadeGains } from '../../utils/musicAnalysis';
import TouchSlider from './TouchSlider';
import { styles } from './miniMixerStyles';

/**
 * CrossfaderCurveGraph: Interactive SVG envelope curve visualizer with
 * PanResponder crossover bias dragging and bias preset selectors.
 */
export default function CrossfaderCurveGraph({
  style = 'fade',
  crossoverBias = 0.5,
  onChangeBias,
  liveGainA = 100,
  liveGainB = 0,
  isRTL = false,
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

  const updateBias = (pageX, locationX) => {
    const { pageX: startX, width } = layoutRef.current;
    let localX = 0;
    if (pageX !== undefined && startX > 0) {
      localX = pageX - startX;
    } else if (locationX !== undefined) {
      localX = locationX;
    }
    const pct = Math.max(0.20, Math.min(0.80, localX / (width || 1)));
    onChangeBias?.(Number(pct.toFixed(2)));
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
        updateBias(evt.nativeEvent.pageX, evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt) => {
        updateBias(evt.nativeEvent.pageX, evt.nativeEvent.locationX);
      },
      onPanResponderRelease: () => {
        onDragEnd?.();
      },
      onPanResponderTerminate: () => {
        onDragEnd?.();
      },
    })
  ), [onChangeBias, onDragStart, onDragEnd]);

  const onLayout = (e) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0) {
      layoutRef.current.width = width;
    }
    measureContainer();
  };

  // SVG Envelope Curve Points (500x70 resolution)
  const { curvePointsA, curvePointsB, crossoverHandleX, crossoverHandleY } = useMemo(() => {
    const pointsA = [];
    const pointsB = [];
    const sampleSteps = 40;
    for (let i = 0; i <= sampleSteps; i++) {
      const rawP = i / sampleSteps;
      const x = rawP * 500;
      const { gainA, gainB } = calculateCrossfadeGains(rawP, style, crossoverBias);
      const yA = 62 - Math.max(0, Math.min(1, gainA)) * 52;
      const yB = 62 - Math.max(0, Math.min(1, gainB)) * 52;
      pointsA.push(`${x.toFixed(1)},${yA.toFixed(1)}`);
      pointsB.push(`${x.toFixed(1)},${yB.toFixed(1)}`);
    }

    const hX = crossoverBias * 500;
    const { gainA: crossA, gainB: crossB } = calculateCrossfadeGains(crossoverBias, style, crossoverBias);
    const hY = 62 - Math.max(0, Math.min(1, (crossA + crossB) / 2)) * 52;

    return {
      curvePointsA: pointsA.join(' '),
      curvePointsB: pointsB.join(' '),
      crossoverHandleX: hX,
      crossoverHandleY: hY,
    };
  }, [style, crossoverBias]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, isRTL && { letterSpacing: 0 }]}>
          {isRTL ? 'منحنى التداخل الصوتي' : 'CROSSFADER ENVELOPE CURVE'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={[styles.deckDot, { backgroundColor: '#ef4444' }]} />
            <Text style={{ fontSize: 9.5, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: 'bold', color: '#f87171' }}>
              {isRTL ? 'أ:' : 'A:'} {liveGainA}%
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={[styles.deckDot, { backgroundColor: '#10b981' }]} />
            <Text style={{ fontSize: 9.5, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: 'bold', color: '#34d399' }}>
              {isRTL ? 'ب:' : 'B:'} {liveGainB}%
            </Text>
          </View>
        </View>
      </View>

      {/* Draggable SVG Curve Area */}
      <View
        ref={containerRef}
        onLayout={onLayout}
        {...panResponder.panHandlers}
        style={styles.curveArea}
      >
        <Svg viewBox="0 0 500 70" style={{ width: '100%', height: 80 }} pointerEvents="none">
          <Line x1="0" y1="35" x2="500" y2="35" stroke="rgba(255,255,255,0.08)" strokeDasharray="3, 3" />
          <Line x1="125" y1="0" x2="125" y2="70" stroke="rgba(255,255,255,0.06)" strokeDasharray="2, 2" />
          <Line x1="250" y1="0" x2="250" y2="70" stroke="rgba(255,255,255,0.12)" strokeDasharray="2, 2" />
          <Line x1="375" y1="0" x2="375" y2="70" stroke="rgba(255,255,255,0.06)" strokeDasharray="2, 2" />

          {/* Crossover Line */}
          <Line
            x1={crossoverHandleX}
            y1="0"
            x2={crossoverHandleX}
            y2="70"
            stroke="rgba(16,185,129,0.5)"
            strokeWidth={1.5}
            strokeDasharray="3, 3"
          />

          {/* Track A Red Curve */}
          <Polyline
            fill="none"
            stroke="#ef4444"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={curvePointsA}
          />

          {/* Track B Green Curve */}
          <Polyline
            fill="none"
            stroke="#10b981"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={curvePointsB}
          />

          {/* Crossover Handle Circle */}
          <Circle
            cx={crossoverHandleX}
            cy={crossoverHandleY}
            r={6}
            fill="#10b981"
            stroke="#ffffff"
            strokeWidth={2}
          />
        </Svg>
      </View>

      {/* Crossover Bias Slider & Presets */}
      <View style={{ marginTop: 8 }}>
        <View style={[styles.sliderHeaderRow, { marginBottom: 4 }]}>
          <View style={styles.sliderTitleWithBadge}>
            <Text style={{ fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#10b981', fontWeight: 'bold' }}>
              {isRTL ? 'نقطة التقاطع:' : 'Crossover Bias:'} {Math.round(crossoverBias * 100)}%
            </Text>
            <Text style={styles.sliderStatusDesc} numberOfLines={1}>
              {crossoverBias <= 0.35
                ? (isRTL ? 'المقطع أ يخفت مبكراً' : 'Track A ducks early')
                : crossoverBias >= 0.65
                ? (isRTL ? 'المقطع أ يحتفظ بطاقته' : 'Track A holds energy')
                : (isRTL ? 'توازن متساوي' : 'Balanced')}
            </Text>
          </View>

          {/* Quick Bias Presets */}
          <View style={styles.biasBtnGroup}>
            {[
              { label: isRTL ? '30% مبكر' : '30% Early', val: 0.30, active: crossoverBias <= 0.35 },
              { label: isRTL ? '50% وسط' : '50% Center', val: 0.50, active: crossoverBias > 0.35 && crossoverBias < 0.65 },
              { label: isRTL ? '70% متأخر' : '70% Late', val: 0.70, active: crossoverBias >= 0.65 },
            ].map((b, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => onChangeBias?.(b.val)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                style={[styles.biasBtn, b.active && styles.biasBtnActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.biasBtnText, b.active && styles.biasBtnTextActive]}>
                  {b.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchSlider
          min={0.20}
          max={0.80}
          step={0.01}
          value={crossoverBias}
          onChange={onChangeBias}
          trackColor="#10b981"
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />

        <View style={styles.sliderScaleRow}>
          <Text style={styles.sliderScaleText}>{isRTL ? '20% قطع مبكر' : '20% Early'}</Text>
          <Text style={[styles.sliderScaleText, styles.sliderScaleTextCenter]}>{isRTL ? '50% توازن متساوي' : '50% Center'}</Text>
          <Text style={styles.sliderScaleText}>{isRTL ? '80% قطع متأخر' : '80% Late'}</Text>
        </View>
      </View>
    </View>
  );
}
