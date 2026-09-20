import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Radio, Play, Disc, Clock, Calendar, Gauge } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';
import { PODCASTS } from '../../data/musicData';

const SPEEDS = [0.8, 1.0, 1.2, 1.5, 2.0];

export default function PodcastsScreen() {
  const { playTrack } = useAudioPlayer();
  const [selectedSpeed, setSelectedSpeed] = useState(1.0);
  const [selectedPodcast, setSelectedPodcast] = useState(PODCASTS[0]?.id);

  const activePodcast = PODCASTS.find((p) => p.id === selectedPodcast) || PODCASTS[0];

  const handlePlayEpisode = (episode, podcast) => {
    playTrack({
      _id: episode.id,
      title: episode.title,
      artist: podcast.author,
      album: podcast.title,
      coverUrl: podcast.cover,
      audioUrl: episode.audioUrl,
      isPodcast: true,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Broadcast Bureau Header Banner */}
      <View style={styles.bannerOuter}>
        <View style={styles.bannerShadow} />
        <View style={styles.banner}>
          <View style={styles.topPill}>
            <Radio size={14} color={colors.ink} />
            <Text style={styles.topPillText}>AUDIO BROADCAST BUREAU</Text>
          </View>
          <Text style={styles.bannerTitle}>TALK RADIO & PODCASTS</Text>
          <Text style={styles.bannerSub}>
            Curated Arabic audio journalism, deep dialogues, book summaries, and culture.
          </Text>

          {/* Playback Speed Controller */}
          <View style={styles.speedBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Gauge size={14} color={colors.ink} />
              <Text style={styles.speedLabel}>SPEED:</Text>
            </View>
            <View style={styles.speedPills}>
              {SPEEDS.map((spd) => (
                <TouchableOpacity
                  key={spd}
                  style={[
                    styles.speedBtn,
                    selectedSpeed === spd && styles.speedBtnActive,
                  ]}
                  onPress={() => setSelectedSpeed(spd)}
                >
                  <Text
                    style={[
                      styles.speedBtnText,
                      selectedSpeed === spd && styles.speedBtnTextActive,
                    ]}
                  >
                    {spd}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* Shows Tabs */}
      <View style={styles.showsSection}>
        <Text style={styles.sectionTitle}>CURATED SHOWS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.showsScroll}>
          {PODCASTS.map((pod) => {
            const active = pod.id === selectedPodcast;
            return (
              <TouchableOpacity
                key={pod.id}
                style={[styles.showCard, active && styles.showCardActive]}
                onPress={() => setSelectedPodcast(pod.id)}
              >
                <Image source={{ uri: pod.cover }} style={styles.showCover} />
                <View style={styles.showInfo}>
                  <Text style={styles.showTitle} numberOfLines={1}>
                    {pod.title}
                  </Text>
                  <Text style={styles.showAuthor} numberOfLines={1}>
                    {pod.author}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Episodes for Active Show */}
      {activePodcast && (
        <View style={styles.episodesSection}>
          <View style={styles.episodesHeader}>
            <Text style={styles.episodesHeaderTitle}>
              EPISODES ({activePodcast.episodes?.length || 0})
            </Text>
            <CassetteTag label="24-BIT BROADCAST" bg={colors.ink} textColor={colors.mint} />
          </View>

          <View style={styles.episodesList}>
            {(activePodcast.episodes || []).map((ep, idx) => (
              <View key={ep.id} style={styles.episodeCard}>
                <View style={styles.epIndexBox}>
                  <Text style={styles.epIndex}>#{idx + 1}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.epTitle}>{ep.title}</Text>
                  <View style={styles.epMetaRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Clock size={11} color={colors.paperMuted} />
                      <Text style={styles.epMetaText}>{ep.duration}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Calendar size={11} color={colors.paperMuted} />
                      <Text style={styles.epMetaText}>{ep.date}</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.epPlayBtn}
                  onPress={() => handlePlayEpisode(ep, activePodcast)}
                >
                  <Play size={14} color={colors.ink} fill={colors.ink} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}
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
  bannerOuter: {
    marginBottom: 16,
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
    backgroundColor: colors.deepForest,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 12,
    padding: 16,
  },
  topPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  topPillText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 9,
    color: colors.ink,
  },
  bannerTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 20,
    color: colors.paper,
    marginBottom: 4,
  },
  bannerSub: {
    fontSize: 11,
    color: '#a7f3d0',
    lineHeight: 15,
    marginBottom: 14,
  },
  speedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.paper,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  speedLabel: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.ink,
  },
  speedPills: {
    flexDirection: 'row',
    gap: 4,
  },
  speedBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.paperLight,
  },
  speedBtnActive: {
    backgroundColor: colors.teal,
  },
  speedBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.ink,
  },
  speedBtnTextActive: {
    color: colors.paper,
  },
  showsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 12,
    color: colors.paper,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  showsScroll: {
    flexDirection: 'row',
    gap: 10,
  },
  showCard: {
    width: 140,
    backgroundColor: colors.surfaceDark,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 10,
  },
  showCardActive: {
    borderColor: colors.mint,
  },
  showCover: {
    width: '100%',
    height: 100,
  },
  showInfo: {
    padding: 8,
  },
  showTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.paper,
  },
  showAuthor: {
    fontSize: 10,
    color: colors.paperMuted,
    marginTop: 2,
  },
  episodesSection: {
    marginTop: 4,
  },
  episodesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 6,
  },
  episodesHeaderTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 12,
    color: colors.tealLight,
  },
  episodesList: {
    gap: 8,
  },
  episodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceDark,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    padding: 10,
  },
  epIndexBox: {
    width: 32,
    height: 32,
    backgroundColor: colors.deepForest,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  epIndex: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.mint,
  },
  epTitle: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 12,
    color: colors.paper,
  },
  epMetaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  epMetaText: {
    fontSize: 10,
    color: colors.paperMuted,
    fontFamily: 'monospace',
  },
  epPlayBtn: {
    padding: 8,
    backgroundColor: colors.mint,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
  },
});
