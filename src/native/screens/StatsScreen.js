import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  Activity,
  Trophy,
  Flame,
  Clock,
  Headphones,
  RefreshCw,
  Award,
  Crown,
  Sparkles,
} from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';
import { API_BASE_URL } from '../config';

const { width } = Dimensions.get('window');

function formatSeconds(secs) {
  if (!secs || secs <= 0) return '0m';
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export default function StatsScreen() {
  const { currentUser, token, likedTrackIds = [] } = useUser();
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentWeek, setCurrentWeek] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchLeaderboard = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/stats/leaderboard`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.leaderboard)) {
          setLeaderboard(data.leaderboard);
          if (data.currentWeek) setCurrentWeek(data.currentWeek);
        }
      }
    } catch (e) {
      console.warn('[StatsScreen] Failed to fetch leaderboard:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [token]);

  // Real user listening metrics
  const myUserId = String(currentUser?._id || currentUser?.id || '');
  const userTotalSec = Number(currentUser?.totalListeningSeconds || 0);
  const userWeeklySec = Number(currentUser?.weeklyListeningSeconds || 0);

  // Find user's real rank in server leaderboard
  const userRankEntry = useMemo(() => {
    if (!myUserId) return null;
    return leaderboard.find(
      (u) =>
        String(u.id) === myUserId ||
        (u.name && currentUser?.name && u.name.toLowerCase() === currentUser.name.toLowerCase())
    );
  }, [leaderboard, myUserId, currentUser?.name]);

  const userRank = userRankEntry ? `#${userRankEntry.rank}` : leaderboard.length > 0 ? `#${leaderboard.length + 1}` : '—';
  const topListener = leaderboard.length > 0 ? leaderboard[0] : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>LISTENING STATS</Text>
          <Text style={styles.headerSub}>REAL-TIME PLATFORM ACTIVITY</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={fetchLeaderboard}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.ink} />
          ) : (
            <>
              <RefreshCw size={13} color={colors.ink} />
              <Text style={styles.refreshText}>UPDATE</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Top Listener of the Week Hero Card ── */}
      {topListener && (
        <View style={styles.heroOuter}>
          <View style={styles.heroShadow} />
          <View style={styles.heroCard}>
            <View style={styles.heroTagRow}>
              <View style={styles.crownTag}>
                <Crown size={12} color="#082621" strokeWidth={3} />
                <Text style={styles.crownTagText}>TOP LISTENER OF THE WEEK</Text>
              </View>
              {currentWeek ? (
                <Text style={styles.weekText}>{currentWeek}</Text>
              ) : null}
            </View>

            <View style={styles.heroUserRow}>
              <Image
                source={{
                  uri:
                    topListener.avatar ||
                    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop',
                }}
                style={styles.heroAvatar}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.heroName} numberOfLines={1}>
                    {topListener.name}
                  </Text>
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedText}>✓</Text>
                  </View>
                </View>
                <Text style={styles.heroMinutes}>
                  {topListener.minutes || Math.floor((topListener.seconds || 0) / 60)} MINUTES LISTENED
                </Text>
                {topListener.topSong && topListener.topSong !== 'Various Tracks' && (
                  <Text style={styles.heroSong} numberOfLines={1}>
                    Top song: {topListener.topSong}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ── 2x2 Grid of Real User Stat Cards ── */}
      <View style={styles.statsGrid}>
        {/* Weekly Time */}
        <View style={styles.cardOuter}>
          <View style={styles.cardShadow} />
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.statTitle}>WEEKLY TIME</Text>
              <View style={[styles.iconBox, { backgroundColor: colors.mint }]}>
                <Clock size={14} color={colors.ink} />
              </View>
            </View>
            <View style={styles.valueRow}>
              <Text style={styles.statValue}>{formatSeconds(userWeeklySec)}</Text>
            </View>
            <Text style={styles.statDesc}>Active listening this week</Text>
          </View>
        </View>

        {/* All-Time Stream Time */}
        <View style={styles.cardOuter}>
          <View style={styles.cardShadow} />
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.statTitle}>TOTAL TIME</Text>
              <View style={[styles.iconBox, { backgroundColor: colors.teal }]}>
                <Headphones size={14} color={colors.ink} />
              </View>
            </View>
            <View style={styles.valueRow}>
              <Text style={styles.statValue}>{formatSeconds(userTotalSec)}</Text>
            </View>
            <Text style={styles.statDesc}>All-time listening history</Text>
          </View>
        </View>

        {/* Community Rank */}
        <View style={styles.cardOuter}>
          <View style={styles.cardShadow} />
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.statTitle}>COMMUNITY RANK</Text>
              <View style={[styles.iconBox, { backgroundColor: '#f59e0b' }]}>
                <Trophy size={14} color={colors.ink} />
              </View>
            </View>
            <View style={styles.valueRow}>
              <Text style={[styles.statValue, { color: '#f59e0b' }]}>{userRank}</Text>
            </View>
            <Text style={styles.statDesc}>Position in weekly charts</Text>
          </View>
        </View>

        {/* Liked Favorites */}
        <View style={styles.cardOuter}>
          <View style={styles.cardShadow} />
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.statTitle}>SAVED TRACKS</Text>
              <View style={[styles.iconBox, { backgroundColor: colors.rust }]}>
                <Flame size={14} color={colors.ink} />
              </View>
            </View>
            <View style={styles.valueRow}>
              <Text style={styles.statValue}>{likedTrackIds.length}</Text>
              <Text style={styles.statUnit}>SONGS</Text>
            </View>
            <Text style={styles.statDesc}>Locally bookmarked favorites</Text>
          </View>
        </View>
      </View>

      {/* ── Community Leaderboard Section ── */}
      <View style={styles.leaderboardSection}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Award size={16} color={colors.mint} />
            <Text style={styles.sectionTitle}>WEEKLY LEADERBOARD</Text>
          </View>
          <Text style={styles.sectionCount}>{leaderboard.length} LISTENERS</Text>
        </View>

        {leaderboard.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {isLoading ? 'Loading leaderboard statistics...' : 'No activity recorded yet this week.'}
            </Text>
          </View>
        ) : (
          <View style={styles.leaderboardList}>
            {leaderboard.map((item, idx) => {
              const isCurrentUser =
                (myUserId && String(item.id) === myUserId) ||
                (currentUser?.name && item.name && item.name.toLowerCase() === currentUser.name.toLowerCase());
              
              const isRank1 = item.rank === 1;
              const isRank2 = item.rank === 2;
              const isRank3 = item.rank === 3;

              const rankBg = isRank1 ? '#f59e0b' : isRank2 ? '#94a3b8' : isRank3 ? '#d97706' : '#27272a';
              const rankColor = isRank1 || isRank2 || isRank3 ? '#082621' : '#ffffff';

              return (
                <View
                  key={item.id || idx}
                  style={[
                    styles.leaderboardRow,
                    isCurrentUser && styles.currentUserRow,
                  ]}
                >
                  <View style={[styles.rankBadge, { backgroundColor: rankBg }]}>
                    <Text style={[styles.rankBadgeText, { color: rankColor }]}>
                      {item.rank}
                    </Text>
                  </View>

                  <Image
                    source={{
                      uri:
                        item.avatar ||
                        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop',
                    }}
                    style={styles.listenerAvatar}
                  />

                  <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text
                        style={[
                          styles.listenerName,
                          isCurrentUser && { color: colors.mint },
                        ]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      {item.isVerified && (
                        <View style={styles.miniVerified}>
                          <Text style={styles.miniVerifiedText}>✓</Text>
                        </View>
                      )}
                      {isCurrentUser && (
                        <View style={styles.youBadge}>
                          <Text style={styles.youBadgeText}>YOU</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.listenerSong} numberOfLines={1}>
                      {item.topSong || 'Listening to Rivo'}
                    </Text>
                  </View>

                  <View style={styles.timePill}>
                    <Text style={styles.timePillText}>
                      {item.minutes || Math.floor((item.seconds || 0) / 60)} MIN
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1110',
  },
  content: {
    padding: 16,
    paddingBottom: 110,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 20,
    color: '#ffffff',
  },
  headerSub: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: colors.mint,
    marginTop: 2,
    letterSpacing: 1,
  },
  refreshBtn: {
    backgroundColor: colors.mint,
    borderWidth: 2,
    borderColor: '#0b1110',
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
  },
  refreshText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: '#082621',
  },
  // Hero Top Listener
  heroOuter: {
    position: 'relative',
    marginBottom: 18,
  },
  heroShadow: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: -5,
    bottom: -5,
    backgroundColor: '#000000',
    borderRadius: 12,
  },
  heroCard: {
    backgroundColor: '#18181b',
    borderWidth: 2,
    borderColor: '#f59e0b',
    borderRadius: 12,
    padding: 14,
  },
  heroTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  crownTag: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  crownTagText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 9,
    color: '#082621',
  },
  weekText: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 10,
    color: '#9ca3af',
  },
  heroUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  heroName: {
    fontWeight: '900',
    fontSize: 16,
    color: '#ffffff',
  },
  verifiedBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#17a398',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#082621',
  },
  heroMinutes: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 11,
    color: '#f59e0b',
    marginTop: 2,
  },
  heroSong: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  // 2x2 Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  cardOuter: {
    width: (width - 44) / 2,
    position: 'relative',
  },
  cardShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: '#000000',
    borderRadius: 10,
  },
  card: {
    backgroundColor: '#18181b',
    borderWidth: 2,
    borderColor: '#27272a',
    borderRadius: 10,
    padding: 12,
    minHeight: 105,
    justifyContent: 'space-between',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: '#9ca3af',
  },
  iconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginVertical: 4,
  },
  statValue: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 20,
    color: '#ffffff',
  },
  statUnit: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 10,
    color: '#9ca3af',
  },
  statDesc: {
    fontSize: 10,
    color: '#6b7280',
  },
  // Leaderboard Section
  leaderboardSection: {
    backgroundColor: '#141d1b',
    borderWidth: 2,
    borderColor: '#27272a',
    borderRadius: 12,
    padding: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: '#27272a',
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 12,
    color: '#ffffff',
  },
  sectionCount: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 10,
    color: colors.mint,
  },
  emptyCard: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#9ca3af',
  },
  leaderboardList: {
    gap: 8,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderWidth: 1.5,
    borderColor: '#27272a',
    borderRadius: 8,
    padding: 8,
  },
  currentUserRow: {
    borderColor: colors.mint,
    backgroundColor: '#162320',
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  rankBadgeText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
  },
  listenerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 10,
    backgroundColor: '#27272a',
  },
  listenerName: {
    fontWeight: 'bold',
    fontSize: 13,
    color: '#ffffff',
  },
  miniVerified: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#17a398',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniVerifiedText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#082621',
  },
  youBadge: {
    backgroundColor: colors.mint,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  youBadgeText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 8,
    color: '#082621',
  },
  listenerSong: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
  timePill: {
    backgroundColor: '#27272a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timePillText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.mint,
  },
});
