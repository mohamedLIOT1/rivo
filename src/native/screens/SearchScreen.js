import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import {
  Search as SearchIcon,
  X,
  Disc,
  Music,
  Users,
  Layers,
  ArrowRight,
  ShieldCheck,
  User,
  Radio,
  Mic,
} from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/colors';
import { API_BASE_URL } from '../config';
import CassetteTag from '../ui/CassetteTag';
import SongItem from '../ui/SongItem';
import AlbumDetailModal from '../components/AlbumDetailModal';
import ArtistDetailModal from '../components/ArtistDetailModal';
import UserDetailModal from '../components/UserDetailModal';
import SongRadarModal from '../components/SongRadarModal';
import { isQuranContent } from '../../utils/quranUtils';
import { splitArtists } from '../../utils/artistUtils.jsx';
import { normalizeCoverUri } from '../utils/coverUtils';

const DISPENSARY_GENRES = [
  { id: 'rap', label: 'EGYPTIAN RAP', color: '#17a398', tag: 'TRAP / DRILL' },
  { id: 'indie', label: 'INDIE ARABIC', color: '#f59e0b', tag: 'ACOUSTIC' },
  { id: 'mahraganat', label: 'MAHRAGANAT', color: '#dc2626', tag: 'STREET BASS' },
  { id: 'tarab', label: 'TARAB RETRO', color: '#8b5cf6', tag: 'CLASSIC CASSETTE' },
  { id: 'lofi', label: 'CAIRO LOFI', color: '#06b6d4', tag: 'CHILL BEATS' },
  { id: 'electronic', label: 'CLUB SYNTH', color: '#ec4899', tag: 'TECHNO / HOUSE' },
  { id: 'pop', label: 'ARABIC POP', color: '#10b981', tag: 'TOP CHARTS' },
  { id: 'shaabi', label: 'SHAABI RETRO', color: '#f97316', tag: 'VINTAGE TAPE' },
  { id: 'rock', label: 'ORIENTAL ROCK', color: '#ef4444', tag: 'DISTORTION' },
  { id: 'quran', label: 'QURAN TARTIL', color: '#047857', tag: 'RECITATION' },
  { id: 'ambient', label: 'NIGHT AMBIENT', color: '#6366f1', tag: 'FOCUS DEEP' },
];

