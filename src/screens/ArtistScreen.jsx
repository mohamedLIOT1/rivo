import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { isUserAdmin } from '../utils/adminUtils';
import EditArtistModal from '../components/EditArtistModal';
import AddAlbumModal from '../components/AddAlbumModal';
import TrackActionMenuModal from '../components/TrackActionMenuModal';
import { useUser } from '../context/UserContext';
import { useAudioPlayer } from '../context/AudioContext';
import { useArtistWebData } from '../components/artist/useArtistWebData';
import ArtistHero from '../components/artist/ArtistHero';
import ArtistAlbumsGrid from '../components/artist/ArtistAlbumsGrid';
import ArtistTrackList from '../components/artist/ArtistTrackList';
import ArtistBioSection from '../components/artist/ArtistBioSection';
import { useTranslation } from '../context/PreferencesContext';

export const OFFICIAL_ALBUM_COVERS = {
  'roma': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/46/81/82/468182bd-6914-bf7d-2f4a-4cb4bd5175cd/196925215671.jpg/1200x1200bb.jpg',
  'supernova': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/7f/a0/00/7fa00086-e72c-191b-6547-e8992f774a9a/885288056853.jpg/1200x1200bb.jpg',
  'nas w nas': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/64/78/b1/6478b176-8977-c2fb-bacd-761567625b00/196925011204.jpg/1200x1200bb.jpg',
  'noaata beida': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/e9/de/11/e9de11f3-be73-e0df-b4ff-72dd702476e3/196626997326.jpg/1200x1200bb.jpg',
  'the ugly ducklings': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/17/21/ff/1721ffa2-9895-8c92-43af-eaebd0a31cc6/3615938009819.png/1200x1200bb.jpg',
  'ابناء البطة السوداء': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/17/21/ff/1721ffa2-9895-8c92-43af-eaebd0a31cc6/3615938009819.png/1200x1200bb.jpg',
  'كايروكي من الاستوديو': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/2b/37/92/2b37929b-6df4-0a3e-24c4-5401eb70b5fe/196626954855.jpg/1200x1200bb.jpg',
  'classics, vol. 1': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/8a/22/95/8a2295a7-e3ba-5b30-1e07-cf3c372c07cc/cover.jpg/1200x1200bb.jpg',
  'classics': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/8a/22/95/8a2295a7-e3ba-5b30-1e07-cf3c372c07cc/cover.jpg/1200x1200bb.jpg',
  'لما بنتولد': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/d8/46/06/d846063d-1cbd-f455-1287-5370cc305292/artwork.jpg/1200x1200bb.jpg',
  'roxi': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/ad/83/7f/ad837f70-04a2-b985-2e0b-dbeaf1f2c5c2/196872351095.jpg/1200x1200bb.jpg',
  'rivo': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/6a/71/f3/6a71f3e3-b9c0-a08d-a782-4fead92c8ed6/cover.jpg/1200x1200bb.jpg',
  'ريفو': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/6a/71/f3/6a71f3e3-b9c0-a08d-a782-4fead92c8ed6/cover.jpg/1200x1200bb.jpg',
  'shoft kalam': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/01/c4/31/01c43187-da8b-fc50-b68e-2e71cd1d7c85/885288123609.jpg/1200x1200bb.jpg',
  'placebo': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/3d/be/1a/3dbe1ae5-a9c0-ff0c-d8ea-3b87692cadeb/6221216529510_cover.png/1200x1200bb.jpg',
  'plan-b': 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/ef/28/e0/ef28e07b-c631-8981-55f4-a8979a433fc5/6221216496775_cover.jpg/1200x1200bb.jpg',
  'agzakhana': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/65/7c/94/657c9473-c77e-601c-9bbc-4540ecc2c08b/6221216496768_Artwork.jpg/1200x1200bb.jpg',
  'talatini': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/21/df/b8/21dfb8ce-a9ea-722d-2fe4-d2c679a781d4/cover.jpg/1200x1200bb.jpg',
  'تلاتيني': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/21/df/b8/21dfb8ce-a9ea-722d-2fe4-d2c679a781d4/cover.jpg/1200x1200bb.jpg',
  'matador': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/2c/31/54/2c31548e-cfbe-639a-7c2a-89a19c629e46/195497282647.jpg/1200x1200bb.jpg',
  'ماتادور': 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/2c/31/54/2c31548e-cfbe-639a-7c2a-89a19c629e46/195497282647.jpg/1200x1200bb.jpg',
  'bgd': 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/b8/01/5e/b8015e1f-13a8-44d4-20b1-ce3cb6ea861a/196626466989.jpg/1200x1200bb.jpg',
  '191-181': 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/3b/b1/68/3bb16886-f404-54c2-9e20-7f2cb09e13f4/196925008549.jpg/1200x1200bb.jpg',
  'florida': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/4a/1c/91/4a1c91d3-45fe-515c-3f1f-df436f521bb3/195497478057.jpg/1200x1200bb.jpg',
  'aqareb': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/33/f0/ec/33f0ece3-d007-4cdd-03b7-de6dfaa1442b/199806680476.jpg/1200x1200bb.jpg',
  'sahran': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/11/49/a2/1149a2a7-5c55-bfa3-0c46-f94e9f90cf05/859737402638_Cover.jpg/1200x1200bb.jpg',
  'سهران': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/11/49/a2/1149a2a7-5c55-bfa3-0c46-f94e9f90cf05/859737402638_Cover.jpg/1200x1200bb.jpg',
  'kol hayaty': 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/64/08/df/6408df48-f62f-0d92-29fc-4c4dbb9bcae7/859727400347_Cover.jpg/1200x1200bb.jpg',
  'كل حياتي': 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/64/08/df/6408df48-f62f-0d92-29fc-4c4dbb9bcae7/859727400347_Cover.jpg/1200x1200bb.jpg',
  'meaddy el nas': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d2/e1/97/d2e19759-e749-749a-a439-1e310ac89f14/889502763589.jpg/1200x1200bb.jpg',
  'معدي الناس': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d2/e1/97/d2e19759-e749-749a-a439-1e310ac89f14/889502763589.jpg/1200x1200bb.jpg',
  'ahla w ahla': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/a8/81/9f/a8819f9f-99f8-eb28-6a73-fcae47843bc8/3616842352848.jpg/1200x1200bb.jpg',
  'أحلى وأحلى': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/a8/81/9f/a8819f9f-99f8-eb28-6a73-fcae47843bc8/3616842352848.jpg/1200x1200bb.jpg',
  'eish beshoak': 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/15/d5/43/15d54341-26ec-8be5-61be-d7f4be2b8ee3/3615934057869.png/1200x1200bb.jpg',
  'عيش بشوقك': 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/15/d5/43/15d54341-26ec-8be5-61be-d7f4be2b8ee3/3615934057869.png/1200x1200bb.jpg',
  'khallik foulazy': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/b4/d9/31/b4d9319e-e4a8-4221-ce16-7eebe39695be/3616553818961.jpg/1200x1200bb.jpg',
  'خليك فولاذي': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/b4/d9/31/b4d9319e-e4a8-4221-ce16-7eebe39695be/3616553818961.jpg/1200x1200bb.jpg',
  'ashamgy': 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/37/10/7c/37107c11-9a70-8b1d-fc30-c322d7ba59eb/3616848805362.jpg/1200x1200bb.jpg',
  'عشأنجي': 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/37/10/7c/37107c11-9a70-8b1d-fc30-c322d7ba59eb/3616848805362.jpg/1200x1200bb.jpg',
  'tegy nrahan': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/7c/4f/7b/7c4f7b49-bdf3-85f2-95f2-6c39bb2f9746/3616843477816.jpg/1200x1200bb.jpg',
  'تيجي نتراهن': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/7c/4f/7b/7c4f7b49-bdf3-85f2-95f2-6c39bb2f9746/3616843477816.jpg/1200x1200bb.jpg',
  'ayam': 'https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/6c/0e/41/6c0e4171-897b-bb68-ea48-fbf5272a2754/859730591025_Cover.jpg/1200x1200bb.jpg',
  'أيام': 'https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/6c/0e/41/6c0e4171-897b-bb68-ea48-fbf5272a2754/859730591025_Cover.jpg/1200x1200bb.jpg'
};

