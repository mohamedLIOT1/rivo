import React, { useState, useEffect } from 'react';
import { ArrowLeft, Disc, Layers, Music2, Sparkles } from 'lucide-react';
import { isUserAdmin } from '../utils/adminUtils';
import EditArtistModal from '../components/EditArtistModal';
import AddAlbumModal from '../components/AddAlbumModal';
import TrackActionMenuModal from '../components/TrackActionMenuModal';
import { useUser } from '../context/UserContext';
import { useAudioPlayer } from '../context/AudioContext';
import { useArtistWebData } from '../components/artist/useArtistWebData';
import ArtistHero from '../components/artist/ArtistHero';
import ArtistTopTracks from '../components/artist/ArtistTopTracks';
import ArtistHorizontalSection from '../components/artist/ArtistHorizontalSection';
import ArtistTrackList from '../components/artist/ArtistTrackList';
import ArtistBioSection from '../components/artist/ArtistBioSection';
import { useTranslation } from '../context/PreferencesContext';
import { OFFICIAL_ALBUM_COVERS, getAlbumArtwork } from '../utils/albumArtworkMap';

export { OFFICIAL_ALBUM_COVERS, getAlbumArtwork };

export default function ArtistScreen({
  artist: initialArtist,
  tracks = [],
  albums = [],
  onSelectTrack,
  onSelectPlaylist,
  onSelectArtist,
  toggleLike,
  onBack,
  currentUser,
  openEditSongModal,
  openEditAlbumModal,
  onDeleteTrack,
  openAddToPlaylist,
  onAlbumCreated = () => {},
  globalTheme = 'dark',
  onToast = () => {}
}) {
  const isDark = globalTheme === 'dark';
  const { t, isRTL } = useTranslation();
  const { addToQueue, jamSession } = useAudioPlayer();
  const { isFollowingArtist, toggleFollowArtist } = useUser();
  const [artist, setArtist] = useState(initialArtist || { name: 'Artist' });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddAlbumOpen, setIsAddAlbumOpen] = useState(false);
  const [actionMenuTrack, setActionMenuTrack] = useState(null);

  useEffect(() => {
    if (initialArtist) {
      setArtist(initialArtist);
    }
  }, [initialArtist]);

  const {
    artistName,
    aliasNote,
    artistTracks,
    artistAlbums,
    topTracks,
    fullAlbums,
    eps,
    singles,
    collaborations,
    isQuran,
    totalPlays,
    bio,
    avatar,
    banner,
    isVerified
  } = useArtistWebData({
    initialArtist: artist,
    tracks,
    albums
  });

  const isAdmin = Boolean(isUserAdmin(currentUser));

  const handleOpenAlbum = (album) => {
    if (!onSelectPlaylist) return;
    const albumTracks = artistTracks.filter(t => t.album && t.album.toLowerCase().trim() === album.name.toLowerCase().trim());
    const albumTrackIds = albumTracks.map(t => String(t.id || t._id));
    const allTrackIds = Array.from(new Set([
      ...albumTrackIds,
      ...(album.trackIds || []).map(String)
    ]));

    const albumPlaylist = {
      ...album,
      id: album.id || ('album-' + encodeURIComponent(album.name).toLowerCase().replace(/[^a-z0-9_-]/g, '-')),
      name: album.name,
      artist: artistName,
      cover: album.cover || albumTracks[0]?.cover || '',
      trackIds: allTrackIds,
      isAlbum: true,
      isPublic: true
    };
    onSelectPlaylist(albumPlaylist);
  };

  const handlePlayAll = () => {
    if (artistTracks.length > 0 && onSelectTrack) {
      onSelectTrack(artistTracks[0], artistTracks);
    }
  };

  const handleAddToQueue = () => {
    if (artistTracks.length > 0) {
      addToQueue?.(artistTracks);
      if (onToast) {
        onToast(jamSession ? `Added ${artistTracks.length} tracks to Jam queue` : `Added ${artistTracks.length} tracks to queue`);
      }
    }
  };

  return (
    <div className={`flex-1 overflow-y-auto pb-32 select-none p-3 sm:p-4 md:p-8 transition-colors ${
      isDark ? 'bg-[#0b1110] text-[#fdfbf7]' : 'bg-[#17a398] text-[#0b1110]'
    }`}>
      {/* Back Button */}
      {onBack && (
        <button
          onClick={onBack}
          type="button"
          className={`mb-3 sm:mb-4 inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-display font-black brutal-border brutal-shadow-sm brutal-btn cursor-pointer transition ${
            isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700' : 'bg-[#fdfbf7] hover:bg-white text-[#0b1110]'
          }`}
        >
          <ArrowLeft size={13} strokeWidth={2.5} className={isRTL ? 'rotate-180' : ''} />
          <span>{t('admin.back') || 'Back'}</span>
        </button>
      )}

      {/* 1. Artist Hero Section */}
      <ArtistHero
        artistName={artistName}
        avatar={avatar}
        banner={banner}
        aliasNote={aliasNote}
        isQuran={isQuran}
        artistTracks={artistTracks}
        artistAlbums={artistAlbums}
        totalPlays={totalPlays}
        isFollowing={isFollowingArtist(artistName)}
        onToggleFollow={() => toggleFollowArtist(artistName)}
        onPlayAll={handlePlayAll}
        onAddToQueue={handleAddToQueue}
        jamSession={jamSession}
        isAdmin={isAdmin}
        onOpenAddAlbum={() => setIsAddAlbumOpen(true)}
        onOpenEditArtist={() => setIsEditModalOpen(true)}
        isDark={isDark}
      />

      {/* 2. Most Listened on Server (Vertical list, Top 5 with View All toggle) */}
      <ArtistTopTracks
        tracks={topTracks}
        isDark={isDark}
        onSelectTrack={onSelectTrack}
        onSelectArtist={onSelectArtist}
        onOpenActionMenu={(track) => setActionMenuTrack(track)}
        toggleLike={toggleLike}
      />

      {/* 3. Full Albums Section (Horizontal scroll with View All) */}
      <ArtistHorizontalSection
        title={isQuran ? t('profile.discographyRecitations') : (isRTL ? 'الألبومات الكاملة' : 'Full Albums')}
        icon={Disc}
        items={fullAlbums}
        isDark={isDark}
        isAdmin={isAdmin}
        isTracks={false}
        onOpenAlbum={handleOpenAlbum}
        openEditAlbumModal={openEditAlbumModal}
      />

      {/* 4. EPs Section (Horizontal scroll with View All) */}
      <ArtistHorizontalSection
        title={isRTL ? 'ألبومات مصغرة (EPs)' : 'EPs & Extended Plays'}
        icon={Layers}
        items={eps}
        isDark={isDark}
        isAdmin={isAdmin}
        isTracks={false}
        onOpenAlbum={handleOpenAlbum}
        openEditAlbumModal={openEditAlbumModal}
      />

      {/* 5. Singles Section (Horizontal scroll with View All) */}
      <ArtistHorizontalSection
        title={isRTL ? 'الأغاني الفردية (Singles)' : 'Singles'}
        icon={Music2}
        items={singles}
        isDark={isDark}
        isAdmin={isAdmin}
        isTracks={false}
        onOpenAlbum={handleOpenAlbum}
        openEditAlbumModal={openEditAlbumModal}
      />

      {/* 6. Features & Collaborations ("Appears On") Section (Horizontal scroll with View All) */}
      <ArtistHorizontalSection
        title={isRTL ? 'المشاركات والأعمال المشتركة' : 'Features & Appears On'}
        icon={Sparkles}
        items={collaborations}
        isDark={isDark}
        isAdmin={false}
        isTracks={true}
        onSelectTrack={onSelectTrack}
        onSelectArtist={onSelectArtist}
      />

      {/* 7. All Discography Tracks List */}
      <ArtistTrackList
        artistTracks={artistTracks}
        isQuran={isQuran}
        isDark={isDark}
        onSelectTrack={onSelectTrack}
        onSelectArtist={onSelectArtist}
        onOpenActionMenu={(track) => setActionMenuTrack(track)}
        toggleLike={toggleLike}
      />

      {/* 8. Artist Biography / About Section */}
      <div className="w-full flex justify-center my-6">
        <ArtistBioSection
          bio={bio}
          artistName={artistName}
          isDark={isDark}
        />
      </div>

      {/* Edit Artist Modal for Admins */}
      {isEditModalOpen && (
        <EditArtistModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          artist={{ ...artist, name: artistName, bio, avatar, banner, isVerified }}
          onSaved={(updated) => {
            setArtist(prev => ({ ...prev, ...updated }));
          }}
          globalTheme={globalTheme}
        />
      )}

      {/* Add Album Modal for Admins */}
      {isAddAlbumOpen && (
        <AddAlbumModal
          isOpen={isAddAlbumOpen}
          onClose={() => setIsAddAlbumOpen(false)}
          initialArtistName={artistName}
          artistTracks={artistTracks}
          artistAvatar={avatar}
          onAlbumCreated={(newAlbum, trackIds, newTracks) => {
            if (onAlbumCreated) onAlbumCreated(newAlbum, trackIds, newTracks);
            setIsAddAlbumOpen(false);
          }}
          globalTheme={globalTheme}
        />
      )}

      {/* Track 3-Dots Action Menu Modal */}
      {actionMenuTrack && (
        <TrackActionMenuModal
          isOpen={Boolean(actionMenuTrack)}
          onClose={() => setActionMenuTrack(null)}
          track={actionMenuTrack}
          onPlayTrack={onSelectTrack}
          onAddToQueue={addToQueue}
          openAddToPlaylist={openAddToPlaylist}
          openEditSongModal={openEditSongModal}
          onDeleteTrack={onDeleteTrack}
          currentUser={currentUser}
          globalTheme={globalTheme}
        />
      )}
    </div>
  );
}
