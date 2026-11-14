import React, { useMemo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Disc } from 'lucide-react-native';
import { normalizeCoverUri } from '../../utils/coverUtils';
import { colors } from '../../theme/colors';

const PlaylistCoverCollage = React.memo(function PlaylistCoverCollage({
  playlist,
  tracks = [],
  style,
  discSize = 28,
  isDark = true,
}) {
  const { customCover, distinctCovers } = useMemo(() => {
    if (!playlist) return { customCover: null, distinctCovers: [] };
    if (playlist.cover && typeof playlist.cover === 'string' && playlist.cover.trim()) {
      return { customCover: playlist.cover.trim(), distinctCovers: [] };
    }

    const trackPoolMap = new Map();
    if (Array.isArray(tracks)) {
      for (const t of tracks) {
        if (t) {
          if (t.id) trackPoolMap.set(String(t.id), t);
          if (t._id) trackPoolMap.set(String(t._id), t);
        }
      }
    }

    const items = playlist.tracks || playlist.trackIds || [];
    const covers = [];
    const seen = new Set();

    for (const item of items) {
      let c = null;
      if (item && typeof item === 'object') {
        c = item.cover || item.coverUrl;
      } else if (item) {
        const found = trackPoolMap.get(String(item));
        c = found?.cover || found?.coverUrl;
      }
      if (c && typeof c === 'string' && c.trim() && !seen.has(c.trim())) {
        seen.add(c.trim());
        covers.push(c.trim());
        if (covers.length === 4) break;
      }
    }

    return { customCover: null, distinctCovers: covers };
  }, [playlist, tracks]);

  if (customCover) {
    return (
      <Image
        source={{ uri: normalizeCoverUri(customCover) }}
        style={[styles.full, style]}
        resizeMode="cover"
        fadeDuration={0}
      />
    );
  }

  if (distinctCovers.length >= 4) {
    return (
      <View style={[styles.gridContainer, style]}>
        <View style={styles.gridRow}>
          <Image
            source={{ uri: normalizeCoverUri(distinctCovers[0]) }}
            style={styles.gridCell}
            resizeMode="cover"
            fadeDuration={0}
          />
          <Image
            source={{ uri: normalizeCoverUri(distinctCovers[1]) }}
            style={styles.gridCell}
            resizeMode="cover"
            fadeDuration={0}
          />
        </View>
        <View style={styles.gridRow}>
          <Image
            source={{ uri: normalizeCoverUri(distinctCovers[2]) }}
            style={styles.gridCell}
            resizeMode="cover"
            fadeDuration={0}
          />
          <Image
            source={{ uri: normalizeCoverUri(distinctCovers[3]) }}
            style={styles.gridCell}
            resizeMode="cover"
            fadeDuration={0}
          />
        </View>
      </View>
    );
  }

  if (distinctCovers.length === 1) {
    return (
      <Image
        source={{ uri: normalizeCoverUri(distinctCovers[0]) }}
        style={[styles.full, style]}
        resizeMode="cover"
        fadeDuration={0}
      />
    );
  }

  if (distinctCovers.length > 1) {
    const gridCovers = [
      distinctCovers[0],
      distinctCovers[1],
      distinctCovers[2] || distinctCovers[0],
      distinctCovers[3] || distinctCovers[1] || distinctCovers[0],
    ];
    return (
      <View style={[styles.gridContainer, style]}>
        <View style={styles.gridRow}>
          <Image
            source={{ uri: normalizeCoverUri(gridCovers[0]) }}
            style={styles.gridCell}
            resizeMode="cover"
            fadeDuration={0}
          />
          <Image
            source={{ uri: normalizeCoverUri(gridCovers[1]) }}
            style={styles.gridCell}
            resizeMode="cover"
            fadeDuration={0}
          />
        </View>
        <View style={styles.gridRow}>
          <Image
            source={{ uri: normalizeCoverUri(gridCovers[2]) }}
            style={styles.gridCell}
            resizeMode="cover"
            fadeDuration={0}
          />
          <Image
            source={{ uri: normalizeCoverUri(gridCovers[3]) }}
            style={styles.gridCell}
            resizeMode="cover"
            fadeDuration={0}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.placeholder, style]}>
      <Disc size={discSize} color={colors.mint || '#17a398'} />
    </View>
  );
});

const styles = StyleSheet.create({
  full: {
    width: '100%',
    height: '100%',
  },
  gridContainer: {
    width: '100%',
    height: '100%',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  gridRow: {
    flex: 1,
    flexDirection: 'row',
  },
  gridCell: {
    flex: 1,
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
});

export default PlaylistCoverCollage;
