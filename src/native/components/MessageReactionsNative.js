import React, { useState, useMemo, useCallback, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Smile, Plus } from 'lucide-react-native';
import { QUICK_EMOJIS } from '../data/chatEmojiData';
import ChatEmojiPickerModal from './ChatEmojiPickerModal';

export { QUICK_EMOJIS };

function MessageReactionsNative({
  message,
  currentUserId,
  onToggleReaction,
  isDark = true,
  isMe = false,
  showPicker = false,
  onClosePicker,
  onTogglePicker,
  onOpenPicker,
}) {
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const messageId = message?._id || message?.id;

  // Group reactions by emoji and check if current user reacted
  const reactionGroups = useMemo(() => {
    const reactions = Array.isArray(message?.reactions) ? message.reactions : [];
    if (reactions.length === 0) return [];

    const map = {};
    const myIdStr = String(currentUserId || '');

    reactions.forEach((r) => {
      const em = r?.emoji;
      if (!em) return;
      if (!map[em]) {
        map[em] = { count: 0, hasMyReaction: false };
      }
      map[em].count += 1;
      if (myIdStr && String(r.userId) === myIdStr) {
        map[em].hasMyReaction = true;
      }
    });

    return Object.entries(map).map(([emoji, data]) => ({
      emoji,
      count: data.count,
      hasMyReaction: data.hasMyReaction,
    }));
  }, [message?.reactions, currentUserId]);

  const handleEmojiPress = useCallback(
    (emoji) => {
      if (onToggleReaction && messageId) {
        onToggleReaction(messageId, emoji);
      }
      if (onClosePicker) {
        onClosePicker();
      }
    },
    [onToggleReaction, messageId, onClosePicker]
  );

  const handleOpenCatalog = useCallback(() => {
    setIsCatalogOpen(true);
    if (onClosePicker) {
      onClosePicker();
    }
  }, [onClosePicker]);

  const handleCloseCatalog = useCallback(() => {
    setIsCatalogOpen(false);
  }, []);

  const handleTogglePickerPress = useCallback(() => {
    if (onTogglePicker) {
      onTogglePicker();
    } else if (showPicker && onClosePicker) {
      onClosePicker();
    } else if (onOpenPicker) {
      onOpenPicker();
    }
  }, [onTogglePicker, showPicker, onClosePicker, onOpenPicker]);

  const hasReactions = reactionGroups.length > 0;

  return (
    <View style={[styles.container, isMe ? styles.containerMe : styles.containerOther]}>
      {/* Quick Emojis Floating Picker Bar */}
      {showPicker && (
        <View
          style={[
            styles.quickBar,
            !isDark && styles.quickBarLight,
            isMe ? styles.quickBarMe : styles.quickBarOther,
          ]}
        >
          {QUICK_EMOJIS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={styles.emojiBtn}
              onPress={() => handleEmojiPress(emoji)}
              activeOpacity={0.65}
              hitSlop={{ top: 6, bottom: 6, left: 3, right: 3 }}
            >
              <Text style={styles.quickEmojiText}>{emoji}</Text>
            </TouchableOpacity>
          ))}

          {/* '+' Button to open full 100+ categorized emoji modal */}
          <TouchableOpacity
            style={[styles.moreBtn, !isDark && styles.moreBtnLight]}
            onPress={handleOpenCatalog}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 6 }}
            accessibilityLabel="More emojis"
          >
            <Plus size={13} color={!isDark ? '#082621' : '#17a398'} strokeWidth={2.8} />
          </TouchableOpacity>
        </View>
      )}

      {/* Existing Reactions Badges List */}
      {hasReactions && (
        <View style={[styles.badgesRow, isMe ? styles.badgesRowMe : styles.badgesRowOther]}>
          {reactionGroups.map(({ emoji, count, hasMyReaction }) => (
            <TouchableOpacity
              key={emoji}
              style={[
                styles.badge,
                !isDark && styles.badgeLight,
                hasMyReaction && styles.badgeMine,
                hasMyReaction && !isDark && styles.badgeMineLight,
              ]}
              onPress={() => handleEmojiPress(emoji)}
              activeOpacity={0.7}
            >
              <Text style={styles.badgeEmoji}>{emoji}</Text>
              {count > 1 && (
                <Text
                  style={[
                    styles.badgeCount,
                    !isDark && styles.badgeCountLight,
                    hasMyReaction && styles.badgeCountMine,
                  ]}
                >
                  {count}
                </Text>
              )}
            </TouchableOpacity>
          ))}

          {/* Quick Add Reaction Button next to badges */}
          <TouchableOpacity
            style={[styles.addReactionBtn, !isDark && styles.addReactionBtnLight]}
            onPress={handleTogglePickerPress}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityLabel="Add reaction"
          >
            <Smile size={12} color={!isDark ? '#57534e' : '#94a3b8'} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      )}

      {/* Full 100+ Categorized Emojis Modal */}
      <ChatEmojiPickerModal
        visible={isCatalogOpen}
        onClose={handleCloseCatalog}
        onSelectEmoji={handleEmojiPress}
        isDark={isDark}
        title="React with Emoji"
        multiSelect={false}
      />
    </View>
  );
}

export default memo(MessageReactionsNative);

const styles = StyleSheet.create({
  container: {
    marginTop: 2,
    marginBottom: 2,
  },
  containerMe: {
    alignItems: 'flex-end',
  },
  containerOther: {
    alignItems: 'flex-start',
  },
  quickBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#162421',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#263b36',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 10,
  },
  quickBarLight: {
    backgroundColor: '#f7f4ee',
    borderColor: '#ded5c7',
    shadowColor: '#000',
    shadowOpacity: 0.15,
  },
  quickBarMe: {
    alignSelf: 'flex-end',
  },
  quickBarOther: {
    alignSelf: 'flex-start',
  },
  emojiBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  quickEmojiText: {
    fontSize: 18,
    lineHeight: 22,
  },
  moreBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1f332f',
    borderWidth: 1,
    borderColor: '#2f4d47',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  moreBtnLight: {
    backgroundColor: '#e6ded3',
    borderColor: '#c7bca9',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  badgesRowMe: {
    justifyContent: 'flex-end',
  },
  badgesRowOther: {
    justifyContent: 'flex-start',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#1b2826',
    borderWidth: 1,
    borderColor: '#283b37',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeLight: {
    backgroundColor: '#eee6db',
    borderColor: '#ddd3c4',
  },
  badgeMine: {
    backgroundColor: 'rgba(23, 163, 152, 0.22)',
    borderColor: '#17a398',
  },
  badgeMineLight: {
    backgroundColor: 'rgba(23, 163, 152, 0.18)',
    borderColor: '#17a398',
  },
  badgeEmoji: {
    fontSize: 12,
    lineHeight: 16,
  },
  badgeCount: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
  },
  badgeCountLight: {
    color: '#57534e',
  },
  badgeCountMine: {
    color: '#17a398',
    fontWeight: '800',
  },
  addReactionBtn: {
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#162421',
    borderWidth: 1,
    borderColor: '#283b37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addReactionBtnLight: {
    backgroundColor: '#eee6db',
    borderColor: '#ddd3c4',
  },
});
