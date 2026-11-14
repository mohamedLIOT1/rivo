import { usePreferences } from '../context/PreferencesContext';
import { useUser } from '../context/UserContext';
import React, { useState, useMemo } from 'react';
import { Home, Search, Disc, Plus, Heart, User, Radio, Podcast, DownloadCloud, MessageSquare, Command, Users, Sparkles, Link2, Music, ShieldCheck, BookOpen, Activity, WifiOff, Settings } from 'lucide-react';
import VerifiedBadge, { isUserVerified } from './VerifiedBadge';
import { isUserAdmin } from '../utils/adminUtils';
import { isQuranContent } from '../utils/quranUtils';
import { isPodcastContent } from '../utils/podcastUtils';
import { buildUrl } from '../utils/router';
import RivoLogo from './RivoLogo';
import { normalizeCoverUrl, handleCoverImageError } from '../utils/coverUtils';
import { getCanonicalArtistAvatar } from '../utils/canonicalArtistAvatars';
import { CANONICAL_RECITERS } from '../utils/canonicalRecitersData';

function Navigation({ 
  currentScreen = 'home', 
  setCurrentScreen = () => {}, 
  playlists = [], 
  openCreatePlaylistModal = () => {}, 
  openSettings = () => {},
  openAddSongModal = () => {},
  openAuthModal = () => {},
  openImportPlaylistModal = () => {},
  openImportSongModal = () => {},
  openJamModal = () => {},
  openChatModal = () => {},
  openShortcutsModal = () => {},
  unreadChatCount = 0,
  currentUser,
  isActivityPanelOpen = false,
  toggleActivityPanel = () => {},
  globalTheme = 'dark',
  libraryMode = 'music',
  likedTrackIds = [],
  tracks = [],
  selectedPlaylist = null,
  onSelectLikedSongs,
  onSelectPlaylist,
  onSelectArtist = () => {},
}) {
  const isDark = globalTheme === 'dark';
  const [libraryFilter, setLibraryFilter] = useState('all');
  const { followedArtists = [] } = useUser ? useUser() : { followedArtists: [] };

  const filteredLikedCount = useMemo(() => {
    if (!likedTrackIds || likedTrackIds.length === 0) return 0;
    if (Array.isArray(tracks) && tracks.length > 0) {
      const likedSet = new Set(likedTrackIds.map(String));
      const matching = tracks.filter(t => likedSet.has(String(t.id || t._id)));
      return matching.filter(t => {
        const isQ = Boolean(t.isQuran || isQuranContent(t));
        const isP = Boolean(t.isPodcast || isPodcastContent(t));
        if (libraryMode === 'quran') return isQ && !isP;
        if (libraryMode === 'podcasts') return isP && !isQ;
        return !isQ && !isP;
      }).length;
    }
    return libraryMode === 'music' ? likedTrackIds.length : 0;
  }, [likedTrackIds, tracks, libraryMode]);

  const isInstalledClient = typeof window !== 'undefined' && Boolean(
    window.RIVO_DESKTOP || 
    window.chrome?.webview || 
    window.RIVO_NATIVE || 
    window.ReactNativeWebView ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
  );

  const { showMusic, showQuran, showPodcasts, t, isRTL } = usePreferences();

  const mainNavItems = [
    ...(showMusic ? [{ id: 'home', label: t('nav.home'), icon: Home }] : []),
    { id: 'search', label: t('nav.search'), icon: Search },
    ...(showQuran ? [{ id: 'quran', label: t('nav.quran'), icon: BookOpen }] : []),
    ...(showPodcasts ? [{ id: 'podcasts', label: t('nav.podcasts') || 'Podcasts', icon: Podcast }] : []),
    ...(!isInstalledClient ? [
      { id: 'download', label: t('nav.download') || t('nav.downloadApp') || 'Download App', icon: DownloadCloud }
    ] : []),
    { id: 'stats', label: t('nav.stats'), icon: Activity },
    ...(currentUser && isUserAdmin(currentUser) ? [
      { id: 'admin', label: t('nav.admin'), icon: ShieldCheck }
    ] : [])
  ];

  const mobileNavItems = [
    ...(showMusic ? [{ id: 'home', label: t('nav.music'), icon: Music }] : []),
    ...(showQuran ? [{ id: 'quran', label: t('nav.quran'), icon: BookOpen }] : []),
    ...(showPodcasts ? [{ id: 'podcasts', label: t('nav.podcasts') || 'Podcasts', icon: Podcast }] : []),
    { id: 'library', label: t('nav.library'), icon: Disc },
    { id: 'search', label: t('nav.search'), icon: Search },
  ];

  const safePlaylists = (Array.isArray(playlists) ? playlists : [])
    .filter(pl => {
      const isQ = Boolean(pl.isQuran || isQuranContent(pl));
      const isP = Boolean(pl.isPodcast || isPodcastContent(pl));
      if (libraryMode === 'quran') return isQ && !isP;
      if (libraryMode === 'podcasts') return isP && !isQ;
      return !isQ && !isP;
    })
    .filter(pl => {
      const name = (pl.name || '').trim().toLowerCase();
      return name !== 'liked songs' && name !== 'liked prescriptions' && pl.id !== 'liked' && !pl.isLikedSongs;
    });
  const filteredPlaylists = safePlaylists.filter(pl => {
    if (libraryFilter === 'playlists') return !pl.isArtistMix;
    if (libraryFilter === 'artists') return Boolean(pl.isArtistMix);
    return true;
  });

  return (
    <>
      {/* =============================================
          DESKTOP LEFT APOTHECARY SIDEBAR
          ============================================= */}
      <aside 
        className={`hidden md:flex flex-col h-full shrink-0 brutal-border border-y-0 border-l-0 p-3 justify-between select-none overflow-hidden transition-colors ${
          isDark 
            ? 'bg-[#101716] border-zinc-800 text-white' 
            : 'bg-[#fdfbf7] border-[#0b1110] text-[#0b1110]'
        }`} 
        style={{ width: 'var(--nav-width)' }}
      >
        <div className="flex flex-col h-full gap-2.5 overflow-hidden">
          


          {/* ── Primary Navigation: Discover ── */}
          <div className="space-y-0.5 shrink-0">
            <div className={`text-[10px] font-mono font-black uppercase px-2 mb-1 tracking-wider ${
              isDark ? 'text-zinc-500' : 'text-zinc-500'
            }`}>
              {t('nav.discover') || 'Discover'}
            </div>

            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const active = currentScreen === item.id;
              const isAdminItem = item.id === 'admin';
              return (
                <a
                  key={item.id}
                  href={buildUrl(item.id)}
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentScreen(item.id);
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg font-display font-bold text-xs transition-all brutal-btn cursor-pointer ${
                    active 
                      ? (isAdminItem ? 'bg-[#f59e0b] text-[#0b1110] brutal-shadow-sm brutal-border font-black' : 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm brutal-border font-black')
                      : isDark
                        ? (isAdminItem ? 'text-[#f59e0b] hover:bg-zinc-800/80' : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white')
                        : (isAdminItem ? 'text-[#f59e0b] hover:bg-[#ede5d3]' : 'text-[#0b1110] hover:bg-[#ede5d3]')
                  }`}
                >
                  <Icon 
                    size={17} 
                    className={active ? 'text-[#0b1110] shrink-0' : isAdminItem ? 'text-[#f59e0b] shrink-0' : isDark ? 'text-zinc-400 shrink-0' : 'text-zinc-600 shrink-0'}
                    strokeWidth={2.5}
                  />
                  <span>{item.label}</span>
                </a>
              );
            })}
          </div>

          {/* ── Prominent Live Jam Button ── */}
          <button
            onClick={openJamModal}
            className={`w-full shrink-0 flex items-center justify-between px-3 py-2 rounded-xl brutal-border font-display font-black text-xs cursor-pointer transition brutal-shadow-sm ${
              isDark 
                ? 'bg-[#17a398]/15 border-[#17a398] text-[#26c4b7] hover:bg-[#17a398]/30' 
                : 'bg-[#17a398]/20 border-[#0b1110] text-[#082621] hover:bg-[#17a398]/35'
            }`}
            title="Start or Join a Real-Time Live Jam Room"
          >
            <div className="flex items-center gap-2.5">
              <Radio size={16} className="text-[#17a398] animate-pulse" strokeWidth={2.5} />
              <span>{t('nav.liveJam') || 'Live Jam'}</span>
            </div>
            <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-[#17a398] text-[#0b1110]">
              RADIO
            </span>
          </button>

          {/* ── "Your Dispensary" Library Section ── */}
          <div className={`pt-2 border-t-2 border-dashed flex-1 flex flex-col min-h-0 ${
            isDark ? 'border-zinc-800' : 'border-[#ded2bb]'
          }`}>
            <div className="flex items-center justify-between px-2 mb-2">
              <button
                onClick={() => {
                  if (libraryMode === 'podcasts') setCurrentScreen('podcasts');
                  else if (libraryMode === 'quran') setCurrentScreen('quran');
                  else setCurrentScreen('library');
                }}
                className={`flex items-center gap-1.5 text-[11px] font-display font-bold hover:underline cursor-pointer ${
                  (libraryMode === 'podcasts' ? currentScreen === 'podcasts' : libraryMode === 'quran' ? currentScreen === 'quran' : currentScreen === 'library')
                    ? 'text-[#17a398]'
                    : isDark ? 'text-zinc-200' : 'text-[#0b1110]'
                }`}
                title="View full library"
              >
                <Disc size={15} className="text-[#17a398]" strokeWidth={2.5} />
                <span>
                  {libraryMode === 'quran' 
                    ? (t('nav.quranLibrary') || 'Quran Library') 
                    : libraryMode === 'podcasts'
                    ? (t('nav.podcastsLibrary') || (isRTL ? 'مكتبة البودكاست' : 'Podcast Library'))
                    : (t('nav.yourLibrary') || 'Your Library')}
                </span>
              </button>

              <div className="flex items-center gap-1">
                <button
                  onClick={openImportSongModal}
                  title={libraryMode === 'quran' 
                    ? (isRTL ? "استيراد عبر الرابط (سورة أو قائمة)" : "Import by Link (Surah / Playlist)") 
                    : (isRTL ? "استيراد عبر الرابط (أغنية أو قائمة)" : "Import by Link (Track / Playlist)")}
                  className={`w-6 h-6 rounded brutal-border flex items-center justify-center font-bold text-xs transition ${
                    isDark 
                      ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-[#17a398]' 
                      : 'bg-white hover:bg-[#ede5d3] text-[#082621]'
                  }`}
                >
                  <Link2 size={12} />
                </button>
                <button
                  onClick={openCreatePlaylistModal}
                  title={libraryMode === 'quran' ? "New Quran Playlist" : "New Playlist"}
                  className="w-6 h-6 rounded brutal-border bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] flex items-center justify-center font-bold text-xs transition brutal-shadow-sm"
                >
                  +
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex gap-1 mb-2 px-1">
              {[
                { id: 'all', label: t('nav.all') || 'All' },
                { id: 'playlists', label: libraryMode === 'podcasts' ? (isRTL ? 'البرامج' : 'Shows') : (t('nav.playlists') || 'Playlists') },
                { id: 'artists', label: libraryMode === 'quran' ? (t('nav.reciters') || 'Reciters') : libraryMode === 'podcasts' ? (isRTL ? 'صناع المحتوى' : 'Creators') : (t('nav.artists') || 'Artists') },
              ].map(({ id: filterId, label: filterLabel }) => {
                const active = libraryFilter === filterId;
                return (
                  <button
                    key={filterId}
                    onClick={() => setLibraryFilter(filterId)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                      active
                        ? 'bg-[#17a398] text-[#0b1110] brutal-border font-black'
                        : isDark
                          ? 'bg-zinc-800/80 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
                          : 'bg-white text-zinc-700 border border-[#0b1110] hover:bg-[#ede5d3]'
                    }`}
                  >
                    {filterLabel}
                  </button>
                );
              })}
            </div>

            {/* Playlists / Artists List */}
            <div className="flex-1 min-h-[160px] overflow-y-auto space-y-1.5 pr-1 pb-1 text-xs font-bold">
              {/* If Artists filter is selected, render Followed Artists or Reciters */}
              {libraryFilter === 'artists' ? (() => {
                const isQuran = libraryMode === 'quran';
                let displayItems = [];

                if (isQuran) {
                  const userReciters = (followedArtists || []).filter(name => isQuranContent(name));
                  if (userReciters.length > 0) {
                    displayItems = userReciters.map(name => ({ name, isReciter: true }));
                  } else {
                    displayItems = (CANONICAL_RECITERS || []).slice(0, 8).map(r => ({ name: r.name, isReciter: true, cover: r.cover }));
                  }
                } else {
                  displayItems = (followedArtists || [])
                    .filter(name => !isQuranContent(name))
                    .map(name => ({ name, isReciter: false }));
                }

                if (displayItems.length === 0) {
                  return (
                    <div className={`p-4 text-center rounded-lg border border-dashed ${
                      isDark ? 'bg-zinc-900/60 border-zinc-700' : 'bg-white border-zinc-400'
                    }`}>
                      <p className={`text-xs font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-800'}`}>
                        {isQuran 
                          ? (isRTL ? 'لا يوجد قراء محددون' : 'No reciters found')
                          : (isRTL ? 'لا تتابع أي فنانين بعد' : 'No followed artists yet')}
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-1">
                        {isQuran
                          ? (isRTL ? 'اختر قارئاً من شاشة القرآن' : 'Select a reciter from Quran screen')
                          : (isRTL ? 'افتح بروفايل أي فنان واضغط متابعة للوصول السريع هنا' : 'Follow artists to access them quickly here')}
                      </p>
                    </div>
                  );
                }

                return displayItems.map((item, idx) => {
                  const artName = typeof item === 'string' ? item : item.name;
                  const isRec = Boolean(item.isReciter);
                  const avatarUrl = item.cover || getCanonicalArtistAvatar(artName);

                  return (
                    <div
                      key={artName + idx}
                      onClick={() => onSelectArtist && onSelectArtist(artName)}
                      className={`p-2 rounded-lg brutal-border flex items-center justify-between cursor-pointer transition group ${
                        isDark 
                          ? 'bg-zinc-900/90 border-zinc-800 hover:bg-zinc-800 text-white' 
                          : 'bg-white hover:bg-[#ede5d3] text-[#0b1110]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {avatarUrl ? (
                          <img
                            src={normalizeCoverUrl(avatarUrl)}
                            alt={artName}
                            className="w-7 h-7 rounded-full object-cover shrink-0 border border-black/20 bg-zinc-800"
                            onError={handleCoverImageError}
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-[#17a398] text-[#0b1110] flex items-center justify-center shrink-0 font-black text-xs border border-black/20">
                            {artName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="truncate flex-1 min-w-0">
                          <div className={`truncate leading-none text-xs font-black ${isDark ? 'text-zinc-200' : 'text-[#0b1110]'}`} dir={isRTL ? "rtl" : "ltr"}>
                            {artName}
                          </div>
                          <span className="text-[10px] font-mono text-zinc-500 font-normal block truncate mt-0.5">
                            {isRec ? (isRTL ? 'قارئ قرآن' : 'Quran Reciter') : (isRTL ? 'فنان متابع' : 'Followed Artist')}
                          </span>
                        </div>
                      </div>
                      <span className={`text-[8px] font-mono font-black px-1.5 py-0.5 rounded shrink-0 ${
                        isDark ? 'bg-zinc-800 text-[#17a398]' : 'bg-[#ded2bb] text-[#0b1110]'
                      }`}>
                        {isRec ? (isRTL ? 'قارئ' : 'RECITER') : 'ARTIST'}
                      </span>
                    </div>
                  );
                });
              })() : (
                <>
                  {/* Liked Songs / Favorite Surahs */}
                  <div
                    onClick={() => {
                      if (onSelectLikedSongs) {
                        onSelectLikedSongs();
                      } else {
                        setCurrentScreen('playlist:liked');
                      }
                    }}
                    className={`p-2 rounded-lg brutal-border flex items-center justify-between cursor-pointer transition group ${
                      (currentScreen === 'playlist' && (selectedPlaylist?.isLikedSongs || selectedPlaylist?.id === 'liked')) || currentScreen === 'liked'
                        ? isDark ? 'bg-zinc-800 border-zinc-600 brutal-shadow-sm text-white font-black' : 'bg-[#ede5d3] text-[#0b1110] brutal-shadow-sm font-black'
                        : isDark 
                          ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-white' 
                          : 'bg-white hover:bg-[#ede5d3] text-[#0b1110]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-6 h-6 rounded bg-[#dc2626] text-white flex items-center justify-center shrink-0">
                        <Heart size={12} fill="currentColor" />
                      </div>
                      <div className="truncate flex-1 min-w-0">
                        <div className={`truncate leading-none ${isDark ? 'text-zinc-200' : 'text-[#0b1110]'}`} dir={isRTL ? "rtl" : "ltr"}>
                          {libraryMode === 'quran' 
                            ? (t('library.favoriteSurahs') || 'Favorite Surahs') 
                            : libraryMode === 'podcasts'
                            ? (t('library.likedPodcasts') || (isRTL ? 'الحلقات المعجب بها' : 'Liked Episodes'))
                            : (t('library.likedSongs') || 'Liked Songs')}
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 font-normal block truncate" dir={isRTL ? "rtl" : "ltr"}>
                          {filteredLikedCount > 0
                            ? `${filteredLikedCount} ${libraryMode === 'quran' 
                                ? (filteredLikedCount === 1 ? (t('library.surahSingle') || 'سورة') : (t('library.surahPlural') || 'سور')) 
                                : libraryMode === 'podcasts'
                                ? (filteredLikedCount === 1 ? (isRTL ? 'حلقة' : 'episode') : (isRTL ? 'حلقات' : 'episodes'))
                                : (filteredLikedCount === 1 ? (t('library.songSingle') || 'أغنية') : (t('library.songPlural') || 'أغانٍ'))}`
                            : (libraryMode === 'quran' ? (t('library.favoriteSurahs') || 'Favorites') : libraryMode === 'podcasts' ? (t('library.likedPodcasts') || 'Favorites') : (t('library.likedSongs') || 'Favorites'))}
                        </span>
                      </div>
                    </div>
                    {filteredLikedCount > 0 && (
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                        isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-[#ded2bb] text-[#0b1110]'
                      }`}>
                        {filteredLikedCount}
                      </span>
                    )}
                  </div>

                  {filteredPlaylists.map((pl, idx) => {
                    const plId = pl.id || pl._id;
                    const isActive = currentScreen === `playlist:${plId}` || (currentScreen === 'playlist' && String(selectedPlaylist?.id || selectedPlaylist?._id) === String(plId));
                    const count = (pl.trackIds || []).length;
                    const colors = ['#1e3a8a', '#f59e0b', '#0f756d', '#dc2626', '#ec4899'];
                    const badgeColor = colors[idx % colors.length];

                    return (
                      <div
                        key={plId || idx}
                        onClick={() => onSelectPlaylist ? onSelectPlaylist(pl) : setCurrentScreen(`playlist:${plId}`)}
                        className={`p-2 rounded-lg brutal-border flex items-center justify-between cursor-pointer transition ${
                          isActive 
                            ? isDark ? 'bg-zinc-800 border-zinc-600 brutal-shadow-sm' : 'bg-[#ede5d3] brutal-shadow-sm'
                            : isDark ? 'bg-zinc-900/90 border-zinc-800 hover:bg-zinc-800 text-zinc-300' : 'bg-white hover:bg-[#ede5d3]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {pl.cover ? (
                            <img 
                              src={normalizeCoverUrl(pl.cover)} 
                              alt={pl.name} 
                              className="w-6 h-6 rounded object-cover border border-zinc-700 shrink-0" 
                              onError={handleCoverImageError}
                            />
                          ) : (
                            <div 
                              className="w-6 h-6 rounded text-white flex items-center justify-center shrink-0 font-mono text-[10px] font-bold"
                              style={{ backgroundColor: badgeColor }}
                            >
                              {pl.name ? pl.name[0].toUpperCase() : 'P'}
                            </div>
                          )}
                          <div className="truncate flex-1 min-w-0">
                            <div className={`truncate leading-none ${isDark ? 'text-zinc-200' : 'text-[#0b1110]'}`} dir={isRTL ? "rtl" : "ltr"}>{pl.name}</div>
                            <span className="text-[10px] font-mono text-zinc-500 font-normal block truncate" dir={isRTL ? "rtl" : "ltr"}>
                              {count} {isQuranContent(pl) || libraryMode === 'quran' 
                                ? (count === 1 ? (t('library.surahSingle') || 'سورة') : (t('library.surahPlural') || 'سور')) 
                                : (pl.isPodcast || isPodcastContent(pl) || libraryMode === 'podcasts')
                                ? (count === 1 ? (isRTL ? 'حلقة' : 'episode') : (isRTL ? 'حلقات' : 'episodes'))
                                : (count === 1 ? (t('library.songSingle') || 'أغنية') : (t('library.songPlural') || 'أغانٍ'))}
                            </span>
                          </div>
                        </div>
                        <span className={`text-[8px] font-mono font-bold px-1 py-0.5 rounded shrink-0 ${
                          isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-[#ede5d3] text-[#0b1110]'
                        }`}>
                          {isQuranContent(pl) || libraryMode === 'quran' ? 'QURAN' : (pl.isPodcast || isPodcastContent(pl) || libraryMode === 'podcasts') ? 'PODCAST' : 'LIST'}
                        </span>
                      </div>
                    );
                  })}

                  {filteredPlaylists.length === 0 && (
                    <div className={`p-3 text-center rounded-lg border border-dashed ${
                      isDark ? 'bg-zinc-900/60 border-zinc-700' : 'bg-white border-zinc-400'
                    }`}>
                      <p className={`text-[11px] font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}>
                        {libraryMode === 'quran' 
                          ? (t('library.noQuranPlaylistsYet') || 'No Quran playlists yet') 
                          : libraryMode === 'podcasts'
                          ? (isRTL ? 'لا توجد قوائم بودكاست بعد' : 'No podcast playlists yet')
                          : (t('library.noPlaylistsYet') || 'No playlists yet')}
                      </p>
                      <button
                        onClick={openCreatePlaylistModal}
                        className="mt-1.5 px-2.5 py-1 bg-[#17a398] text-[#0b1110] text-[10px] font-bold rounded brutal-border brutal-shadow-sm"
                      >
                        + {libraryMode === 'quran' 
                          ? (t('library.createQuranPlaylist') || 'Create Quran Playlist') 
                          : libraryMode === 'podcasts'
                          ? (isRTL ? 'إنشاء قائمة بودكاست' : 'Create Podcast Playlist')
                          : (t('library.createPlaylist') || 'Create Playlist')}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

          </div>

          {/* ── Switch to Offline Mode Button (visible on mobile / tablet screens <= 1024px) ── */}
          <div className="block lg:hidden mt-auto mb-1.5 shrink-0">
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'SET_APP_MODE',
                    mode: 'offline'
                  }));
                }
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl brutal-border font-bold text-xs cursor-pointer transition ${
                isDark ? 'bg-[#0b1110] border-[#17a398] text-[#26c4b7] hover:bg-[#17a398]/20' : 'bg-white border-[#17a398] text-[#082621] hover:bg-[#17a398]/10'
              }`}
              title="Switch to Offline Mode (Local Vault)"
            >
              <div className="flex items-center gap-2">
                <WifiOff size={15} className="text-[#17a398]" strokeWidth={2.5} />
                <span>{t('library.offlineVault') || 'الخزنة المحلية'}</span>
              </div>
              <span className="text-[8px] font-mono font-black px-1.5 py-0.5 rounded bg-[#17a398] text-[#0b1110]">
                {isRTL ? 'تبديل' : 'SWITCH'}
              </span>
            </button>
          </div>

          {/* ── User & Shortcuts Bar (Bottom) ── */}
          <div className={`p-2 rounded-xl brutal-border flex items-center justify-between gap-2.5 mt-auto shrink-0 ${
            isDark ? 'bg-[#141d1b] border-zinc-800' : 'bg-[#ede5d3] border-black'
          }`}>
            <button
              onClick={() => {
                if (currentUser) {
                  setCurrentScreen('profile');
                } else {
                  openAuthModal();
                }
              }}
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer group"
              title={currentUser ? "Account Profile" : "Log In"}
            >
              <div className="w-9 h-9 rounded-lg bg-[#17a398] brutal-border flex items-center justify-center font-display font-black text-xs text-[#0b1110] brutal-shadow-sm shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
                {currentUser?.avatar ? (
                  <img 
                    src={currentUser.avatar} 
                    alt="Profile" 
                    className="w-full h-full object-cover" 
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  currentUser?.name?.[0] || 'R'
                )}
              </div>
              <div className="min-w-0 flex-1 flex flex-col justify-center pt-1">
                <div className={`text-xs font-display font-black truncate flex items-center gap-1 leading-snug ${
                  isDark ? 'text-zinc-100 group-hover:text-white' : 'text-[#0b1110] group-hover:text-black'
                }`}>
                  <span className="truncate">{currentUser ? currentUser.name : 'Sign In'}</span>
                  {currentUser && isUserVerified(currentUser) && <VerifiedBadge size={13} />}
                </div>
                <div className="mt-0.5 flex items-center gap-1">
                  <span 
                    onClick={(e) => {
                      if (currentUser && isUserAdmin(currentUser)) {
                        e.stopPropagation();
                        setCurrentScreen('admin');
                      }
                    }}
                    className={`inline-flex items-center text-[8px] font-mono font-black uppercase px-1.5 py-0.5 rounded brutal-border leading-none ${
                      currentUser && isUserAdmin(currentUser) 
                        ? 'bg-[#f59e0b] text-[#0b1110] hover:scale-105 transition-transform cursor-pointer' 
                        : currentUser 
                          ? 'bg-[#17a398] text-[#0b1110]' 
                          : 'bg-[#f59e0b] text-[#0b1110]'
                    }`}
                    title={currentUser && isUserAdmin(currentUser) ? "Open Admin Portal (/admin)" : undefined}
                  >
                    {currentUser && isUserAdmin(currentUser) ? 'ADMIN' : currentUser ? 'ONLINE' : 'GUEST'}
                  </span>
                </div>
              </div>
            </button>

            <button
              onClick={openSettings}
              title="Audio & App Settings"
              className={`w-9 h-9 rounded-lg brutal-border flex items-center justify-center transition shrink-0 cursor-pointer ${
                isDark 
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white' 
                  : 'bg-white border-[#0b1110] text-[#0b1110] hover:bg-[#ded2bb]'
              }`}
            >
              <Settings size={15} strokeWidth={2.5} />
            </button>

            {openShortcutsModal && (
              <button
                onClick={openShortcutsModal}
                title="Keyboard Shortcuts (?)"
                className={`w-9 h-9 rounded-lg brutal-border flex items-center justify-center transition shrink-0 cursor-pointer ${
                  isDark 
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white' 
                    : 'bg-white border-[#0b1110] text-[#0b1110] hover:bg-[#ded2bb]'
                }`}
              >
                <Command size={14} strokeWidth={2.5} />
              </button>
            )}
          </div>

        </div>
      </aside>

      {/* =============================================
          MOBILE BOTTOM NAVIGATION — Rivo Apothecary Style
          ============================================= */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-40 brutal-border-thick border-x-0 border-b-0 h-[58px] px-3 flex items-center justify-around shadow-2xl transition-colors ${
        isDark 
          ? 'bg-[#101716] border-zinc-800 text-white' 
          : 'bg-[#fdfbf7] border-black text-[#0b1110]'
      }`}>
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const active = currentScreen === item.id;

          return (
            <a
              key={item.id}
              href={buildUrl(item.id)}
              onClick={(e) => {
                e.preventDefault();
                setCurrentScreen(item.id);
              }}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition ${
                active 
                  ? 'bg-[#17a398] text-[#0b1110] brutal-border font-bold' 
                  : isDark 
                    ? 'text-zinc-400 hover:text-white' 
                    : 'text-[#0b1110]'
              }`}
            >
              <Icon 
                size={18} 
                className={active ? 'text-[#0b1110]' : isDark ? 'text-zinc-400' : 'text-[#0b1110]'} 
                strokeWidth={2.5} 
              />
              <span className="text-[9px] font-display font-bold">
                {item.label}
              </span>
            </a>
          );
        })}

        {/* Mobile Messages Button */}
        <button
          onClick={openChatModal}
          className={`relative flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition ${
            isDark ? 'text-zinc-400 hover:text-white' : 'text-[#0b1110]'
          }`}
        >
          <div className="relative">
            <MessageSquare size={18} className={isDark ? 'text-zinc-400' : 'text-[#0b1110]'} strokeWidth={2.5} />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-[#dc2626] text-white text-[8px] font-mono px-1 rounded-full font-bold brutal-border">
                {unreadChatCount}
              </span>
            )}
          </div>
          <span className="text-[9px] font-display font-bold">
            Chat
          </span>
        </button>
      </nav>
    </>
  );
}

export default React.memo(Navigation);
