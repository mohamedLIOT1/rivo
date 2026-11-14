import React, { memo, useState, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView } from 'react-native';
import { Disc, Layers, Music2, Sparkles, Plus, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react-native';
import { normalizeCoverUri } from '../../utils/coverUtils';
import { useTranslation } from '../../context/LocalizationContext';

function HorizontalAlbumCarousel({
  title,
  icon: Icon,
  items = [],
  isDark = true,
  artistCover,
  onSelectAlbum,
  styles,
  isRTL
}) {
  const [isGrid, setIsGrid] = useState(false);
  if (!items || items.length === 0) return null;

  return (
    <View style={{ marginBottom: 16 }}>
      {/* Carousel Header */}
      <View style={[styles.sectionHeaderRow, !isDark && styles.sectionHeaderRowLight, isRTL && { flexDirection: 'row-reverse' }]}>
        <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, isRTL && { flexDirection: 'row-reverse' }]}>
          {Icon && <Icon size={15} color="#17a398" />}
          <Text style={[styles.sectionTitle, !isDark && styles.sectionTitleLight]}>{title}</Text>
          <View style={{ backgroundColor: 'rgba(23,163,152,0.15)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10 }}>
            <Text style={{ fontSize: 10, color: '#17a398', fontWeight: '900', fontFamily: 'monospace' }}>
              {items.length}
            </Text>
          </View>
        </View>

        {items.length > 2 && (
          <TouchableOpacity onPress={() => setIsGrid(prev => !prev)} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text style={{ fontSize: 10, color: '#17a398', fontWeight: '800', fontFamily: 'monospace' }}>
              {isGrid ? (isRTL ? 'عرض بالعرض' : 'CAROUSEL') : (isRTL ? 'عرض الكل' : 'VIEW ALL')}
            </Text>
            {isGrid ? <ChevronUp size={12} color="#17a398" /> : <ChevronRight size={12} color="#17a398" style={isRTL && { transform: [{ rotate: '180deg' }] }} />}
          </TouchableOpacity>
        )}
      </View>

      {/* Items Container */}
      {isGrid ? (
        <View style={[styles.albumGrid, isRTL && { flexDirection: 'row-reverse' }]}>
          {items.map((album, idx) => {
            const albumKey = album.id || album.name || idx;
            const albCover = normalizeCoverUri(album.cover || album.coverUrl || artistCover);
            const songCount = (album.tracks && album.tracks.length) || (album.trackIds && album.trackIds.length) || (album.trackCount || 0);

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
                  {songCount} {isRTL ? 'مقاطع' : 'tracks'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingHorizontal: 10, paddingTop: 4, paddingBottom: 6 }}
        >
          {items.map((album, idx) => {
            const albumKey = album.id || album.name || idx;
            const albCover = normalizeCoverUri(album.cover || album.coverUrl || artistCover);
            const songCount = (album.tracks && album.tracks.length) || (album.trackIds && album.trackIds.length) || (album.trackCount || 0);

            return (
              <TouchableOpacity
                key={albumKey}
                style={[styles.albumCard, !isDark && styles.albumCardLight, { width: 130, marginBottom: 0 }]}
                onPress={() => onSelectAlbum && onSelectAlbum(album)}
                activeOpacity={0.85}
              >
                <Image source={{ uri: albCover }} style={[styles.albumCover, { height: 110 }]} resizeMode="cover" />
                <Text style={[styles.albumCardTitle, !isDark && styles.albumCardTitleLight, isRTL && { textAlign: 'right' }]} numberOfLines={1}>
                  {album.name || 'Untitled Album'}
                </Text>
                <Text style={[styles.albumCardSub, !isDark && styles.albumCardSubLight, isRTL && { textAlign: 'right' }]} numberOfLines={1}>
                  {songCount > 0 ? `${songCount} ${isRTL ? 'مقاطع' : 'tracks'}` : (album.artist || '')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

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

  // Categorize releases
  const { fullAlbums, eps, singles } = useMemo(() => {
    const full = [];
    const epList = [];
    const singleList = [];

    finalAlbums.forEach((a) => {
      const name = String(a.name || a.title || '').toLowerCase().trim();
      const count = Number(a.trackCount || (Array.isArray(a.trackIds) ? a.trackIds.length : (Array.isArray(a.tracks) ? a.tracks.length : 0)));
      const relType = (a.releaseType || '').toLowerCase();

      if (relType === 'single' || name.endsWith('- single') || name.endsWith('(single)') || count === 1) {
        singleList.push(a);
      } else if (relType === 'ep' || name.endsWith('- ep') || name.endsWith('(ep)') || (count >= 2 && count <= 6)) {
        epList.push(a);
      } else {
        full.push(a);
      }
    });

    return { fullAlbums: full, eps: epList, singles: singleList };
  }, [finalAlbums]);

  if (finalAlbums.length === 0 && !isAdmin) return null;

  return (
    <View style={[styles.sectionContainer, !isDark && styles.sectionContainerLight]}>
      {/* Admin Action Row */}
      {isAdmin && (
        <View style={[{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10, paddingHorizontal: 12 }, isRTL && { flexDirection: 'row-reverse' }]}>
          <TouchableOpacity
            style={[styles.headerAddBtn, isRTL && { flexDirection: 'row-reverse' }]}
            onPress={() => setIsAddAlbumOpen && setIsAddAlbumOpen(true)}
            activeOpacity={0.8}
          >
            <Plus size={11} color="#0b1110" strokeWidth={2.8} />
            <Text style={styles.headerAddBtnText}>{t('profile.addAlbum')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 1. Full Albums Horizontal Carousel */}
      <HorizontalAlbumCarousel
        title={isRTL ? 'الألبومات الكاملة' : 'Full Albums'}
        icon={Disc}
        items={fullAlbums}
        isDark={isDark}
        artistCover={artistCover}
        onSelectAlbum={onSelectAlbum}
        styles={styles}
        isRTL={isRTL}
      />

      {/* 2. EPs Horizontal Carousel */}
      <HorizontalAlbumCarousel
        title={isRTL ? 'ألبومات مصغرة (EPs)' : 'EPs & Extended Plays'}
        icon={Layers}
        items={eps}
        isDark={isDark}
        artistCover={artistCover}
        onSelectAlbum={onSelectAlbum}
        styles={styles}
        isRTL={isRTL}
      />

      {/* 3. Singles Horizontal Carousel */}
      <HorizontalAlbumCarousel
        title={isRTL ? 'الأغاني الفردية (Singles)' : 'Singles'}
        icon={Music2}
        items={singles}
        isDark={isDark}
        artistCover={artistCover}
        onSelectAlbum={onSelectAlbum}
        styles={styles}
        isRTL={isRTL}
      />
    </View>
  );
}

export default memo(ArtistAlbumsSection);
