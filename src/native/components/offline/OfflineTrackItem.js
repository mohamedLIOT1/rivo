import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Disc, Check, FolderDown, Trash2, Play, Pause } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { normalizeCoverUri } from '../../utils/coverUtils';
import { isQuranContent } from '../../../utils/quranUtils';
import { isPodcastContent } from '../../utils/podcastUtils';
import { useTranslation } from '../../context/LocalizationContext';

function areEqualOfflineItem(prev, next) {
  return (
    prev.trackId === next.trackId &&
    prev.isActive === next.isActive &&
    prev.isPlaying === next.isPlaying &&
    prev.isSelected === next.isSelected &&
    prev.isSelectMode === next.isSelectMode &&
    prev.isDark === next.isDark &&
    prev.track?.title === next.track?.title &&
    prev.track?.artist === next.track?.artist
  );
}

export const OfflineTrackItem = React.memo(function OfflineTrackItem({
  track,
  trackId,
  isActive,
  isPlaying,
  isSelected,
  isSelectMode,
  isDark,
  onPress,
  onLongPress,
  onPlay,
  onExport,
  onDelete,
  styles,
}) {
  const { isRTL } = useTranslation();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.trackCard,
        !isDark && styles.trackCardLight,
        isSelected && {
          borderColor: colors.mint,
          backgroundColor: 'rgba(52,211,153,0.12)',
        },
      ]}
    >
      {isSelectMode && (
        <View style={styles.selectCheckWrapper}>
          <View style={[styles.selectCheckBox, isSelected && styles.selectCheckBoxActive]}>
            {isSelected && <Check size={13} color={colors.ink} strokeWidth={3} />}
          </View>
        </View>
      )}

      <View style={styles.coverBox}>
        <View style={styles.coverPlaceholder}>
          <Disc size={20} color="#1c332e" />
        </View>
        <Image
          source={{
            uri: normalizeCoverUri(track?.coverUrl || track?.cover, track),
          }}
          style={styles.cover}
          resizeMode="cover"
          fadeDuration={0}
        />
      </View>

      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[styles.trackTitle, !isDark && styles.trackTitleLight]} numberOfLines={1}>
          {track?.title || 'Untitled'}
        </Text>
        <Text style={[styles.trackArtist, !isDark && styles.trackArtistLight]} numberOfLines={1}>
          {track?.artist || 'Unknown Artist'}
        </Text>
        <View style={styles.badgeRow}>
          {(() => {
            const isQ = Boolean(
              track?.isQuran === true ||
              track?.isQuran === 'true' ||
              track?.category === 'quran' ||
              track?.contentType === 'quran' ||
              isQuranContent(track)
            );
            const isP = !isQ && Boolean(
              track?.isPodcast === true ||
              track?.isPodcast === 'true' ||
              track?.contentType === 'podcast' ||
              isPodcastContent(track)
            );

            let pillStyle = null;
            let textStyle = null;
            let label = isRTL ? 'محفوظ أوفلاين' : 'OFFLINE SONG';

            if (isQ) {
              pillStyle = {
                borderColor: '#10b981',
                backgroundColor: 'rgba(16,185,129,0.16)',
              };
              textStyle = { color: '#6ee7b7' };
              label = isRTL ? 'القرآن الكريم' : 'HOLY QURAN';
            } else if (isP) {
              pillStyle = {
                borderColor: '#a855f7',
                backgroundColor: 'rgba(168,85,247,0.16)',
              };
              textStyle = { color: '#c084fc' };
              label = isRTL ? 'بودكاست' : 'PODCAST';
            } else if (track?.isLocalImport) {
              pillStyle = {
                borderColor: colors.mint,
                backgroundColor: 'rgba(52,211,153,0.12)',
              };
              textStyle = { color: colors.mint };
              label = isRTL ? 'ملف مستورد' : 'IMPORTED MP3';
            }

            return (
              <View style={[styles.localPill, pillStyle]}>
                <Text style={[styles.localPillText, textStyle]}>
                  {label}
                </Text>
              </View>
            );
          })()}
        </View>
      </View>

      {!isSelectMode && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.playBtn} onPress={onPlay}>
            {isActive && isPlaying ? (
              <Pause size={15} color={colors.ink} fill={colors.ink} />
            ) : (
              <Play size={15} color={colors.ink} fill={colors.ink} />
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.exportBtn} onPress={onExport}>
            <FolderDown size={15} color="#10b981" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
            <Trash2 size={15} color={colors.rust} />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}, areEqualOfflineItem);

export default OfflineTrackItem;
