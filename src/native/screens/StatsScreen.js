import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Activity, Flame, Disc, Users, Clock, Trophy } from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';
import BrutalCard from '../ui/BrutalCard';

const { width } = Dimensions.get('window');

export default function StatsScreen() {
  const { tracks = [], currentUser, playlists = [], likedTrackIds = [] } = useUser();

  const totalTracks = (Array.isArray(tracks) ? tracks.length : 0) || 42;
  const estimatedHours = Math.round((totalTracks * 3.6) / 60);

  const stats = [
    {
      title: 'AUDIO VAULT',
      value: `${totalTracks}`,
      unit: 'TAPES',
      desc: 'Mastered recordings in database',
      color: colors.teal,
      icon: Disc,
    },
    {
      title: 'STREAM TIME',
      value: `${estimatedHours}h`,
      unit: 'ESTIMATED',
      desc: 'High-fidelity playback time',
      color: colors.mint,
      icon: Clock,
    },
    {
      title: 'YOUR ARCHIVE',
      value: `${Array.isArray(likedTrackIds) ? likedTrackIds.length : 0}`,
      unit: 'LIKED',
      desc: 'Locally bookmarked favorites',
      color: colors.rust,
      icon: Flame,
    },
    {
      title: 'YOUR CRATES',
      value: `${Array.isArray(playlists) ? playlists.length : 0}`,
      unit: 'PLAYLISTS',
      desc: 'Curated track compilations',
      color: colors.gold,
      icon: Trophy,
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>LISTENING STATS</Text>
          <Text style={styles.headerSub}>YOUR MUSIC ACTIVITY</Text>
        </View>
        <CassetteTag label="OVERVIEW" bg={colors.ink} textColor={colors.mint} />
      </View>

      {/* 2x2 Grid of Brutal Stat Cards */}
      <View style={styles.statsGrid}>
        {stats.map((item, idx) => {
          const Icon = item.icon;
          return (
            <View key={idx} style={styles.cardOuter}>
              <View style={styles.cardShadow} />
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.statTitle}>{item.title}</Text>
                  <View style={[styles.iconBox, { backgroundColor: item.color }]}>
                    <Icon size={14} color={colors.ink} />
                  </View>
                </View>
                <View style={styles.valueRow}>
                  <Text style={styles.statValue}>{item.value}</Text>
                  <Text style={styles.statUnit}>{item.unit}</Text>
                </View>
                <Text style={styles.statDesc}>{item.desc}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Acoustic Spectrum & Activity */}
      <View style={styles.spectrumOuter}>
        <View style={styles.cardShadow} />
        <View style={styles.spectrumCard}>
          <View style={styles.spectrumHeader}>
            <Activity size={16} color={colors.mint} />
            <Text style={styles.spectrumTitle}>FREQUENCY ACTIVITY METER</Text>
          </View>
          <Text style={styles.spectrumDesc}>
            Dynamic 24-bit audio resolution streamed across Cairo and MENA nodes.
          </Text>

          <View style={styles.barsContainer}>
            {[40, 75, 55, 90, 65, 85, 45, 95, 80, 60, 70, 88, 50, 92, 78, 64].map((h, i) => (
              <View key={i} style={styles.barWrapper}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${h}%`,
                      backgroundColor: i % 2 === 0 ? colors.teal : colors.mint,
                    },
                  ]}
                />
              </View>
            ))}
          </View>
          <Text style={styles.barsLabel}>32Hz — 64Hz — 128Hz — 250Hz — 1kHz — 8kHz — 16kHz</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  content: {
    padding: 14,
    paddingBottom: 110,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: colors.deepForest,
    paddingBottom: 10,
  },
  headerTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 18,
    color: colors.paper,
    letterSpacing: 0.5,
  },
  headerSub: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '800',
    color: colors.mint,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  cardOuter: {
    width: (width - 40) / 2,
    position: 'relative',
  },
  cardShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: colors.tealDark,
    borderRadius: 10,
  },
  card: {
    backgroundColor: colors.surfaceDark,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 10,
    padding: 12,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.paperMuted,
  },
  iconBox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  statValue: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 24,
    color: colors.paper,
  },
  statUnit: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.mint,
  },
  statDesc: {
    fontSize: 10,
    color: colors.paperMuted,
    marginTop: 4,
  },
  spectrumOuter: {
    position: 'relative',
    marginTop: 4,
  },
  spectrumCard: {
    backgroundColor: colors.surfaceDark,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 10,
    padding: 14,
  },
  spectrumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  spectrumTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 12,
    color: colors.paper,
  },
  spectrumDesc: {
    fontSize: 11,
    color: colors.paperMuted,
    marginBottom: 16,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 90,
    gap: 4,
    marginBottom: 10,
    paddingHorizontal: 6,
  },
  barWrapper: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  barsLabel: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 9,
    color: colors.tealLight,
    textAlign: 'center',
  },
});
