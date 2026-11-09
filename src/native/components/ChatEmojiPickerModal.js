import React, { useState, useMemo, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Platform,
} from 'react-native';
import { X, Check } from 'lucide-react-native';
import { EMOJI_CATEGORIES } from '../data/chatEmojiData';

function ChatEmojiPickerModalComponent({
  visible,
  onClose,
  onSelectEmoji,
  isDark = true,
  title = 'React with Emoji',
  multiSelect = false,
}) {
  const [activeCategory, setActiveCategory] = useState('smiles');

  const currentCategory = useMemo(() => {
    return (
      EMOJI_CATEGORIES.find((cat) => cat.id === activeCategory) ||
      EMOJI_CATEGORIES[0]
    );
  }, [activeCategory]);

  const handleEmojiPress = useCallback(
    (emoji) => {
      if (onSelectEmoji) {
        onSelectEmoji(emoji);
      }
      if (!multiSelect && onClose) {
        onClose();
      }
    },
    [onSelectEmoji, multiSelect, onClose]
  );

  const renderEmojiItem = useCallback(
    ({ item }) => (
      <TouchableOpacity
        style={styles.emojiCell}
        onPress={() => handleEmojiPress(item)}
        activeOpacity={0.6}
        hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
      >
        <Text style={styles.emojiGlyph}>{item}</Text>
      </TouchableOpacity>
    ),
    [handleEmojiPress]
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop touchable to close */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={[styles.sheet, !isDark && styles.sheetLight]}>
          {/* Top handle pill */}
          <View style={[styles.handlePill, !isDark && styles.handlePillLight]} />

          {/* Header */}
          <View style={[styles.header, !isDark && styles.headerLight]}>
            <Text style={[styles.title, !isDark && styles.titleLight]}>
              {title}
            </Text>
            <TouchableOpacity
              style={[styles.closeBtn, !isDark && styles.closeBtnLight]}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {multiSelect ? (
                <View style={styles.doneBtnRow}>
                  <Check size={14} color={!isDark ? '#082621' : '#17a398'} strokeWidth={2.8} />
                  <Text style={[styles.doneBtnText, !isDark && styles.doneBtnTextLight]}>Done</Text>
                </View>
              ) : (
                <X size={16} color={!isDark ? '#082621' : '#94a3b8'} strokeWidth={2.4} />
              )}
            </TouchableOpacity>
          </View>

          {/* Category Tabs */}
          <View style={[styles.categoryTabs, !isDark && styles.categoryTabsLight]}>
            {EMOJI_CATEGORIES.map((cat) => {
              const isActive = cat.id === activeCategory;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.tabBtn,
                    !isDark && styles.tabBtnLight,
                    isActive && styles.tabBtnActive,
                  ]}
                  onPress={() => setActiveCategory(cat.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.tabText,
                      !isDark && styles.tabTextLight,
                      isActive && styles.tabTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Emojis Grid */}
          <FlatList
            data={currentCategory.emojis}
            keyExtractor={(item, index) => `${activeCategory}-${item}-${index}`}
            renderItem={renderEmojiItem}
            numColumns={7}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.gridContent}
            initialNumToRender={28}
            maxToRenderPerBatch={28}
            windowSize={3}
            removeClippedSubviews={Platform.OS === 'android'}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      </View>
    </Modal>
  );
}

export default memo(ChatEmojiPickerModalComponent);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#0f1715',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1.5,
    borderColor: '#243632',
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    maxHeight: 380,
    minHeight: 320,
  },
  sheetLight: {
    backgroundColor: '#fbf8f2',
    borderColor: '#ded5c7',
  },
  handlePill: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#263b36',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  handlePillLight: {
    backgroundColor: '#ded5c7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1d2c29',
    marginBottom: 8,
  },
  headerLight: {
    borderBottomColor: '#ebd5c2',
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: '#17a398',
    letterSpacing: 0.3,
  },
  titleLight: {
    color: '#082621',
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnLight: {
    backgroundColor: '#efe7d8',
    borderRadius: 8,
  },
  doneBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(23, 163, 152, 0.15)',
  },
  doneBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#17a398',
  },
  doneBtnTextLight: {
    color: '#082621',
  },
  categoryTabs: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 10,
    backgroundColor: '#14201d',
    borderRadius: 12,
    padding: 3,
  },
  categoryTabsLight: {
    backgroundColor: '#eee6da',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  tabBtnLight: {
    backgroundColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: '#17a398',
  },
  tabText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#94a3b8',
  },
  tabTextLight: {
    color: '#57534e',
  },
  tabTextActive: {
    color: '#082621',
    fontWeight: '900',
  },
  gridContent: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  emojiCell: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 2,
    borderRadius: 10,
  },
  emojiGlyph: {
    fontSize: 24,
    lineHeight: 28,
  },
});
