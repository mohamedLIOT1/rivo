import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  Platform
} from 'react-native';
import { X, Radio, Play, Pause, Sparkles } from 'lucide-react-native';
import { QURAN_LIVE_STATIONS } from '../data/quranLiveStations';
import { useAudioPlayer } from '../context/AudioContext';
import { useTranslation } from '../context/LocalizationContext';
import { normalizeCoverUri } from '../utils/coverUtils';
import { styles } from './quranRadioModalStyles';

/**
 * Resilient station thumbnail with disk-cache normalization,
 * aspect-ratio preserving cover mode, and graceful Islamic geometric fallback.
 */
const StationThumb = React.memo(function StationThumb({ item, isCurrentPlaying }) {
  const [hasError, setHasError] = useState(false);
  const coverUri = useMemo(() => normalizeCoverUri(item?.cover, item), [item?.cover, item]);

  return (
    <View style={styles.stationThumbWrap}>
      {!hasError && coverUri ? (
        <Image
          source={{ uri: coverUri }}
          style={styles.stationThumb}
          resizeMode="cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <View style={styles.stationThumbFallback}>
          <Radio size={20} color="#d4af37" />
        </View>
      )}
      {isCurrentPlaying && (
        <View style={styles.playingIndicator}>
          <View style={styles.playingDot} />
        </View>
      )}
    </View>
  );
});

export default function QuranRadioModal({ isOpen, visible, onClose, globalTheme = 'dark' }) {
  const isModalVisible = visible !== undefined ? visible : isOpen;
  const { currentTrack, isPlaying, playTrack, togglePlay } = useAudioPlayer();
  const { t, isRTL } = useTranslation();

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
        }, QURAN_LIVE_STATIONS);
      }
    } catch (err) {
      console.error('[QuranRadio] play error:', err);
    }
  };

  return (
    <Modal
      visible={Boolean(isModalVisible)}
      transparent
      animationType={Platform.OS === 'android' ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={[styles.header, isRTL && styles.headerRtl]}>
            <View style={[styles.headerTitleWrap, isRTL && styles.headerTitleWrapRtl]}>
              <View style={styles.radioIconWrap}>
                <Radio size={18} color="#d4af37" />
              </View>
              <View style={styles.titleTextContainer}>
                <View style={[styles.titleRow, isRTL && styles.titleRowRtl]}>
                  <Text
                    style={[
                      styles.title,
                      isRTL && { letterSpacing: 0, fontFamily: Platform.OS === 'ios' ? 'Geeza Pro' : 'sans-serif' }
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {t('quran.title')}
                  </Text>
                  <View style={styles.liveTag}>
                    <Text style={[styles.liveTagText, isRTL && { letterSpacing: 0 }]}>
                      🔴 {t('quran.liveBadge')} 24/7
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.subtitle,
                    isRTL && { letterSpacing: 0, textAlign: 'right' }
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {t('quran.radioSub')}
                </Text>
              </View>
            </View>

            {/* Absolute Close Button - anchored safely within modal frame */}
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, isRTL ? styles.closeBtnRtl : styles.closeBtnLtr]}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={t('common.close') || 'Close'}
            >
              <X size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* List of Stations */}
          <FlatList
            data={QURAN_LIVE_STATIONS}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            windowSize={5}
            maxToRenderPerBatch={10}
            initialNumToRender={10}
            removeClippedSubviews={true}
            renderItem={({ item }) => {
              const curId = String(currentTrack?._id || currentTrack?.id || '');
              const isCurrent = curId === item.id;
              const isCurrentPlaying = isCurrent && isPlaying;

              return (
                <TouchableOpacity
                  onPress={() => handlePlayStation(item)}
                  style={[
                    styles.stationItem,
                    isRTL && styles.stationItemRtl,
                    isCurrent && styles.stationItemActive
                  ]}
                  activeOpacity={0.8}
                >
                  <StationThumb item={item} isCurrentPlaying={isCurrentPlaying} />

                  <View style={[styles.stationInfo, isRTL ? styles.stationInfoRtl : styles.stationInfoLtr]}>
                    <Text style={[styles.stationTitle, isCurrent && styles.stationTitleActive, isRTL && { textAlign: 'right', letterSpacing: 0 }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[styles.stationArtist, isRTL && { textAlign: 'right', letterSpacing: 0 }]} numberOfLines={1}>
                      {item.artist}
                    </Text>
                    <Text style={[styles.stationDesc, isRTL && { textAlign: 'right', letterSpacing: 0 }]} numberOfLines={1}>
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
          <View style={[styles.footer, isRTL && { flexDirection: 'row-reverse' }]}>
            <Sparkles size={12} color="#d4af37" />
            <Text style={[styles.footerText, isRTL && { letterSpacing: 0, textAlign: 'center' }]}>
              {t('quran.uninterruptedBroadcast')}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
