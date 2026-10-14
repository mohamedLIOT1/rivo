import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Switch,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Plus, DownloadCloud, Link2, Music, Disc } from 'lucide-react-native';
import { API_BASE_URL } from '../config';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';

export default function CreatePlaylistModal({ visible, onClose, onSuccess }) {
  const { token, syncUserData } = useUser();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'import'
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [importUrl, setImportUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      showToast('Please enter a playlist name', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/playlists/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: desc.trim(),
          isPublic,
          isQuran: false,
        }),
      });

      const data = await res.json();
      if (res.ok && (data.success || data.playlist)) {
        showToast(`Playlist "${name.trim()}" created!`, 'success');
        setName('');
        setDesc('');
        await syncUserData();
        if (onSuccess) onSuccess(data.playlist);
        onClose();
      } else {
        showToast(data.error || data.message || 'Failed to create playlist', 'error');
      }
    } catch {
      showToast('Network error creating playlist', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importUrl.trim()) {
      showToast('Please paste a Spotify or YouTube playlist URL', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/playlists/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: importUrl.trim(),
          isQuran: false,
        }),
      });

      const data = await res.json();
      if (res.ok && (data.success || data.playlist)) {
        showToast(`Imported playlist "${data.playlist?.name || 'New Tape'}"!`, 'success');
        setImportUrl('');
        await syncUserData();
        if (onSuccess) onSuccess(data.playlist);
        onClose();
      } else {
        showToast(data.error || data.message || 'Failed to import playlist', 'error');
      }
    } catch {
      showToast('Network error importing playlist', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheetOuter}>
          <View style={styles.hardShadow} />
          <View style={styles.sheet}>
            {/* Header */}
            <View style={styles.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.iconBox}>
                  {activeTab === 'create' ? (
                    <Plus size={18} color={colors.ink} />
                  ) : (
                    <DownloadCloud size={18} color={colors.ink} />
                  )}
                </View>
                <View>
                  <Text style={styles.title}>
                    {activeTab === 'create' ? 'NEW PLAYLIST' : 'IMPORT TAPE'}
                  </Text>
                  <CassetteTag label="LIBRARY ARCHIVE" bg={colors.ink} textColor={colors.tealLight} />
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color={colors.ink} />
              </TouchableOpacity>
            </View>

            {/* Tab Switcher */}
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'create' && styles.tabBtnActive]}
                onPress={() => setActiveTab('create')}
              >
                <Text style={[styles.tabBtnText, activeTab === 'create' && styles.tabBtnTextActive]}>
                  CREATE NEW
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'import' && styles.tabBtnActive]}
                onPress={() => setActiveTab('import')}
              >
                <Text style={[styles.tabBtnText, activeTab === 'import' && styles.tabBtnTextActive]}>
                  IMPORT LINK
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {activeTab === 'create' ? (
                <View style={styles.formContent}>
                  <Text style={styles.label}>PLAYLIST NAME *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Midnight Waves, Arabic Hip-Hop..."
                    placeholderTextColor="#9ca3af"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />

                  <Text style={styles.label}>DESCRIPTION (OPTIONAL)</Text>
                  <TextInput
                    style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                    placeholder="Short description or mood for this playlist..."
                    placeholderTextColor="#9ca3af"
                    value={desc}
                    onChangeText={setDesc}
                    multiline
                  />

                  <View style={styles.switchRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.switchTitle}>Make Playlist Public</Text>
                      <Text style={styles.switchDesc}>
                        Visible to others on your profile and search.
                      </Text>
                    </View>
                    <Switch
                      value={isPublic}
                      onValueChange={setIsPublic}
                      trackColor={{ false: '#27272a', true: colors.mint }}
                      thumbColor="#ffffff"
                    />
                  </View>

                  <View style={styles.btnRow}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                      <Text style={styles.cancelText}>CANCEL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.submitBtn, (!name.trim() || loading) && { opacity: 0.6 }]}
                      onPress={handleCreate}
                      disabled={!name.trim() || loading}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color={colors.ink} />
                      ) : (
                        <Text style={styles.submitText}>CREATE PLAYLIST</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.formContent}>
                  <Text style={styles.desc}>
                    Paste a Spotify or YouTube playlist URL to convert and import it directly into your Rivo library:
                  </Text>

                  <Text style={styles.label}>PLAYLIST URL *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="https://open.spotify.com/playlist/... or youtube.com/playlist?list=..."
                    placeholderTextColor="#9ca3af"
                    value={importUrl}
                    onChangeText={setImportUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <View style={styles.btnRow}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                      <Text style={styles.cancelText}>CANCEL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.submitBtn, (!importUrl.trim() || loading) && { opacity: 0.6 }]}
                      onPress={handleImport}
                      disabled={!importUrl.trim() || loading}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color={colors.ink} />
                      ) : (
                        <Text style={styles.submitText}>IMPORT PLAYLIST</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  sheetOuter: {
    position: 'relative',
    maxHeight: '85%',
  },
  hardShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: -6,
    bottom: -6,
    backgroundColor: colors.ink,
    borderRadius: 16,
  },
  sheet: {
    backgroundColor: colors.paper,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
    marginBottom: 12,
  },
  iconBox: {
    width: 34,
    height: 34,
    backgroundColor: colors.mint,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 15,
    color: colors.ink,
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ede5d3',
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    padding: 2,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabBtnActive: {
    backgroundColor: colors.ink,
  },
  tabBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.ink,
  },
  tabBtnTextActive: {
    color: colors.mint,
  },
  formContent: {
    gap: 8,
  },
  label: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.ink,
    marginTop: 4,
  },
  desc: {
    fontSize: 12,
    color: colors.ink,
    opacity: 0.85,
    lineHeight: 18,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.ink,
    fontWeight: 'bold',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ede5d3',
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 8,
    padding: 10,
    marginVertical: 4,
  },
  switchTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 12,
    color: colors.ink,
  },
  switchDesc: {
    fontSize: 10,
    color: colors.ink,
    opacity: 0.75,
    marginTop: 2,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#ede5d3',
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 12,
    color: colors.ink,
  },
  submitBtn: {
    flex: 2,
    backgroundColor: colors.mint,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 12,
    color: colors.ink,
  },
});
