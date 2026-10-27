import React, { useState, useEffect, useMemo } from 'react';
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
} from 'react-native';
import {
  X,
  Sliders,
  Volume2,
  Wand2,
  Play,
  Check,
  Sparkles,
  ArrowRight,
  Zap,
  Flame,
  Layers,
  Activity,
} from 'lucide-react-native';
import {
  getTrackMusicalData,
  checkHarmonicCompatibility,
  getCamelotColor,
  calculateBarsDuration,
  CAMELOT_COLORS,
} from '../utils/musicAnalysis';
import { useAudioPlayer } from '../context/AudioContext';
import { normalizeCoverUri } from '../utils/coverUtils';

const { width } = Dimensions.get('window');

const SPOTIFY_TRANSITION_STYLES = [
  {
    id: 'auto',
    name: 'Auto (Smart Mix)',
    desc: 'Analyzes BPM & Camelot harmony to pick optimal transition',
    icon: Wand2,
    badge: 'Spotify Auto',
    color: '#10b981',
  },
  {
    id: 'fade',
    name: 'Fade',
    desc: 'Smooth equal-power crossfade without abrupt volume drop',
    icon: Volume2,
    badge: 'Clean Fade',
    color: '#10b981',
  },
  {
    id: 'rise',
    name: 'Rise',
    desc: 'Dramatic high-pass sweep and buildup tension before the drop',
    icon: Zap,
    badge: 'Dramatic Rise',
    color: '#f59e0b',
  },
  {
    id: 'blend',
    name: 'Blend (Bass Swap)',
    desc: 'Swaps bass frequencies smoothly to prevent muddy low-end clash',
    icon: Layers,
    badge: 'Bass Swap',
    color: '#a855f7',
  },
  {
    id: 'cut',
    name: 'Instant Cut',
    desc: 'Direct switch on downbeat without crossfade overlap',
    icon: Flame,
    badge: 'Downbeat Cut',
    color: '#ef4444',
  },
];

const SPOTIFY_BAR_OPTIONS = [2, 4, 8, 12];

