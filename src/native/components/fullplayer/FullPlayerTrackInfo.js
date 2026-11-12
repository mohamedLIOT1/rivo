import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Heart } from 'lucide-react-native';
import { styles } from './fullPlayerStyles';
import { useTranslation } from '../../context/LocalizationContext';
import { isArabicText } from '../../theme/typography';

export const FullPlayerTrackInfo = React.memo(function FullPlayerTrackInfo({
  currentTrack,
  trackId,
  isLiked,
  toggleLikeTrack,
  vocalIsolationStatus,
  stemMode = 'mix',
  setStemMode,
  isMixMode = false,
  mixName,
}) {
  const { isRTL } = useTranslation();
  const rawGenre = currentTrack?.genre || 'MUSIC';
  const displayGenre = isRTL
    ? (String(rawGenre).toUpperCase() === 'MUSIC'
        ? 'موسيقى'
        : String(rawGenre).toUpperCase() === 'QURAN'
          ? 'القرآن الكريم'
          : String(rawGenre).toUpperCase())
    : String(rawGenre).toUpperCase();

  const isTitleArabic = isRTL || isArabicText(currentTrack?.title);
  const isArtistArabic = isRTL || isArabicText(currentTrack?.artist);

  return (
    <View>
      {/* Vocal isolation status banner if active */}
      {vocalIsolationStatus && (
        <View style={styles.vocalBannerBox}>
          <View style={styles.vocalBannerHeader}>
            <View style={styles.vocalBannerLeft}>
              <View style={styles.vocalPingDot} />
              <Text style={styles.vocalBannerTitle}>AI VOCAL ISOLATION</Text>
            </View>
            <Text style={styles.vocalBannerEta}>
              {vocalIsolationStatus.eta ? `${vocalIsolationStatus.eta} (${vocalIsolationStatus.progress || 0}%)` : `Isolating vocals... ${vocalIsolationStatus.progress || 0}%`}
            </Text>
          </View>
          <View style={styles.vocalProgressBarBg}>
            <View
              style={[
                styles.vocalProgressBarFill,
                { width: `${Math.min(100, Math.max(5, Number(vocalIsolationStatus.progress || 0)))}%` }
              ]}
            />
          </View>
        </View>
      )}

      {/* Song Title & Action Info Bar */}
      <View style={styles.trackInfoRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <View style={styles.genreBadge}>
              <Text
                style={[
                  styles.genreBadgeText,
                  (isRTL || isArabicText(displayGenre)) && {
                    letterSpacing: 0,
                    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
                  },
                ]}
              >
                {displayGenre}
              </Text>
            </View>

            {/* 3-Way Stem Mode Pills (🎵 الكل / 🎤 كلمات / 🎹 اللحن) */}
            {displayGenre !== 'القرآن الكريم' && displayGenre !== 'QURAN' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#070c0a', borderRadius: 8, padding: 2, borderWidth: 1, borderColor: '#1f2f2b', gap: 2 }}>
                <TouchableOpacity
                  onPress={() => setStemMode?.('mix')}
                  style={[{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 }, (stemMode || 'mix') === 'mix' && { backgroundColor: '#17a398' }]}
                  activeOpacity={0.7}
                >
                  <Text style={[{ fontSize: 10, fontWeight: '900', color: '#9ca3af', fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, (stemMode || 'mix') === 'mix' && { color: '#0b1110' }]}>
                    🎵 {isRTL ? 'الكل' : 'Mix'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setStemMode?.('vocal')}
                  style={[{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 }, stemMode === 'vocal' && { backgroundColor: '#10b981' }]}
                  activeOpacity={0.7}
                >
                  <Text style={[{ fontSize: 10, fontWeight: '900', color: '#9ca3af', fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, stemMode === 'vocal' && { color: '#0b1110' }]}>
                    🎤 {isRTL ? 'كلمات' : 'Vocals'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setStemMode?.('inst')}
                  style={[{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 }, stemMode === 'inst' && { backgroundColor: '#f59e0b' }]}
                  activeOpacity={0.7}
                >
                  <Text style={[{ fontSize: 10, fontWeight: '900', color: '#9ca3af', fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, stemMode === 'inst' && { color: '#0b1110' }]}>
                    🎹 {isRTL ? 'اللحن' : 'Beats'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.songTitle,
              isTitleArabic && {
                letterSpacing: 0,
                fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
              },
            ]}
            numberOfLines={1}
          >
            {currentTrack?.title || 'Untitled Track'}
          </Text>
          <Text
            style={[
              styles.songArtist,
              isArtistArabic && {
                letterSpacing: 0,
                fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
              },
            ]}
            numberOfLines={1}
          >
            {currentTrack?.artist || 'Unknown Artist'}
          </Text>
          {isMixMode && (
            <Text
              style={[
                styles.songArtist,
                { color: '#34d399', fontSize: 11, fontWeight: '700', marginTop: 3, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
              ]}
              numberOfLines={1}
            >
              🎛️ {mixName || currentTrack?.mixName || 'Mix'}
            </Text>
          )}
        </View>

        {/* Heart Button */}
        <TouchableOpacity
          onPress={() => toggleLikeTrack(trackId)}
          style={styles.deckHeartBtn}
          activeOpacity={0.8}
        >
          <Heart
            size={20}
            color={isLiked ? '#ef4444' : '#9ca3af'}
            fill={isLiked ? '#ef4444' : 'transparent'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
});

export default FullPlayerTrackInfo;
