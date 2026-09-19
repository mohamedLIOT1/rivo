import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, Image, TouchableOpacity, Modal, StyleSheet, Dimensions, 
  ActivityIndicator, ScrollView, FlatList, TextInput, Switch, KeyboardAvoidingView, Platform 
} from 'react-native';
import { 
  ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart, 
  Download, CheckCircle, ListMusic, AlignLeft, Edit2, X, Check, ShieldCheck, Sparkles 
} from 'lucide-react-native';
import { useAudioPlayer, useAudioProgress } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import { API_BASE_URL } from '../config';
import SongItem from './SongItem';

const { width, height } = Dimensions.get('window');

export default function FullPlayerModal({ visible, onClose }) {
  const audio = useAudioPlayer();
  const { currentTime, duration } = useAudioProgress();
  const {
    currentTrack,
    isPlaying,
    isLoading,
    isShuffle,
    isRepeat,
    togglePlay,
    seekTo,
    playNextTrack,
    playPrevTrack,
    setIsShuffle,
    setIsRepeat,
    handleDownloadTrack,
    handleRemoveDownload,
    downloadedTracks,
    downloadingIds,
    queue,
  } = audio;

  const { likedTrackIds, toggleLikeTrack, token, currentUser } = useUser();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('artwork'); // 'artwork', 'lyrics', 'queue'
  const lyricsScrollRef = useRef(null);

  // Mobile Lyrics Editor State
  const [isEditingLyrics, setIsEditingLyrics] = useState(false);
  const [lyricsDraft, setLyricsDraft] = useState('');
  const [isSavingLyrics, setIsSavingLyrics] = useState(false);
  const [markVerified, setMarkVerified] = useState(false);

  const isAdmin = Boolean(
    currentUser?.isAdmin === true || 
    currentUser?.role === 'admin' || 
    ['ali', 'lio', 'tester'].includes((currentUser?.name || currentUser?.username || '').trim().toLowerCase())
  );

  // Auto-scroll lyrics
  useEffect(() => {
    if (visible && activeTab === 'lyrics' && currentTrack?.lyrics?.length > 0) {
      const activeIndex = currentTrack.lyrics.findIndex((l, i) => {
        const next = currentTrack.lyrics[i + 1];
        return currentTime >= l.time && (!next || currentTime < next.time);
      });
      if (activeIndex !== -1 && lyricsScrollRef.current) {
        lyricsScrollRef.current.scrollTo({ y: activeIndex * 40, animated: true });
      }
    }
  }, [currentTime, activeTab, visible, currentTrack?.id]);

  if (!currentTrack) return null;

  const trackId = currentTrack._id || currentTrack.id;
  const isLiked = likedTrackIds.includes(trackId);
  const downloadedRecord = downloadedTracks.find(t => (t._id || t.id) === trackId);
  const isDownloaded = !!downloadedRecord || currentTrack.isDownloaded;
  const downloadProgress = downloadingIds[trackId];
  const isDownloading = downloadProgress !== undefined;

  const defaultCover = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80';

  const formatTime = (secs) => {
    if (isNaN(secs) || secs === null) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleOpenLyricsEdit = () => {
    const raw = (currentTrack?.lyrics || [])
      .map(l => `[${formatTime(l.time)}] ${l.text}`)
      .join('\n');
    setLyricsDraft(raw);
    setMarkVerified(Boolean(currentTrack?.isVerified || currentTrack?.lyricsVerified));
    setIsEditingLyrics(true);
  };

  const handleSaveLyrics = async () => {
    if (!lyricsDraft.trim()) {
      showToast?.('Please enter lyrics text', 'error');
      return;
    }
    setIsSavingLyrics(true);
    try {
      const lines = lyricsDraft.split('\n').filter(l => l.trim());
      const songDur = duration || currentTrack.duration || 180;
      const step = Math.max(2, (songDur - 10) / Math.max(1, lines.length));

      const parsedLyrics = lines.map((line, idx) => {
        const match = line.match(/\[?(\d+):(\d+)(?:\.(\d+))?\]?\s*(.*)/);
        if (match) {
          const m = parseInt(match[1]);
          const s = parseInt(match[2]);
          const cs = match[3] ? parseInt(match[3].padEnd(2, '0').slice(0, 2)) : 0;
          const time = m * 60 + s + cs / 100;
          return { time: Math.round(time * 100) / 100, text: match[4]?.trim() || line.trim() };
        } else {
          return { time: Math.round((idx * step) * 100) / 100, text: line.trim() };
        }
      });

      const res = await fetch(`${API_BASE_URL}/api/tracks/update-lyrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          trackId: currentTrack.id || currentTrack._id,
          title: currentTrack.title,
          artist: currentTrack.artist,
          audioUrl: currentTrack.audioUrl,
          lyrics: parsedLyrics,
          isVerified: markVerified
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save lyrics');
      }

      currentTrack.lyrics = parsedLyrics;
      currentTrack.isVerified = markVerified;
      setIsEditingLyrics(false);
      showToast?.('Lyrics updated successfully!', 'success');
    } catch (e) {
      console.warn('Save lyrics error:', e);
      showToast?.(e.message || 'Error saving lyrics', 'error');
    } finally {
      setIsSavingLyrics(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <ChevronDown size={28} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Playing From Playlist</Text>
          <View style={styles.headerRightBtn} />
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabSwitcherBar}>
          <TouchableOpacity
            onPress={() => setActiveTab('artwork')}
            style={[styles.tabBtn, activeTab === 'artwork' && styles.activeTabBtn]}
          >
            <AlignLeft size={20} color={activeTab === 'artwork' ? '#1DB954' : '#a1a1aa'} />
            <Text style={[styles.tabBtnText, activeTab === 'artwork' && styles.activeTabBtnText]}>Cover</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('lyrics')}
            style={[styles.tabBtn, activeTab === 'lyrics' && styles.activeTabBtn]}
          >
            <AlignLeft size={20} color={activeTab === 'lyrics' ? '#1DB954' : '#a1a1aa'} />
            <Text style={[styles.tabBtnText, activeTab === 'lyrics' && styles.activeTabBtnText]}>Lyrics</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('queue')}
            style={[styles.tabBtn, activeTab === 'queue' && styles.activeTabBtn]}
          >
            <ListMusic size={20} color={activeTab === 'queue' ? '#1DB954' : '#a1a1aa'} />
            <Text style={[styles.tabBtnText, activeTab === 'queue' && styles.activeTabBtnText]}>Queue</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Content Area */}
        <View style={styles.contentArea}>
          {activeTab === 'artwork' && (
            <View style={styles.artworkContainer}>
              <Image
                source={{ uri: currentTrack.coverUrl || currentTrack.cover || defaultCover }}
                style={styles.artwork}
              />
            </View>
          )}

          {activeTab === 'lyrics' && (
            <View style={{ flex: 1, width: '100%' }}>
              {/* Lyrics Header Action Bar */}
              <View style={styles.lyricsHeaderBar}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.lyricsHeaderTitle}>Karaoke Lyrics</Text>
                  {(currentTrack.isVerified || currentTrack.lyricsVerified) && (
                    <View style={styles.verifiedBadge}>
                      <CheckCircle size={11} color="#1DB954" />
                      <Text style={styles.verifiedBadgeText}>VERIFIED</Text>
                    </View>
                  )}
                </View>

                {/* Edit Lyrics Action Button */}
                <TouchableOpacity 
                  onPress={handleOpenLyricsEdit} 
                  style={styles.editLyricsBtn}
                  activeOpacity={0.8}
                >
                  <Edit2 size={13} color="#000000" />
                  <Text style={styles.editLyricsBtnText}>Edit Lyrics</Text>
                </TouchableOpacity>
              </View>

              <ScrollView ref={lyricsScrollRef} contentContainerStyle={styles.lyricsContainer} showsVerticalScrollIndicator={false}>
                {(!currentTrack.lyrics || currentTrack.lyrics.length === 0) ? (
                  <View style={styles.emptyLyricsBox}>
                    <Text style={styles.noLyricsText}>No lyrics available for this song</Text>
                    <TouchableOpacity 
                      onPress={handleOpenLyricsEdit} 
                      style={[styles.editLyricsBtn, { marginTop: 14, paddingHorizontal: 16, paddingVertical: 8 }]}
                    >
                      <Edit2 size={14} color="#000000" />
                      <Text style={styles.editLyricsBtnText}>Add Lyrics Now</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  currentTrack.lyrics.map((line, idx) => {
                    const isActive = currentTime >= line.time && (!currentTrack.lyrics[idx+1] || currentTime < currentTrack.lyrics[idx+1].time);
                    return (
                      <TouchableOpacity key={idx} onPress={() => seekTo(line.time)}>
                        <Text style={[styles.lyricLine, isActive && styles.activeLyricLine]}>
                          {line.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          )}

          {activeTab === 'queue' && (
            <View style={styles.queueContainer}>
              <Text style={styles.queueTitle}>Up Next ({queue.length})</Text>
              <FlatList
                data={queue}
                keyExtractor={(item, index) => `${item._id || item.id}-${index}`}
                renderItem={({ item }) => (
                  <SongItem track={item} onPlay={(t) => audio.playTrack(t, queue)} />
                )}
                contentContainerStyle={{ paddingBottom: 40 }}
              />
            </View>
          )}
        </View>

        {/* Track Details */}
        <View style={styles.trackDetails}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{currentTrack.title || 'Untitled'}</Text>
            <Text style={styles.artist} numberOfLines={1}>{currentTrack.artist || 'Unknown Artist'}</Text>
          </View>
          <TouchableOpacity onPress={() => toggleLikeTrack(trackId)} style={styles.likeBtn}>
            <Heart size={26} color={isLiked ? '#ef4444' : '#ffffff'} fill={isLiked ? '#ef4444' : 'transparent'} />
          </TouchableOpacity>
        </View>

        {/* Progress Bar & Seek */}
        <View style={styles.progressContainer}>
          <TouchableOpacity 
            style={styles.progressBarTrack}
            activeOpacity={1}
            onPress={(e) => {
              const clickX = e.nativeEvent.locationX;
              const barWidth = width - 48;
              const newTime = (clickX / barWidth) * duration;
              seekTo(newTime);
            }}
          >
            <View style={[styles.progressBarFill, { width: `${Math.min(progressPercent, 100)}%` }]} />
          </TouchableOpacity>
          <View style={styles.timeLabels}>
            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity onPress={() => setIsShuffle(!isShuffle)}>
            <Shuffle size={22} color={isShuffle ? '#1DB954' : '#a1a1aa'} />
          </TouchableOpacity>

          <TouchableOpacity onPress={playPrevTrack}>
            <SkipBack size={32} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity onPress={togglePlay} style={styles.mainPlayBtn} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator size="large" color="#000000" />
            ) : isPlaying ? (
              <Pause size={28} color="#000000" />
            ) : (
              <Play size={28} color="#000000" style={{ marginLeft: 3 }} />
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={playNextTrack}>
            <SkipForward size={32} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsRepeat(!isRepeat)}>
            <Repeat size={22} color={isRepeat ? '#1DB954' : '#a1a1aa'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Mobile Lyrics Editor Modal ── */}
      <Modal
        visible={isEditingLyrics}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditingLyrics(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.editorCard}>
            {/* Header */}
            <View style={styles.editorHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Edit2 size={18} color="#1DB954" />
                <Text style={styles.editorTitle}>Edit Song Lyrics</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setIsEditingLyrics(false)} 
                style={styles.editorCloseBtn}
              >
                <X size={20} color="#a1a1aa" />
              </TouchableOpacity>
            </View>

            <Text style={styles.editorHint}>
              Add timestamps like <Text style={{ color: '#1DB954', fontWeight: 'bold' }}>[0:15]</Text> before lines for karaoke sync, or paste plain lyrics.
            </Text>

            {/* Input */}
            <TextInput
              style={styles.editorInput}
              multiline
              value={lyricsDraft}
              onChangeText={setLyricsDraft}
              placeholder="[0:00] First line&#10;[0:15] Second line..."
              placeholderTextColor="#52525b"
              textAlignVertical="top"
              autoCapitalize="sentences"
            />

            {/* Admin Verified Switch */}
            {isAdmin && (
              <View style={styles.verifySwitchRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={14} color="#f59e0b" />
                    <Text style={styles.verifySwitchLabel}>Verify & Lock Lyrics</Text>
                  </View>
                  <Text style={styles.verifySwitchSub}>
                    Official badge displayed across all devices
                  </Text>
                </View>
                <Switch
                  value={markVerified}
                  onValueChange={setMarkVerified}
                  trackColor={{ false: '#3f3f46', true: '#1DB954' }}
                  thumbColor="#ffffff"
                />
              </View>
            )}

            {/* Actions */}
            <View style={styles.editorActions}>
              <TouchableOpacity
                onPress={() => setIsEditingLyrics(false)}
                style={styles.editorCancelBtn}
              >
                <Text style={styles.editorCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveLyrics}
                disabled={isSavingLyrics}
                style={styles.editorSaveBtn}
              >
                {isSavingLyrics ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <>
                    <Check size={16} color="#000000" />
                    <Text style={styles.editorSaveText}>Save Lyrics</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
    paddingHorizontal: 24,
    paddingTop: 48,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tabSwitcherBar: {
    flexDirection: 'row',
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 6,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeTabBtn: {
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#71717a',
  },
  activeTabBtnText: {
    color: '#ffffff',
  },
  closeBtn: {
    padding: 6,
  },
  headerRightBtn: {
    width: 32,
  },
  contentArea: {
    flex: 1,
    marginVertical: 10,
  },
  queueContainer: {
    flex: 1,
  },
  queueTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 16,
  },
  lyricsHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    marginBottom: 8,
  },
  lyricsHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.3)',
    gap: 3,
  },
  verifiedBadgeText: {
    color: '#1DB954',
    fontSize: 9,
    fontWeight: '900',
  },
  editLyricsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1DB954',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  editLyricsBtnText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  emptyLyricsBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 80,
  },
  artworkContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  artwork: {
    width: width - 80,
    height: width - 80,
    borderRadius: 24,
    backgroundColor: '#18181b',
  },
  lyricsContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  lyricLine: {
    fontSize: 18,
    color: '#71717a',
    fontWeight: '800',
    textAlign: 'center',
    marginVertical: 10,
    paddingHorizontal: 12,
  },
  activeLyricLine: {
    color: '#ffffff',
    fontSize: 22,
    transform: [{ scale: 1.04 }],
  },
  noLyricsText: {
    color: '#71717a',
    fontSize: 15,
  },
  trackDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  artist: {
    fontSize: 16,
    color: '#a1a1aa',
    marginTop: 4,
  },
  likeBtn: {
    padding: 8,
  },
  progressContainer: {
    marginVertical: 12,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#27272a',
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#1DB954',
    borderRadius: 3,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeText: {
    fontSize: 12,
    color: '#71717a',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  mainPlayBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1DB954',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal Editor Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  editorCard: {
    backgroundColor: '#121216',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a',
    maxHeight: height * 0.85,
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  editorTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editorCloseBtn: {
    padding: 6,
  },
  editorHint: {
    fontSize: 12,
    color: '#a1a1aa',
    lineHeight: 18,
    marginBottom: 12,
  },
  editorInput: {
    backgroundColor: '#18181b',
    color: '#ffffff',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    borderRadius: 14,
    padding: 14,
    minHeight: 180,
    maxHeight: 260,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 14,
  },
  verifySwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181b',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 16,
  },
  verifySwitchLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  verifySwitchSub: {
    fontSize: 11,
    color: '#71717a',
    marginTop: 2,
  },
  editorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editorCancelBtn: {
    flex: 1,
    backgroundColor: '#27272a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  editorCancelText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  editorSaveBtn: {
    flex: 2,
    backgroundColor: '#1DB954',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  editorSaveText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});
