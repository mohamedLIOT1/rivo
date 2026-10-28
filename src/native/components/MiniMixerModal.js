import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Audio } from 'expo-av';
import Svg, { Line, Polyline, Circle } from 'react-native-svg';
import {
  X,
  Sliders,
  Volume2,
  Wand2,
  Play,
  Square,
  Check,
  Sparkles,
  Zap,
  Layers,
  Activity,
  Plus,
  Minus,
  Radio,
  Gauge,
  Music2,
  MoveHorizontal,
} from 'lucide-react-native';
import {
  getTrackMusicalData,
  checkHarmonicCompatibility,
  getCamelotColor,
  calculateBarsDuration,
  calculateCrossfadeGains,
} from '../utils/musicAnalysis';
import { API_BASE_URL } from '../config';
import { resolveAudioStream } from '../services/youtubeResolver';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

const TRANSITION_STYLES = [
  {
    id: 'auto',
    name: 'Auto',
    desc: 'Smart AI: analyzes BPM & harmonic key to craft the ideal transition',
    icon: Wand2,
    badge: 'AI Smart',
    color: '#10b981',
  },
  {
    id: 'rise',
    name: 'Rise',
    desc: 'High-pass tension sweep with punchy bass drop on the first downbeat',
    icon: Zap,
    badge: 'Buildup & Drop',
    color: '#f59e0b',
  },
  {
    id: 'blend',
    name: 'Blend',
    desc: 'Balanced 3-band EQ crossfade with sub-bass frequency swap',
    icon: Activity,
    badge: 'Bass Swap',
    color: '#10b981',
  },
  {
    id: 'wave',
    name: 'Wave',
    desc: 'Low-pass wave sweep rhythmically washing out highs into the new track',
    icon: Radio,
    badge: 'Filter Sweep',
    color: '#06b6d4',
  },
  {
    id: 'melt',
    name: 'Melt',
    desc: 'Harmonic frequency melting crossfade, ideal for melodic & vocal changes',
    icon: Sparkles,
    badge: 'Harmonic Morph',
    color: '#a855f7',
  },
  {
    id: 'slam',
    name: 'Slam',
    desc: 'Instant downbeat cut directly on the beat with zero overlapping clutter',
    icon: Music2,
    badge: 'Downbeat Cut',
    color: '#ef4444',
  },
  {
    id: 'fade',
    name: 'Fade',
    desc: 'Classic equal-power crossfade preserving constant acoustic loudness',
    icon: Volume2,
    badge: 'Equal-Power',
    color: '#3b82f6',
  },
];

const BAR_OPTIONS = [1, 2, 4, 8, 16];

