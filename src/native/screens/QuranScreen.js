import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
} from 'react-native';
import { BookOpen, Search, Play, Pause, Disc, User, Volume2, Radio, ArrowLeft } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';
import SongItem from '../ui/SongItem';
import QuranRadioModal from '../components/QuranRadioModal';
import {
  isQuranContent,
  getQuranReciterName,
  cleanQuranTrackTitle,
  normalizeArabicText,
  FAMOUS_RECITERS,
  sortQuranTracks,
  getSurahNumber,
  getSurahName,
} from '../../utils/quranUtils';

export default function QuranScreen({ onTrackAction }) {
  const { playTrack, currentTrack, isPlaying, tracks: audioTracks, downloadedTracks = [] } = useAudioPlayer();
  const { tracks: userTracks } = useUser();
  const { appMode } = useConnectivity();
  const { isDark } = useTheme();
  const [selectedReciter, setSelectedReciter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(40);
  const [isRadioModalOpen, setIsRadioModalOpen] = useState(false);

  React.useEffect(() => {
    setVisibleLimit(40);
  }, [selectedReciter, searchQuery]);

  const isOffline = appMode === 'offline';
  const allTracks = isOffline
    ? (Array.isArray(downloadedTracks) ? downloadedTracks : [])
    : ((Array.isArray(userTracks) && userTracks.length > 0) ? userTracks : (audioTracks || []));

  // Filter strictly Quranic tracks with robust deduplication
  const quranTracks = useMemo(() => {
    const raw = (allTracks || []).filter(t => isQuranContent(t) && !isRadioTrack(t));
    const seenAudio = new Set();
    const seenMeta = new Set();
    const deduped = [];
    for (const t of raw) {
      const reciter = getQuranReciterName(t);
      const cleanTitle = cleanQuranTrackTitle(t.title || '');
      const metaKey = `${normalizeArabicText(reciter)}:::${normalizeArabicText(cleanTitle)}`;
      
      let audioKey = null;
      if (t.audioUrl && typeof t.audioUrl === 'string' && t.audioUrl.length > 10) {
        const ytMatch = t.audioUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/) || t.audioUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        audioKey = ytMatch ? `yt:${ytMatch[1]}` : `url:${t.audioUrl.trim().toLowerCase()}`;
      }

      if (audioKey && seenAudio.has(audioKey)) {
        continue;
      }
      if (metaKey && seenMeta.has(metaKey)) {
        continue;
      }

      if (audioKey) seenAudio.add(audioKey);
      if (metaKey) seenMeta.add(metaKey);
      deduped.push(t);
    }
    return deduped;
  }, [allTracks]);

  // Reciters extracted from quran tracks sorted by available recitation count
  const recitersList = useMemo(() => {
    const map = new Map();
    quranTracks.forEach((t) => {
      const name = getQuranReciterName(t);
      if (name && name !== 'قارئ غير معروف') {
        if (!map.has(name)) {
          map.set(name, { name, count: 0, cover: t.coverUrl || t.cover });
        }
        map.get(name).count += 1;
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [quranTracks]);

  // Filtered tracks with canonical Quranic sorting (1 to 114)
  const displayedTracks = useMemo(() => {
    if (!selectedReciter && !searchQuery.trim()) return [];
    let result = quranTracks;
    if (selectedReciter) {
      const normSelected = normalizeArabicText(selectedReciter);
      const famousItem = FAMOUS_RECITERS.find(r => normalizeArabicText(r.name) === normSelected);
      const aliases = famousItem ? famousItem.aliases.map(normalizeArabicText) : [normSelected];

      result = result.filter((t) => {
        const rName = getQuranReciterName(t);
        const normR = normalizeArabicText(rName);
        if (normR === normSelected || normR.includes(normSelected) || normSelected.includes(normR)) {
          return true;
        }
        const textToSearch = normalizeArabicText(`${t.title || ''} ${t.artist || ''} ${t.album || ''} ${rName}`);
        return aliases.some(a => a.length >= 3 && textToSearch.includes(a));
      });
    }
    if (searchQuery.trim()) {
      const normQ = normalizeArabicText(searchQuery.trim());
      result = result.filter((t) => {
        const rName = getQuranReciterName(t);
        const trackText = normalizeArabicText(`${t.title || ''} ${t.artist || ''} ${t.album || ''} ${rName}`);
        return trackText.includes(normQ);
      });
    }
    return sortQuranTracks(result);
  }, [quranTracks, selectedReciter, searchQuery]);

  return (
    <View style={[styles.container, !isDark && { backgroundColor: '#fdfbf7' }]}>
      {/* Header Banner with Arabic Aesthetic */}
      <View style={styles.bannerOuter}>
        <View style={styles.bannerShadow} />
        <View style={styles.banner}>
          <View style={styles.bannerTopRow}>
            <View style={styles.quranPill}>
              <BookOpen size={13} color={colors.ink} />
              <Text style={styles.quranPillText}>المصحف المرتل الصوتي</Text>
            </View>
            <CassetteTag label="RECITATIONS" bg={colors.ink} textColor={colors.mint} />
          </View>

          <Text style={styles.arabicTitle}>القرآن الكريم</Text>
          <TouchableOpacity style={styles.radioBannerBtn} onPress={() => setIsRadioModalOpen(true)} activeOpacity={0.85}>
            <Radio size={16} color="#000000" strokeWidth={2.5} />
            <Text style={styles.radioBannerBtnText}>إذاعة القرآن الكريم (مباشر 24/7)</Text>
          </TouchableOpacity>
          <Text style={styles.arabicSub}>
            استمع لتلاوات خاشعة مرتبة حسب المصحف الشريف بدقة صوتية عالية وبدون إعلانات.
          </Text>

          {/* Search bar inside Quran */}
          <View style={styles.searchBar}>
            <Search size={16} color={colors.ink} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="ابحث عن سورة أو قارئ..."
              placeholderTextColor={colors.grayText}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>
      </View>

      {/* Reciters Horizontal Carousel */}
      <View style={styles.recitersSection}>
        <Text style={[styles.sectionHeading, !isDark && { color: colors.ink }]}>كبار القراء • RECITERS</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.reciterScroll}
        >
          <TouchableOpacity
            style={[
              styles.reciterPill,
              selectedReciter === null && styles.reciterPillActive,
            ]}
            onPress={() => setSelectedReciter(null)}
          >
            <Text
              style={[
                styles.reciterPillText,
                selectedReciter === null && styles.reciterPillTextActive,
              ]}
            >
              كل القراء ({recitersList.length})
            </Text>
          </TouchableOpacity>

          {recitersList.map((r) => {
            const active = selectedReciter === r.name;
            return (
              <TouchableOpacity
                key={r.name}
                style={[styles.reciterPill, active && styles.reciterPillActive]}
                onPress={() => setSelectedReciter(active ? null : r.name)}
              >
                <Text
                  style={[
                    styles.reciterPillText,
                    active && styles.reciterPillTextActive,
                  ]}
                >
                  {r.name} ({r.count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content Area */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* VIEW 1: No reciter selected & no search -> Show Reciter Cards (prevent dumping 457 tracks!) */}
        {!selectedReciter && !searchQuery.trim() ? (
          <View style={styles.reciterGridSection}>
            <View style={styles.reciterGridHeader}>
              <Text style={[styles.reciterGridTitle, !isDark && { color: colors.ink }]}>
                اختر القارئ للاستماع للمصحف كاملاً
              </Text>
              <Text style={styles.reciterGridSubtitle}>
                تصفح سور القرآن الكريم مرتبة بالترتيب الشرعي (1 إلى 114)
              </Text>
            </View>

            <View style={styles.reciterCardsGrid}>
              {recitersList.map((reciter) => (
                <TouchableOpacity
                  key={reciter.name}
                  style={[styles.reciterCard, !isDark && styles.reciterCardLight]}
                  onPress={() => setSelectedReciter(reciter.name)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: reciter.cover || 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=300' }}
                    style={styles.reciterCardCover}
                  />
                  <View style={styles.reciterCardInfo}>
                    <Text style={[styles.reciterCardName, !isDark && { color: colors.ink }]} numberOfLines={1}>
                      {reciter.name}
                    </Text>
                    <View style={styles.reciterCardBadge}>
                      <Text style={styles.reciterCardBadgeText}>
                        {reciter.count} سورة مرتبة
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          /* VIEW 2: Reciter chosen OR user searching -> Show Canonical Sorted Surahs */
          <>
            {selectedReciter && (
              <View style={[styles.selectedReciterBanner, !isDark && styles.selectedReciterBannerLight]}>
                <View style={styles.selectedReciterRow}>
                  <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => setSelectedReciter(null)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.backBtnText}>← كل القراء</Text>
                  </TouchableOpacity>

                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={[styles.selectedReciterName, !isDark && { color: colors.ink }]} numberOfLines={1}>
                      مصحف الشيخ {selectedReciter}
                    </Text>
                    <Text style={styles.selectedReciterCount}>
                      {displayedTracks.length} سورة • مرتبة من الفاتحة إلى الناس (1 إلى 114)
                    </Text>
                  </View>
                </View>

                {displayedTracks.length > 0 && (
                  <TouchableOpacity
                    style={styles.playAllBtn}
                    onPress={() => playTrack(displayedTracks[0], displayedTracks)}
                    activeOpacity={0.8}
                  >
                    <Play size={14} color={colors.ink} fill={colors.ink} />
                    <Text style={styles.playAllBtnText}>
                      تشغيل المصحف كاملاً بالترتيب (من سورة {getSurahName(displayedTracks[0]) || 'البداية'})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.listHeader}>
              <Text style={styles.listCount}>
                {displayedTracks.length} سورة متوفرة • مرتبة ترتيب المصحف
              </Text>
              {(selectedReciter || searchQuery.trim()) && (
                <TouchableOpacity onPress={() => { setSelectedReciter(null); setSearchQuery(''); }}>
                  <Text style={styles.clearFilterText}>إلغاء التصفية ✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {displayedTracks.length === 0 ? (
              <View style={styles.emptyCard}>
                <BookOpen size={36} color={colors.mint} />
                <Text style={styles.emptyTitle}>
                  {isOffline ? 'لا توجد سور قرآنية محملة' : 'لا توجد تلاوات مطابقة'}
                </Text>
                <Text style={styles.emptySub}>
                  {isOffline
                    ? 'لم تقم بتحميل أي سور أو تلاوات بعد. قم بالتحميل في الوضع الأون لاين لتستمع إليها بدون إنترنت.'
                    : 'جرب البحث باسم سورة أو قارئ آخر.'}
                </Text>
              </View>
            ) : (
              <View style={styles.tracksList}>
                {displayedTracks.slice(0, visibleLimit).map((track, idx) => {
                  const sNum = getSurahNumber(track);
                  const displayIndex = (sNum >= 1 && sNum <= 114) ? sNum : (idx + 1);
                  return (
                    <SongItem
                      key={track._id || track.id || idx}
                      track={track}
                      index={displayIndex}
                      onPlay={(t) => playTrack(t, displayedTracks)}
                      onMorePress={() => onTrackAction && onTrackAction(track)}
                    />
                  );
                })}

                {displayedTracks.length > visibleLimit && (
                  <TouchableOpacity
                    style={styles.loadMoreBtn}
                    onPress={() => setVisibleLimit((prev) => prev + 35)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.loadMoreText}>
                      عرض المزيد من التلاوات ({displayedTracks.length - visibleLimit} متبقية) ↓
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
      <QuranRadioModal isOpen={isRadioModalOpen} visible={isRadioModalOpen} onClose={() => setIsRadioModalOpen(false)} />
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  bannerOuter: {
    margin: 14,
    marginBottom: 10,
    position: 'relative',
  },
  bannerShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: colors.tealDark,
    borderRadius: 12,
  },
  banner: {
    backgroundColor: '#044a37',
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 12,
    padding: 16,
  },
  bannerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  quranPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  quranPillText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.ink,
  },
  arabicTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'right',
    marginBottom: 4,
  },
  arabicSub: {
    fontSize: 11,
    color: '#a7f3d0',
    textAlign: 'right',
    lineHeight: 16,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'right',
  },
  recitersSection: {
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  sectionHeading: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.paper,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  reciterScroll: {
    gap: 8,
    paddingRight: 14,
  },
  reciterPill: {
    backgroundColor: colors.surfaceDark,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reciterPillActive: {
    backgroundColor: colors.mint,
    borderColor: colors.ink,
  },
  reciterPillText: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 11,
    color: colors.paperMuted,
  },
  reciterPillTextActive: {
    color: colors.ink,
    fontWeight: '900',
  },
  scrollContent: {
    padding: 14,
    paddingTop: 4,
    paddingBottom: 110,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 6,
  },
  listCount: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.tealLight,
  },
  clearFilterText: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 10,
    color: colors.rust,
  },
  emptyCard: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceDark,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 10,
  },
  emptyTitle: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 14,
    color: colors.paper,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 11,
    color: colors.paperMuted,
    marginTop: 4,
  },
  tracksList: {
    gap: 8,
  },
  loadMoreBtn: {
    backgroundColor: '#182320',
    borderWidth: 1.5,
    borderColor: colors.mint,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  radioBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#d4af37',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    marginBottom: 12,
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 3,
  },
  radioBannerBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 13,
    color: '#000000',
  },
  loadMoreText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 12,
    color: colors.mint,
  },
  reciterGridSection: {
    marginTop: 4,
    marginBottom: 20,
  },
  reciterGridHeader: {
    marginBottom: 12,
    alignItems: 'center',
  },
  reciterGridTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 4,
  },
  reciterGridSubtitle: {
    fontSize: 11,
    color: '#a7f3d0',
    textAlign: 'center',
  },
  reciterCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  reciterCard: {
    width: '48%',
    backgroundColor: '#0a231f',
    borderWidth: 2,
    borderColor: '#17a398',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    marginBottom: 6,
  },
  reciterCardLight: {
    backgroundColor: '#fdfbf7',
    borderColor: colors.ink,
  },
  reciterCardCover: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.mint,
    marginBottom: 8,
    backgroundColor: '#041d1a',
  },
  reciterCardInfo: {
    alignItems: 'center',
    width: '100%',
  },
  reciterCardName: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 12,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 4,
  },
  reciterCardBadge: {
    backgroundColor: '#064e3b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  reciterCardBadgeText: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 10,
    color: '#a7f3d0',
  },
  selectedReciterBanner: {
    backgroundColor: '#08332b',
    borderWidth: 2,
    borderColor: '#17a398',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  selectedReciterBannerLight: {
    backgroundColor: '#e6f7f4',
    borderColor: colors.ink,
  },
  selectedReciterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  backBtn: {
    backgroundColor: colors.mint,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  backBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.ink,
  },
  selectedReciterName: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 13,
    color: '#ffffff',
    textAlign: 'right',
  },
  selectedReciterCount: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#a7f3d0',
    marginTop: 2,
    textAlign: 'right',
  },
  playAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mint,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  playAllBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.ink,
  },
});
