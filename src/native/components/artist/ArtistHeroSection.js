import React, { memo } from 'react';
import { View, Text, Image, TouchableOpacity, Platform } from 'react-native';
import {
  Play,
  ListPlus,
  UserPlus,
  Check,
  CheckCircle2,
  Plus,
  Edit,
} from 'lucide-react-native';
import { normalizeCoverUri } from '../../utils/coverUtils';
import { useTranslation } from '../../context/LocalizationContext';

function ArtistHeroSection({
  artistCover,
  artistName,
  finalTracksCount = 0,
  finalAlbumsCount = 0,
  isDark = true,
  isFollowing = false,
  setIsFollowing,
  handlePlayAll,
  addToQueue,
  finalTracks = [],
  isAdmin = false,
  setIsAddAlbumOpen,
  setIsEditArtistOpen,
  styles,
}) {
  const { t, isRTL } = useTranslation();

  return (
    <View style={styles.heroSection}>
      {/* Centered Big Artist Image */}
      <View style={styles.avatarWrapper}>
        <Image
          source={{ uri: normalizeCoverUri(artistCover) }}
          style={styles.avatarImg}
          resizeMode="cover"
        />
      </View>

      {/* Verified Artist Badge */}
      <View style={[styles.verifiedBadge, isRTL && { flexDirection: 'row-reverse' }]}>
        <Text style={[styles.verifiedText, isRTL && { letterSpacing: 0, fontFamily: Platform.OS === 'ios' ? 'Geeza Pro' : 'sans-serif' }]}>
          {t('profile.verifiedArtist')}
        </Text>
        <CheckCircle2 size={12} color="#17a398" style={isRTL ? { marginRight: 4 } : { marginLeft: 4 }} />
      </View>

      {/* Large Artist Name */}
      <Text style={[styles.artistName, !isDark && styles.artistNameLight, isRTL && { textAlign: 'center', letterSpacing: 0 }]} numberOfLines={2}>
        {artistName}
      </Text>

      {/* Counter Pills */}
      <View style={[styles.metaPill, !isDark && styles.metaPillLight, isRTL && { flexDirection: 'row-reverse' }]}>
        <Text style={[styles.metaPillText, !isDark && styles.metaPillTextLight, isRTL && { letterSpacing: 0 }]}>
          {finalTracksCount} {t('common.tracks')}
        </Text>
        <Text style={styles.metaDot}>•</Text>
        <Text style={[styles.metaPillText, !isDark && styles.metaPillTextLight, isRTL && { letterSpacing: 0 }]}>
          {finalAlbumsCount} {t('common.albums')}
        </Text>
      </View>

      {/* Action Buttons Row */}
      <View style={[styles.actionRow, isRTL && { flexDirection: 'row-reverse' }]}>
        <TouchableOpacity
          style={styles.playBtn}
          onPress={() => handlePlayAll && handlePlayAll(false)}
          activeOpacity={0.85}
        >
          <Play size={20} color="#0b1110" fill="#0b1110" style={{ marginLeft: 2 }} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.queueBtn, !isDark && styles.queueBtnLight, isRTL && { flexDirection: 'row-reverse' }]}
          onPress={() => {
            if (addToQueue && finalTracks.length > 0) addToQueue(finalTracks);
          }}
          activeOpacity={0.8}
        >
          <ListPlus size={15} color="#26c4b7" strokeWidth={2.2} />
          <Text style={[styles.queueBtnText, !isDark && styles.queueBtnTextLight, isRTL && { letterSpacing: 0 }]}>
            {t('profile.queueAll')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.followBtn, !isDark && styles.followBtnLight, isFollowing && styles.followBtnActive, isRTL && { flexDirection: 'row-reverse' }]}
          onPress={() => setIsFollowing && setIsFollowing(!isFollowing)}
          activeOpacity={0.8}
        >
          {isFollowing ? (
            <Check size={14} color="#0b1110" strokeWidth={3} />
          ) : (
            <UserPlus size={14} color={!isDark ? '#0b1110' : '#fdfbf7'} strokeWidth={2.2} />
          )}
          <Text
            style={[
              styles.followBtnText,
              !isDark && styles.followBtnTextLight,
              isFollowing && styles.followBtnTextActive,
              isRTL && { letterSpacing: 0 }
            ]}
          >
            {isFollowing ? t('profile.followActive') : t('profile.follow')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Admin Controls Dedicated Row */}
      {isAdmin && (
        <View style={[styles.adminActionRow, isRTL && { flexDirection: 'row-reverse' }]}>
          <TouchableOpacity
            style={styles.addAlbumHeroBtn}
            onPress={() => setIsAddAlbumOpen && setIsAddAlbumOpen(true)}
            activeOpacity={0.8}
          >
            <Plus size={13} color="#0b1110" strokeWidth={2.8} />
            <Text style={[styles.addAlbumHeroBtnText, isRTL && { letterSpacing: 0 }]}>
              {t('profile.addAlbum')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.editArtistHeroBtn}
            onPress={() => setIsEditArtistOpen && setIsEditArtistOpen(true)}
            activeOpacity={0.8}
          >
            <Edit size={13} color="#0b1110" strokeWidth={2.5} />
            <Text style={[styles.editArtistHeroBtnText, isRTL && { letterSpacing: 0 }]}>
              {t('profile.editArtistPage')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default memo(ArtistHeroSection);
