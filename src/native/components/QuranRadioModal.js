import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Platform,
  Dimensions
} from 'react-native';
import { X, Radio, Play, Pause, Sparkles } from 'lucide-react-native';
import { QURAN_LIVE_STATIONS } from '../data/quranLiveStations';
import { useAudioPlayer } from '../context/AudioContext';

const { width, height } = Dimensions.get('window');

export default function QuranRadioModal({ isOpen, visible, onClose, globalTheme = 'dark' }) {
  const isModalVisible = visible !== undefined ? visible : isOpen;
  const { currentTrack, isPlaying, playTrack, togglePlay } = useAudioPlayer();

  if (!isModalVisible) return null;

  const handlePlayStation = async (station) => {
    try {
      const curId = String(currentTrack?._id || currentTrack?.id || '');
      const isCur = curId === station.id;
      if (isCur) {
        if (togglePlay) togglePlay();
        return;
      }
      if (playTrack) {
        await playTrack({
          ...station,
          _id: station.id,
          id: station.id,
          isLive: true,
          isRadio: true,
          isQuran: true,
          duration: Infinity,
        }, [station]);
      }
    } catch (err) {
      console.error('[QuranRadio] play error:', err);
    }
  };

  return (
    <Modal
      visible={Boolean(isModalVisible)}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.radioIconWrap}>
                <Radio size={18} color="#d4af37" />
              </View>
              <View>
                <View style={styles.titleRow}>
                  <Text style={styles.title}>إذاعة القرآن الكريم</Text>
                  <View style={styles.liveTag}>
                    <Text style={styles.liveTagText}>🔴 24/7</Text>
                  </View>
                </View>
                <Text style={styles.subtitle}>بث مباشر رسمي بأعلى جودة نقاء</Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* List of Stations */}
          <FlatList
            data={QURAN_LIVE_STATIONS}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const curId = String(currentTrack?._id || currentTrack?.id || '');
              const isCurrent = curId === item.id;
              const isCurrentPlaying = isCurrent && isPlaying;

              return (
                <TouchableOpacity
                  onPress={() => handlePlayStation(item)}
                  style={[
                    styles.stationItem,
                    isCurrent && styles.stationItemActive
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={styles.stationThumbWrap}>
                    <Image source={{ uri: item.cover }} style={styles.stationThumb} />
                    {isCurrentPlaying && (
                      <View style={styles.playingIndicator}>
                        <View style={styles.playingDot} />
                      </View>
                    )}
                  </View>

                  <View style={styles.stationInfo}>
                    <Text style={[styles.stationTitle, isCurrent && styles.stationTitleActive]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.stationArtist} numberOfLines={1}>
                      {item.artist}
                    </Text>
                    <Text style={styles.stationDesc} numberOfLines={1}>
                      {item.description}
                    </Text>
                  </View>

                  <View style={[
                    styles.playBtn,
                    isCurrentPlaying && styles.playBtnActive
                  ]}>
                    {isCurrentPlaying ? (
                      <Pause size={16} color="#070c0b" />
                    ) : (
                      <Play size={16} color={isCurrent ? "#070c0b" : "#ffffff"} style={{ marginLeft: 2 }} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
          />

          {/* Footer */}
          <View style={styles.footer}>
            <Sparkles size={12} color="#d4af37" />
            <Text style={styles.footerText}>يعمل في الخلفية وشاشة القفل بدون انقطاع</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#070c0b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(194, 155, 56, 0.35)',
    maxHeight: height * 0.85,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(194, 155, 56, 0.2)',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radioIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(194, 155, 56, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(194, 155, 56, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
  },
  liveTag: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  liveTagText: {
    fontSize: 10,
    color: '#f87171',
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 11,
    color: '#d4af37',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 14,
    gap: 10,
  },
  stationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#0a1210',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  stationItemActive: {
    backgroundColor: '#0f1f1a',
    borderColor: '#c29b38',
  },
  stationThumbWrap: {
    width: 50,
    height: 50,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  stationThumb: {
    width: '100%',
    height: '100%',
  },
  playingIndicator: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#d4af37',
  },
  stationInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  stationTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  stationTitleActive: {
    color: '#d4af37',
  },
  stationArtist: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  stationDesc: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnActive: {
    backgroundColor: '#d4af37',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 11,
    color: '#9ca3af',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
