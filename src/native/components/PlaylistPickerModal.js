import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, ActivityIndicator, Platform, BackHandler } from 'react-native';
import { X, Plus, FolderPlus, Music, Check } from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from '../context/LocalizationContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';

const PLAYLIST_ROW_HEIGHT = 65;

const PlaylistItemRow = React.memo(function PlaylistItemRow({
  item,
  isProcessing,
  onSelect,
  isRTL,
}) {
  const count = Array.isArray(item.tracks) ? item.tracks.length : 0;
  return (
    <TouchableOpacity
      style={styles.playlistItem}
      onPress={() => onSelect(item)}
      disabled={isProcessing}
      activeOpacity={0.7}
    >
      <View style={styles.playlistIcon}>
        <Music size={16} color={colors.mint} />
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={[styles.playlistName, isRTL && styles.rtlText]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.playlistCount, isRTL && styles.rtlText]}>
          {count} {isRTL ? 'مقاطع' : 'TRACKS'}
        </Text>
      </View>
      {isProcessing ? (
        <ActivityIndicator size="small" color={colors.teal} />
      ) : (
        <View style={styles.addPill}>
          <Check size={14} color={colors.ink} />
          <Text style={[styles.addPillText, isRTL && styles.rtlText]}>
            {isRTL ? 'إضافة' : 'ADD'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

export default function PlaylistPickerModal({ visible, track, onClose }) {
  const { playlists, createPlaylist, addToPlaylist, token } = useUser();
  const { showToast } = useToast();
  const { isRTL } = useTranslation();
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [addingId, setAddingId] = useState(null);

  useEffect(() => {
    if (!visible || !track) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose?.();
      return true;
    });
    return () => sub.remove();
  }, [visible, track, onClose]);

  if (!visible || !track) return null;

  const trackId = String(track._id || track.id);

  const handleCreateAndAdd = async () => {
    if (!newPlaylistName.trim()) {
      showToast(isRTL ? 'برجاء كتابة اسم القائمة' : 'Please enter a playlist name', 'warning');
      return;
    }
    if (!token) {
      showToast('Please log in to manage playlists', 'warning');
      return;
    }
    try {
      setIsCreating(true);
      await createPlaylist(newPlaylistName.trim());
      setNewPlaylistName('');
      showToast('Playlist created!', 'success');
    } catch {
      showToast('Failed to create playlist', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectPlaylist = async (playlist) => {
    const pId = playlist._id || playlist.id;
    if (!token) {
      showToast('Please log in to manage playlists', 'warning');
      return;
    }
    try {
      setAddingId(pId);
      await addToPlaylist(pId, trackId);
      showToast(`Added to "${playlist.name}"`, 'success');
      onClose();
    } catch {
      showToast('Failed to add track to playlist', 'error');
    } finally {
      setAddingId(null);
    }
  };

  const getItemLayout = useCallback((_, index) => ({
    length: PLAYLIST_ROW_HEIGHT,
    offset: PLAYLIST_ROW_HEIGHT * index,
    index,
  }), []);

  const renderPlaylistItem = useCallback(({ item }) => {
    const pId = item._id || item.id;
    return (
      <PlaylistItemRow
        item={item}
        isProcessing={addingId === pId}
        onSelect={handleSelectPlaylist}
        isRTL={isRTL}
      />
    );
  }, [addingId, handleSelectPlaylist, isRTL]);

  return (
    <View style={styles.modalBackdrop}>
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.cardOuter}>
          <View style={styles.hardShadow} />
          <View style={styles.modalBox}>
            {/* Header */}
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <CassetteTag label={isRTL ? 'قائمة تشغيل' : 'PLAYLIST'} bg={colors.ink} textColor={colors.mint} />
                <Text style={[styles.title, isRTL && styles.rtlText]}>
                  {isRTL ? 'إضافة إلى قائمة تشغيل' : 'ADD TO PLAYLIST'}
                </Text>
                <Text style={[styles.subTitle, isRTL && styles.rtlText]} numberOfLines={1}>
                  "{track.title}" - {track.artist || (isRTL ? 'فنان غير معروف' : 'Unknown')}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={18} color={colors.ink} />
              </TouchableOpacity>
            </View>

            {/* Quick Create Box */}
            <View style={styles.createBox}>
              <TextInput
                style={[styles.input, isRTL && { textAlign: 'right' }]}
                placeholder={isRTL ? 'اسم القائمة الجديدة...' : 'New Playlist Name...'}
                placeholderTextColor={colors.grayText}
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
              />
              <TouchableOpacity
                style={styles.createBtn}
                onPress={handleCreateAndAdd}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color={colors.ink} />
                ) : (
                  <>
                    <Plus size={16} color={colors.ink} strokeWidth={3} />
                    <Text style={[styles.createBtnText, isRTL && styles.rtlText]}>
                      {isRTL ? 'إنشاء' : 'NEW'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Playlist Items */}
            <Text style={[styles.sectionLabel, isRTL && styles.rtlText]}>
              {isRTL ? `قوائم التشغيل الخاصة بك (${playlists.length})` : `YOUR PLAYLISTS (${playlists.length})`}
            </Text>
            {playlists.length === 0 ? (
              <View style={styles.emptyBox}>
                <FolderPlus size={32} color={colors.teal} />
                <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                  {isRTL ? 'لا توجد قوائم تشغيل حتى الآن.' : 'No playlists found.'}
                </Text>
                <Text style={[styles.emptySub, isRTL && styles.rtlText]}>
                  {isRTL ? 'أنشئ قائمتك الأولى بالأعلى!' : 'Create your first one above!'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={playlists}
                keyExtractor={(item, index) => String(item._id || item.id || index)}
                style={{ maxHeight: 280 }}
                windowSize={3}
                maxToRenderPerBatch={6}
                initialNumToRender={8}
                removeClippedSubviews={true}
                getItemLayout={getItemLayout}
                renderItem={renderPlaylistItem}
              />
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    zIndex: 2600,
    elevation: Platform.OS === 'android' ? 36 : 0,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cardOuter: {
    width: '100%',
    maxWidth: 420,
    position: 'relative',
  },
  hardShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: -6,
    bottom: -6,
    backgroundColor: colors.ink,
    borderRadius: 8,
  },
  modalBox: {
    backgroundColor: colors.paper,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 8,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.ink,
    paddingBottom: 10,
  },
  title: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 18,
    color: colors.ink,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  subTitle: {
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.paperMuted,
    borderRadius: 6,
  },
  createBox: {
    flexDirection: 'row',
    marginBottom: 14,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 42,
    backgroundColor: colors.paperLight,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.ink,
    fontWeight: '700',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 14,
    gap: 4,
  },
  createBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 12,
    color: colors.ink,
  },
  sectionLabel: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1,
    color: colors.inkMuted,
    marginBottom: 8,
  },
  emptyBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paperMuted,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
  },
  emptyText: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 12,
    color: colors.ink,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 11,
    color: colors.inkMuted,
    marginTop: 2,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paperLight,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  playlistIcon: {
    width: 34,
    height: 34,
    backgroundColor: colors.ink,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistName: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 13,
    color: colors.ink,
  },
  playlistCount: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: colors.inkMuted,
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mint,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 3,
  },
  addPillText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.ink,
  },
  rtlText: {
    letterSpacing: 0,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'normal',
  },
});
