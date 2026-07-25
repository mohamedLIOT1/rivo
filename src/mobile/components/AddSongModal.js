import React, { useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { X, Music, User, Book, Hash, Link as LinkIcon, Save } from 'lucide-react-native';
import { API_BASE_URL } from '../config';

export default function AddSongModal({ visible, onClose, onSuccess }) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [genre, setGenre] = useState('Pop');
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!title || !artist || !audioUrl) {
      setError('يرجى ملء الحقول الأساسية: العنوان، الفنان، ورابط الصوت');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_BASE_URL}/api/tracks/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, artist, album: album || 'Single', genre, audioUrl,
          source: 'Manual',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل حفظ الأغنية');

      onSuccess();
      setTitle(''); setArtist(''); setAlbum(''); setAudioUrl('');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>إضافة أغنية يدوياً (نظام الويب)</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color="#a1a1aa" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>عنوان الأغنية *</Text>
              <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="مثال: Blinding Lights" placeholderTextColor="#52525b" />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>الفنان *</Text>
              <TextInput style={styles.input} value={artist} onChangeText={setArtist} placeholder="مثال: The Weeknd" placeholderTextColor="#52525b" />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>الألبوم</Text>
              <TextInput style={styles.input} value={album} onChangeText={setAlbum} placeholder="مثال: After Hours" placeholderTextColor="#52525b" />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>النوع (Genre)</Text>
              <TextInput style={styles.input} value={genre} onChangeText={setGenre} placeholder="مثال: Pop" placeholderTextColor="#52525b" />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>رابط ملف الصوت (Direct MP3 URL) *</Text>
              <TextInput style={styles.input} value={audioUrl} onChangeText={setAudioUrl} placeholder="https://..." placeholderTextColor="#52525b" />
            </View>

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator color="#000" /> : (
                <>
                  <Save size={20} color="#000" />
                  <Text style={styles.saveBtnText}>حفظ في المكتبة العامة</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#18181b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  form: {
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#a1a1aa',
    marginBottom: 8,
    textAlign: 'left',
  },
  input: {
    backgroundColor: '#09090b',
    borderRadius: 12,
    padding: 12,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#27272a',
    textAlign: 'left',
  },
  saveBtn: {
    backgroundColor: '#1DB954',
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  saveBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'left',
  },
});
