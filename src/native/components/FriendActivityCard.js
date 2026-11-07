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
  if (!lastActiveAt) return isRTL ? 'غير متصل' : 'Offline';
  const diffSec = Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / 1000);
  if (isNaN(diffSec) || diffSec < 0) return isRTL ? 'غير متصل' : 'Offline';
  if (diffSec < 60) return isRTL ? 'نشط الآن' : 'Active now';
  if (diffSec < 3600) {
    const mins = Math.max(1, Math.floor(diffSec / 60));
    return isRTL ? `منذ ${mins} د` : `${mins}m ago`;
  }
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return isRTL ? `منذ ${hours} س` : `${hours}h ago`;
  }
  const days = Math.floor(diffSec / 86400);
  if (days === 1) return isRTL ? 'أمس' : 'Yesterday';
  return isRTL ? `منذ ${days} ي` : `${days}d ago`;
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
    return isRTL ? `غير متصل • منذ ${hours} س` : `Offline • Last seen ${hours}h ago`;
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
  const trackCover = listening?.cover || listening?.coverUrl || '';

  const avatarBorderColor = isLive
    ? '#10b981'
    : isOnline
    ? '#34d399'
    : isDark
    ? '#52525b'
    : '#a1a1aa';

  return (
    <View style={[styles.friendCard, !isDark && styles.friendCardLight]}>
      {/* ── Top Row: Avatar + Name (ample horizontal room) + Clean Status Pill on Top End ── */}
      <View style={[styles.topRow, isRTL && styles.rowReverse]}>
        {/* User Info Clickable Area (Spans full available width, never squished) */}
        <TouchableOpacity
          style={[styles.userProfileTouch, isRTL && styles.rowReverse, isRTL ? styles.userTouchRTL : styles.userTouchLTR]}
          onPress={() => onOpenProfile(item)}
          activeOpacity={0.75}
        >
          {/* Avatar with Status Ring & Crisp Status Dot */}
          <View style={[styles.avatarWrap, isRTL ? styles.avatarWrapRTL : styles.avatarWrapLTR]}>
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
            {isLive ? (
              <View style={[styles.onlineDot, isRTL ? styles.onlineDotRTL : styles.onlineDotLTR, { backgroundColor: '#10b981', borderColor: !isDark ? '#ede5d3' : '#141d1b' }]} />
            ) : isOnline ? (
              <View style={[styles.onlineDot, isRTL ? styles.onlineDotRTL : styles.onlineDotLTR, { backgroundColor: '#34d399', borderColor: !isDark ? '#ede5d3' : '#141d1b' }]} />
            ) : (
              <View style={[styles.onlineDot, isRTL ? styles.onlineDotRTL : styles.onlineDotLTR, { backgroundColor: '#64748b', borderColor: !isDark ? '#ede5d3' : '#141d1b' }]} />
            )}
          </View>

          {/* Name & Subtitle Block - Takes maximum horizontal space */}
          <View style={[styles.userNameBlock, isRTL ? styles.alignEnd : styles.alignStart]}>
            <View style={[styles.nameAndBadge, isRTL && styles.rowReverse]}>
              <Text
                style={[
                  styles.friendName,
                  !isDark && styles.friendNameLight,
                  isRTL && styles.arabicText,
                  isRTL && styles.textRight
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.name || 'Friend'}
              </Text>
              {(item.isVerified || item.role === 'admin') && (
                <ShieldCheck
                  size={13}
                  color="#17a398"
                  strokeWidth={2.5}
                  style={isRTL ? styles.verifiedIconRTL : styles.verifiedIconLTR}
                />
              )}
            </View>
            {(isLive || isOnline) && (
              <Text
                style={[
                  styles.statusSubtitle,
                  isRTL && styles.arabicText,
                  isRTL && styles.textRight
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {isLive
                  ? (isRTL ? 'يستمع الآن على ريفو' : 'Listening live on Rivo')
                  : (isRTL ? 'متصل الآن' : 'Online now')}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Clean, Dedicated Status Pill on Top End (Never squishes username) */}
        {isLive ? (
          <View style={styles.liveBadge}>
            <Radio size={9} color="#0b1110" strokeWidth={3} />
            <Text style={[styles.liveBadgeText, isRTL && styles.arabicBadgeText]}>
              {isRTL ? 'مباشر' : 'LIVE'}
            </Text>
          </View>
        ) : isOnline ? (
          <View style={[styles.onlineBadge, !isDark && styles.onlineBadgeLight]}>
            <View style={styles.onlineBadgeDot} />
            <Text style={[styles.onlineBadgeText, !isDark && styles.onlineBadgeTextLight, isRTL && styles.arabicBadgeText]}>
              {isRTL ? 'متصل' : 'ONLINE'}
            </Text>
          </View>
        ) : (
          <View style={[styles.timeBadge, isDark ? styles.timeBadgeDark : styles.timeBadgeLight]}>
            <Clock size={9} color={isDark ? '#94a3b8' : '#64748b'} />
            <Text style={[styles.timeBadgeText, isDark ? styles.timeBadgeTextDark : styles.timeBadgeTextLight, isRTL && styles.arabicBadgeText]}>
              {formatCompactPillNative(item.lastActiveAt, isRTL)}
            </Text>
          </View>
        )}
      </View>

      {/* ── Bottom Section: Dedicated Track Player Card OR Idle Box (Spans full width) ── */}
      {hasTrack ? (
        <TouchableOpacity
          onPress={() => onListenAlong(item)}
          activeOpacity={0.8}
          style={[
            styles.trackCard,
            isRTL && styles.rowReverse,
            isLive ? styles.trackCardLive : (isDark ? styles.trackCardDark : styles.trackCardLight)
          ]}
        >
          {/* Cover art */}
          <View style={styles.trackThumbWrap}>
            <Image
              source={{ uri: normalizeCoverUri(trackCover, listening) }}
              style={styles.trackThumb}
              fadeDuration={0}
            />
          </View>

          {/* Track metadata */}
          <View style={[styles.trackDetailsCol, isRTL ? styles.alignEnd : styles.alignStart]}>
            <Text style={[styles.trackLabel, isLive ? styles.trackLabelLive : styles.trackLabelOffline, isRTL && styles.arabicBadgeText]}>
              {isLive ? (isRTL ? '▶ يستمع الآن' : '▶ LIVE') : (isRTL ? '📻 آخر استماع' : '📻 LAST PLAYED')}
            </Text>
            <Text style={[styles.trackName, !isDark && styles.trackNameLight, isRTL && styles.arabicText, isRTL && styles.textRight]} numberOfLines={1}>
              {trackTitle}
            </Text>
            {trackArtist ? (
              <Text style={[styles.trackArtistText, isRTL && styles.arabicText, isRTL && styles.textRight]} numberOfLines={1}>
                {trackArtist}
              </Text>
            ) : null}
          </View>

          {/* 1-Tap Play Button */}
          <View style={[styles.playPillBtn, isLive ? styles.playPillBtnLive : styles.playPillBtnDefault]}>
            <Play size={10} color="#0b1110" fill="#0b1110" style={isRTL ? { marginRight: 1 } : { marginLeft: 1 }} />
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={() => onOpenProfile(item)}
          activeOpacity={0.75}
          style={[styles.idleBox, isRTL && styles.rowReverse, isDark ? styles.idleBoxDark : styles.idleBoxLight]}
        >
          <Disc size={11} color="#64748b" style={styles.shrink0} />
          <Text style={[styles.idleText, isRTL && styles.arabicText, isRTL && styles.textRight]} numberOfLines={1}>
            {isOnline
              ? (isRTL ? 'يتصفح الموسيقى وقوائم التشغيل' : 'Browsing music & playlists')
              : (isRTL ? 'لم يستمع لأي مقطع مؤخراً' : 'No recent listening activity')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

export default FriendActivityCard;

const styles = StyleSheet.create({
  friendCard: {
    backgroundColor: '#141d1b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#263330',
    padding: 10,
    marginBottom: 8,
    width: '100%',
  },
  friendCardLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    width: '100%',
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  alignStart: {
    alignItems: 'flex-start',
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
  textRight: {
    textAlign: 'right',
  },
  shrink0: {
    flexShrink: 0,
  },
  userProfileTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  userTouchLTR: {
    marginRight: 8,
  },
  userTouchRTL: {
    marginLeft: 8,
  },
  avatarWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  avatarWrapLTR: {
    marginRight: 10,
  },
  avatarWrapRTL: {
    marginLeft: 10,
  },
  avatarRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    padding: 1.5,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
    backgroundColor: '#17a398',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: '#0b1110',
    fontSize: 13,
    fontWeight: '900',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  onlineDotLTR: {
    right: -1,
  },
  onlineDotRTL: {
    left: -1,
  },
  userNameBlock: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  nameAndBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
    gap: 4,
  },
  friendName: {
    color: '#fdfbf7',
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
    letterSpacing: Platform.OS === 'ios' ? 0.2 : 0,
  },
  friendNameLight: {
    color: '#082621',
  },
  verifiedIconLTR: {
    marginLeft: 3,
    flexShrink: 0,
  },
  verifiedIconRTL: {
    marginRight: 3,
    flexShrink: 0,
  },
  statusSubtitle: {
    color: '#94a3b8',
    fontSize: 10.5,
    marginTop: 1,
    maxWidth: '100%',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 12,
    gap: 4,
    flexShrink: 0,
  },
  liveBadgeText: {
    color: '#0b1110',
    fontSize: 9.5,
    fontWeight: '900',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 211, 153, 0.14)',
    borderColor: '#34d399',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
    flexShrink: 0,
  },
  onlineBadgeLight: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
  },
  onlineBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#34d399',
  },
  onlineBadgeText: {
    color: '#34d399',
    fontSize: 9.5,
    fontWeight: '800',
  },
  onlineBadgeTextLight: {
    color: '#087443',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
    flexShrink: 0,
    borderWidth: 1,
  },
  timeBadgeDark: {
    backgroundColor: '#1f2d29',
    borderColor: '#2d3f3a',
  },
  timeBadgeLight: {
    backgroundColor: '#ded4c1',
    borderColor: 'rgba(11,17,16,0.2)',
  },
  timeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  timeBadgeTextDark: {
    color: '#cbd5e1',
  },
  timeBadgeTextLight: {
    color: '#334155',
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 7,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    width: '100%',
  },
  trackCardLive: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderColor: '#10b981',
  },
  trackCardDark: {
    backgroundColor: '#0c1311',
    borderColor: '#22332f',
  },
  trackCardLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(11,17,16,0.15)',
  },
  trackThumbWrap: {
    width: 34,
    height: 34,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: '#000',
    flexShrink: 0,
  },
  trackThumb: {
    width: '100%',
    height: '100%',
  },
  trackDetailsCol: {
    flex: 1,
    minWidth: 0,
  },
  trackLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  trackLabelLive: {
    color: '#10b981',
  },
  trackLabelOffline: {
    color: '#94a3b8',
  },
  trackName: {
    color: '#f1f5f9',
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 0.5,
  },
  trackNameLight: {
    color: '#0b1110',
  },
  trackArtistText: {
    color: '#64748b',
    fontSize: 10,
  },
  playPillBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  playPillBtnLive: {
    backgroundColor: '#10b981',
  },
  playPillBtnDefault: {
    backgroundColor: '#17a398',
  },
  idleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 6,
    width: '100%',
  },
  idleBoxDark: {
    backgroundColor: '#0c1311',
  },
  idleBoxLight: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  idleText: {
    color: '#64748b',
    fontSize: 10.5,
    flex: 1,
  },
  arabicText: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    letterSpacing: 0,
  },
  arabicBadgeText: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    letterSpacing: 0,
  },
});