export default function MiniMixerModal({
  visible,
  onClose,
  fromTrack,
  toTrack,
  transition,
  onSaveTransition,
}) {
  const { playTrack } = useAudioPlayer();

  const fromMusic = useMemo(() => getTrackMusicalData(fromTrack), [fromTrack]);
  const toMusic = useMemo(() => getTrackMusicalData(toTrack), [toTrack]);
  const harmony = useMemo(
    () => checkHarmonicCompatibility(fromMusic.key, toMusic.key),
    [fromMusic.key, toMusic.key]
  );

  const [selectedStyle, setSelectedStyle] = useState('auto');
  const [selectedBars, setSelectedBars] = useState(4);
  const [isPreviewing, setIsPreviewing] = useState(false);

  useEffect(() => {
    if (visible) {
      if (transition) {
        setSelectedStyle(transition.style || transition.type || 'auto');
        setSelectedBars(transition.bars || 4);
      } else {
        setSelectedStyle('auto');
        setSelectedBars(4);
      }
      setIsPreviewing(false);
    }
  }, [visible, transition]);

  const avgBpm = Math.round((fromMusic.bpm + toMusic.bpm) / 2);
  const durationSec = calculateBarsDuration(selectedBars, avgBpm);

  const handleAudition = () => {
    setIsPreviewing(true);
    if (fromTrack) {
      // Seek near end of fromTrack to audition transition
      const dur = Number(fromTrack.duration || 240);
      const seekPos = Math.max(0, dur - durationSec - 2);
      playTrack(fromTrack, [fromTrack, toTrack], seekPos);
    }
    setTimeout(() => setIsPreviewing(false), Math.min(10000, durationSec * 1000 + 3000));
  };

  const handleSave = () => {
    if (onSaveTransition) {
      onSaveTransition({
        style: selectedStyle,
        bars: selectedBars,
        duration: durationSec,
        bpm: avgBpm,
      });
    }
    onClose();
  };

  const fromColor = getCamelotColor(fromMusic.key);
  const toColor = getCamelotColor(toMusic.key);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.headerIconBox}>
                <Sliders size={18} color="#10b981" />
              </View>
              <View>
                <Text style={styles.sheetTitle}>Spotify Transition Editor</Text>
                <Text style={styles.sheetSubtitle}>Mixed Playlists DJ Engine</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Track Comparison Card */}
            <View style={styles.comparisonCard}>
              {/* Outgoing Track */}
              <View style={styles.trackCol}>
                <Image
                  source={{ uri: normalizeCoverUri(fromTrack?.cover || fromTrack?.coverUrl) }}
                  style={styles.trackCover}
                />
                <Text style={styles.trackTitle} numberOfLines={1}>
                  {fromTrack?.title || 'Current Track'}
                </Text>
                <Text style={styles.trackArtist} numberOfLines={1}>
                  {fromTrack?.artist || 'Artist'}
                </Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.camelotPill, { backgroundColor: fromColor.bg, borderColor: fromColor.border }]}>
                    <Text style={[styles.camelotText, { color: fromColor.text }]}>{fromMusic.key}</Text>
                  </View>
                  <Text style={styles.bpmText}>{fromMusic.bpm} BPM</Text>
                </View>
              </View>

              {/* Transition Indicator Arrow */}
              <View style={styles.midCol}>
                <View style={styles.arrowCircle}>
                  <ArrowRight size={14} color="#10b981" />
                </View>
                <Text style={[styles.harmonyBadge, { color: harmony.compatible ? '#34d399' : '#f59e0b' }]}>
                  {harmony.compatible ? 'Harmonic ✓' : 'Energy Shift'}
                </Text>
              </View>

              {/* Incoming Track */}
              <View style={styles.trackCol}>
                <Image
                  source={{ uri: normalizeCoverUri(toTrack?.cover || toTrack?.coverUrl) }}
                  style={styles.trackCover}
                />
                <Text style={styles.trackTitle} numberOfLines={1}>
                  {toTrack?.title || 'Next Track'}
                </Text>
                <Text style={styles.trackArtist} numberOfLines={1}>
                  {toTrack?.artist || 'Artist'}
                </Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.camelotPill, { backgroundColor: toColor.bg, borderColor: toColor.border }]}>
                    <Text style={[styles.camelotText, { color: toColor.text }]}>{toMusic.key}</Text>
                  </View>
                  <Text style={styles.bpmText}>{toMusic.bpm} BPM</Text>
                </View>
              </View>
            </View>

            {/* Transition Duration (Bars) */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>TRANSITION LENGTH</Text>
                <Text style={styles.sectionValue}>
                  {selectedBars} BARS ({durationSec}s)
                </Text>
              </View>
              <View style={styles.pillRow}>
                {SPOTIFY_BAR_OPTIONS.map((bars) => {
                  const bSec = calculateBarsDuration(bars, avgBpm);
                  const isSel = selectedBars === bars;
                  return (
                    <TouchableOpacity
                      key={bars}
                      style={[styles.barPill, isSel && styles.barPillActive]}
                      onPress={() => setSelectedBars(bars)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.barPillText, isSel && styles.barPillTextActive]}>
                        {bars} bars
                      </Text>
                      <Text style={[styles.barPillSub, isSel && styles.barPillSubActive]}>
                        {bSec}s
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Transition Style Presets */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TRANSITION STYLE</Text>
              {SPOTIFY_TRANSITION_STYLES.map((st) => {
                const IconComponent = st.icon;
                const isSel = selectedStyle === st.id;
                return (
                  <TouchableOpacity
                    key={st.id}
                    style={[styles.styleCard, isSel && styles.styleCardActive]}
                    onPress={() => setSelectedStyle(st.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.styleIconBox, { backgroundColor: isSel ? 'rgba(16, 185, 129, 0.2)' : '#1a2924' }]}>
                      <IconComponent size={18} color={isSel ? '#10b981' : '#94a3b8'} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.styleName, isSel && { color: '#ffffff' }]}>
                          {st.name}
                        </Text>
                        <View style={[styles.styleBadge, { backgroundColor: `${st.color}20`, borderColor: st.color }]}>
                          <Text style={[styles.styleBadgeText, { color: st.color }]}>{st.badge}</Text>
                        </View>
                      </View>
                      <Text style={styles.styleDesc} numberOfLines={2}>
                        {st.desc}
                      </Text>
                    </View>
                    {isSel && (
                      <View style={styles.checkCircle}>
                        <Check size={12} color="#000000" strokeWidth={3} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={styles.auditionBtn}
              onPress={handleAudition}
              activeOpacity={0.8}
            >
              <Play size={14} color="#10b981" fill="#10b981" />
              <Text style={styles.auditionBtnText}>
                {isPreviewing ? 'AUDITIONING...' : 'PREVIEW'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              activeOpacity={0.8}
            >
              <Check size={16} color="#000000" strokeWidth={2.5} />
              <Text style={styles.saveBtnText}>APPLY MIX</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0c1714',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: '#1d3630',
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#162822',
  },
  headerIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  sheetSubtitle: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#162822',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  comparisonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#11221d',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f3a32',
    padding: 12,
    marginBottom: 16,
  },
  trackCol: {
    flex: 1,
    alignItems: 'center',
  },
  trackCover: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#1b302a',
    marginBottom: 6,
  },
  trackTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  trackArtist: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  camelotPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  camelotText: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  bpmText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#cbd5e1',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  midCol: {
    width: 60,
    alignItems: 'center',
  },
  arrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  harmonyBadge: {
    fontSize: 8,
    fontWeight: '800',
    textAlign: 'center',
  },
  section: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  sectionValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10b981',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  barPill: {
    flex: 1,
    backgroundColor: '#11221d',
    borderWidth: 1.2,
    borderColor: '#1e3830',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  barPillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderColor: '#10b981',
  },
  barPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94a3b8',
  },
  barPillTextActive: {
    color: '#10b981',
  },
  barPillSub: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
  },
  barPillSubActive: {
    color: '#34d399',
  },
  styleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#11221d',
    borderWidth: 1.2,
    borderColor: '#1e3830',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  styleCardActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderColor: '#10b981',
  },
  styleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  styleBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 0.8,
  },
  styleBadgeText: {
    fontSize: 8,
    fontWeight: '800',
  },
  styleDesc: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#162822',
  },
  auditionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#11221d',
    borderWidth: 1.2,
    borderColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 12,
  },
  auditionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: 0.5,
  },
  saveBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 12,
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.5,
  },
});
