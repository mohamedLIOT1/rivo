import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { X, Sliders, Check } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';

const PRESETS = [
  { id: 'flat', name: 'Flat Natural', desc: 'Clinical neutral acoustic curve', bands: [0, 0, 0, 0, 0] },
  { id: 'bass', name: 'Bass Dispensary', desc: 'Sub-bass low frequency boost', bands: [6, 4, 1, 0, 0] },
  { id: 'vocal', name: 'Vocal Clarity', desc: 'Speech and vocal frequency lift', bands: [-2, 1, 5, 3, -1] },
  { id: 'club', name: 'Club / Midnight', desc: 'Heavy kick and crisp highs', bands: [5, 3, 0, 2, 4] },
  { id: 'treble', name: 'Acoustic Treble', desc: 'High end instrument presence', bands: [-2, 0, 1, 4, 6] },
  { id: 'rock', name: 'Analog Tape Warmth', desc: 'Mid-range crunch and warm tone', bands: [4, 2, -1, 3, 5] },
];

const BANDS = ['60Hz', '250Hz', '1kHz', '4kHz', '16kHz'];

export default function EqualizerModal({ visible, onClose }) {
  const { equalizerPreset, setEqualizerPreset } = useAudioPlayer();

  const currentPresetObj = PRESETS.find(p => p.id === equalizerPreset) || PRESETS[0];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetOuter}>
          <View style={styles.hardShadow} />
          <View style={styles.sheet}>
            {/* Header */}
            <View style={styles.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.iconBox}>
                  <Sliders size={18} color={colors.ink} />
                </View>
                <View>
                  <Text style={styles.title}>RIVO EQUALIZER</Text>
                  <CassetteTag label="ACOUSTIC CALIBRATION" bg={colors.ink} textColor={colors.teal} />
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color={colors.ink} />
              </TouchableOpacity>
            </View>

            {/* Visualizer Curve */}
            <View style={styles.visualizerBox}>
              <Text style={styles.visualizerTitle}>PRESET: {currentPresetObj.name.toUpperCase()}</Text>
              <View style={styles.barsRow}>
                {currentPresetObj.bands.map((gain, i) => {
                  const heightPct = Math.min(100, Math.max(15, 50 + gain * 7));
                  return (
                    <View key={i} style={styles.barCol}>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { height: `${heightPct}%` }]} />
                      </View>
                      <Text style={styles.bandName}>{BANDS[i]}</Text>
                      <Text style={styles.gainText}>{gain > 0 ? `+${gain}` : gain}dB</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Presets List */}
            <Text style={styles.sectionTitle}>Acoustic Presets</Text>
            <ScrollView style={{ maxHeight: 220 }}>
              {PRESETS.map((p) => {
                const isSelected = (equalizerPreset || 'flat') === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.presetCard, isSelected && styles.selectedPresetCard]}
                    onPress={() => setEqualizerPreset(p.id)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.presetName, isSelected && styles.selectedPresetName]}>{p.name}</Text>
                      <Text style={styles.presetDesc}>{p.desc}</Text>
                    </View>
                    {isSelected && <Check size={18} color={colors.tealDark} strokeWidth={3} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 38, 33, 0.85)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  sheetOuter: {
    position: 'relative',
  },
  hardShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: -6,
    bottom: -6,
    backgroundColor: colors.ink,
  },
  sheet: {
    backgroundColor: colors.paper,
    borderWidth: 3.5,
    borderColor: colors.ink,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconBox: {
    width: 32,
    height: 32,
    backgroundColor: colors.teal,
    borderWidth: 2,
    borderColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.ink,
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 6,
  },
  visualizerBox: {
    backgroundColor: colors.ink,
    borderWidth: 2.5,
    borderColor: colors.ink,
    padding: 12,
    marginBottom: 16,
  },
  visualizerTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.tealLight,
    marginBottom: 12,
    letterSpacing: 1,
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    height: 100,
    alignItems: 'flex-end',
  },
  barCol: {
    alignItems: 'center',
  },
  barTrack: {
    width: 16,
    height: 70,
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: colors.tealDark,
    justifyContent: 'flex-end',
  },
  barFill: {
    backgroundColor: colors.teal,
    width: '100%',
  },
  bandName: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.textMuted,
    marginTop: 4,
  },
  gainText: {
    fontSize: 8,
    color: colors.tealLight,
    marginTop: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.ink,
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: 10,
    marginBottom: 6,
  },
  selectedPresetCard: {
    backgroundColor: colors.paperDark,
    borderWidth: 2.5,
    borderColor: colors.tealDark,
  },
  presetName: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.ink,
  },
  selectedPresetName: {
    color: colors.tealDark,
  },
  presetDesc: {
    fontSize: 11,
    color: '#4b5563',
    marginTop: 2,
    fontWeight: '600',
  },
});
