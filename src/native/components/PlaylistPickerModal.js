import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, ActivityIndicator, Platform, BackHandler } from 'react-native';
import { X, Plus, FolderPlus, Music, Check } from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from '../context/LocalizationContext';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';
import { styles } from './playlistPickerStyles';

const PLAYLIST_ROW_HEIGHT = 65;

const PlaylistItemRow = React.memo(function PlaylistItemRow({
  item,
  isProcessing,
  onSelect,
  isRTL,
  isDark,
}) {
  const count = Array.isArray(item.tracks) ? item.tracks.length : 0;
  return (
    <TouchableOpacity
      style={[
        styles.playlistItem,
        isDark && { backgroundColor: '#141d1b', borderColor: '#27272a' }
      ]}
      onPress={() => onSelect(item)}
      disabled={isProcessing}
      activeOpacity={0.7}
    >
      <View style={styles.playlistIcon}>
        <Music size={16} color={colors.mint} />
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={[styles.playlistName, { color: isDark ? '#ffffff' : colors.ink }, isRTL && styles.rtlText]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.playlistCount, { color: isDark ? '#9ca3af' : colors.inkMuted }, isRTL && styles.rtlText]}>
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
  const { isDark } = useTheme();
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
        isDark={isDark}
      />
    );
  }, [addingId, handleSelectPlaylist, isRTL, isDark]);

  return (
    <View style={styles.modalBackdrop}>
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.cardOuter}>
          {!isDark && <View style={styles.hardShadow} />}
          <View style={[
            styles.modalBox,
            isDark && { backgroundColor: '#111a18', borderColor: '#27272a' }
          ]}>
            {/* Header */}
            <View style={[
              styles.header,
              { borderBottomColor: isDark ? '#27272a' : colors.ink }
            ]}>
              <View style={{ flex: 1 }}>
                <CassetteTag
                  label={isRTL ? 'قائمة تشغيل' : 'PLAYLIST'}
                  bg={isDark ? '#141d1b' : colors.ink}
                  textColor={colors.mint}
                />
                <Text style={[
                  styles.title,
                  { color: isDark ? '#ffffff' : colors.ink },
                  isRTL && styles.rtlText
                ]}>
                  {isRTL ? 'إضافة إلى قائمة تشغيل' : 'ADD TO PLAYLIST'}
                </Text>
                <Text style={[
                  styles.subTitle,
                  { color: isDark ? '#9ca3af' : colors.inkMuted },
                  isRTL && styles.rtlText
                ]} numberOfLines={1}>
                  "{track.title}" - {track.artist || (isRTL ? 'فنان غير معروف' : 'Unknown')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={[
                  styles.closeBtn,
                  isDark && { backgroundColor: '#141d1b', borderColor: '#27272a' }
                ]}
              >
                <X size={18} color={isDark ? '#e4e4e7' : colors.ink} />
              </TouchableOpacity>
            </View>

            {/* Quick Create Box */}
            <View style={styles.createBox}>
              <TextInput
                style={[
                  styles.input,
                  isDark && { backgroundColor: '#08110f', color: '#ffffff', borderColor: '#27272a' },
                  isRTL && { textAlign: 'right' }
                ]}
                placeholder={isRTL ? 'اسم القائمة الجديدة...' : 'New Playlist Name...'}
                placeholderTextColor={isDark ? '#6b7280' : colors.grayText}
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
            <Text style={[
              styles.sectionLabel,
              { color: isDark ? '#9ca3af' : colors.inkMuted },
              isRTL && styles.rtlText
            ]}>
              {isRTL ? `قوائم التشغيل الخاصة بك (${playlists.length})` : `YOUR PLAYLISTS (${playlists.length})`}
            </Text>
            {playlists.length === 0 ? (
              <View style={[
                styles.emptyBox,
                isDark && { backgroundColor: '#141d1b', borderColor: '#27272a' }
              ]}>
                <FolderPlus size={32} color={colors.teal} />
                <Text style={[
                  styles.emptyText,
                  { color: isDark ? '#ffffff' : colors.ink },
                  isRTL && styles.rtlText
                ]}>
                  {isRTL ? 'لا توجد قوائم تشغيل حتى الآن.' : 'No playlists found.'}
                </Text>
                <Text style={[
                  styles.emptySub,
                  { color: isDark ? '#9ca3af' : colors.inkMuted },
                  isRTL && styles.rtlText
                ]}>
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

