import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Platform,
  Animated,
  BackHandler,
} from 'react-native';
import {
  ArrowLeft,
  Play,
  Shuffle,
  Disc,
  Heart,
  Download,
  CheckCircle2,
  ListPlus,
  UserPlus,
  Check,
  Music,
  MoreVertical,
  CheckSquare,
  Plus,
  Edit,
} from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/colors';
import { normalizeCoverUri } from '../utils/coverUtils';
import { formatDuration } from '../utils/timeUtils';
import { INITIAL_TRACKS } from '../data/initialTracks';
import { API_BASE_URL } from '../config';
import { matchesArtist, getCanonicalArtistName, getArtistAliasNote } from '../../utils/artistUtils.jsx';
import MiniPlayer from './MiniPlayer';
import AddAlbumModal from './AddAlbumModal';
import EditArtistModal from './EditArtistModal';
import { styles } from './artist/artistDetailStyles';
import ArtistHeroSection from './artist/ArtistHeroSection';
import ArtistAlbumsSection from './artist/ArtistAlbumsSection';
import { useArtistDetailData } from './artist/useArtistDetailData';
import { useTranslation } from '../context/LocalizationContext';


const { width } = Dimensions.get('window');

export default function ArtistDetailModal({
  visible,
  artist,
  onClose,
  allTracks = [],
  allAlbums = [],
  onSelectAlbum,
  onTrackAction,
  onOpenFullPlayer,
}) {
  const { playTrack, currentTrack, addToQueue, downloadedTracks = [], downloadTrack, openFullPlayer: contextOpenFullPlayer } = useAudioPlayer();
  const handleOpenFull = React.useCallback(() => {
    const trigger = onOpenFullPlayer || contextOpenFullPlayer;
    if (!trigger) return;
    if (Platform.OS === 'ios' && typeof onClose === 'function') {
      onClose();
      setTimeout(() => {
        trigger();
      }, 150);
    } else {
      trigger();
    }
  }, [onOpenFullPlayer, contextOpenFullPlayer, onClose]);

  const handleTrackAction = React.useCallback((track) => {
    if (!onTrackAction) return;
    if (Platform.OS === 'ios' && typeof onClose === 'function') {
      onClose();
      setTimeout(() => {
        onTrackAction(track);
      }, 150);
    } else {
      onTrackAction(track);
    }
  }, [onTrackAction, onClose]);
  const { likedTrackIds = [], toggleLikeTrack, currentUser } = useUser();
  const { isDark } = useTheme();
  const { t, isRTL } = useTranslation();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isAddAlbumOpen, setIsAddAlbumOpen] = useState(false);
  const [isEditArtistOpen, setIsEditArtistOpen] = useState(false);
  const isAdmin = Boolean(currentUser?.role === 'admin' || currentUser?.isAdmin);


  // Normalize artist name and resolve canonical group (matches Web ArtistScreen)
  const rawArtistName = useMemo(() => {
    if (!artist) return '';
    if (typeof artist === 'string') return artist.trim();
    return (artist.name || artist.artist || '').trim();
  }, [artist]);

  const canonicalName = useMemo(() => getCanonicalArtistName(rawArtistName), [rawArtistName]);
  const artistName = canonicalName || rawArtistName;
  const artistKey = artistName.toLowerCase();
  const aliasNote = useMemo(() => getArtistAliasNote(artistName), [artistName]);

  const {
    finalTracks,
    finalAlbums,
    artistCover,
  } = useArtistDetailData({
    artist,
    artistName,
    rawArtistName,
    artistKey,
    visible,
    allTracks,
    allAlbums,
  });

  const handlePlayAll = (shuffle = false) => {
    if (finalTracks.length === 0) return;
    let queue = [...finalTracks];
    if (shuffle) {
      queue.sort(() => Math.random() - 0.5);
    }
    playTrack(queue[0], queue);
  };

  const { height: SCREEN_HEIGHT } = Dimensions.get('window');
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: Platform.OS === 'android' ? 0 : 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: Platform.OS === 'android' ? 0 : 180,
      useNativeDriver: true,
    }).start(() => {
      onClose && onClose();
    });
  };

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => sub.remove();
  }, [visible]);
  if (!visible || !artistName) return null;

  const curTrackId = String(currentTrack?._id || currentTrack?.id || '');
  const likedSet = React.useMemo(() => new Set((likedTrackIds || []).map(String)), [likedTrackIds]);
  const downloadedSet = React.useMemo(() => new Set((downloadedTracks || []).map(d => String(d._id || d.id))), [downloadedTracks]);

  const renderTrackItem = React.useCallback(({ item: t, index }) => {
    const trackId = String(t._id || t.id || '');
    const isCurrent = curTrackId !== '' && curTrackId === trackId;
    const isLiked = likedSet.has(trackId);
    const isDl = downloadedSet.has(trackId) || Boolean(t.isDownloaded || t.localAudioUri);

    const numStr = (index + 1) < 10 ? `0${index + 1}` : `${index + 1}`;
    const trackCover = normalizeCoverUri(t.coverUrl || t.cover || artistCover);

    return (
      <View style={{ paddingHorizontal: 16 }}>
        <TouchableOpacity
          key={trackId || index}
          style={[styles.trackRow, isCurrent && styles.trackRowActive]}
          onPress={() => {
            if (isCurrent) {
              if (handleOpenFull) {
                handleOpenFull();
              } else {
                playTrack(t, finalTracks);
              }
            } else {
              playTrack(t, finalTracks);
            }
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.trackNum, isCurrent && styles.trackNumActive]}>
            {numStr}
          </Text>
          <Image source={{ uri: trackCover }} style={styles.trackThumb} resizeMode="cover" fadeDuration={0} />
          <View style={styles.trackDetails}>
            <Text style={[styles.trackTitle, !isDark && styles.trackTitleLight, isCurrent && styles.trackTitleActive]} numberOfLines={1}>
              {t.title || 'Untitled Track'}
            </Text>
            <Text style={[styles.trackArtist, !isDark && styles.trackArtistLight]} numberOfLines={1}>
              {t.artist || artistName}
            </Text>
          </View>
          <Text style={styles.trackDuration}>{formatDuration(t.duration, 210)}</Text>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => downloadTrack && downloadTrack(t)}
            activeOpacity={0.7}
          >
            {isDl ? (
              <CheckCircle2 size={16} color="#17a398" />
            ) : (
              <Download size={16} color="#6b7280" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => toggleLikeTrack && toggleLikeTrack(trackId)}
            activeOpacity={0.7}
          >
            <Heart
              size={16}
              color={isLiked ? '#dc2626' : '#6b7280'}
              fill={isLiked ? '#dc2626' : 'transparent'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => handleTrackAction(t)}
            activeOpacity={0.7}
          >
            <MoreVertical size={16} color="#9ca3af" />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    );
  }, [curTrackId, likedSet, downloadedSet, artistCover, artistName, isDark, handleOpenFull, playTrack, finalTracks, downloadTrack, toggleLikeTrack, handleTrackAction]);

  return (
    <Animated.View
      style={[
        styles.fullScreenWrapper,
        !isDark && styles.containerLight,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[styles.container, !isDark && styles.containerLight]}>
        {/* Top Header Bar matching Image 2 */}
        <View style={[styles.topBar, isRTL && { alignItems: 'flex-end' }]}>
          <TouchableOpacity onPress={handleClose} style={[styles.backBtn, !isDark && styles.backBtnLight, isRTL && { flexDirection: 'row-reverse', alignSelf: 'flex-end' }]} activeOpacity={0.8}>
            <ArrowLeft size={20} color={!isDark ? '#0b1110' : '#fdfbf7'} strokeWidth={2.5} style={isRTL && { transform: [{ rotate: '180deg' }] }} />
            <Text style={[styles.backText, !isDark && styles.backTextLight]}>{t('admin.back') || 'BACK'}</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          data={finalTracks}
          keyExtractor={(t, idx) => String(t._id || t.id || idx)}
          renderItem={renderTrackItem}
          initialNumToRender={Platform.OS === 'android' ? 5 : 8}
          maxToRenderPerBatch={Platform.OS === 'android' ? 4 : 6}
          windowSize={Platform.OS === 'android' ? 3 : 5}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={Platform.OS === 'android'}
          ListHeaderComponent={(
            <View>
              <ArtistHeroSection
                artistCover={artistCover}
                artistName={artistName}
                finalTracksCount={finalTracks.length}
                finalAlbumsCount={finalAlbums.length}
                isDark={isDark}
                isFollowing={isFollowing}
                setIsFollowing={setIsFollowing}
                handlePlayAll={handlePlayAll}
                addToQueue={addToQueue}
                finalTracks={finalTracks}
                isAdmin={isAdmin}
                setIsAddAlbumOpen={setIsAddAlbumOpen}
                setIsEditArtistOpen={setIsEditArtistOpen}
                styles={styles}
              />

              <ArtistAlbumsSection
                finalAlbums={finalAlbums}
                isAdmin={isAdmin}
                isDark={isDark}
                artistCover={artistCover}
                setIsAddAlbumOpen={setIsAddAlbumOpen}
                onSelectAlbum={onSelectAlbum}
                styles={styles}
              />

              <View style={[styles.sectionContainer, !isDark && styles.sectionContainerLight, { marginBottom: 0, paddingBottom: 0, borderBottomWidth: 0 }]}>
                <View style={[styles.sectionHeaderRow, !isDark && styles.sectionHeaderRowLight, isRTL && { flexDirection: 'row-reverse' }]}>
                  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, isRTL && { flexDirection: 'row-reverse' }]}>
                    <Music size={16} color="#17a398" />
                    <Text style={[styles.sectionTitle, !isDark && styles.sectionTitleLight]}>{t('profile.popularTracks')}</Text>
                  </View>
                  <Text style={styles.sectionCounter}>{t('profile.tracksCount', { count: finalTracks.length })}</Text>
                </View>
              </View>
            </View>
          )}
          ListFooterComponent={<View style={{ height: currentTrack ? 120 : 60 }} />}
          windowSize={5}
          maxToRenderPerBatch={10}
          initialNumToRender={10}
          removeClippedSubviews={true}
        />

        {/* Floating Mini Player matching home screen experience */}
        {currentTrack && (
          <MiniPlayer
            onOpenFullPlayer={handleOpenFull}
            bottomOffset={Platform.OS === 'ios' ? 24 : 12}
          />
        )}

        {/* Admin Modals */}
        <AddAlbumModal
          visible={isAddAlbumOpen}
          onClose={() => setIsAddAlbumOpen(false)}
          initialArtistName={artistName}
          finalTracks={finalTracks}
          artistAvatar={artistCover}
        />

        <EditArtistModal
          visible={isEditArtistOpen}
          onClose={() => setIsEditArtistOpen(false)}
          artist={artist}
        />
      </View>
    </Animated.View>
  );
}