export default function SearchScreen({ onTrackAction, onOpenChat, onOpenFullPlayer, onSelectAlbum, onSelectArtist, initialQuery = '', onQueryChange }) {
  const { width } = useWindowDimensions();
  const numColumns = width >= 1024 ? 5 : width >= 768 ? 4 : width >= 600 ? 3 : 2;
  const albumGap = 10;
  const albumPadding = 28;
  const albumCardWidth = Math.floor((width - albumPadding - (numColumns - 1) * albumGap) / numColumns);

  const genreColumns = width >= 1024 ? 4 : width >= 600 ? 3 : 2;
  const genreCardWidth = Math.floor((width - albumPadding - (genreColumns - 1) * albumGap) / genreColumns);

  const { playTrack, tracks: audioTracks, downloadedTracks = [] } = useAudioPlayer();
  const { tracks: userTracks, albums: userAlbums = [], fetchPublicTracks } = useUser();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (fetchPublicTracks) await fetchPublicTracks();
    } catch {}
    finally {
      setIsRefreshing(false);
    }
  };
  const { appMode } = useConnectivity();
  const { isDark } = useTheme();

  const [query, setQuery] = useState(initialQuery || '');

  useEffect(() => {
    if (initialQuery !== undefined && initialQuery !== query) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  const handleQueryChange = (txt) => {
    setQuery(txt);
    if (onQueryChange) onQueryChange(txt);
    if (activeFilter !== 'all' && !txt.trim()) setActiveFilter('all');
  };
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'songs' | 'artists' | 'albums' | 'people'
  const [remoteResults, setRemoteResults] = useState([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);
  const [userResults, setUserResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isRadarOpen, setIsRadarOpen] = useState(false);
  const [visibleSongLimit, setVisibleSongLimit] = useState(25);
  const searchTimeoutRef = useRef(null);
  const userSearchTimeoutRef = useRef(null);

  const isOffline = appMode === 'offline';
  const allTracks = isOffline
    ? (Array.isArray(downloadedTracks) ? downloadedTracks : [])
    : ((Array.isArray(userTracks) && userTracks.length > 0) ? userTracks : (Array.isArray(audioTracks) ? audioTracks : []));

  useEffect(() => {
    setVisibleSongLimit(25);
  }, [query, activeFilter]);

  // Live query to server /api/search when connected
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 2 || isOffline || activeFilter === 'people') {
      setRemoteResults([]);
      setIsSearchingRemote(false);
      return;
    }

    setIsSearchingRemote(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.success && Array.isArray(data.tracks)) {
            setRemoteResults(data.tracks);
          }
        }
      } catch {}
      setIsSearchingRemote(false);
    }, 450);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query, isOffline, activeFilter]);

  // Live query for people & listeners (fast 150ms debounce)
  useEffect(() => {
    if (userSearchTimeoutRef.current) clearTimeout(userSearchTimeoutRef.current);

    const trimmed = query.trim();
    if (isOffline) {
      setUserResults([]);
      setIsSearchingUsers(false);
      return;
    }

    if (!trimmed && activeFilter !== 'people') {
      setUserResults([]);
      setIsSearchingUsers(false);
      return;
    }

    setIsSearchingUsers(true);
    userSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const url = trimmed
          ? `${API_BASE_URL}/api/users/search?q=${encodeURIComponent(trimmed)}`
          : `${API_BASE_URL}/api/users/search`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data?.success && Array.isArray(data.users)) {
            setUserResults(data.users);
          }
        }
      } catch {}
      setIsSearchingUsers(false);
    }, 150);

    return () => {
      if (userSearchTimeoutRef.current) clearTimeout(userSearchTimeoutRef.current);
    };
  }, [query, activeFilter, isOffline]);

  const normalizeFuzzy = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[-_.\s/\\,:+()~`'"!?#@*&^%$[\]{}|<>]+/g, '')
      .trim();
  };

  // Matching songs
  const filteredTracks = useMemo(() => {
    let localResult = allTracks || [];

    if (selectedGenre) {
      if (selectedGenre === 'quran') {
        localResult = localResult.filter(isQuranContent);
      } else {
        const key = selectedGenre.toLowerCase();
        localResult = localResult.filter(
          (t) =>
            t.genre?.toLowerCase().includes(key) ||
            t.title?.toLowerCase().includes(key) ||
            t.artist?.toLowerCase().includes(key) ||
            t.tags?.some?.((tag) => tag.toLowerCase().includes(key))
        );
      }
    }

    if (query.trim()) {
      const q = query.toLowerCase().trim();
      const fq = normalizeFuzzy(q);
      localResult = localResult.filter(
        (t) =>
          t.title?.toLowerCase().includes(q) ||
          t.artist?.toLowerCase().includes(q) ||
          t.album?.toLowerCase().includes(q) ||
          (fq && normalizeFuzzy(t.title).includes(fq)) ||
          (fq && normalizeFuzzy(t.artist).includes(fq)) ||
          (fq && normalizeFuzzy(t.album).includes(fq))
      );
    }

    // Merge local and remote results (deduplicating)
    const combined = [...localResult];
    const seenIds = new Set(localResult.map(t => String(t._id || t.id || t.audioUrl)));

    for (const r of remoteResults) {
      const rid = String(r._id || r.id || r.audioUrl);
      if (!seenIds.has(rid)) {
        seenIds.add(rid);
        combined.push(r);
      }
    }

    return combined;
  }, [allTracks, query, selectedGenre, remoteResults]);

  // Matching Artists
  const matchingArtists = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    const map = new Map();

    (allTracks || []).forEach((t) => {
      if (!t.artist || isQuranContent(t)) return;
      const artistNames = splitArtists(t.artist);
      artistNames.forEach((name) => {
        const cleanName = (name || '').trim();
        if (!cleanName) return;
        const key = cleanName.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            name: cleanName,
            count: 1,
            cover: t.coverUrl || t.cover,
            tracks: [t],
          });
        } else {
          const entry = map.get(key);
          entry.count += 1;
          entry.tracks.push(t);
        }
      });
    });

    const fq = normalizeFuzzy(q);
    return Array.from(map.values()).filter(
      (a) => a.name.toLowerCase().includes(q) || (fq && normalizeFuzzy(a.name).includes(fq))
    );
  }, [allTracks, query]);

  // Matching Albums
  const matchingAlbums = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    const fq = normalizeFuzzy(q);
    const map = new Map();

    // From DB albums
    (userAlbums || []).forEach((alb) => {
      if (!alb || isQuranContent(alb)) return;
      const key = (alb.name || '').toLowerCase().trim();
      if (key && !map.has(key)) {
        map.set(key, {
          id: alb.id || alb._id,
          name: alb.name,
          artist: alb.artist || 'Various Artists',
          cover: alb.cover || alb.coverUrl,
          tracks: alb.tracks || [],
          trackIds: alb.trackIds || [],
        });
      }
    });

    // Extract from tracks
    (allTracks || []).forEach((t) => {
      if (!t.album || isQuranContent(t)) return;
      const albName = t.album.trim();
      const key = albName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: `album-${key}`,
          name: albName,
          artist: t.artist || 'Various Artists',
          cover: t.coverUrl || t.cover,
          tracks: [t],
        });
      } else {
        const existing = map.get(key);
        if (!existing.tracks) existing.tracks = [];
        existing.tracks.push(t);
      }
    });

    return Array.from(map.values()).filter(
      (a) =>
        (a.name && a.name.toLowerCase().includes(q)) ||
        (a.artist && a.artist.toLowerCase().includes(q)) ||
        (fq && normalizeFuzzy(a.name).includes(fq)) ||
        (fq && normalizeFuzzy(a.artist).includes(fq))
    );
  }, [userAlbums, allTracks, query]);

  const hasSearch = query.trim().length > 0 || Boolean(selectedGenre);

  return (
    <View style={[styles.container, !isDark && styles.containerLight]}>
      {/* Header & Search Bar */}
      <View style={[styles.searchHeader, !isDark && styles.searchHeaderLight]}>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.headerTitle, !isDark && styles.headerTitleLight]}>EXPLORE & SEARCH</Text>
          <CassetteTag label={isOffline ? 'OFFLINE SONGS' : 'ONLINE'} bg={colors.ink} textColor={colors.mint} />
        </View>

        <View style={[styles.inputContainer, !isDark && styles.inputContainerLight]}>
          <SearchIcon size={18} color={!isDark ? '#0b1110' : colors.ink} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, !isDark && { color: '#0b1110' }]}
            placeholder="Search songs, artists, albums..."
            placeholderTextColor={!isDark ? '#78716c' : colors.grayText}
            value={query}
            onChangeText={(txt) => {
              setQuery(txt);
              if (activeFilter !== 'all' && !txt.trim()) setActiveFilter('all');
            }}
            autoCorrect={false}
          />
          {isSearchingRemote && (
            <ActivityIndicator size="small" color={colors.teal} style={{ marginRight: 6 }} />
          )}
          {query.length > 0 && (
            <TouchableOpacity onPress={() => handleQueryChange('')} style={styles.clearBtn}>
              <X size={16} color={colors.ink} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setIsRadarOpen(true)}
            style={styles.radarQuickBtn}
            activeOpacity={0.8}
            accessibilityLabel="Song Radar"
          >
            <Mic size={14} color="#10b981" />
            <Text style={styles.radarQuickBtnText}>RADAR</Text>
          </TouchableOpacity>
        </View>

        {/* Selected Genre Banner */}
        {selectedGenre && (
          <View style={styles.activeGenreBanner}>
            <Text style={styles.activeGenreText}>
              FILTERING: {DISPENSARY_GENRES.find((g) => g.id === selectedGenre)?.label}
            </Text>
            <TouchableOpacity onPress={() => setSelectedGenre(null)} style={styles.removeGenreBtn}>
              <X size={12} color={colors.ink} />
            </TouchableOpacity>
          </View>
        )}

        {/* Search Filter Tabs Row (All / Songs / Artists / Albums) */}
        {query.trim().length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterPillsScroll} contentContainerStyle={styles.filterPillsRow}>
            <TouchableOpacity
              style={[styles.filterPill, !isDark && styles.filterPillLight, activeFilter === 'all' && styles.filterPillActive]}
              onPress={() => setActiveFilter('all')}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterPillText, !isDark && styles.filterPillTextLight, activeFilter === 'all' && styles.filterPillTextActive]}>
                ALL
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, !isDark && styles.filterPillLight, activeFilter === 'songs' && styles.filterPillActive]}
              onPress={() => setActiveFilter('songs')}
              activeOpacity={0.8}
            >
              <Music size={12} color={activeFilter === 'songs' ? '#082621' : (!isDark ? '#57534e' : '#9ca3af')} style={{ marginRight: 4 }} />
              <Text style={[styles.filterPillText, !isDark && styles.filterPillTextLight, activeFilter === 'songs' && styles.filterPillTextActive]}>
                SONGS ({filteredTracks.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, !isDark && styles.filterPillLight, activeFilter === 'artists' && styles.filterPillActive]}
              onPress={() => setActiveFilter('artists')}
              activeOpacity={0.8}
            >
              <Users size={12} color={activeFilter === 'artists' ? '#082621' : (!isDark ? '#57534e' : '#9ca3af')} style={{ marginRight: 4 }} />
              <Text style={[styles.filterPillText, !isDark && styles.filterPillTextLight, activeFilter === 'artists' && styles.filterPillTextActive]}>
                ARTISTS ({matchingArtists.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, !isDark && styles.filterPillLight, activeFilter === 'albums' && styles.filterPillActive]}
              onPress={() => setActiveFilter('albums')}
              activeOpacity={0.8}
            >
              <Layers size={12} color={activeFilter === 'albums' ? '#082621' : (!isDark ? '#57534e' : '#9ca3af')} style={{ marginRight: 4 }} />
              <Text style={[styles.filterPillText, !isDark && styles.filterPillTextLight, activeFilter === 'albums' && styles.filterPillTextActive]}>
                ALBUMS ({matchingAlbums.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, !isDark && styles.filterPillLight, activeFilter === 'people' && styles.filterPillActive]}
              onPress={() => setActiveFilter('people')}
              activeOpacity={0.8}
            >
              <Users size={12} color={activeFilter === 'people' ? '#082621' : (!isDark ? '#57534e' : '#9ca3af')} style={{ marginRight: 4 }} />
              <Text style={[styles.filterPillText, !isDark && styles.filterPillTextLight, activeFilter === 'people' && styles.filterPillTextActive]}>
                PEOPLE ({userResults.length})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.mint}
            colors={[colors.mint]}
          />
        }
      >
        {/* If no query and no selected genre: Show 12 Genre Blister Packs */}
        {!hasSearch && (
          <View style={styles.genresSection}>
            <View style={styles.sectionTitleRow}>
              <Disc size={16} color={colors.mint} />
              <Text style={styles.sectionHeading}>POPULAR GENRES & MOODS</Text>
            </View>

            <View style={styles.genresGrid}>
              {DISPENSARY_GENRES.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.genreCard, { backgroundColor: g.color, width: genreCardWidth }]}
                  activeOpacity={0.85}
                  onPress={() => setSelectedGenre(g.id)}
                >
                  <View style={styles.genreCardInner}>
                    <Text style={styles.genreLabel}>{g.label}</Text>
                    <Text style={styles.genreTag}>{g.tag}</Text>
                    <View style={styles.genreDecoDisc}>
                      <Disc size={36} color="rgba(0,0,0,0.2)" />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── PEOPLE & LISTENERS SECTION (Top priority for people queries) ── */}
        {(activeFilter === 'people' || (hasSearch && activeFilter === 'all' && (userResults.length > 0 || isSearchingUsers))) && (
          <View style={styles.peopleSection}>
            <View style={styles.sectionTitleRow}>
              <Users size={16} color="#06b6d4" strokeWidth={2.4} />
              <Text style={[styles.sectionHeading, !isDark && styles.sectionHeadingLight]}>
                PEOPLE & LISTENERS
              </Text>
              <View style={[styles.countBadge, { backgroundColor: 'rgba(6,182,212,0.15)', borderColor: '#06b6d4' }]}>
                <Text style={[styles.countBadgeText, { color: '#06b6d4' }]}>{userResults.length}</Text>
              </View>
              {isSearchingUsers && (
                <ActivityIndicator size="small" color="#06b6d4" style={{ marginLeft: 6 }} />
              )}
            </View>

            {userResults.length === 0 && !isSearchingUsers ? (
              activeFilter === 'people' && (
                <View style={[styles.emptyContainer, !isDark && { backgroundColor: '#f6f2e8', borderColor: '#0b1110' }]}>
                  <Users size={36} color="#06b6d4" />
                  <Text style={[styles.emptyText, !isDark && { color: '#0b1110' }]}>No listeners found.</Text>
                  <Text style={styles.emptySub}>Try searching with a different user name.</Text>
                </View>
              )
            ) : (
              <ScrollView
                horizontal={activeFilter === 'all'}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={activeFilter === 'all' ? styles.peopleScrollRow : styles.peopleVerticalList}
              >
                {userResults.map((u) => {
                  const initial = (u.name || 'U').charAt(0).toUpperCase();
                  return (
                    <TouchableOpacity
                      key={u.id}
                      style={[
                        activeFilter === 'all' ? styles.personCardHorizontal : styles.personCardVertical,
                        !isDark && styles.personCardLight,
                      ]}
                      onPress={() => setSelectedUser(u)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.personAvatarWrap}>
                        {u.avatar ? (
                          <Image
                            source={{ uri: normalizeCoverUri(u.avatar) }}
                            style={styles.personAvatar}
                          />
                        ) : (
                          <View style={styles.personAvatarFallback}>
                            <Text style={styles.personAvatarInitial}>{initial}</Text>
                          </View>
                        )}
                        {u.isVerified && (
                          <View style={styles.personVerifiedBadge}>
                            <ShieldCheck size={10} color="#082621" />
                          </View>
                        )}
                      </View>

                      <View style={styles.personInfo}>
                        <Text style={[styles.personName, !isDark && styles.personNameLight]} numberOfLines={1}>
                          {u.name}
                        </Text>
                        <Text style={styles.personSub} numberOfLines={1}>
                          {u.followersCount || 0} followers • {(u.publicPlaylists || []).length} crates
                        </Text>
                      </View>

                      <View style={styles.personActionBtn}>
                        <Text style={styles.personActionText}>View</Text>
                        <ArrowRight size={11} color="#06b6d4" />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}

        {/* ── ARTISTS SECTION (Matching Images) ── */}
        {hasSearch && (activeFilter === 'all' || activeFilter === 'artists') && matchingArtists.length > 0 && (
          <View style={styles.artistsSection}>
            <View style={styles.sectionTitleRow}>
              <Users size={16} color="#17a398" strokeWidth={2.4} />
              <Text style={[styles.sectionHeading, !isDark && styles.sectionHeadingLight]}>
                ARTISTS
              </Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{matchingArtists.length}</Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.artistsScrollRow}>
              {matchingArtists.map((artist, idx) => {
                const coverUri = artist.cover;
                return (
                  <TouchableOpacity
                    key={artist.name || idx}
                    style={[styles.artistCard, !isDark && styles.artistCardLight]}
                    onPress={() => onSelectArtist ? onSelectArtist(artist) : setSelectedArtist(artist)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.artistAvatarWrap}>
                      <Image
                        source={{ uri: normalizeCoverUri(coverUri) }}
                        style={styles.artistAvatar}
                        resizeMode="cover"
                      />
                    </View>
                    <Text style={[styles.artistName, !isDark && styles.artistNameLight]} numberOfLines={1}>
                      {artist.name}
                    </Text>
                    <Text style={styles.artistCountPill}>
                      {artist.count} {artist.count === 1 ? 'Song' : 'Songs'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── ALBUMS SECTION (Matching Images) ── */}
        {hasSearch && (activeFilter === 'all' || activeFilter === 'albums') && matchingAlbums.length > 0 && (
          <View style={styles.albumsSection}>
            <View style={styles.sectionTitleRow}>
              <Layers size={16} color="#f59e0b" strokeWidth={2.4} />
              <Text style={[styles.sectionHeading, !isDark && styles.sectionHeadingLight]}>
                ALBUMS
              </Text>
              <View style={[styles.countBadge, { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: '#f59e0b' }]}>
                <Text style={[styles.countBadgeText, { color: '#f59e0b' }]}>{matchingAlbums.length}</Text>
              </View>
            </View>

            <View style={styles.albumsGrid}>
              {matchingAlbums.map((alb, index) => {
                const coverUri = alb.cover || alb.coverUrl || alb.tracks?.[0]?.cover || alb.tracks?.[0]?.coverUrl;
                return (
                  <TouchableOpacity
                    key={alb.id || alb.name || String(index)}
                    style={[styles.albumCard, !isDark && styles.albumCardLight, { width: albumCardWidth }]}
                    onPress={() => onSelectAlbum ? onSelectAlbum(alb) : setSelectedAlbum(alb)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.albumCoverWrap}>
                      <View style={styles.albumCoverPlaceholder}>
                        <Disc size={36} color="#1f3630" strokeWidth={1.5} />
                      </View>
                      <Image
                        source={{ uri: normalizeCoverUri(coverUri) }}
                        style={styles.albumCover}
                        resizeMode="cover"
                      />
                    </View>
                    <Text style={[styles.albumTitle, !isDark && styles.albumTitleLight]} numberOfLines={1}>
                      {alb.name}
                    </Text>
                    <Text style={styles.albumArtist} numberOfLines={1}>
                      {alb.artist || 'Various Artists'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── SONGS SECTION ── */}
        {hasSearch && (activeFilter === 'all' || activeFilter === 'songs') && (
          <View style={styles.resultsSection}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsCount}>
                FOUND {filteredTracks.length} SONGS
              </Text>
            </View>

            {filteredTracks.length === 0 ? (
              <View style={[styles.emptyContainer, !isDark && { backgroundColor: '#f6f2e8', borderColor: '#0b1110' }]}>
                <Disc size={36} color={colors.teal} />
                <Text style={[styles.emptyText, !isDark && { color: '#0b1110' }]}>No matching songs found.</Text>
                <Text style={styles.emptySub}>Try searching for another artist, album or track title.</Text>
              </View>
            ) : (
              <View style={styles.tracksList}>
                {filteredTracks.slice(0, visibleSongLimit).map((track, index) => (
                  <SongItem
                    key={track._id || track.id || index}
                    track={track}
                    index={index + 1}
                    onPlay={(t) => playTrack(t, filteredTracks)}
                    onMorePress={() => onTrackAction && onTrackAction(track)}
                  />
                ))}

                {filteredTracks.length > visibleSongLimit && (
                  <TouchableOpacity
                    style={[styles.loadMoreBtn, !isDark && styles.loadMoreBtnLight]}
                    onPress={() => setVisibleSongLimit((prev) => prev + 25)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.loadMoreText}>
                      SHOW MORE ({filteredTracks.length - visibleSongLimit} MORE TRACKS)
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Album Details Modal */}
      {!onSelectAlbum && (
        <AlbumDetailModal
          visible={Boolean(selectedAlbum)}
          album={selectedAlbum}
          onClose={() => setSelectedAlbum(null)}
          allTracks={allTracks}
          onTrackAction={onTrackAction}
          onOpenFullPlayer={onOpenFullPlayer}
          onSelectArtist={(artistName) => {
            setSelectedAlbum(null);
            setSelectedArtist({ name: artistName });
          }}
        />
      )}

      {/* Artist Details Modal */}
      {!onSelectArtist && (
        <ArtistDetailModal
          visible={Boolean(selectedArtist)}
          artist={selectedArtist}
          onClose={() => setSelectedArtist(null)}
          allTracks={allTracks}
          allAlbums={userAlbums}
          onOpenFullPlayer={onOpenFullPlayer}
          onSelectAlbum={(alb) => {
            setSelectedArtist(null);
            setSelectedAlbum(alb);
          }}
          onTrackAction={onTrackAction}
        />
      )}

      {/* User Details Modal */}
      <UserDetailModal
        visible={Boolean(selectedUser)}
        user={selectedUser}
        userId={selectedUser?.id}
        onClose={() => setSelectedUser(null)}
        onOpenChat={onOpenChat}
        onOpenFullPlayer={onOpenFullPlayer}
      />

      {/* Song Radar Modal — Acoustic Audio & Humming Recognition */}
      <SongRadarModal
        visible={isRadarOpen}
        onClose={() => setIsRadarOpen(false)}
        onOpenAddToPlaylist={onTrackAction}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  containerLight: {
    backgroundColor: '#fdfbf7',
  },
  searchHeader: {
    backgroundColor: colors.deepForest,
    borderBottomWidth: 2.5,
    borderBottomColor: colors.ink,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    maxWidth: 840,
    width: '100%',
    alignSelf: 'center',
  },
  searchHeaderLight: {
    backgroundColor: '#ede5d3',
    borderBottomColor: '#0b1110',
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    fontWeight: '900',
    fontSize: 18,
    color: colors.paper,
    letterSpacing: 0.5,
  },
  headerTitleLight: {
    color: '#0b1110',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 44,
  },
  inputContainerLight: {
    backgroundColor: '#ffffff',
    borderColor: '#0b1110',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    fontWeight: '700',
    color: colors.ink,
  },
  clearBtn: {
    padding: 4,
  },
  radarQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0b1110',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 6,
  },
  radarQuickBtnText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    letterSpacing: 0.5,
  },
  radarBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#081714',
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  radarBannerLight: {
    backgroundColor: '#f4ede1',
    borderColor: '#0b1110',
  },
  radarBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radarBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarBannerTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#10b981',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
  },
  radarBannerSub: {
    fontSize: 10,
    color: colors.grayText,
    marginTop: 2,
  },
  radarPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 0.5,
    borderColor: '#10b981',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  radarPillText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#10b981',
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
  },
  radarBannerArrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textDark: {
    color: '#0b1110',
  },
  textDarkMuted: {
    color: '#57534e',
  },
  activeGenreBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.mint,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 8,
  },
  activeGenreText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.ink,
  },
  removeGenreBtn: {
    padding: 2,
  },
  filterPillsScroll: {
    marginTop: 10,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 2,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#0d1815',
    borderWidth: 1.5,
    borderColor: '#1f332d',
  },
  filterPillLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  filterPillActive: {
    backgroundColor: '#17a398',
    borderColor: '#082621',
  },
  filterPillText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9ca3af',
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
  },
  filterPillTextLight: {
    color: '#0b1110',
  },
  filterPillTextActive: {
    color: '#082621',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 120,
    maxWidth: 840,
    width: '100%',
    alignSelf: 'center',
  },
  genresSection: {
    marginBottom: 20,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionHeading: {
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    fontWeight: '900',
    fontSize: 13,
    color: colors.paper,
    letterSpacing: 0.5,
  },
  sectionHeadingLight: {
    color: '#082621',
  },
  countBadge: {
    backgroundColor: 'rgba(23,163,152,0.15)',
    borderWidth: 1,
    borderColor: '#17a398',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 4,
  },
  countBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#17a398',
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
  },
  genresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  genreCard: {
    height: 84,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  genreCardInner: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
    position: 'relative',
  },
  genreLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    fontWeight: '900',
    fontSize: 13,
    color: colors.ink,
    letterSpacing: 0.3,
  },
  genreTag: {
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    fontWeight: '800',
    fontSize: 9,
    color: 'rgba(0,0,0,0.6)',
  },
  genreDecoDisc: {
    position: 'absolute',
    right: -8,
    bottom: -8,
  },
  artistsSection: {
    marginBottom: 20,
  },
  artistsScrollRow: {
    gap: 12,
    paddingVertical: 4,
  },
  artistCard: {
    width: 100,
    alignItems: 'center',
    backgroundColor: '#0d1815',
    borderWidth: 2,
    borderColor: '#172722',
    borderRadius: 12,
    padding: 10,
  },
  artistCardLight: {
    backgroundColor: '#f6f2e8',
    borderColor: '#0b1110',
  },
  artistAvatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#17a398',
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: '#1f3630',
  },
  artistAvatar: {
    width: '100%',
    height: '100%',
  },
  artistName: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 4,
  },
  artistNameLight: {
    color: '#082621',
  },
  artistCountPill: {
    fontSize: 9,
    color: '#17a398',
    fontWeight: '700',
  },
  albumsSection: {
    marginBottom: 20,
  },
  albumsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  albumCard: {
    backgroundColor: '#0d1815',
    borderWidth: 2,
    borderColor: '#172722',
    borderRadius: 12,
    padding: 8,
    overflow: 'hidden',
  },
  albumCardLight: {
    backgroundColor: '#f6f2e8',
    borderColor: '#0b1110',
  },
  albumCoverWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#07100e',
    marginBottom: 8,
    position: 'relative',
  },
  albumCoverPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumCover: {
    width: '100%',
    height: '100%',
  },
  albumTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 2,
  },
  albumTitleLight: {
    color: '#082621',
  },
  albumArtist: {
    fontSize: 10,
    color: '#71717a',
    fontWeight: '600',
  },
  resultsSection: {
    marginTop: 4,
  },
  resultsHeader: {
    marginBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 6,
  },
  resultsCount: {
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.tealLight,
    letterSpacing: 0.5,
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceDark,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
  },
  emptyText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    fontWeight: '800',
    fontSize: 13,
    color: colors.paper,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 11,
    color: colors.paperMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  tracksList: {
    gap: 8,
  },
  peopleSection: {
    marginBottom: 20,
  },
  peopleScrollRow: {
    gap: 10,
    paddingVertical: 4,
  },
  peopleVerticalList: {
    gap: 8,
    paddingVertical: 4,
  },
  personCardHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d1815',
    borderWidth: 2,
    borderColor: '#172722',
    borderRadius: 12,
    padding: 10,
    width: 220,
    gap: 10,
  },
  personCardVertical: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d1815',
    borderWidth: 2,
    borderColor: '#172722',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  personCardLight: {
    backgroundColor: '#f6f2e8',
    borderColor: '#0b1110',
  },
  personAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    position: 'relative',
    overflow: 'visible',
  },
  personAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1f3630',
  },
  personAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#17a398',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#082621',
  },
  personAvatarInitial: {
    fontSize: 18,
    fontWeight: '900',
    color: '#082621',
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
  },
  personVerifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#10b981',
    borderRadius: 8,
    width: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0b1110',
  },
  personInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  personName: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    letterSpacing: 0.2,
  },
  personNameLight: {
    color: '#082621',
  },
  personSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9ca3af',
    marginTop: 2,
  },
  personActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(6,182,212,0.12)',
    borderWidth: 1,
    borderColor: '#06b6d4',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  personActionText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#06b6d4',
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
  },
  loadMoreBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#141d1b',
    borderWidth: 1.5,
    borderColor: '#17a398',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  loadMoreBtnLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  loadMoreText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#17a398',
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    letterSpacing: 0.5,
  },
});
