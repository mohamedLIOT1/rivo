import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  Sliders,
  X,
  Layers,
  MoveHorizontal,
  Square,
  Play,
  Check,
} from 'lucide-react-native';
import {
  getTrackMusicalData,
  getCamelotColor,
  calculateBarsDuration,
} from '../utils/musicAnalysis';
import { useTranslation } from '../context/LocalizationContext';
import { styles } from './mixer/miniMixerStyles';
import DeckCard from './mixer/DeckCard';
import TransitionStylePicker from './mixer/TransitionStylePicker';
import CrossfaderCurveGraph from './mixer/CrossfaderCurveGraph';
import useMixerAudition from './mixer/useMixerAudition';

function generatePeaksForTrack(track, count = 80) {
  let seed = 0;
  const str = `${track?.title || ''}_${track?.artist || ''}_${track?.id || track?._id || ''}_${track?.duration || 180}`;
  for (let i = 0; i < str.length; i++) {
    seed = (seed << 5) - seed + str.charCodeAt(i);
    seed |= 0;
  }
  const abs = Math.abs(seed);
  const peaks = [];
  for (let i = 0; i < count; i++) {
    const progress = i / count;
    let envelope = 0.5 + 0.4 * Math.sin(progress * Math.PI);
    if (progress < 0.08) envelope = 0.2 + progress * 8 * 0.5;
    if (progress > 0.88) envelope = Math.max(0.15, (1 - progress) * 7 * 0.8);
    const noise = (((abs * (i + 13)) % 100) / 100) * 0.35;
    peaks.push(Math.min(1.0, Math.max(0.1, Number((envelope + noise).toFixed(2)))));
  }
  return peaks;
}