function formatTime(seconds) {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// ── Native Touch Slider Component ──
function TouchSlider({ min, max, step = 1, value, onChange, trackColor = '#10b981', inactiveColor = '#27272a' }) {
  const [layoutWidth, setLayoutWidth] = useState(SCREEN_WIDTH - 64);

  const handleTouch = (evt) => {
    const x = evt.nativeEvent.locationX;
    const pct = Math.max(0, Math.min(1, x / (layoutWidth || 1)));
    const rawVal = min + pct * (max - min);
    const stepped = Math.round(rawVal / step) * step;
    const clamped = Math.max(min, Math.min(max, Number(stepped.toFixed(2))));
    onChange(clamped);
  };

  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <View
      onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={handleTouch}
      onResponderMove={handleTouch}
      style={styles.touchSliderContainer}
    >
      <View style={[styles.touchSliderTrack, { backgroundColor: inactiveColor }]}>
        <View style={[styles.touchSliderFill, { width: `${pct}%`, backgroundColor: trackColor }]} />
      </View>
      <View
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

// ── Interactive Waveform Cue Component ──
function WaveformCueBox({
  peaks,
  duration,
  position,
  overlapDuration,
  mode = 'out',
  onSeek,
  accentColor = '#ef4444',
  tagText = 'Overlap',
  isPlaying = false,
  cursorProgress = 0,
}) {
  const [width, setWidth] = useState(SCREEN_WIDTH - 64);

  const handleTouch = (evt) => {
    const x = evt.nativeEvent.locationX;
    const pct = Math.max(0, Math.min(1, x / (width || 1)));
    const sec = Math.round(pct * duration);
    if (mode === 'out') {
      onSeek(Math.max(5, Math.min(duration, sec)));
    } else {
      onSeek(Math.max(0, Math.min(duration - 5, sec)));
    }
  };

  const posPct = Math.max(0, Math.min(100, (position / (duration || 1)) * 100));

  let shadedStartPct = 0;
  let shadedWidthPct = 0;
  if (mode === 'out') {
    shadedStartPct = Math.max(0, ((position - overlapDuration) / (duration || 1)) * 100);
    shadedWidthPct = Math.max(1, posPct - shadedStartPct);
  } else {
    shadedStartPct = posPct;
    const endPct = Math.min(100, ((position + overlapDuration) / (duration || 1)) * 100);
    shadedWidthPct = Math.max(1, endPct - posPct);
  }

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={handleTouch}
      onResponderMove={handleTouch}
      style={styles.waveformContainer}
    >
      {/* Background audio peaks */}
      <View style={styles.peaksWrapper}>
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

      {/* Shaded Overlap / Entry region */}
      <View
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

      {/* Cue Marker Thumb */}
      <View
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

      {/* Audition Cursor */}
      {isPlaying && (
        <View
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

export default function MiniMixerModal({
  visible,
  onClose,
  fromTrack,
  toTrack,
  transition,
  onSaveTransition,
}) {
  const trackA = fromTrack;
  const trackB = toTrack;

  const dataA = useMemo(() => getTrackMusicalData(trackA), [trackA]);
  const dataB = useMemo(() => getTrackMusicalData(trackB), [trackB]);

  const durA = Math.max(10, Number(trackA?.duration) || 210);
  const durB = Math.max(10, Number(trackB?.duration) || 210);

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

  // Preview / Audition states
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [soloPlayingDeck, setSoloPlayingDeck] = useState(null);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [soloProgress, setSoloProgress] = useState(0);
  const [liveGainA, setLiveGainA] = useState(100);
  const [liveGainB, setLiveGainB] = useState(0);

  // Curve container measurement
  const [curveWidth, setCurveWidth] = useState(SCREEN_WIDTH - 64);

  // Waveform peak data
  const peaksA = useMemo(() => generatePeaksForTrack(trackA, 75), [trackA?.id, trackA?._id, trackA?.title]);
  const peaksB = useMemo(() => generatePeaksForTrack(trackB, 75), [trackB?.id, trackB?._id, trackB?.title]);

  // Expo Audio sound refs for auditioning
  const soundARef = useRef(null);
  const soundBRef = useRef(null);
  const auditionTimerRef = useRef(null);

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
      setLiveGainA(volA);
      setLiveGainB(0);
    }
    stopAudition();
  }, [visible, trackA?.id, trackB?.id, transition]);

  // Clean stop for any active auditioning sounds
  const stopAudition = async () => {
    if (auditionTimerRef.current) {
      clearInterval(auditionTimerRef.current);
      auditionTimerRef.current = null;
    }
    if (soundARef.current) {
      try {
        await soundARef.current.stopAsync();
        await soundARef.current.unloadAsync();
      } catch {}
      soundARef.current = null;
    }
    if (soundBRef.current) {
      try {
        await soundBRef.current.stopAsync();
        await soundBRef.current.unloadAsync();
      } catch {}
      soundBRef.current = null;
    }
    setIsPreviewing(false);
    setSoloPlayingDeck(null);
    setSoloProgress(0);
    setPreviewProgress(0);
    setLiveGainA(volA);
    setLiveGainB(0);
    setIsLoadingAudio(false);
  };

  useEffect(() => {
    return () => {
      stopAudition();
    };
  }, []);

  const resolveStreamUrl = async (track) => {
    if (!track) return null;
    if (track.nativeAudioUri) return track.nativeAudioUri;
    if (track.localAudioUri) return track.localAudioUri;
    if (track.resolvedAudioUrl && track.resolvedAudioUrl.startsWith('http')) return track.resolvedAudioUrl;
    if (track.audioUrl && (track.audioUrl.startsWith('/uploads/') || track.audioUrl.startsWith('http') && !track.audioUrl.includes('youtube.com'))) {
      return track.audioUrl.startsWith('/') ? `${API_BASE_URL}${track.audioUrl}` : track.audioUrl;
    }
    try {
      const u = await resolveAudioStream(track);
      if (u) {
        return u.startsWith('/') ? `${API_BASE_URL}${u}` : u;
      }
    } catch {}
    return null;
  };

  // Solo Preview Deck A
  const handlePreviewSoloA = async () => {
    if (soloPlayingDeck === 'A') {
      await stopAudition();
      return;
    }
    await stopAudition();
    setSoloPlayingDeck('A');
    setIsLoadingAudio(true);

    try {
      const urlA = await resolveStreamUrl(trackA);
      if (!urlA) {
        await stopAudition();
        return;
      }

      const previewDuration = Math.min(duration, 8);
      const startSec = Math.max(0, mixOutPoint - previewDuration);
      const targetVol = Math.max(0.01, Math.min(1, (volA / 100)));
      const spd = Number(speedA) || 1.0;

      const { sound } = await Audio.Sound.createAsync(
        { uri: urlA },
        {
          shouldPlay: true,
          positionMillis: Math.floor(startSec * 1000),
          volume: targetVol,
          rate: spd,
          shouldCorrectPitch: true,
        }
      );
      soundARef.current = sound;
      setIsLoadingAudio(false);
      setLiveGainA(volA);
      setLiveGainB(0);

      const startTime = Date.now();
      const totalMs = (previewDuration / spd) * 1000;

      auditionTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const p = Math.min(1, elapsed / totalMs);
        setSoloProgress(p);
        if (p >= 1) {
          stopAudition();
        }
      }, 100);
    } catch (err) {
      console.warn('[Native Solo A] error:', err);
      await stopAudition();
    }
  };

  // Solo Preview Deck B
  const handlePreviewSoloB = async () => {
    if (soloPlayingDeck === 'B') {
      await stopAudition();
      return;
    }
    await stopAudition();
    setSoloPlayingDeck('B');
    setIsLoadingAudio(true);

    try {
      const urlB = await resolveStreamUrl(trackB);
      if (!urlB) {
        await stopAudition();
        return;
      }

      const previewDuration = Math.min(duration, 8);
      const startSec = Math.max(0, mixInPoint);
      const targetVol = Math.max(0.01, Math.min(1, (volB / 100)));
      const spd = Number(speedB) || 1.0;

      const { sound } = await Audio.Sound.createAsync(
        { uri: urlB },
        {
          shouldPlay: true,
          positionMillis: Math.floor(startSec * 1000),
          volume: targetVol,
          rate: spd,
          shouldCorrectPitch: true,
        }
      );
      soundBRef.current = sound;
      setIsLoadingAudio(false);
      setLiveGainA(0);
      setLiveGainB(volB);

      const startTime = Date.now();
      const totalMs = (previewDuration / spd) * 1000;

      auditionTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const p = Math.min(1, elapsed / totalMs);
        setSoloProgress(p);
        if (p >= 1) {
          stopAudition();
        }
      }, 100);
    } catch (err) {
      console.warn('[Native Solo B] error:', err);
      await stopAudition();
    }
  };

  // Full Dual-Deck Audition Transition
  const handleAuditionTransition = async () => {
    if (isPreviewing) {
      await stopAudition();
      return;
    }
    await stopAudition();
    setIsPreviewing(true);
    setIsLoadingAudio(true);

    try {
      const [urlA, urlB] = await Promise.all([
        resolveStreamUrl(trackA),
        resolveStreamUrl(trackB),
      ]);

      if (!urlA || !urlB) {
        await stopAudition();
        return;
      }

      const multA = (Number(volA) || 100) / 100;
      const multB = (Number(volB) || 100) / 100;
      const spdA = Number(speedA) || 1.0;
      const spdB = Number(speedB) || 1.0;

      const leadInSec = 2.0;
      const seekA = Math.max(0, mixOutPoint - duration - leadInSec);
      const seekB = Math.max(0, mixInPoint);

      const [resSoundA, resSoundB] = await Promise.all([
        Audio.Sound.createAsync(
          { uri: urlA },
          {
            shouldPlay: true,
            positionMillis: Math.floor(seekA * 1000),
            volume: Math.max(0.01, Math.min(1, 1.0 * multA)),
            rate: spdA,
            shouldCorrectPitch: true,
          }
        ),
        Audio.Sound.createAsync(
          { uri: urlB },
          {
            shouldPlay: false,
            positionMillis: Math.floor(seekB * 1000),
            volume: 0,
            rate: spdB,
            shouldCorrectPitch: true,
          }
        ),
      ]);

      soundARef.current = resSoundA.sound;
      soundBRef.current = resSoundB.sound;
      setIsLoadingAudio(false);
      setLiveGainA(Math.round(volA));
      setLiveGainB(0);

      const startTime = Date.now();
      const leadInMs = (leadInSec / spdA) * 1000;
      const transMs = Math.max(1, duration) * 1000;
      const tailMs = 2500;
      const totalMs = leadInMs + transMs + tailMs;

      let deckBStarted = false;

      auditionTimerRef.current = setInterval(async () => {
        const elapsed = Date.now() - startTime;

        if (elapsed < leadInMs) {
          setPreviewProgress(0);
          soundARef.current?.setVolumeAsync(Math.max(0.01, Math.min(1, 1.0 * multA))).catch(() => {});
          setLiveGainA(Math.round(volA));
          setLiveGainB(0);
        } else if (elapsed <= leadInMs + transMs) {
          if (!deckBStarted) {
            deckBStarted = true;
            soundBRef.current?.playAsync().catch(() => {});
          }

          const rawP = (elapsed - leadInMs) / transMs;
          const { gainA, gainB } = calculateCrossfadeGains(rawP, style, crossoverBias);

          soundARef.current?.setVolumeAsync(Math.max(0.01, Math.min(1, gainA * multA))).catch(() => {});
          soundBRef.current?.setVolumeAsync(Math.max(0.01, Math.min(1, gainB * multB))).catch(() => {});
          setPreviewProgress(rawP);
          setLiveGainA(Math.round(gainA * multA * 100));
          setLiveGainB(Math.round(gainB * multB * 100));
        } else {
          setPreviewProgress(1);
          soundARef.current?.setVolumeAsync(0).catch(() => {});
          soundBRef.current?.setVolumeAsync(Math.max(0.01, Math.min(1, 1.0 * multB))).catch(() => {});
          setLiveGainA(0);
          setLiveGainB(Math.round(volB));
        }

        if (elapsed >= totalMs) {
          stopAudition();
        }
      }, 100);
    } catch (err) {
      console.warn('[Native Audition] error:', err);
      await stopAudition();
    }
  };

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

  const handleCurveTouch = (evt) => {
    const x = evt.nativeEvent.locationX;
    const pct = Math.max(0.20, Math.min(0.80, x / (curveWidth || 1)));
    setCrossoverBias(Number(pct.toFixed(2)));
  };

  const fromColor = getCamelotColor(dataA.key);
  const toColor = getCamelotColor(dataB.key);

  // SVG Envelope Curve Points (500x70 resolution)
  const curvePointsA = [];
  const curvePointsB = [];
  const sampleSteps = 40;
  for (let i = 0; i <= sampleSteps; i++) {
    const rawP = i / sampleSteps;
    const x = rawP * 500;
    const { gainA, gainB } = calculateCrossfadeGains(rawP, style, crossoverBias);
    const yA = 62 - Math.max(0, Math.min(1, gainA)) * 52;
    const yB = 62 - Math.max(0, Math.min(1, gainB)) * 52;
    curvePointsA.push(`${x.toFixed(1)},${yA.toFixed(1)}`);
    curvePointsB.push(`${x.toFixed(1)},${yB.toFixed(1)}`);
  }

  const crossoverHandleX = crossoverBias * 500;
  const { gainA: crossA, gainB: crossB } = calculateCrossfadeGains(crossoverBias, style, crossoverBias);
  const crossoverHandleY = 62 - Math.max(0, Math.min(1, (crossA + crossB) / 2)) * 52;

  const activeStyleObj = TRANSITION_STYLES.find(t => t.id === style) || TRANSITION_STYLES[0];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* ── Modal Header ── */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.headerIconBox}>
                <Sliders size={18} color="#10b981" />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.sheetTitle}>Edit Transition</Text>
                  <View style={styles.rivoBadge}>
                    <Text style={styles.rivoBadgeText}>Rivo Automix</Text>
                  </View>
                </View>
                <Text style={styles.sheetSubtitle} numberOfLines={1}>
                  {trackA?.title} → {trackB?.title}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* ── 1. DUAL WAVEFORMS & INTUITIVE CUE CONTROLS ── */}
            <View style={styles.cueSection}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Layers size={14} color="#10b981" />
                  <Text style={styles.sectionTitle}>WAVEFORM CUE POINTS & ZONE RESIZING</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <MoveHorizontal size={11} color="#10b981" />
                  <Text style={styles.sectionHint}>Drag waveform to set cues</Text>
                </View>
              </View>

              {/* ── DECK A: MIX-OUT POINT ── */}
              <View style={styles.deckCard}>
                <View style={styles.deckTopRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <View style={[styles.deckDot, { backgroundColor: '#ef4444' }]} />
                    <Text style={styles.deckName} numberOfLines={1}>
                      Deck A: {trackA?.title}
                    </Text>
                    <View style={[styles.camelotPill, { backgroundColor: fromColor.bg, borderColor: fromColor.border }]}>
                      <Text style={[styles.camelotText, { color: fromColor.text }]}>{dataA.key}</Text>
                    </View>
                    <Text style={styles.bpmText}>{dataA.bpm} BPM</Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {/* Solo Preview A Button */}
                    <TouchableOpacity
                      style={[styles.soloBtn, soloPlayingDeck === 'A' && styles.soloBtnActiveA]}
                      onPress={handlePreviewSoloA}
                      disabled={isLoadingAudio}
                      activeOpacity={0.7}
                    >
                      {isLoadingAudio && soloPlayingDeck === 'A' ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : soloPlayingDeck === 'A' ? (
                        <Square size={10} color="#fff" fill="#fff" />
                      ) : (
                        <Play size={10} color="#f87171" fill="#f87171" />
                      )}
                      <Text style={[styles.soloBtnText, soloPlayingDeck === 'A' && styles.soloBtnTextActive]}>
                        {soloPlayingDeck === 'A' ? 'Stop' : 'Preview Mix-Out'}
                      </Text>
                    </TouchableOpacity>

                    {/* Mix-Out Steppers */}
                    <View style={styles.stepperBox}>
                      <Text style={styles.stepperPrefix}>Mix-Out:</Text>
                      <TouchableOpacity
                        onPress={() => setMixOutPoint(p => Math.max(5, p - 1))}
                        style={styles.stepBtn}
                      >
                        <Minus size={11} color="#94a3b8" />
                      </TouchableOpacity>
                      <Text style={styles.stepVal}>{formatTime(mixOutPoint)}</Text>
                      <TouchableOpacity
                        onPress={() => setMixOutPoint(p => Math.min(durA, p + 1))}
                        style={styles.stepBtn}
                      >
                        <Plus size={11} color="#94a3b8" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Subline Timing Info */}
                <View style={styles.timingSubline}>
                  <Text style={{ fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#f87171', fontWeight: 'bold' }}>
                    Mix-Out: {formatTime(mixOutPoint)} / {formatTime(durA)} ({Math.round((mixOutPoint / durA) * 100)}%)
                  </Text>
                  <Text style={{ fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#94a3b8' }}>
                    Remaining: {formatTime(Math.max(0, durA - mixOutPoint))}
                  </Text>
                </View>

                {/* Interactive Waveform Track Deck A */}
                <WaveformCueBox
                  peaks={peaksA}
                  duration={durA}
                  position={mixOutPoint}
                  overlapDuration={duration}
                  mode="out"
                  onSeek={setMixOutPoint}
                  accentColor="#ef4444"
                  tagText="Overlap"
                  isPlaying={isPreviewing || soloPlayingDeck === 'A'}
                  cursorProgress={soloPlayingDeck === 'A' ? soloProgress : previewProgress}
                />

                {/* Volume & Speed Sliders Deck A */}
                <View style={styles.sliderGrid}>
                  <View style={styles.sliderCol}>
                    <View style={styles.sliderLabelRow}>
                      <Text style={[styles.sliderLabelText, { color: '#f87171' }]}>
                        🔊 Volume: {volA}%
                      </Text>
                      <Text style={styles.sliderSubText}>
                        {volA === 100 ? '100% (Default)' : volA > 100 ? `+${volA - 100}% Boost` : `${volA - 100}% Cut`}
                      </Text>
                    </View>
                    <TouchSlider
                      min={50}
                      max={140}
                      step={5}
                      value={volA}
                      onChange={setVolA}
                      trackColor="#ef4444"
                    />
                  </View>

                  <View style={styles.sliderCol}>
                    <View style={styles.sliderLabelRow}>
                      <Text style={[styles.sliderLabelText, { color: '#f59e0b' }]}>
                        ⚡ Speed: {speedA.toFixed(2)}x
                      </Text>
                      <TouchableOpacity onPress={() => setSpeedA(1.0)} activeOpacity={0.7}>
                        <Text style={styles.resetLink}>Reset (1.0x)</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchSlider
                      min={0.85}
                      max={1.15}
                      step={0.01}
                      value={speedA}
                      onChange={setSpeedA}
                      trackColor="#f59e0b"
                    />
                  </View>
                </View>

                {/* Quick Jumps Deck A */}
                <View style={styles.quickJumpRow}>
                  <Text style={styles.quickJumpLabel}>Quick Jump:</Text>
                  {[
                    { label: 'Radio Cut (45%)', p: 0.45 },
                    { label: 'Chorus 2 (65%)', p: 0.65 },
                    { label: 'Outro (85%)', p: 0.85 },
                    { label: 'Full Song (99%)', p: 0.99 },
                  ].map((qj, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.quickChip}
                      onPress={() => setMixOutPoint(Math.floor(durA * qj.p))}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.quickChipText}>{qj.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* ── DECK B: MIX-IN POINT ── */}
              <View style={[styles.deckCard, { borderColor: 'rgba(16, 185, 129, 0.25)' }]}>
                <View style={styles.deckTopRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <View style={[styles.deckDot, { backgroundColor: '#10b981' }]} />
                    <Text style={styles.deckName} numberOfLines={1}>
                      Deck B: {trackB?.title}
                    </Text>
                    <View style={[styles.camelotPill, { backgroundColor: toColor.bg, borderColor: toColor.border }]}>
                      <Text style={[styles.camelotText, { color: toColor.text }]}>{dataB.key}</Text>
                    </View>
                    <Text style={styles.bpmText}>{dataB.bpm} BPM</Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {/* Solo Preview B Button */}
                    <TouchableOpacity
                      style={[styles.soloBtn, soloPlayingDeck === 'B' && styles.soloBtnActiveB]}
                      onPress={handlePreviewSoloB}
                      disabled={isLoadingAudio}
                      activeOpacity={0.7}
                    >
                      {isLoadingAudio && soloPlayingDeck === 'B' ? (
                        <ActivityIndicator size="small" color="#0b1110" />
                      ) : soloPlayingDeck === 'B' ? (
                        <Square size={10} color="#0b1110" fill="#0b1110" />
                      ) : (
                        <Play size={10} color="#34d399" fill="#34d399" />
                      )}
                      <Text style={[styles.soloBtnText, soloPlayingDeck === 'B' && styles.soloBtnTextActiveB]}>
                        {soloPlayingDeck === 'B' ? 'Stop' : 'Preview Mix-In'}
                      </Text>
                    </TouchableOpacity>

                    {/* Mix-In Steppers */}
                    <View style={[styles.stepperBox, { borderColor: 'rgba(16,185,129,0.4)' }]}>
                      <Text style={[styles.stepperPrefix, { color: '#10b981' }]}>Mix-In:</Text>
                      <TouchableOpacity
                        onPress={() => setMixInPoint(p => Math.max(0, p - 1))}
                        style={styles.stepBtn}
                      >
                        <Minus size={11} color="#94a3b8" />
                      </TouchableOpacity>
                      <Text style={[styles.stepVal, { color: '#34d399' }]}>{formatTime(mixInPoint)}</Text>
                      <TouchableOpacity
                        onPress={() => setMixInPoint(p => Math.min(durB - 5, p + 1))}
                        style={styles.stepBtn}
                      >
                        <Plus size={11} color="#94a3b8" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Subline Timing Info */}
                <View style={styles.timingSubline}>
                  <Text style={{ fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#34d399', fontWeight: 'bold' }}>
                    Mix-In: {formatTime(mixInPoint)} / {formatTime(durB)} ({Math.round((mixInPoint / durB) * 100)}%)
                  </Text>
                  <Text style={{ fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#94a3b8' }}>
                    Starts exactly at: {formatTime(mixInPoint)} (Skips intro)
                  </Text>
                </View>

                {/* Interactive Waveform Track Deck B */}
                <WaveformCueBox
                  peaks={peaksB}
                  duration={durB}
                  position={mixInPoint}
                  overlapDuration={duration}
                  mode="in"
                  onSeek={setMixInPoint}
                  accentColor="#10b981"
                  tagText="Entry"
                  isPlaying={isPreviewing || soloPlayingDeck === 'B'}
                  cursorProgress={soloPlayingDeck === 'B' ? soloProgress : previewProgress}
                />

                {/* Volume & Speed Sliders Deck B */}
                <View style={styles.sliderGrid}>
                  <View style={styles.sliderCol}>
                    <View style={styles.sliderLabelRow}>
                      <Text style={[styles.sliderLabelText, { color: '#34d399' }]}>
                        🔊 Volume: {volB}%
                      </Text>
                      <Text style={styles.sliderSubText}>
                        {volB === 100 ? '100% (Default)' : volB > 100 ? `+${volB - 100}% Boost` : `${volB - 100}% Cut`}
                      </Text>
                    </View>
                    <TouchSlider
                      min={50}
                      max={140}
                      step={5}
                      value={volB}
                      onChange={setVolB}
                      trackColor="#10b981"
                    />
                  </View>

                  <View style={styles.sliderCol}>
                    <View style={styles.sliderLabelRow}>
                      <Text style={[styles.sliderLabelText, { color: '#06b6d4' }]}>
                        ⚡ Speed: {speedB.toFixed(2)}x
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                          onPress={() => {
                            if (dataA.bpm && dataB.bpm) {
                              const ratio = Math.max(0.85, Math.min(1.15, Number((dataA.bpm / dataB.bpm).toFixed(2))));
                              setSpeedB(ratio);
                            }
                          }}
                          style={styles.bpmSyncPill}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.bpmSyncText}>⚡ Sync ({dataA.bpm})</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setSpeedB(1.0)} activeOpacity={0.7}>
                          <Text style={styles.resetLink}>1.0x</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <TouchSlider
                      min={0.85}
                      max={1.15}
                      step={0.01}
                      value={speedB}
                      onChange={setSpeedB}
                      trackColor="#06b6d4"
                    />
                  </View>
                </View>

                {/* Quick Jumps Deck B */}
                <View style={styles.quickJumpRow}>
                  <Text style={styles.quickJumpLabel}>Quick Jump:</Text>
                  {[
                    { label: 'Start (0:00)', sec: 0 },
                    { label: 'Skip Intro (+12s)', sec: 12 },
                    { label: 'Drop Start (+24s)', sec: 24 },
                  ].map((qj, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.quickChip}
                      onPress={() => setMixInPoint(Math.min(durB - 5, qj.sec))}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.quickChipText}>{qj.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* ── 2. TRANSITION STYLE • RIVO PRESETS (2-COLUMN GRID) ── */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>TRANSITION STYLE • RIVO PRESETS</Text>
                <Text style={styles.sectionBadgeText}>{activeStyleObj.badge}</Text>
              </View>

              <View style={styles.styleGrid2Col}>
                {TRANSITION_STYLES.map((st) => {
                  const Icon = st.icon;
                  const isSel = style === st.id;
                  return (
                    <TouchableOpacity
                      key={st.id}
                      style={[
                        styles.styleCard2Col,
                        isSel && {
                          borderColor: st.color,
                          backgroundColor: 'rgba(255,255,255,0.08)',
                          shadowColor: st.color,
                          shadowOpacity: 0.35,
                          shadowRadius: 8,
                          elevation: 4,
                        },
                      ]}
                      onPress={() => setStyle(st.id)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.styleCardTop}>
                        <View style={[styles.styleIconBox, { backgroundColor: isSel ? st.color : 'rgba(255,255,255,0.06)' }]}>
                          <Icon size={15} color={isSel ? '#000000' : st.color} />
                        </View>
                        <Text style={[styles.styleName, isSel && { color: '#ffffff', fontWeight: 'bold' }]}>
                          {st.name}
                        </Text>
                        {isSel && <Check size={14} color={st.color} strokeWidth={3} style={{ marginLeft: 'auto' }} />}
                      </View>
                      <Text style={styles.styleDesc} numberOfLines={2}>
                        {st.desc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── 3. DURATION & QUANTIZED BARS ── */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>DURATION & QUANTIZED BARS</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.barsValText}>{bars} Bars</Text>
                  <Text style={{ color: '#64748b', fontSize: 11 }}>•</Text>
                  <Text style={styles.durationValText}>{duration}s</Text>
                </View>
              </View>

              {/* 5 Quantized Bar Buttons */}
              <View style={styles.pillRow}>
                {BAR_OPTIONS.map((numBars) => {
                  const bSec = calculateBarsDuration(numBars, dataA.bpm);
                  const isSel = bars === numBars;
                  return (
                    <TouchableOpacity
                      key={numBars}
                      style={[styles.barPill, isSel && styles.barPillActive]}
                      onPress={() => handleSelectBars(numBars)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.barPillText, isSel && styles.barPillTextActive]}>
                        {numBars} {numBars === 1 ? 'Bar' : 'Bars'}
                      </Text>
                      <Text style={[styles.barPillSub, isSel && styles.barPillSubActive]}>
                        ~{bSec}s
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Fine-Tuning Slider */}
              <View style={{ marginTop: 10 }}>
                <TouchSlider
                  min={1}
                  max={48}
                  step={0.5}
                  value={duration}
                  onChange={setDuration}
                  trackColor="#10b981"
                />
                <View style={styles.sliderSubLabels}>
                  <Text style={styles.sliderSubLabelText}>Fast Drop (1s)</Text>
                  <Text style={styles.sliderSubLabelText}>Standard DJ Overlap (4-8s)</Text>
                  <Text style={styles.sliderSubLabelText}>Max Mix (48s)</Text>
                </View>
              </View>
            </View>

            {/* ── 4. REALTIME INTERACTIVE ENVELOPE CURVE GRAPH & CROSSOVER TUNER ── */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                {/* Track A Meter */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={[styles.deckDot, { backgroundColor: '#ef4444' }]} />
                  <Text style={{ fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: 'bold', color: '#f87171' }}>
                    Deck A {liveGainA}%
                  </Text>
                </View>

                {/* Bias Buttons */}
                <View style={styles.biasBtnGroup}>
                  {[
                    { label: 'Early (30%)', val: 0.30, active: crossoverBias <= 0.35 },
                    { label: 'Center (50%)', val: 0.50, active: crossoverBias > 0.35 && crossoverBias < 0.65 },
                    { label: 'Late (70%)', val: 0.70, active: crossoverBias >= 0.65 },
                  ].map((b, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => setCrossoverBias(b.val)}
                      style={[styles.biasBtn, b.active && styles.biasBtnActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.biasBtnText, b.active && styles.biasBtnTextActive]}>
                        {b.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Track B Meter */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: 'bold', color: '#34d399' }}>
                    {liveGainB}% Deck B
                  </Text>
                  <View style={[styles.deckDot, { backgroundColor: '#10b981' }]} />
                </View>
              </View>

              {/* Draggable SVG Curve Area */}
              <View
                onLayout={(e) => setCurveWidth(e.nativeEvent.layout.width)}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={handleCurveTouch}
                onResponderMove={handleCurveTouch}
                style={styles.curveArea}
              >
                <Svg viewBox="0 0 500 70" style={{ width: '100%', height: 80 }}>
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

                  {/* Track A Red Gain Curve */}
                  <Polyline
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={curvePointsA.join(' ')}
                  />

                  {/* Track B Green Gain Curve */}
                  <Polyline
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={curvePointsB.join(' ')}
                  />

                  {/* Intersection Handle */}
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

              {/* Crossover Bias Slider */}
              <View style={{ marginTop: 6 }}>
                <View style={styles.sliderLabelRow}>
                  <Text style={{ fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#10b981', fontWeight: 'bold' }}>
                    Crossover Point: {Math.round(crossoverBias * 100)}%
                  </Text>
                  <Text style={styles.sliderSubText}>
                    {crossoverBias <= 0.35
                      ? 'Track A ducks early'
                      : crossoverBias >= 0.65
                      ? 'Track A holds energy longer'
                      : 'Balanced centered crossover'}
                  </Text>
                </View>
                <TouchSlider
                  min={0.20}
                  max={0.80}
                  step={0.01}
                  value={crossoverBias}
                  onChange={setCrossoverBias}
                  trackColor="#10b981"
                />
              </View>
            </View>
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
                <Square size={14} color="#fff" fill="#fff" />
              ) : (
                <Play size={14} color="#fff" fill="#fff" />
              )}
              <Text style={styles.auditionBtnText}>
                {isPreviewing ? 'Stop Audition' : 'Audition Transition'}
              </Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity onPress={onClose} style={styles.cancelBtn} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={styles.saveBtn} activeOpacity={0.8}>
                <Check size={14} color="#0b1110" strokeWidth={3} />
                <Text style={styles.saveBtnText}>Save Transition</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: '94%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(24, 24, 27, 0.9)',
  },
  headerIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  rivoBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  rivoBadgeText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
    color: '#34d399',
  },
  sheetSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
    maxWidth: SCREEN_WIDTH - 120,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  scrollArea: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cueSection: {
    backgroundColor: '#09090b',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
    color: '#cbd5e1',
    letterSpacing: 0.5,
  },
  sectionHint: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#64748b',
  },
  sectionBadgeText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
    color: '#10b981',
  },
  deckCard: {
    backgroundColor: 'rgba(24, 24, 27, 0.6)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 10,
  },
  deckTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  deckDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  deckName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
    maxWidth: 110,
  },
  camelotPill: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  camelotText: {
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  bpmText: {
    fontSize: 9,
    color: '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  soloBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(24, 24, 27, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  soloBtnActiveA: {
    backgroundColor: '#ef4444',
    borderColor: '#f87171',
  },
  soloBtnActiveB: {
    backgroundColor: '#10b981',
    borderColor: '#34d399',
  },
  soloBtnText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
    color: '#f87171',
  },
  soloBtnTextActive: {
    color: '#ffffff',
  },
  soloBtnTextActiveB: {
    color: '#000000',
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  stepperPrefix: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
    color: '#f87171',
  },
  stepBtn: {
    padding: 1,
  },
  stepVal: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
    color: '#ffffff',
    minWidth: 26,
    textAlign: 'center',
  },
  timingSubline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  waveformContainer: {
    height: 52,
    backgroundColor: '#090d0c',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  peaksWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
    opacity: 0.35,
  },
  peakBar: {
    width: 2,
    backgroundColor: '#94a3b8',
    borderRadius: 1,
  },
  shadedRegion: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadedText: {
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
  },
  markerHandle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    marginLeft: -1.5,
    width: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 5,
  },
  markerInnerLine: {
    width: 1,
    height: 18,
    backgroundColor: '#ffffff',
  },
  markerLabel: {
    position: 'absolute',
    top: 2,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
  },
  markerLabelText: {
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
  },
  auditionCursor: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#ffffff',
    shadowColor: '#ffffff',
    shadowRadius: 4,
    shadowOpacity: 1,
  },
  sliderGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  sliderCol: {
    flex: 1,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sliderLabelText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
  },
  sliderSubText: {
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#64748b',
  },
  resetLink: {
    fontSize: 8,
    color: '#94a3b8',
    textDecorationLine: 'underline',
  },
  bpmSyncPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  bpmSyncText: {
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#34d399',
    fontWeight: 'bold',
  },
  quickJumpRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  quickJumpLabel: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#64748b',
    marginRight: 2,
  },
  quickChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  quickChipText: {
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#cbd5e1',
  },
  section: {
    backgroundColor: 'rgba(24, 24, 27, 0.5)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 12,
  },
  styleGrid2Col: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  styleCard2Col: {
    width: '48.5%',
    backgroundColor: 'rgba(24, 24, 27, 0.75)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    minHeight: 84,
    justifyContent: 'space-between',
  },
  styleCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  styleIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  styleDesc: {
    fontSize: 9.5,
    color: '#94a3b8',
    lineHeight: 13,
  },
  barsValText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  durationValText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
    color: '#10b981',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  barPill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  barPillActive: {
    backgroundColor: '#10b981',
    borderColor: '#34d399',
  },
  barPillText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  barPillTextActive: {
    color: '#000000',
  },
  barPillSub: {
    fontSize: 8,
    color: '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  barPillSubActive: {
    color: 'rgba(0,0,0,0.7)',
    fontWeight: 'bold',
  },
  sliderSubLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  sliderSubLabelText: {
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#64748b',
  },
  biasBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  biasBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  biasBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  biasBtnText: {
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#94a3b8',
  },
  biasBtnTextActive: {
    color: '#34d399',
    fontWeight: 'bold',
  },
  curveArea: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  touchSliderContainer: {
    height: 24,
    justifyContent: 'center',
    position: 'relative',
  },
  touchSliderTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  touchSliderFill: {
    height: '100%',
    borderRadius: 2,
  },
  touchSliderThumb: {
    position: 'absolute',
    marginLeft: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  auditionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  auditionBtnActive: {
    backgroundColor: '#ef4444',
    borderColor: '#f87171',
  },
  auditionBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  cancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  cancelBtnText: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#10b981',
  },
  saveBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0b1110',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
