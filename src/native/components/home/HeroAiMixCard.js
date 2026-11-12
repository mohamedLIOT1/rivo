import React, { useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Play, Disc } from 'lucide-react-native';
import { normalizeCoverUri } from '../../utils/coverUtils';

const HeroAiMixCard = React.memo(function HeroAiMixCard({
  aiMoodMix = [],
  moodLabel = 'MUSIC FLOW',
  isRTL = false,
  onPlayMix,
}) {
  const coverTracks = useMemo(() => (Array.isArray(aiMoodMix) ? aiMoodMix.slice(0, 4) : []), [aiMoodMix]);

  const artistsSummary = useMemo(() => {
    const names = [];
    const seen = new Set();
    for (let i = 0; i < aiMoodMix.length; i++) {
      const a = String(aiMoodMix[i]?.artist || '').trim();
      if (a && !seen.has(a.toLowerCase())) {
        seen.add(a.toLowerCase());
        names.push(a);
      }
      if (names.length >= 4) break;
    }
    return names.join(' • ');
  }, [aiMoodMix]);

  const count = aiMoodMix.length;
  const titleText = count > 0 ? (isRTL ? 'قائمة ذكاء ريفو' : 'AI Mood Mix') : (isRTL ? 'كاسيت ريفو' : 'RIVO CASSETTE');
  const subtitleText = count > 0
    ? `${moodLabel} • ${count} ${isRTL ? 'أغاني' : 'tracks'}`
    : `${moodLabel} • HI-FI`;

  return (
    <TouchableOpacity
      style={styles.outerCard}
      onPress={onPlayMix}
      activeOpacity={0.9}
    >
      <View style={styles.dashedInner}>
        <View style={styles.topMetaRow}>
          <Text style={styles.labText}>{isRTL ? 'مختبر ريفو الصوتي' : 'RIVO SOUND LAB'}</Text>
          <View style={styles.badge12h}>
            <Text style={styles.badge12hText}>
              {count > 0 ? (isRTL ? 'كل 12 ساعة' : '12H AI MIX') : 'HI-FI'}
            </Text>
          </View>
        </View>

        <View style={styles.bodyRow}>
          {/* 2x2 Mosaic Cover replacing the old green circle */}
          <View style={styles.mosaicBox}>
            {coverTracks.length > 0 ? (
              <View style={styles.mosaicGrid}>
                {coverTracks.map((tr, idx) => (
                  <Image
                    key={`hero-ai-${tr?._id || tr?.id || idx}`}
                    source={{ uri: normalizeCoverUri(tr?.cover || tr?.coverUrl, tr) }}
                    style={styles.mosaicTile}
                    resizeMode="cover"
                    fadeDuration={0}
                    resizeMethod={Platform.OS === 'android' ? 'resize' : 'auto'}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyCover}>
                <Disc size={26} color="#0b1110" strokeWidth={2.2} />
              </View>
            )}
          </View>

          {/* Playlist Info & Play CTA beside Cover */}
          <View style={styles.infoCol}>
            <Text style={[styles.cardTitle, isRTL && { textAlign: 'right' }]} numberOfLines={1}>
              {titleText}
            </Text>
            <Text style={[styles.moodLine, isRTL && { textAlign: 'right' }]} numberOfLines={1}>
              {subtitleText}
            </Text>
            {Boolean(artistsSummary) && (
              <Text style={[styles.artistsLine, isRTL && { textAlign: 'right' }]} numberOfLines={2}>
                {artistsSummary}
              </Text>
            )}

            <TouchableOpacity
              style={styles.playBtn}
              onPress={onPlayMix}
              activeOpacity={0.85}
            >
              <Play size={10} color="#17a398" fill="#17a398" />
              <Text style={styles.playBtnText}>
                {isRTL ? 'تشغيل القائمة' : 'PLAY PLAYLIST'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  outerCard: {
    marginTop: 12,
    backgroundColor: '#fdfbf7',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#0b1110',
    padding: 6,
  },
  dashedInner: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#0b1110',
    borderRadius: 8,
    padding: 8,
    backgroundColor: '#ffffff',
  },
  topMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1.5,
    borderBottomColor: '#0b1110',
    paddingBottom: 4,
    marginBottom: 8,
  },
  labText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#0b1110',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  badge12h: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  badge12hText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.4,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mosaicBox: {
    width: 68,
    height: 68,
    borderRadius: 8,
    backgroundColor: '#17a398',
    borderWidth: 1.5,
    borderColor: '#0b1110',
    overflow: 'hidden',
  },
  mosaicGrid: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mosaicTile: {
    width: '50%',
    height: '50%',
  },
  emptyCover: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#0b1110',
    lineHeight: 17,
  },
  moodLine: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0f756d',
    marginTop: 1,
  },
  artistsLine: {
    fontSize: 9.5,
    color: '#52525b',
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 12,
  },
  playBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0b1110',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  playBtnText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#17a398',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

export default HeroAiMixCard;