export default function MiniMixerModal({
  visible,
  onClose,
  fromTrack,
  toTrack,
  transition,
  onSaveTransition,
}) {
  const { isRTL } = useTranslation();

  const rtlTextStyle = useMemo(() => (
    isRTL ? {
      letterSpacing: 0,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    } : null
  ), [isRTL]);

  const trackA = fromTrack;
  const trackB = toTrack;

  const dataA = useMemo(() => getTrackMusicalData(trackA), [trackA]);
  const dataB = useMemo(() => getTrackMusicalData(trackB), [trackB]);

  const durA = Math.max(10, Number(trackA?.duration) || 210);
  const durB = Math.max(10, Number(trackB?.duration) || 210);

  // Parent ScrollView lock during active drag
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const onDragStart = useCallback(() => setScrollEnabled(false), []);
  const onDragEnd = useCallback(() => setScrollEnabled(true), []);

  // Transition parameters state
  const [style, setStyle] = useState('auto');
  const [bars, setBars] = useState(4);
  const [duration, setDuration] = useState(8);
  const [crossoverBias, setCrossoverBias] = useState(0.5);
  const [mixOutPoint, setMixOutPoint] = useState(Math.max(5, Math.floor(durA - 8)));
  const [mixInPoint, setMixInPoint] = useState(0);

  // Volume Trim & Speed Controls for Deck A & Deck B
  const [volA, setVolA] = useState(100);
  const [volB, setVolB] = useState(100);
  const [speedA, setSpeedA] = useState(1.0);
  const [speedB, setSpeedB] = useState(1.0);

  // Waveform peak data
  const peaksA = useMemo(() => generatePeaksForTrack(trackA, 75), [trackA?.id, trackA?._id, trackA?.title]);
  const peaksB = useMemo(() => generatePeaksForTrack(trackB, 75), [trackB?.id, trackB?._id, trackB?.title]);

  // Audition management hook with cancellation guards
  const {
    isPreviewing,
    isLoadingAudio,
    soloPlayingDeck,
    previewProgress,
    soloProgress,
    liveGainA,
    liveGainB,
    handlePreviewSoloA,
    handlePreviewSoloB,
    handleAuditionTransition,
    stopAudition,
  } = useMixerAudition({
    trackA,
    trackB,
    mixOutPoint,
    mixInPoint,
    duration,
    volA,
    volB,
    speedA,
    speedB,
    style,
    crossoverBias,
  });

  // Reset or initialize state whenever transition or tracks change
  useEffect(() => {
    if (visible && trackA && trackB) {
      if (transition) {
        setStyle(transition.style || 'auto');
        setBars(transition.bars || 4);
        setDuration(Number(transition.duration) || calculateBarsDuration(transition.bars || 4, dataA.bpm));
        setCrossoverBias(Number(transition.crossoverBias) || 0.5);
        if (transition.mixOutPoint !== undefined) setMixOutPoint(Math.min(durA, Number(transition.mixOutPoint)));
        else setMixOutPoint(Math.max(5, Math.floor(durA - 8)));
        if (transition.mixInPoint !== undefined) setMixInPoint(Math.min(durB, Number(transition.mixInPoint)));
        else setMixInPoint(0);
        setVolA(transition.volA !== undefined ? Number(transition.volA) : 100);
        setVolB(transition.volB !== undefined ? Number(transition.volB) : 100);
        setSpeedA(transition.speedA !== undefined ? Number(transition.speedA) : 1.0);
        setSpeedB(transition.speedB !== undefined ? Number(transition.speedB) : 1.0);
      } else {
        const autoBars = 4;
        const autoDur = calculateBarsDuration(autoBars, dataA.bpm);
        setStyle('auto');
        setBars(autoBars);
        setDuration(autoDur);
        setCrossoverBias(0.5);
        setMixOutPoint(Math.max(5, Math.floor(durA - autoDur)));
        setMixInPoint(0);
        setVolA(100);
        setVolB(100);
        setSpeedA(1.0);
        setSpeedB(1.0);
      }
    }
    stopAudition();
  }, [visible, trackA?.id, trackB?.id, transition]);

  const handleSelectBars = (numBars) => {
    setBars(numBars);
    const dur = calculateBarsDuration(numBars, dataA.bpm);
    setDuration(dur);
  };

  const handleSave = async () => {
    await stopAudition();
    if (onSaveTransition) {
      onSaveTransition({
        style,
        bars,
        duration,
        crossoverBias,
        mixOutPoint,
        mixInPoint,
        volA,
        volB,
        speedA,
        speedB,
        keyA: dataA.key,
        keyB: dataB.key,
        bpmA: dataA.bpm,
        bpmB: dataB.bpm,
      });
    }
    onClose();
  };

  const fromColor = getCamelotColor(dataA.key);
  const toColor = getCamelotColor(dataB.key);

  return (
    <Modal visible={visible} animationType={Platform.OS === 'android' ? 'none' : 'slide'} transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* ── Modal Header ── */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, marginRight: 8 }}>
              <View style={styles.headerIconBox}>
                <Sliders size={18} color="#10b981" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={[styles.sheetTitle, rtlTextStyle]}>
                    {isRTL ? 'تعديل الانتقال الصوتي' : 'Edit Transition'}
                  </Text>
                  <View style={styles.rivoBadge}>
                    <Text style={[styles.rivoBadgeText, rtlTextStyle]}>
                      {isRTL ? 'مكس تلقائي' : 'Rivo Automix'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.sheetSubtitle} numberOfLines={1}>
                  {trackA?.title} → {trackB?.title}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* ── Scrollable Controls ── */}
          <ScrollView
            style={styles.scrollArea}
            showsVerticalScrollIndicator={false}
            scrollEnabled={scrollEnabled}
          >
            {/* ── 1. DUAL WAVEFORMS & INTUITIVE CUE CONTROLS ── */}
            <View style={styles.cueSection}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                  <Layers size={14} color="#10b981" />
                  <Text style={[styles.sectionTitle, rtlTextStyle]} numberOfLines={1}>
                    {isRTL ? 'نقاط الانتقال ومناطق التداخل' : 'WAVEFORM CUE POINTS & REGIONS'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <MoveHorizontal size={11} color="#10b981" />
                  <Text style={[styles.sectionHint, rtlTextStyle]}>
                    {isRTL ? 'اسحب لضبط النقطة' : 'Drag to adjust'}
                  </Text>
                </View>
              </View>

              {/* Deck A */}
              <DeckCard
                deck="A"
                track={trackA}
                musicalData={dataA}
                color={fromColor}
                duration={durA}
                position={mixOutPoint}
                onChangePosition={setMixOutPoint}
                overlapDuration={duration}
                volume={volA}
                onChangeVolume={setVolA}
                speed={speedA}
                onChangeSpeed={setSpeedA}
                isPlayingSolo={soloPlayingDeck === 'A'}
                isLoadingAudio={isLoadingAudio}
                onToggleSolo={handlePreviewSoloA}
                peaks={peaksA}
                cursorProgress={soloPlayingDeck === 'A' ? soloProgress : previewProgress}
                isRTL={isRTL}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />

              {/* Deck B */}
              <DeckCard
                deck="B"
                track={trackB}
                musicalData={dataB}
                color={toColor}
                duration={durB}
                position={mixInPoint}
                onChangePosition={setMixInPoint}
                overlapDuration={duration}
                volume={volB}
                onChangeVolume={setVolB}
                speed={speedB}
                onChangeSpeed={setSpeedB}
                referenceBpm={dataA.bpm}
                isPlayingSolo={soloPlayingDeck === 'B'}
                isLoadingAudio={isLoadingAudio}
                onToggleSolo={handlePreviewSoloB}
                peaks={peaksB}
                cursorProgress={soloPlayingDeck === 'B' ? soloProgress : previewProgress}
                isRTL={isRTL}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            </View>

            {/* ── 2 & 3. TRANSITION STYLE & QUANTIZED BARS ── */}
            <TransitionStylePicker
              style={style}
              onSelectStyle={setStyle}
              bars={bars}
              duration={duration}
              bpmA={dataA.bpm}
              onSelectBars={handleSelectBars}
              onChangeDuration={setDuration}
              isRTL={isRTL}
              rtlTextStyle={rtlTextStyle}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />

            {/* ── 4. REALTIME INTERACTIVE ENVELOPE CURVE GRAPH & CROSSOVER TUNER ── */}
            <CrossfaderCurveGraph
              style={style}
              crossoverBias={crossoverBias}
              onChangeBias={setCrossoverBias}
              liveGainA={liveGainA}
              liveGainB={liveGainB}
              isRTL={isRTL}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          </ScrollView>

          {/* ── FOOTER: AUDITION & SAVE ── */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={[styles.auditionBtn, isPreviewing && styles.auditionBtnActive]}
              onPress={handleAuditionTransition}
              disabled={isLoadingAudio}
              activeOpacity={0.8}
            >
              {isLoadingAudio && isPreviewing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : isPreviewing ? (
                <Square size={13} color="#fff" fill="#fff" />
              ) : (
                <Play size={13} color="#fff" fill="#fff" />
              )}
              <Text style={[styles.auditionBtnText, rtlTextStyle]} numberOfLines={1}>
                {isPreviewing
                  ? (isRTL ? 'إيقاف المعاينة' : 'Stop Audition')
                  : (isRTL ? 'معاينة الانتقال' : 'Audition Mix')}
              </Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <TouchableOpacity onPress={onClose} style={styles.cancelBtn} activeOpacity={0.7}>
                <Text style={[styles.cancelBtnText, rtlTextStyle]}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={styles.saveBtn} activeOpacity={0.8}>
                <Check size={14} color="#0b1110" strokeWidth={3} />
                <Text style={[styles.saveBtnText, rtlTextStyle]}>{isRTL ? 'حفظ' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
