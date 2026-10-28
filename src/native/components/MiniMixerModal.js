import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import {
  X,
  Sliders,
  Volume2,
  Wand2,
  Play,
  Square,
  Check,
  Sparkles,
  ArrowRight,
  Zap,
  Flame,
  Layers,
  Activity,
  Plus,
  Minus,
  Radio,
} from 'lucide-react-native';
import {
  getTrackMusicalData,
  checkHarmonicCompatibility,
  getCamelotColor,
  calculateBarsDuration,
  calculateCrossfadeGains,
} from '../utils/musicAnalysis';
import { useAudioPlayer } from '../context/AudioContext';
import { normalizeCoverUri } from '../utils/coverUtils';
import { API_BASE_URL } from '../config';
import { resolveAudioStream } from '../services/youtubeResolver';
import { colors } from '../theme/colors';

const { width } = Dimensions.get('window');

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
    icon: Layers,
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
    icon: Flame,
    badge: 'Drop Cut',
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
  const harmony = useMemo(
    () => checkHarmonicCompatibility(dataA.key, dataB.key, dataA.bpm, dataB.bpm),
    [dataA.key, dataB.key, dataA.bpm, dataB.bpm]
  );

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
        } else {
          setPreviewProgress(1);
          soundARef.current?.setVolumeAsync(0).catch(() => {});
          soundBRef.current?.setVolumeAsync(Math.max(0.01, Math.min(1, 1.0 * multB))).catch(() => {});
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
    setMixOutPoint(Math.max(5, Math.floor(durA - dur)));
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

  const formatMinSec = (sec) => {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.headerIconBox}>
                <Sliders size={18} color="#10b981" />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.sheetTitle}>Edit Transition</Text>
                  <View style={styles.spotifyBadge}>
                    <Text style={styles.spotifyBadgeText}>Automix</Text>
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
            {/* ── CUE POINTS & ZONE RESIZING ── */}
            <View style={styles.cueSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>WAVEFORM CUE POINTS & ZONE RESIZING</Text>
              </View>

              {/* DECK A: OUTGOING */}
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
                      <Square size={12} color="#fff" fill="#fff" />
                    ) : (
                      <Play size={12} color="#f87171" fill="#f87171" />
                    )}
                    <Text style={[styles.soloBtnText, soloPlayingDeck === 'A' && styles.soloBtnTextActive]}>
                      {soloPlayingDeck === 'A' ? 'Stop' : 'Preview Mix-Out'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Mix-Out Timestamp & Fine Tuning */}
                <View style={styles.timingRow}>
                  <Text style={styles.cueLabel}>
                    Mix-Out: <Text style={{ color: '#f87171', fontWeight: 'bold' }}>{formatMinSec(mixOutPoint)}</Text> / {formatMinSec(durA)}
                  </Text>
                  <View style={styles.stepperBox}>
                    <TouchableOpacity
                      onPress={() => setMixOutPoint(p => Math.max(5, p - 1))}
                      style={styles.stepBtn}
                    >
                      <Minus size={12} color="#94a3b8" />
                    </TouchableOpacity>
                    <Text style={styles.stepVal}>{formatMinSec(mixOutPoint)}</Text>
                    <TouchableOpacity
                      onPress={() => setMixOutPoint(p => Math.min(durA, p + 1))}
                      style={styles.stepBtn}
                    >
                      <Plus size={12} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Quick Jumps Deck A */}
                <View style={styles.quickJumpRow}>
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
                    >
                      <Text style={styles.quickChipText}>{qj.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Volume & Speed Controls Deck A */}
                <View style={styles.ctrlGrid}>
                  <View style={styles.ctrlCol}>
                    <Text style={styles.ctrlTitle}>🔊 Volume: {volA}%</Text>
                    <View style={styles.stepperRow}>
                      <TouchableOpacity onPress={() => setVolA(v => Math.max(50, v - 10))} style={styles.miniBtn}>
                        <Minus size={10} color="#fff" />
                      </TouchableOpacity>
                      <Text style={styles.ctrlValText}>{volA}%</Text>
                      <TouchableOpacity onPress={() => setVolA(v => Math.min(140, v + 10))} style={styles.miniBtn}>
                        <Plus size={10} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.ctrlCol}>
                    <Text style={styles.ctrlTitle}>⚡ Speed: {speedA.toFixed(2)}x</Text>
                    <View style={styles.stepperRow}>
                      <TouchableOpacity onPress={() => setSpeedA(s => Math.max(0.85, Number((s - 0.02).toFixed(2))))} style={styles.miniBtn}>
                        <Minus size={10} color="#fff" />
                      </TouchableOpacity>
                      <Text style={styles.ctrlValText}>{speedA.toFixed(2)}x</Text>
                      <TouchableOpacity onPress={() => setSpeedA(s => Math.min(1.15, Number((s + 0.02).toFixed(2))))} style={styles.miniBtn}>
                        <Plus size={10} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>

              {/* DECK B: INCOMING */}
              <View style={[styles.deckCard, { borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
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
                      <Square size={12} color="#0b1110" fill="#0b1110" />
                    ) : (
                      <Play size={12} color="#34d399" fill="#34d399" />
                    )}
                    <Text style={[styles.soloBtnText, soloPlayingDeck === 'B' && styles.soloBtnTextActiveB]}>
                      {soloPlayingDeck === 'B' ? 'Stop' : 'Preview Mix-In'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Mix-In Timestamp & Fine Tuning */}
                <View style={styles.timingRow}>
                  <Text style={styles.cueLabel}>
                    Mix-In: <Text style={{ color: '#34d399', fontWeight: 'bold' }}>{formatMinSec(mixInPoint)}</Text> (Starts exactly here)
                  </Text>
                  <View style={[styles.stepperBox, { borderColor: 'rgba(16,185,129,0.4)' }]}>
                    <TouchableOpacity
                      onPress={() => setMixInPoint(p => Math.max(0, p - 1))}
                      style={styles.stepBtn}
                    >
                      <Minus size={12} color="#94a3b8" />
                    </TouchableOpacity>
                    <Text style={[styles.stepVal, { color: '#34d399' }]}>{formatMinSec(mixInPoint)}</Text>
                    <TouchableOpacity
                      onPress={() => setMixInPoint(p => Math.min(durB - 5, p + 1))}
                      style={styles.stepBtn}
                    >
                      <Plus size={12} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Quick Jumps Deck B */}
                <View style={styles.quickJumpRow}>
                  {[
                    { label: 'Start (0:00)', sec: 0 },
                    { label: 'Skip Intro (+12s)', sec: 12 },
                    { label: 'Drop Start (+24s)', sec: 24 },
                  ].map((qj, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.quickChip}
                      onPress={() => setMixInPoint(Math.min(durB - 5, qj.sec))}
                    >
                      <Text style={styles.quickChipText}>{qj.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Volume & Speed Controls Deck B with Sync BPM */}
                <View style={styles.ctrlGrid}>
                  <View style={styles.ctrlCol}>
                    <Text style={styles.ctrlTitle}>🔊 Volume: {volB}%</Text>
                    <View style={styles.stepperRow}>
                      <TouchableOpacity onPress={() => setVolB(v => Math.max(50, v - 10))} style={styles.miniBtn}>
                        <Minus size={10} color="#fff" />
                      </TouchableOpacity>
                      <Text style={styles.ctrlValText}>{volB}%</Text>
                      <TouchableOpacity onPress={() => setVolB(v => Math.min(140, v + 10))} style={styles.miniBtn}>
                        <Plus size={10} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.ctrlCol}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={styles.ctrlTitle}>⚡ Speed: {speedB.toFixed(2)}x</Text>
                      <TouchableOpacity
                        onPress={() => {
                          if (dataA.bpm && dataB.bpm) {
                            const ratio = Math.max(0.85, Math.min(1.15, Number((dataA.bpm / dataB.bpm).toFixed(2))));
                            setSpeedB(ratio);
                          }
                        }}
                        style={styles.syncBtn}
                      >
                        <Text style={styles.syncBtnText}>⚡ Sync ({dataA.bpm})</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.stepperRow}>
                      <TouchableOpacity onPress={() => setSpeedB(s => Math.max(0.85, Number((s - 0.02).toFixed(2))))} style={styles.miniBtn}>
                        <Minus size={10} color="#fff" />
                      </TouchableOpacity>
                      <Text style={styles.ctrlValText}>{speedB.toFixed(2)}x</Text>
                      <TouchableOpacity onPress={() => setSpeedB(s => Math.min(1.15, Number((s + 0.02).toFixed(2))))} style={styles.miniBtn}>
                        <Plus size={10} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* ── TRANSITION STYLE PRESETS ── */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>TRANSITION STYLE • PRESETS</Text>
              </View>

              <View style={styles.styleGrid}>
                {TRANSITION_STYLES.map((st) => {
                  const Icon = st.icon;
                  const isSel = style === st.id;
                  return (
                    <TouchableOpacity
                      key={st.id}
                      style={[
                        styles.styleCard,
                        isSel && { borderColor: st.color, backgroundColor: 'rgba(255,255,255,0.06)' },
                      ]}
                      onPress={() => setStyle(st.id)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <View style={[styles.styleIconBox, { backgroundColor: isSel ? st.color : 'rgba(255,255,255,0.08)' }]}>
                          <Icon size={14} color={isSel ? '#0b1110' : st.color} />
                        </View>
                        <Text style={[styles.styleName, isSel && { color: st.color }]}>{st.name}</Text>
                        {isSel && <Check size={14} color={st.color} style={{ marginLeft: 'auto' }} />}
                      </View>
                      <Text style={styles.styleDesc} numberOfLines={2}>
                        {st.desc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── DURATION & QUANTIZED BARS ── */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>DURATION & QUANTIZED BARS</Text>
                <Text style={styles.sectionValue}>
                  {bars} Bars • {duration}s
                </Text>
              </View>

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
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0f1715',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
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
    color: '#fff',
    letterSpacing: 0.3,
  },
  spotifyBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  spotifyBadgeText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
    color: '#34d399',
  },
  sheetSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
    maxWidth: width - 100,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  scrollArea: {
    paddingHorizontal: 16,
  },
  cueSection: {
    marginTop: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
    color: '#94a3b8',
    letterSpacing: 0.8,
  },
  sectionValue: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
    color: '#34d399',
  },
  deckCard: {
    backgroundColor: '#141f1c',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: 12,
    marginBottom: 10,
  },
  deckTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  deckDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  deckName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
    maxWidth: 140,
  },
  camelotPill: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  camelotText: {
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  bpmText: {
    fontSize: 10,
    color: '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  soloBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1e2926',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
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
    color: '#fff',
  },
  soloBtnTextActiveB: {
    color: '#0b1110',
  },
  timingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  cueLabel: {
    fontSize: 11,
    color: '#cbd5e1',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b1110',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  stepBtn: {
    padding: 4,
  },
  stepVal: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#f87171',
    paddingHorizontal: 6,
    fontWeight: 'bold',
  },
  quickJumpRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  quickChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  quickChipText: {
    fontSize: 9,
    color: '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  ctrlGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  ctrlCol: {
    flex: 1,
    backgroundColor: '#0b1110',
    borderRadius: 8,
    padding: 8,
  },
  ctrlTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#cbd5e1',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  miniBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    padding: 4,
  },
  ctrlValText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  syncBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  syncBtnText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#34d399',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  section: {
    marginTop: 14,
  },
  styleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  styleCard: {
    width: (width - 40) / 2,
    backgroundColor: '#141f1c',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 10,
  },
  styleIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  styleDesc: {
    fontSize: 9,
    color: '#94a3b8',
    lineHeight: 12,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  barPill: {
    flex: 1,
    backgroundColor: '#141f1c',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 8,
    alignItems: 'center',
  },
  barPillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
  },
  barPillText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  barPillTextActive: {
    color: '#34d399',
  },
  barPillSub: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  barPillSubActive: {
    color: '#10b981',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 8,
  },
  auditionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e2926',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  auditionBtnActive: {
    backgroundColor: '#ef4444',
    borderColor: '#f87171',
  },
  auditionBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  cancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0b1110',
  },
});
