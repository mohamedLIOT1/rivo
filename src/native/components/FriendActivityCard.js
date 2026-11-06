import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import {
  Play,
  Radio,
  Disc,
  Clock,
  ShieldCheck,
} from 'lucide-react-native';
import { normalizeCoverUri } from '../utils/coverUtils';
import { useLocalization } from '../context/LocalizationContext';

function formatCompactPillNative(lastActiveAt, isRTL = false) {
  if (!lastActiveAt) return isRTL ? 'غير متصل' : 'OFFLINE';
  const diffSec = Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / 1000);
  if (isNaN(diffSec) || diffSec < 0) return isRTL ? 'غير متصل' : 'OFFLINE';
  if (diffSec < 60) return isRTL ? 'الآن' : 'NOW';
  if (diffSec < 3600) {
    const mins = Math.max(1, Math.floor(diffSec / 60));
    return isRTL ? `${mins} د` : `${mins}M`;
  }
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return isRTL ? `${hours} س` : `${hours}H`;
  }
  const days = Math.floor(diffSec / 86400);
  if (days === 1) return isRTL ? 'أمس' : '1D';
  return isRTL ? `${days} ي` : `${days}D`;
}

function formatLastSeenSubtitle(lastActiveAt, isRTL = false) {
  if (!lastActiveAt) return isRTL ? 'غير متصل' : 'Offline';
  const diffSec = Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / 1000);
  if (isNaN(diffSec) || diffSec < 0) return isRTL ? 'غير متصل' : 'Offline';
  if (diffSec < 60) return isRTL ? 'غير متصل • نشط الآن' : 'Offline • Active just now';
  if (diffSec < 3600) {
    const mins = Math.max(1, Math.floor(diffSec / 60));
    return isRTL ? `غير متصل • منذ ${mins} د` : `Offline • Last seen ${mins}m ago`;
  }
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return isRTL
      ? (hours === 1 ? 'غير متصل • منذ ساعة' : hours === 2 ? 'غير متصل • منذ ساعتين' : `غير متصل • منذ ${hours} س`)
      : `Offline • Last seen ${hours}h ago`;
  }
  const days = Math.floor(diffSec / 86400);
  if (days === 1) return isRTL ? 'غير متصل • أمس' : 'Offline • Last seen yesterday';
  return isRTL ? `غير متصل • منذ ${days} ي` : `Offline • Last seen ${days}d ago`;
}

