import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { X, Moon, Clock, Ban } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';

const OPTIONS = [
  { label: '15 Minutes', minutes: 15 },
  { label: '30 Minutes', minutes: 30 },
  { label: '45 Minutes', minutes: 45 },
  { label: '60 Minutes', minutes: 60 },
  { label: 'End of Current Track', minutes: 4 },
];

export default function SleepTimerModal({ visible, onClose }) {
  const { sleepTimerRemaining, startSleepTimer, cancelSleepTimer } = useAudioPlayer();

  const formatRemaining = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

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
                  <Moon size={18} color={colors.ink} />
                </View>
                <View>
                  <Text style={styles.title}>SLEEP TIMER</Text>
                  <CassetteTag label="AUTO-SUSPEND DECK" bg={colors.ink} textColor={colors.sky} />
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color={colors.ink} />
              </TouchableOpacity>
            </View>

            {/* Active countdown card */}
            {sleepTimerRemaining !== null && (
              <View style={styles.activeCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeLabel}>TIMER CURRENTLY ACTIVE</Text>
                  <Text style={styles.activeTime}>
                    Auto-stop in {formatRemaining(sleepTimerRemaining)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    cancelSleepTimer();
                    onClose();
                  }}
                >
                  <Ban size={14} color={colors.cardBg} />
                  <Text style={styles.cancelBtnText}>CANCEL</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.subText}>Suspend playback after:</Text>
            <View style={styles.optionsList}>
              {OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.minutes}
                  style={styles.optionBtn}
                  onPress={() => {
                    startSleepTimer(opt.minutes);
                    onClose();
                  }}
                  activeOpacity={0.8}
                >
                  <Clock size={16} color={colors.ink} />
                  <Text style={styles.optionLabel}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
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
    padding: 18,
    paddingBottom: 28,
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
    backgroundColor: colors.sky,
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
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ink,
    padding: 12,
    borderWidth: 2,
    borderColor: colors.teal,
    marginBottom: 16,
  },
  activeLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.tealLight,
    letterSpacing: 0.5,
  },
  activeTime: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.cardBg,
    marginTop: 2,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.crimson,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: colors.cardBg,
  },
  cancelBtnText: {
    color: colors.cardBg,
    fontWeight: '900',
    fontSize: 10,
  },
  subText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.ink,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  optionsList: {
    gap: 8,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.cardBg,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: 14,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.ink,
  },
});
