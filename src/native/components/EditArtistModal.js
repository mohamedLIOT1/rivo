import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
  Switch,
} from 'react-native';
import {
  X,
  User,
  Image as ImageIcon,
  Check,
  CheckCircle2,
  FileText,
  ShieldCheck,
} from 'lucide-react-native';
import { API_BASE_URL } from '../config';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import { normalizeCoverUri } from '../utils/coverUtils';

export default function EditArtistModal({
  visible,
  onClose,
  artist,
  onSaved = () => {},
}) {
  const { token, fetchPublicTracks } = useUser();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [cover, setCover] = useState('');
  const [banner, setBanner] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const originalName = typeof artist === 'string'
    ? artist.trim()
    : (artist?.name || artist?.artist || '').trim();

  useEffect(() => {
    if (visible && artist) {
      const artObj = typeof artist === 'object' ? artist : {};
      setName(originalName);
      setBio(artObj.bio || '');
      setCover(artObj.cover || artObj.avatar || artObj.coverUrl || '');
      setBanner(artObj.banner || artObj.headerImage || '');
      setIsVerified(Boolean(artObj.isVerified || artObj.verified));
      setIsSaving(false);
    }
  }, [visible, artist]);

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Artist name cannot be empty', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/artists/${encodeURIComponent(originalName)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          bio: bio.trim(),
          cover: cover.trim(),
          banner: banner.trim(),
          isVerified,
        })
      });

      const data = await res.json();
      if (res.ok && (data.success || data.artist)) {
        showToast('Artist profile updated successfully!', 'success');
        if (fetchPublicTracks) fetchPublicTracks();
        if (onSaved) onSaved(data.artist || { name, bio, cover, banner, isVerified });
        onClose();
      } else {
        showToast(data.error || 'Failed to update artist', 'error');
      }
    } catch {
      showToast('Error saving artist details', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header Bar */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <User size={20} color="#f59e0b" strokeWidth={2.5} />
            <Text style={styles.headerTitle}>EDIT ARTIST PROFILE</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={20} color="#fdfbf7" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          {/* Artist Name */}
          <Text style={styles.fieldLabel}>ARTIST DISPLAY NAME *</Text>
          <TextInput
            style={styles.input}
            placeholder="Artist Name"
            placeholderTextColor="#6b7280"
            value={name}
            onChangeText={setName}
          />

          {/* Avatar / Profile Image URL */}
          <Text style={styles.fieldLabel}>PROFILE AVATAR URL</Text>
          <TextInput
            style={styles.input}
            placeholder="https://..."
            placeholderTextColor="#6b7280"
            value={cover}
            onChangeText={setCover}
            autoCapitalize="none"
          />

          {cover ? (
            <View style={styles.previewBox}>
              <Image source={{ uri: normalizeCoverUri(cover) }} style={styles.previewAvatar} resizeMode="cover" />
              <Text style={styles.previewText}>Avatar Preview</Text>
            </View>
          ) : null}

          {/* Banner / Header Image URL */}
          <Text style={styles.fieldLabel}>HEADER / BANNER IMAGE URL</Text>
          <TextInput
            style={styles.input}
            placeholder="https://..."
            placeholderTextColor="#6b7280"
            value={banner}
            onChangeText={setBanner}
            autoCapitalize="none"
          />

          {banner ? (
            <View style={[styles.previewBox, { flexDirection: 'column', alignItems: 'flex-start' }]}>
              <Image source={{ uri: normalizeCoverUri(banner) }} style={styles.previewBanner} resizeMode="cover" />
              <Text style={styles.previewText}>Header Banner Preview</Text>
            </View>
          ) : null}

          {/* Biography */}
          <Text style={styles.fieldLabel}>ARTIST BIOGRAPHY / BIO</Text>
          <TextInput
            style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
            placeholder="About this artist..."
            placeholderTextColor="#6b7280"
            value={bio}
            onChangeText={setBio}
            multiline={true}
          />

          {/* Verified Switch */}
          <View style={styles.switchRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={18} color="#17a398" strokeWidth={2.4} />
              <Text style={styles.switchLabel}>Verified Artist Badge</Text>
            </View>
            <Switch
              value={isVerified}
              onValueChange={setIsVerified}
              trackColor={{ false: '#243b37', true: '#17a398' }}
              thumbColor={isVerified ? '#fdfbf7' : '#9ca3af'}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            {isSaving ? (
              <ActivityIndicator color="#0b1110" />
            ) : (
              <>
                <Check size={16} color="#0b1110" strokeWidth={3} />
                <Text style={styles.saveBtnText}>SAVE ARTIST CHANGES</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1110',
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderColor: '#f59e0b',
    marginBottom: 16,
  },
  headerTitle: {
    color: '#fdfbf7',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#162321',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#243b37',
  },
  scroll: {
    flex: 1,
  },
  fieldLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 6,
    marginTop: 12,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#141d1b',
    borderWidth: 1.5,
    borderColor: '#243b37',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fdfbf7',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  previewBox: {
    marginTop: 10,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#141d1b',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#243b37',
  },
  previewAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  previewBanner: {
    width: '100%',
    height: 90,
    borderRadius: 8,
  },
  previewText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#141d1b',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#243b37',
    marginTop: 16,
    marginBottom: 20,
  },
  switchLabel: {
    color: '#fdfbf7',
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  saveBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#0b1110',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    marginTop: 10,
  },
  saveBtnText: {
    color: '#0b1110',
    fontSize: 13,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
  },
});
