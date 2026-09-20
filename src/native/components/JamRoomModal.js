import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { X, Radio, LogOut, Sparkles } from 'lucide-react-native';
import { useSocket } from '../context/SocketContext';
import { useUser } from '../context/UserContext';
import { useAudioPlayer } from '../context/AudioContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';

export default function JamRoomModal({ visible, onClose }) {
  const { jamSession, joinJam, leaveJam } = useSocket();
  const { currentUser } = useUser();
  const { currentTrack } = useAudioPlayer();
  const [roomInput, setRoomInput] = useState('');

  const handleJoin = () => {
    if (roomInput.trim()) {
      joinJam(roomInput.trim().toUpperCase());
      setRoomInput('');
    }
  };

  const handleCreateNew = () => {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    joinJam(code);
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
                  <Radio size={18} color={colors.ink} />
                </View>
                <View>
                  <Text style={styles.title}>RIVO JAM ROOM</Text>
                  <CassetteTag label="REAL-TIME BROADCAST" bg={colors.amber} textColor={colors.ink} />
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color={colors.ink} />
              </TouchableOpacity>
            </View>

            {jamSession ? (
              <View style={styles.activeSession}>
                <View style={styles.codeCard}>
                  <Text style={styles.codeSubtitle}>ROOM BROADCAST CODE</Text>
                  <Text style={styles.codeText}>{jamSession.roomCode || 'LIVE'}</Text>
                </View>

                {currentTrack && (
                  <View style={styles.syncBox}>
                    <Text style={styles.syncLabel}>SYNCHRONIZED TAPE:</Text>
                    <Text style={styles.syncTitle} numberOfLines={1}>{currentTrack.title}</Text>
                  </View>
                )}

                <TouchableOpacity style={styles.leaveBtn} onPress={leaveJam}>
                  <LogOut size={16} color={colors.cardBg} />
                  <Text style={styles.leaveBtnText}>TERMINATE JAM LINK</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.inactiveSession}>
                <Text style={styles.desc}>
                  Broadcast audio in sync across multiple devices. Enter an active clinical room code or generate a new station:
                </Text>

                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="ROOM CODE"
                    placeholderTextColor="#9ca3af"
                    value={roomInput}
                    onChangeText={setRoomInput}
                    autoCapitalize="characters"
                    maxLength={6}
                  />
                  <TouchableOpacity
                    style={[styles.joinBtn, !roomInput.trim() && { opacity: 0.5 }]}
                    onPress={handleJoin}
                    disabled={!roomInput.trim()}
                  >
                    <Text style={styles.joinBtnText}>JOIN</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity style={styles.createBtn} onPress={handleCreateNew}>
                  <Sparkles size={18} color={colors.ink} />
                  <Text style={styles.createBtnText}>START NEW JAM SESSION</Text>
                </TouchableOpacity>
              </View>
            )}
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
    backgroundColor: colors.amber,
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
  desc: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: 12,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    color: colors.ink,
  },
  joinBtn: {
    backgroundColor: colors.teal,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinBtnText: {
    fontWeight: '900',
    color: colors.ink,
    fontSize: 13,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.ink,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.ink,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.amber,
    borderWidth: 2.5,
    borderColor: colors.ink,
    paddingVertical: 14,
  },
  createBtnText: {
    fontWeight: '900',
    color: colors.ink,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  activeSession: {
    gap: 12,
  },
  codeCard: {
    backgroundColor: colors.ink,
    borderWidth: 2,
    borderColor: colors.amber,
    padding: 16,
    alignItems: 'center',
  },
  codeSubtitle: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.amber,
    letterSpacing: 1,
  },
  codeText: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.cardBg,
    letterSpacing: 4,
    marginTop: 4,
  },
  syncBox: {
    backgroundColor: colors.cardBg,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: 12,
  },
  syncLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.tealDark,
    letterSpacing: 1,
  },
  syncTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
    marginTop: 2,
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.crimson,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingVertical: 12,
  },
  leaveBtnText: {
    color: colors.cardBg,
    fontWeight: '900',
    fontSize: 12,
  },
});
