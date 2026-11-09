import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Radio, Users } from 'lucide-react-native';
import { colors } from '../../theme/colors';

export const PodcastShowCard = React.memo(function PodcastShowCard({
  show,
  onSelect,
  isDark = true,
  isRTL = true,
}) {
  if (!show) return null;

  const episodeCount = show.episodes?.length || 0;
  const followers = show.followersCount || show.followers;

  return (
    <TouchableOpacity
      style={[styles.card, !isDark && styles.cardLight]}
      onPress={() => onSelect(show)}
      activeOpacity={0.85}
    >
      <View style={styles.imageContainer}>
        {show.cover ? (
          <Image source={{ uri: show.cover }} style={styles.coverImage} resizeMode="cover" />
        ) : (
          <View style={styles.placeholderImage}>
            <Radio size={32} color={colors.mint} />
          </View>
        )}
        <View style={[styles.episodesBadge, !isRTL && styles.episodesBadgeLTR]}>
          <Text style={styles.episodesBadgeText}>
            {isRTL ? `${episodeCount} حلقات` : `${episodeCount} episodes`}
          </Text>
        </View>
      </View>

      <View style={styles.infoContainer}>
        <Text
          style={[
            styles.title,
            !isDark && styles.titleLight,
            !isRTL && styles.textLTR,
          ]}
          numberOfLines={1}
        >
          {show.title || show.name}
        </Text>
        <Text
          style={[
            styles.creator,
            !isDark && styles.creatorLight,
            !isRTL && styles.textLTR,
          ]}
          numberOfLines={1}
        >
          {show.creator}
        </Text>
        {followers ? (
          <View style={[styles.followersRow, !isRTL && styles.followersRowLTR]}>
            <Users size={11} color={!isDark ? '#64748b' : '#94a3b8'} />
            <Text style={[styles.followersText, !isDark && styles.followersTextLight]}>
              {isRTL ? `${followers} متابع` : `${followers} Followers`}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    width: 154,
    marginRight: 14,
    backgroundColor: '#151d1c',
    borderRadius: 14,
    padding: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  imageContainer: {
    width: 136,
    height: 136,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1b2624',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  episodesBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(11, 17, 16, 0.85)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  episodesBadgeLTR: {
    right: undefined,
    left: 6,
  },
  episodesBadgeText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '700',
  },
  infoContainer: {
    marginTop: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'right',
  },
  titleLight: {
    color: '#0f172a',
  },
  creator: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    textAlign: 'right',
  },
  creatorLight: {
    color: '#64748b',
  },
  textLTR: {
    textAlign: 'left',
  },
  followersRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  followersRowLTR: {
    flexDirection: 'row',
  },
  followersText: {
    fontSize: 10,
    color: '#94a3b8',
  },
  followersTextLight: {
    color: '#64748b',
  },
});

export default PodcastShowCard;
