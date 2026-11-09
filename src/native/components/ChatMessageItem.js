import React, { useState, memo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { CheckCheck, Check, Radio, Headphones, Smile } from 'lucide-react-native';
import { normalizeCoverUri } from '../utils/coverUtils';
import MessageReactionsNative from './MessageReactionsNative';

function ChatMessageItemComponent({
  item,
  isMe,
  activeUser,
  isDark,
  onOpenJam,
  joinJam,
  onViewProfile,
  onToggleReaction,
  currentUserId,
}) {
  const [showPicker, setShowPicker] = useState(false);

  const timeStr = item.createdAt
    ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const isBot = Boolean(activeUser?.isBot || activeUser?.name === 'Rivo Bot' || item.isBot);

  const handleProfilePress = useCallback(() => {
    if (onViewProfile && activeUser) {
      onViewProfile(activeUser);
    }
  }, [onViewProfile, activeUser]);

  const handleLongPress = useCallback(() => {
    setShowPicker((prev) => !prev);
  }, []);

  const handleTogglePicker = useCallback(() => {
    setShowPicker((prev) => !prev);
  }, []);

  const handleClosePicker = useCallback(() => {
    setShowPicker(false);
  }, []);

  const handleBubblePress = useCallback(() => {
    if (showPicker) {
      setShowPicker(false);
    }
  }, [showPicker]);

  return (
    <View style={[styles.msgRow, isMe ? styles.myMsgRow : styles.otherMsgRow]}>
      {/* Sender Avatar for received messages */}
      {!isMe && (
        <TouchableOpacity
          style={styles.senderAvatarWrap}
          onPress={handleProfilePress}
          activeOpacity={0.7}
        >
          {activeUser?.avatar ? (
            <Image
              source={{ uri: normalizeCoverUri(activeUser.avatar) }}
              style={styles.senderAvatar}
            />
          ) : (
            <View style={styles.senderAvatarFallback}>
              <Text style={styles.senderAvatarLetter}>
                {activeUser?.name ? activeUser.name[0].toUpperCase() : 'U'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      <View style={{ alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: isMe ? '85%' : '80%' }}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleBubblePress}
          onLongPress={handleLongPress}
          delayLongPress={280}
          style={[
            styles.bubble,
            isMe ? styles.myBubble : [styles.otherBubble, !isDark && styles.otherBubbleLight],
          ]}
        >
          {!isMe && isBot && (
            <TouchableOpacity
              style={styles.botBadgeRow}
              onPress={handleProfilePress}
              activeOpacity={0.7}
            >
              <View style={styles.botBadge}>
                <Text style={styles.botBadgeText}>BOT</Text>
              </View>
              <Text style={styles.botName}>RIVO BOT</Text>
            </TouchableOpacity>
          )}

          {item.jamInvite?.roomCode ? (
            <View style={[styles.jamInviteCard, !isDark && styles.jamInviteCardLight]}>
              <View style={styles.jamInviteHeader}>
                <Radio size={13} color="#17a398" />
                <Text style={styles.jamInviteTag}>JAM SESSION INVITE</Text>
              </View>
              <Text style={styles.jamInviteCode}>{item.jamInvite.roomCode}</Text>
              <Text style={styles.jamInviteSub}>Tap to join and listen together in sync</Text>
              <TouchableOpacity
                style={styles.jamInviteJoinBtn}
                onPress={() => {
                  if (joinJam) joinJam(item.jamInvite.roomCode);
                  if (onOpenJam) onOpenJam();
                }}
                activeOpacity={0.85}
              >
                <Headphones size={13} color="#082621" />
                <Text style={styles.jamInviteJoinBtnText}>JOIN JAM NOW</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text
              style={[
                styles.msgText,
                isMe ? styles.myMsgText : [styles.otherMsgText, !isDark && styles.otherMsgTextLight],
              ]}
            >
              {item.text}
            </Text>
          )}
        </TouchableOpacity>

        {/* Message Reactions Display & Quick React Bar */}
        <MessageReactionsNative
          message={item}
          currentUserId={currentUserId}
          onToggleReaction={onToggleReaction}
          isDark={isDark}
          isMe={isMe}
          showPicker={showPicker}
          onClosePicker={handleClosePicker}
          onTogglePicker={handleTogglePicker}
          onOpenPicker={handleTogglePicker}
        />

        {/* Message Meta Row with direct 1-tap reaction button */}
        <View style={[styles.msgMetaRow, isMe ? styles.myMetaRow : styles.otherMetaRow]}>
          {!isMe && (
            <TouchableOpacity
              style={[styles.reactTriggerBtn, !isDark && styles.reactTriggerBtnLight]}
              onPress={handleTogglePicker}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Add reaction"
            >
              <Smile size={11} color={!isDark ? '#64748b' : '#94a3b8'} strokeWidth={2.2} />
            </TouchableOpacity>
          )}

          {timeStr ? <Text style={styles.msgTimeText}>{timeStr}</Text> : null}

          {isMe && (
            <>
              {item.read ? (
                <View style={styles.seenBadge}>
                  <CheckCheck size={12} color="#26c4b7" strokeWidth={2.4} />
                  <Text style={styles.seenText}>Seen</Text>
                </View>
              ) : (
                <View style={styles.sentBadge}>
                  <Check size={11} color="#64748b" strokeWidth={2.0} />
                  <Text style={styles.sentText}>Sent</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.reactTriggerBtn, !isDark && styles.reactTriggerBtnLight]}
                onPress={handleTogglePicker}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Add reaction"
              >
                <Smile size={11} color={!isDark ? '#64748b' : '#94a3b8'} strokeWidth={2.2} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

export default memo(ChatMessageItemComponent);

const styles = StyleSheet.create({
  msgRow: {
    marginVertical: 4,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  myMsgRow: {
    justifyContent: 'flex-end',
  },
  otherMsgRow: {
    justifyContent: 'flex-start',
  },
  senderAvatarWrap: {
    marginRight: 8,
    marginBottom: 16,
  },
  senderAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1e293b',
  },
  senderAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  senderAvatarLetter: {
    fontSize: 12,
    fontWeight: '700',
    color: '#17a398',
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 36,
  },
  myBubble: {
    backgroundColor: '#17a398',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#1b2826',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#253835',
  },
  otherBubbleLight: {
    backgroundColor: '#e6ded3',
    borderColor: '#d8cebe',
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  myMsgText: {
    color: '#082621',
    fontWeight: '600',
  },
  otherMsgText: {
    color: '#f8fafc',
  },
  otherMsgTextLight: {
    color: '#0b1110',
  },
  botBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  botBadge: {
    backgroundColor: '#17a398',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  botBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#082621',
  },
  botName: {
    fontSize: 10,
    color: '#17a398',
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  jamInviteCard: {
    backgroundColor: '#0c1715',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#17a398',
    minWidth: 200,
  },
  jamInviteCardLight: {
    backgroundColor: '#ded5c7',
    borderColor: '#17a398',
  },
  jamInviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  jamInviteTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#17a398',
    letterSpacing: 0,
  },
  jamInviteCode: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
    marginBottom: 4,
  },
  jamInviteSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 10,
  },
  jamInviteJoinBtn: {
    backgroundColor: '#17a398',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  jamInviteJoinBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#082621',
    letterSpacing: 0.5,
  },
  msgMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
    paddingHorizontal: 2,
  },
  myMetaRow: {
    justifyContent: 'flex-end',
  },
  otherMetaRow: {
    justifyContent: 'flex-start',
  },
  msgTimeText: {
    fontSize: 10,
    color: '#64748b',
  },
  seenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  seenText: {
    fontSize: 10,
    color: '#26c4b7',
    fontWeight: '600',
  },
  sentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sentText: {
    fontSize: 10,
    color: '#64748b',
  },
  reactTriggerBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(23, 163, 152, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(23, 163, 152, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactTriggerBtnLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    borderColor: 'rgba(0, 0, 0, 0.12)',
  },
});