const FriendActivityCard = React.memo(function FriendActivityCard({
  item,
  isDark,
  onOpenProfile,
  onListenAlong,
}) {
  const { isRTL = false } = useLocalization() || {};
  const rawListening = item.currentListening;
  const isDummyOffline = Boolean(
    rawListening?.title?.toLowerCase() === 'offline' ||
    rawListening?.name?.toLowerCase() === 'offline'
  );
  const listening = isDummyOffline ? null : rawListening;
  const hasTrack = Boolean(listening && (listening.title || listening.name));
  const isLive = Boolean(item.isLive && hasTrack);
  const isOnline = Boolean(item.isOnline);

  const trackTitle = listening?.title || listening?.name || '';
  const trackArtist = listening?.artist || '';

  const avatarBorderColor = isLive
    ? '#10b981'
    : isOnline
    ? '#34d399'
    : isDark
    ? '#52525b'
    : '#a1a1aa';

  return (
    <View style={[styles.friendCard, !isDark && styles.friendCardLight]}>
      {/* Clickable Area for Profile & Play */}
      <TouchableOpacity
        style={styles.cardMainTouch}
        onPress={() => onOpenProfile(item)}
        activeOpacity={0.75}
      >
        {/* Avatar (40x40) with crisp status ring */}
        <View style={styles.avatarWrap}>
          <View style={[styles.avatarRing, { borderColor: avatarBorderColor }]}>
            {item.avatar ? (
              <Image source={{ uri: normalizeCoverUri(item.avatar) }} style={styles.avatarImg} fadeDuration={0} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarLetter}>
                  {item.name ? item.name[0].toUpperCase() : 'U'}
                </Text>
              </View>
            )}
          </View>
          {/* Status Dot */}
          {isLive ? (
            <View style={[styles.onlineDot, { backgroundColor: '#10b981', borderColor: !isDark ? '#f4ede1' : '#0b1110', borderWidth: 2 }]} />
          ) : isOnline ? (
            <View style={[styles.onlineDot, { backgroundColor: '#34d399' }]} />
          ) : (
            <View style={[styles.onlineDot, { backgroundColor: '#64748b' }]} />
          )}
        </View>

        {/* Info Column */}
        <View style={styles.infoCol}>
          {/* Top Row: Name + Verified Badge + Status/Time Pill */}
          <View style={styles.nameRow}>
            <View style={styles.nameAndBadge}>
              <Text
                style={[
                  styles.friendName,
                  !isDark && styles.friendNameLight,
                  isRTL && styles.arabicText
                ]}
                numberOfLines={1}
              >
                {item.name || 'Friend'}
              </Text>
              {(item.isVerified || item.role === 'admin') && (
                <ShieldCheck size={13} color="#17a398" strokeWidth={2.5} style={styles.verifiedIcon} />
              )}
            </View>

            {/* Status / Time Pill */}
            {isLive ? (
              <View style={styles.liveBadge}>
                <Radio size={9} color="#0b1110" strokeWidth={3} />
                <Text style={[styles.liveBadgeText, isRTL && styles.arabicBadgeText]}>
                  {isRTL ? 'مباشر' : 'LIVE'}
                </Text>
              </View>
            ) : isOnline ? (
              <View style={[styles.liveBadge, { backgroundColor: isDark ? '#064e3b' : '#d1fae5', borderWidth: 1, borderColor: isDark ? '#047857' : '#a7f3d0' }]}>
                <Text style={[styles.liveBadgeText, { color: isDark ? '#34d399' : '#047857' }, isRTL && styles.arabicBadgeText]}>
                  {isRTL ? 'متصل' : 'ONLINE'}
                </Text>
              </View>
            ) : (
              <View style={[styles.liveBadge, { backgroundColor: isDark ? '#27272a' : '#e4e4e7', borderWidth: 1, borderColor: isDark ? '#3f3f46' : '#d4d4d8' }]}>
                <Clock size={9} color={isDark ? '#a1a1aa' : '#71717a'} />
                <Text style={[styles.liveBadgeText, { color: isDark ? '#d4d4d8' : '#3f3f46' }, isRTL && styles.arabicBadgeText]}>
                  {formatCompactPillNative(item.lastActiveAt, isRTL)}
                </Text>
              </View>
            )}
          </View>

          {/* Second Row: Track info or offline status */}
          {isLive && hasTrack ? (
            <TouchableOpacity
              onPress={() => onListenAlong(item)}
              activeOpacity={0.7}
              style={styles.trackInfoRow}
            >
              <Disc size={11} color="#26c4b7" strokeWidth={2.4} />
              <Text style={[styles.trackTitle, { color: '#26c4b7', fontWeight: '700' }]} numberOfLines={1}>
                {trackTitle}
                {trackArtist ? <Text style={{ color: '#5eead4', fontWeight: '400' }}> • {trackArtist}</Text> : null}
              </Text>
            </TouchableOpacity>
          ) : hasTrack ? (
            <TouchableOpacity
              onPress={() => onListenAlong(item)}
              activeOpacity={0.7}
              style={styles.trackInfoRow}
            >
              <Disc size={11} color="#94a3b8" strokeWidth={1.8} />
              <Text style={[styles.trackTitle, { color: !isDark ? '#27272a' : '#e4e4e7', fontWeight: '600' }]} numberOfLines={1}>
                <Text style={{ color: isDark ? '#a1a1aa' : '#71717a', fontWeight: '400', fontSize: 10.5 }}>
                  {isRTL ? 'آخر تشغيل: ' : 'Last played: '}
                </Text>
                {trackTitle}
                {trackArtist ? <Text style={{ color: isDark ? '#94a3b8' : '#71717a', fontWeight: '400' }}> • {trackArtist}</Text> : null}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.idleText, !isDark && styles.idleTextLight, isRTL && styles.arabicText]} numberOfLines={1}>
              {isOnline
                ? (isRTL ? 'متصل • يتصفح الموسيقى' : 'Online • Browsing music')
                : formatLastSeenSubtitle(item.lastActiveAt, isRTL)}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {/* 1-Tap Play / Tune In Action Button */}
      {hasTrack && (
        <TouchableOpacity
          style={[styles.actionBtn, isLive ? styles.tuneInBtn : styles.playTrackBtn]}
          onPress={() => onListenAlong(item)}
          activeOpacity={0.85}
        >
          <Play size={10} color="#0b1110" fill="#0b1110" style={!isLive ? { marginLeft: 1 } : null} />
          {isLive && (
            <Text style={[styles.actionBtnText, isRTL && styles.arabicBadgeText]}>
              {isRTL ? 'استماع' : 'TUNE IN'}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
});

export default FriendActivityCard;

const styles = StyleSheet.create({
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#141d1b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#263330',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  friendCardLight: {
    backgroundColor: '#fdfbf7',
    borderColor: '#0b1110',
  },
  cardMainTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 9,
    flexShrink: 0,
  },
  avatarRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 1.5,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    backgroundColor: '#17a398',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#0b1110',
    fontWeight: '900',
    fontSize: 14,
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#0e1715',
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingRight: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 2,
  },
  nameAndBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: 6,
  },
  friendName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    flexShrink: 1,
  },
  friendNameLight: {
    color: '#0b1110',
  },
  verifiedIcon: {
    marginLeft: 4,
    flexShrink: 0,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#17a398',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
    flexShrink: 0,
  },
  liveBadgeText: {
    color: '#0b1110',
    fontSize: 9.5,
    fontWeight: '800',
  },
  arabicBadgeText: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    letterSpacing: 0,
  },
  arabicText: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    letterSpacing: 0,
  },
  trackInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    flex: 1,
    minWidth: 0,
    gap: 4,
    marginTop: 1,
  },
  trackTitle: {
    color: '#94a3b8',
    fontSize: 11,
    flex: 1,
    minWidth: 0,
  },
  idleText: {
    color: '#64748b',
    fontSize: 11,
    width: '100%',
    flex: 1,
    minWidth: 0,
    marginTop: 1,
  },
  idleTextLight: {
    color: '#57534e',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17a398',
    borderRadius: 8,
    flexShrink: 0,
  },
  tuneInBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 3,
    marginLeft: 4,
  },
  playTrackBtn: {
    width: 28,
    height: 28,
    marginLeft: 4,
  },
  actionBtnText: {
    color: '#0b1110',
    fontSize: 9.5,
    fontWeight: '900',
  },
});
