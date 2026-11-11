import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { Play, Pause, MoreVertical, Clock, Calendar, Radio } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { formatPodcastDuration, formatPodcastReleaseDate } from '../../utils/podcastUtils';

export const PodcastEpisodeItem = React.memo(function PodcastEpisodeItem({
  episode,
  isCurrentTrack,
  isPlaying,
  onPlay,
  onTrackAction,
  isDark = true,
  isRTL = true,
}) {
  if (!episode) return null;

  const active = Boolean(isCurrentTrack);
  const formattedDate = formatPodcastReleaseDate(episode.releaseDate, isRTL);
  const formattedDuration = formatPodcastDuration(episode.duration, isRTL);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        !isDark && styles.containerLight,
        active && styles.containerActive,
        !isRTL && styles.containerLTR,
      ]}
      onPress={() => onPlay(episode)}
      activeOpacity={0.8}
    >
      {/* Thumbnail */}
      <View style={styles.thumbnailFrame}>
        {episode.cover || episode.coverUrl ? (
          <Image
            source={{ uri: episode.cover || episode.coverUrl }}
            style={styles.thumbnail}
            resizeMode="cover"
            fadeDuration={0}
            resizeMethod={Platform.OS === 'android' ? 'resize' : 'auto'}
          />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Radio size={16} color={colors.mint} />
          </View>
        )}
      </View>

      {/* Info Column */}
      <View style={styles.infoCol}>
        <Text
          style={[
            styles.title,
            !isDark && styles.titleLight,
            active && styles.titleActive,
            !isRTL && styles.titleLTR,
          ]}
          numberOfLines={2}
        >
          {episode.title}
        </Text>

        <View style={[styles.metaRow, !isRTL && styles.metaRowLTR]}>
          {formattedDate ? (
            <View style={[styles.metaItem, !isRTL && styles.metaItemLTR]}>
              <Calendar size={11} color={!isDark ? '#64748b' : '#94a3b8'} />
              <Text style={[styles.metaText, !isDark && styles.metaTextLight]}>
                {formattedDate}
              </Text>
            </View>
          ) : null}

          {formattedDuration ? (
            <View style={[styles.metaItem, !isRTL && styles.metaItemLTR]}>
              <Clock size={11} color={!isDark ? '#64748b' : '#94a3b8'} />
              <Text style={[styles.metaText, !isDark && styles.metaTextLight]}>
                {formattedDuration}
              </Text>
            </View>
          ) : null}

          {episode.album ? (
            <View style={[styles.metaItem, !isRTL && styles.metaItemLTR]}>
              <Radio size={11} color={colors.mint} />
              <Text style={styles.metaShowText} numberOfLines={1}>
                {episode.album}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Play / Status Button */}
      <TouchableOpacity
        style={[
          styles.playBtn,
          active && styles.playBtnActive,
          !isDark && !active && styles.playBtnLight,
        ]}
        onPress={() => onPlay(episode)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {active && isPlaying ? (
          <Pause size={15} color="#0b1110" fill="#0b1110" />
        ) : (
          <Play
            size={15}
            color={active ? '#0b1110' : (!isDark ? '#0f172a' : '#ffffff')}
            fill={active ? '#0b1110' : (!isDark ? '#0f172a' : '#ffffff')}
            style={{ marginLeft: 2 }}
          />
        )}
      </TouchableOpacity>

      {/* More Options */}
      {onTrackAction ? (
        <TouchableOpacity
          style={styles.moreBtn}
          onPress={() => onTrackAction(episode)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MoreVertical size={16} color={!isDark ? '#64748b' : '#94a3b8'} />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginVertical: 4,
    backgroundColor: '#121918',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    gap: 10,
  },
  containerLTR: {
    flexDirection: 'row',
  },
  containerLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  containerActive: {
    borderColor: colors.mint,
    backgroundColor: 'rgba(23, 163, 152, 0.08)',
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtnLight: {
    backgroundColor: '#e2e8f0',
  },
  playBtnActive: {
    backgroundColor: colors.mint,
  },
  infoCol: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'right',
    lineHeight: 18,
  },
  titleLTR: {
    textAlign: 'left',
  },
  titleLight: {
    color: '#0f172a',
  },
  titleActive: {
    color: colors.mint,
  },
  metaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  metaRowLTR: {
    flexDirection: 'row',
  },
  metaItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  metaItemLTR: {
    flexDirection: 'row',
  },
  metaText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  metaTextLight: {
    color: '#64748b',
  },
  metaShowText: {
    fontSize: 11,
    color: colors.mint,
    fontWeight: '600',
    maxWidth: 90,
  },
  thumbnailFrame: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1c2826',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreBtn: {
    padding: 4,
  },
});

export default PodcastEpisodeItem;
