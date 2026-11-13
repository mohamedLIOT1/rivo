import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Platform } from 'react-native';
import { Play, Disc } from 'lucide-react-native';
import { normalizeCoverUri } from '../../utils/coverUtils';

/**
 * Home Featured Album card with sibling touch responders so tapping Play on the
 * artwork never loses its touch event to the card navigation handler on Android.
 */
const FeaturedAlbumCard = React.memo(function FeaturedAlbumCard({
  album,
  isDark,
  width,
  isLoading = false,
  onSelect,
  onPlay,
}) {
  const [imgError, setImgError] = React.useState(false);
  const coverUri = album.cover || album.coverUrl || album.tracks?.[0]?.cover || album.tracks?.[0]?.coverUrl;
  const normalizedCover = useMemo(() => normalizeCoverUri(imgError ? null : coverUri), [coverUri, imgError]);

  const handleSelect = useCallback(() => {
    onSelect(album);
  }, [album, onSelect]);

  const handlePlay = useCallback(() => {
    if (!isLoading) {
      onPlay(album);
    }
  }, [album, isLoading, onPlay]);

  return (
    <View style={[styles.albumCard, !isDark && styles.albumCardLight, { width }]}>
      <View style={styles.albumCoverWrap}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={handleSelect}
          activeOpacity={0.85}
        >
          <View style={styles.albumCoverPlaceholder}>
            <Disc size={36} color="#1f3630" strokeWidth={1.5} />
          </View>
          <Image
            source={{ uri: normalizedCover }}
            style={styles.albumCover}
            resizeMode="cover"
            fadeDuration={0}
            resizeMethod={Platform.OS === 'android' ? 'resize' : 'auto'}
            onError={() => setImgError(true)}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.albumPlayOverlay}
          onPress={handlePlay}
          activeOpacity={0.75}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          accessibilityRole="button"
          accessibilityLabel={`Play ${album.name || 'album'}`}
        >
          <View style={styles.albumPlayPill}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#0b1110" />
            ) : (
              <Play size={12} color="#0b1110" fill="#0b1110" style={{ marginLeft: 2 }} />
            )}
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={handleSelect} activeOpacity={0.85}>
        <Text style={[styles.albumTitle, !isDark && styles.albumTitleLight]} numberOfLines={1}>
          {album.name}
        </Text>
        <Text style={styles.albumArtist} numberOfLines={1}>
          {album.artist || 'Various Artists'}
        </Text>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  albumCard: {
    backgroundColor: '#141d1b',
    borderWidth: 1.5,
    borderColor: '#263330',
    borderRadius: 14,
    padding: 10,
  },
  albumCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  albumCoverWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0b1110',
    marginBottom: 8,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#263330',
  },
  albumCover: {
    width: '100%',
    height: '100%',
  },
  albumCoverPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#101c19',
  },
  albumPlayOverlay: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    zIndex: 10,
    elevation: Platform.OS === 'android' ? 0 : 6,
  },
  albumPlayPill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  albumTitle: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '800',
    marginBottom: 2,
  },
  albumTitleLight: {
    color: '#0b1110',
  },
  albumArtist: {
    color: '#94a3b8',
    fontSize: 10.5,
    fontWeight: '700',
  },
});

export default FeaturedAlbumCard;