export function getAlbumArtwork(albumOrName, fallbackCover = '') {
  const name = typeof albumOrName === 'string' ? albumOrName : (albumOrName?.name || '');
  const cleanKey = name.replace(/^Album\s*[-–—:]\s*/i, '').trim().toLowerCase();
  if (OFFICIAL_ALBUM_COVERS[cleanKey]) {
    return OFFICIAL_ALBUM_COVERS[cleanKey];
  }
  const cover = (typeof albumOrName === 'object' && albumOrName?.cover) ? albumOrName.cover : fallbackCover;
  if (cover && !cover.includes('hqdefault.jpg') && !cover.includes('i.ytimg.com/vi/')) {
    return cover;
  }
  for (const [key, val] of Object.entries(OFFICIAL_ALBUM_COVERS)) {
    if (cleanKey.includes(key) || key.includes(cleanKey)) {
      return val;
    }
  }
  return cover || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Album')}&background=082621&color=26c4b7&size=512&bold=true&format=svg`;
}

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
    isQuran,
    totalPlays,
    bio,
    avatar,
    banner,
    isVerified,
    remoteData
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

      {/* ── 1. Artist Hero Section ── */}
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

      {/* ── 2. Discography & Albums Section ── */}
      <ArtistAlbumsGrid
        artistAlbums={artistAlbums}
        isQuran={isQuran}
        isAdmin={isAdmin}
        isDark={isDark}
        onOpenAlbum={handleOpenAlbum}
        onOpenAddAlbum={() => setIsAddAlbumOpen(true)}
        openEditAlbumModal={openEditAlbumModal}
      />

      {/* ── 3. Popular Songs / All Tracks ── */}
      <ArtistTrackList
        artistTracks={artistTracks}
        isQuran={isQuran}
        isDark={isDark}
        onSelectTrack={onSelectTrack}
        onSelectArtist={onSelectArtist}
        onOpenActionMenu={(track) => setActionMenuTrack(track)}
        toggleLike={toggleLike}
      />

      {/* ── 4. Artist Biography / About Section ── */}
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
