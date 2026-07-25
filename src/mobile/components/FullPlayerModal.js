import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, Modal, StyleSheet, Dimensions, ActivityIndicator, ScrollView, FlatList } from 'react-native';
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart, Download, CheckCircle, ListMusic, AlignLeft } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import SongItem from './SongItem';

const { width, height } = Dimensions.get('window');

export default function FullPlayerModal({ visible, onClose }) {
  const audio = useAudioPlayer();
  const {
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
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

  const { likedTrackIds, toggleLikeTrack, tracks } = useUser();
  const [activeTab, setActiveTab] = useState('artwork'); // 'artwork', 'lyrics', 'queue'
  const lyricsScrollRef = useRef(null);

  // Auto-scroll lyrics (Always define hooks at the top!)
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

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <ChevronDown size={28} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Now Playing</Text>
          <TouchableOpacity 
            onPress={() => isDownloaded ? handleRemoveDownload(trackId) : handleDownloadTrack(currentTrack)} 
            style={styles.headerRightBtn}
          >
            {isDownloading ? (
              <ActivityIndicator size="small" color="#1DB954" />
            ) : isDownloaded ? (
              <CheckCircle size={22} color="#1DB954" />
            ) : (
              <Download size={22} color="#a1a1aa" />
            )}
          </TouchableOpacity>
        </View>

        {/* Tab Switcher Bar */}
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
            <ScrollView ref={lyricsScrollRef} contentContainerStyle={styles.lyricsContainer} showsVerticalScrollIndicator={false}>
              {(!currentTrack.lyrics || currentTrack.lyrics.length === 0) ? (
                <View style={styles.emptyLyricsBox}>
                  <Text style={styles.noLyricsText}>No lyrics available for this song</Text>
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
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
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
    fontSize: 14,
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
    padding: 6,
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
  emptyLyricsBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
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
    paddingVertical: 20,
    alignItems: 'center',
  },
  lyricLine: {
    fontSize: 20,
    color: '#71717a',
    fontWeight: '800',
    textAlign: 'center',
    marginVertical: 10,
    paddingHorizontal: 10,
  },
  activeLyricLine: {
    color: '#ffffff',
    fontSize: 24,
    transform: [{ scale: 1.05 }],
  },
  noLyricsText: {
    color: '#71717a',
    fontSize: 16,
    marginTop: 100,
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
});
