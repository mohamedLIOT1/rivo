import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { X, Plus, Link, Music } from 'lucide-react-native';
import { API_BASE_URL } from '../config';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';

export default function AddSongModal({ visible, onClose, onSuccess }) {
  const { token } = useUser();
  const { showToast } = useToast();

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!url.trim()) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/tracks/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Imported: ${data.track?.title || 'Song added!'}`, 'info');
        setUrl('');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        showToast(data.message || data.error || 'Failed to resolve link', 'error');
      }
    } catch {
      showToast('Network error importing song', 'error');
    } finally {
      setLoading(false);
    }
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
                  <Plus size={18} color={colors.ink} />
                </View>
                <View>
                  <Text style={styles.title}>ADD AUDIO TAPE</Text>
                  <CassetteTag label="STREAM RESOLVER" bg={colors.ink} textColor={colors.tealLight} />
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color={colors.ink} />
              </TouchableOpacity>
            </View>

            <Text style={styles.desc}>
              Paste a YouTube or direct MP3 stream URL to register it into the dispensary catalog:
            </Text>

            <TextInput
              style={styles.input}
              placeholder="https://youtu.be/... or https://example.com/audio.mp3"
              placeholderTextColor="#9ca3af"
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>CANCEL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, (!url.trim() || loading) && { opacity: 0.6 }]}
                onPress={handleImport}
                disabled={!url.trim() || loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.ink} />
                ) : (
                  <Text style={styles.submitText}>ADD SONG</Text>
                )}
              </TouchableOpacity>
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
    justifyContent: 'center',
    padding: 16,
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
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
  desc: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 14,
  },
  input: {
    backgroundColor: colors.cardBg,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: 12,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 16,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.paperDark,
  },
  cancelText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.ink,
  },
  submitBtn: {
    backgroundColor: colors.teal,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingVertical: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.ink,
  },
});
