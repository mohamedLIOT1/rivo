import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Shield, Trash2, Disc, UserCheck, AlertTriangle } from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';
import { API_BASE_URL } from '../config';

export default function AdminScreen() {
  const { currentUser, tracks, token, fetchPublicTracks } = useUser();
  const { showToast } = useToast();
  const [deletingId, setDeletingId] = useState(null);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.email?.includes('admin');

  const handleDeleteSong = (track) => {
    Alert.alert(
      'ADMIN COMMAND // PURGE TRACK',
      `Permanently delete "${track.title}" from the master cloud database?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'CONFIRM DELETE',
          style: 'destructive',
          onPress: async () => {
            const id = track._id || track.id;
            try {
              setDeletingId(id);
              const res = await fetch(`${API_BASE_URL}/api/tracks/${id}`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });
              if (res.ok) {
                showToast('Track deleted from database', 'info');
                fetchPublicTracks();
              } else {
                showToast('Failed to delete track (Admin privileges required)', 'error');
              }
            } catch {
              showToast('Error sending delete command', 'error');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>ADMIN CONSOLE</Text>
          <Text style={styles.headerSub}>DISPENSARY MODERATION & VAULT CONTROL</Text>
        </View>
        <CassetteTag
          label={isAdmin ? 'ADMIN AUTHORIZED' : 'RESTRICTED VIEW'}
          bg={isAdmin ? colors.mint : colors.rust}
          textColor={colors.ink}
        />
      </View>

      {/* Warning banner if not admin */}
      {!isAdmin && (
        <View style={styles.warningCard}>
          <AlertTriangle size={18} color={colors.rust} />
          <Text style={styles.warningText}>
            You are logged in as a standard citizen. Destructive commands require administrative privileges.
          </Text>
        </View>
      )}

      {/* Master Songs Management */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>MASTER REEL REGISTRY ({tracks.length} TAPES)</Text>
      </View>

      <View style={styles.tracksList}>
        {tracks.slice(0, 30).map((track, idx) => (
          <View key={track._id || track.id || idx} style={styles.trackRow}>
            <View style={styles.indexBox}>
              <Text style={styles.indexText}>{idx + 1}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.trackTitle} numberOfLines={1}>
                {track.title}
              </Text>
              <Text style={styles.trackArtist} numberOfLines={1}>
                {track.artist || 'Unknown'} • ID: {String(track._id || track.id).slice(0, 8)}...
              </Text>
            </View>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDeleteSong(track)}
            >
              <Trash2 size={15} color={colors.rust} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  content: {
    padding: 14,
    paddingBottom: 110,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: colors.deepForest,
    paddingBottom: 10,
  },
  headerTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 18,
    color: colors.paper,
    letterSpacing: 0.5,
  },
  headerSub: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '800',
    color: colors.mint,
    marginTop: 2,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b1818',
    borderWidth: 2,
    borderColor: colors.rust,
    borderRadius: 8,
    padding: 12,
    gap: 10,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#fca5a5',
    lineHeight: 15,
  },
  sectionHeader: {
    marginBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 6,
  },
  sectionTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.tealLight,
  },
  tracksList: {
    gap: 8,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceDark,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    padding: 10,
  },
  indexBox: {
    width: 26,
    height: 26,
    backgroundColor: colors.deepForest,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.mint,
  },
  trackTitle: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 12,
    color: colors.paper,
  },
  trackArtist: {
    fontSize: 10,
    color: colors.paperMuted,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1.5,
    borderColor: colors.rust,
    borderRadius: 6,
  },
});
