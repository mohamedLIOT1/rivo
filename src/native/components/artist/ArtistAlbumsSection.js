import React, { memo } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Disc, Plus } from 'lucide-react-native';
import { normalizeCoverUri } from '../../utils/coverUtils';
import { useTranslation } from '../../context/LocalizationContext';

function ArtistAlbumsSection({
  finalAlbums = [],
  isAdmin = false,
  isDark = true,
  artistCover,
  setIsAddAlbumOpen,
  onSelectAlbum,
  styles,
}) {
  const { t, isRTL } = useTranslation();
  if (finalAlbums.length === 0 && !isAdmin) return null;

  return (
    <View style={[styles.sectionContainer, !isDark && styles.sectionContainerLight]}>
      <View style={[styles.sectionHeaderRow, !isDark && styles.sectionHeaderRowLight, isRTL && { flexDirection: 'row-reverse' }]}>
        <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, isRTL && { flexDirection: 'row-reverse' }]}>
          <Disc size={16} color="#17a398" />
          <Text style={[styles.sectionTitle, !isDark && styles.sectionTitleLight]}>{t('profile.discography')}</Text>
        </View>
        <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, isRTL && { flexDirection: 'row-reverse' }]}>
          <Text style={styles.sectionCounter}>{t('profile.albumsCount', { count: finalAlbums.length })}</Text>
          {isAdmin && (
            <TouchableOpacity
              style={[styles.headerAddBtn, isRTL && { flexDirection: 'row-reverse' }]}
              onPress={() => setIsAddAlbumOpen && setIsAddAlbumOpen(true)}
              activeOpacity={0.8}
            >
              <Plus size={11} color="#0b1110" strokeWidth={2.8} />
              <Text style={styles.headerAddBtnText}>{t('profile.addAlbum')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {finalAlbums.length > 0 ? (
        <View style={[styles.albumGrid, isRTL && { flexDirection: 'row-reverse' }]}>
          {finalAlbums.map((album, idx) => {
            const albumKey = album.id || album.name || idx;
            const albCover = normalizeCoverUri(album.cover || album.coverUrl || artistCover);
            const songCount = (album.tracks && album.tracks.length) || (album.trackIds && album.trackIds.length) || 0;

            return (
              <TouchableOpacity
                key={albumKey}
                style={[styles.albumCard, !isDark && styles.albumCardLight]}
                onPress={() => onSelectAlbum && onSelectAlbum(album)}
                activeOpacity={0.85}
              >
                <Image source={{ uri: albCover }} style={styles.albumCover} resizeMode="cover" />
                <Text style={[styles.albumCardTitle, !isDark && styles.albumCardTitleLight, isRTL && { textAlign: 'right' }]} numberOfLines={1}>
                  {album.name || 'Untitled Album'}
                </Text>
                <Text style={[styles.albumCardSub, !isDark && styles.albumCardSubLight, isRTL && { textAlign: 'right' }]} numberOfLines={1}>
                  {t('common.albums')} • {t('profile.tracksCount', { count: songCount })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyAlbumBox}>
          <Text style={styles.emptyAlbumText}>{t('profile.noAlbums')}</Text>
          <TouchableOpacity
            style={[styles.uploadFirstBtn, isRTL && { flexDirection: 'row-reverse' }]}
            onPress={() => setIsAddAlbumOpen && setIsAddAlbumOpen(true)}
            activeOpacity={0.8}
          >
            <Plus size={13} color="#0b1110" strokeWidth={2.8} />
            <Text style={styles.uploadFirstBtnText}>{t('profile.uploadFirstAlbum')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default memo(ArtistAlbumsSection);
