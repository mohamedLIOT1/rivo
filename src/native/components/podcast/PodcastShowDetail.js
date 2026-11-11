import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  FlatList,
  StyleSheet,
  Platform,
} from 'react-native';
import {
  ArrowLeft,
  ArrowRight,
  Play,
  Check,
  Plus,
  Users,
  Radio,
  Share2,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import PodcastEpisodeItem from './PodcastEpisodeItem';
import { styles } from './podcastShowDetailStyles';

export const PodcastShowDetail = React.memo(function PodcastShowDetail({
  show,
  onBack,
  onPlayEpisode,
  onPlayAll,
  onTrackAction,
  currentTrackId,
  isPlaying,
  isFollowed,
  onToggleFollow,
  isDark = true,
  isRTL = true,
}) {
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const episodes = useMemo(() => show?.episodes || [], [show]);

  const handlePlayAllPress = useCallback(() => {
    if (episodes.length > 0) {
      onPlayAll(episodes);
    }
  }, [episodes, onPlayAll]);

  const handlePlayEpisodeRow = useCallback((item) => {
    onPlayEpisode(item, episodes);
  }, [onPlayEpisode, episodes]);

  const renderEpisodeItem = useCallback(({ item }) => (
    <PodcastEpisodeItem
      episode={item}
      isCurrentTrack={currentTrackId === String(item.id || item._id)}
      isPlaying={isPlaying}
      onPlay={handlePlayEpisodeRow}
      onTrackAction={onTrackAction}
      isDark={isDark}
      isRTL={isRTL}
    />
  ), [currentTrackId, isPlaying, handlePlayEpisodeRow, onTrackAction, isDark, isRTL]);

  const keyExtractor = useCallback((item) => String(item.id || item._id), []);

  const headerComponent = useMemo(() => (
    <View style={styles.headerContainer}>
      {/* Top Bar with Back Button */}
      <View style={[styles.topNavRow, !isRTL && styles.topNavRowLTR]}>
        <TouchableOpacity
          style={[styles.backBtn, !isDark && styles.backBtnLight, !isRTL && styles.backBtnLTR]}
          onPress={onBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <BackIcon size={20} color={!isDark ? '#0f172a' : '#ffffff'} />
          <Text style={[styles.backText, !isDark && styles.backTextLight]}>
            {isRTL ? 'البرامج' : 'Podcasts'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Show Hero */}
      <View style={styles.heroSection}>
        <View style={styles.coverFrame}>
          {show.cover ? (
            <Image source={{ uri: show.cover }} style={styles.coverImage} resizeMode="cover" />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Radio size={48} color={colors.mint} />
            </View>
          )}
        </View>

        <Text style={[styles.showTitle, !isDark && styles.showTitleLight]} numberOfLines={2}>
          {show.title || show.name}
        </Text>

        <Text style={[styles.creatorText, !isDark && styles.creatorTextLight]} numberOfLines={1}>
          {isRTL ? `تقديم: ${show.creator}` : `Host: ${show.creator}`}
        </Text>

        {show.categoryLabel ? (
          <View style={styles.categoryPill}>
            <Text style={styles.categoryPillText}>{show.categoryLabel}</Text>
          </View>
        ) : null}

        {show.description ? (
          <Text style={[styles.descriptionText, !isDark && styles.descriptionTextLight]} numberOfLines={4}>
            {show.description}
          </Text>
        ) : null}

        {/* Stats */}
        <View style={[styles.statsRow, !isRTL && styles.statsRowLTR]}>
          {(show.followersCount || show.followers) ? (
            <View style={[styles.statItem, !isRTL && styles.statItemLTR]}>
              <Users size={13} color={colors.mint} />
              <Text style={[styles.statText, !isDark && styles.statTextLight]}>
                {isRTL ? `${show.followersCount || show.followers} متابع` : `${show.followersCount || show.followers} Followers`}
              </Text>
            </View>
          ) : null}
          <View style={styles.statDot} />
          <View style={[styles.statItem, !isRTL && styles.statItemLTR]}>
            <Radio size={13} color={colors.mint} />
            <Text style={[styles.statText, !isDark && styles.statTextLight]}>
              {isRTL ? `${episodes.length} حلقات متاحة` : `${episodes.length} Episodes available`}
            </Text>
          </View>
        </View>

        {/* CTA Buttons */}
        <View style={[styles.actionButtonsRow, !isRTL && styles.actionButtonsRowLTR]}>
          <TouchableOpacity
            style={[styles.playAllBtn, !isRTL && styles.playAllBtnLTR]}
            onPress={handlePlayAllPress}
            activeOpacity={0.85}
          >
            <Play size={16} color="#0b1110" fill="#0b1110" />
            <Text style={styles.playAllBtnText}>{isRTL ? 'تشغيل كل الحلقات' : 'Play All Episodes'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.followBtn,
              isFollowed && styles.followBtnActive,
              !isDark && !isFollowed && styles.followBtnLight,
              !isRTL && styles.followBtnLTR,
            ]}
            onPress={() => onToggleFollow(show.id)}
            activeOpacity={0.8}
          >
            {isFollowed ? (
              <>
                <Check size={16} color={colors.mint} />
                <Text style={styles.followBtnActiveText}>{isRTL ? 'مُتابَع' : 'Following'}</Text>
              </>
            ) : (
              <>
                <Plus size={16} color={!isDark ? '#0f172a' : '#ffffff'} />
                <Text style={[styles.followBtnText, !isDark && styles.followBtnTextLight]}>{isRTL ? 'متابعة' : 'Follow'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Episodes Section Title */}
      <View style={[styles.episodesHeaderRow, !isRTL && styles.episodesHeaderRowLTR]}>
        <Text style={[styles.episodesHeading, !isDark && styles.episodesHeadingLight]}>
          {isRTL ? 'الحلقات' : 'Episodes'}
        </Text>
        <Text style={styles.episodesCountText}>
          ({episodes.length})
        </Text>
      </View>
    </View>
  ), [
    show,
    episodes,
    isDark,
    isRTL,
    isFollowed,
    onBack,
    handlePlayAllPress,
    onToggleFollow,
    BackIcon,
  ]);

  return (
    <FlatList
      data={episodes}
      renderItem={renderEpisodeItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={headerComponent}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      initialNumToRender={10}
      maxToRenderPerBatch={15}
      windowSize={9}
      removeClippedSubviews={Platform.OS === 'android'}
    />
  );
});

export default PodcastShowDetail;
