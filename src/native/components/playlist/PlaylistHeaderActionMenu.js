import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  Edit3,
  Globe,
  Lock,
  ListPlus,
  Download,
  Sliders,
  Trash2,
  X,
  Check,
  ArrowUpDown,
} from 'lucide-react-native';
import { useTranslation } from '../../context/LocalizationContext';
import { useTheme } from '../../context/ThemeContext';
import { colors } from '../../theme/colors';

export default function PlaylistHeaderActionMenu({
  visible,
  onClose,
  playlist,
  isOwner,
  onEdit,
  onDelete,
  onTogglePrivacy,
  isTogglingPrivacy,
  onQueueAll,
  onDownloadAll,
  isDownloadingAll,
  downloadStats,
  canBeMix,
  isMixActive,
  onToggleMix,
  isReordering,
  onToggleReorder,
}) {
  const { t, isRTL } = useTranslation();
  const { isDark = true } = useTheme();

  if (!visible) return null;

  const isPublic = playlist?.isPublic !== false;
  const rtlTextStyle = isRTL
    ? {
        letterSpacing: 0,
        fontFamily: Platform.OS === 'ios' ? 'System' : 'normal',
        textAlign: 'right',
      }
    : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View
              style={[
                styles.sheet,
                {
                  backgroundColor: isDark ? '#111a18' : '#fdfbf7',
                  borderColor: isDark ? '#27272a' : colors.ink,
                },
              ]}
              renderToHardwareTextureAndroid={true}
            >
              {/* Header */}
              <View
                style={[
                  styles.headerRow,
                  { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
                  isRTL && { flexDirection: 'row-reverse' },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.sheetTitle,
                      { color: isDark ? '#fdfbf7' : colors.ink },
                      rtlTextStyle,
                    ]}
                    numberOfLines={1}
                  >
                    {playlist?.name || (isRTL ? 'قائمة التشغيل' : 'Playlist')}
                  </Text>
                  <Text
                    style={[
                      styles.sheetSubtitle,
                      { color: isDark ? '#9ca3af' : '#4b5563' },
                      rtlTextStyle,
                    ]}
                  >
                    {isRTL ? 'خيارات إضافية' : 'Playlist Options'}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={20} color={isDark ? '#e4e4e7' : colors.ink} />
                </TouchableOpacity>
              </View>

              {/* Action List */}
              <View style={styles.actionList}>
                {/* 1. Edit Playlist (Owner) */}
                {isOwner && (
                  <TouchableOpacity
                    style={[
                      styles.actionRow,
                      { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
                      isRTL && { flexDirection: 'row-reverse' },
                    ]}
                    onPress={() => {
                      onClose();
                      onEdit?.();
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconBox, { backgroundColor: 'rgba(23,163,152,0.15)' }]}>
                      <Edit3 size={16} color="#17a398" />
                    </View>
                    <Text
                      style={[
                        styles.actionText,
                        { color: isDark ? '#fdfbf7' : colors.ink },
                        rtlTextStyle,
                      ]}
                    >
                      {isRTL ? 'تعديل تفاصيل القائمة' : 'Edit Playlist Details'}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* 2. Public / Private Toggle (Owner) */}
                {isOwner && (
                  <TouchableOpacity
                    style={[
                      styles.actionRow,
                      { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
                      isRTL && { flexDirection: 'row-reverse' },
                    ]}
                    disabled={isTogglingPrivacy}
                    onPress={() => {
                      onTogglePrivacy?.();
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconBox, { backgroundColor: isPublic ? 'rgba(23,163,152,0.15)' : 'rgba(156,163,175,0.15)' }]}>
                      {isTogglingPrivacy ? (
                        <ActivityIndicator size="small" color="#17a398" />
                      ) : isPublic ? (
                        <Globe size={16} color="#17a398" />
                      ) : (
                        <Lock size={16} color="#9ca3af" />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.actionText,
                        { color: isDark ? '#fdfbf7' : colors.ink },
                        rtlTextStyle,
                      ]}
                    >
                      {isPublic
                        ? (isRTL ? 'تحويل إلى قائمة خاصة' : 'Make Playlist Private')
                        : (isRTL ? 'تحويل إلى قائمة عامة' : 'Make Playlist Public')}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* 3. Reorder Playlist */}
                {isOwner && onToggleReorder && (
                  <TouchableOpacity
                    style={[
                      styles.actionRow,
                      { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
                      isRTL && { flexDirection: 'row-reverse' },
                    ]}
                    onPress={() => {
                      onClose();
                      onToggleReorder();
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconBox, { backgroundColor: isReordering ? '#f59e0b' : 'rgba(23,163,152,0.15)' }]}>
                      <ArrowUpDown size={16} color={isReordering ? '#000000' : '#17a398'} />
                    </View>
                    <Text
                      style={[
                        styles.actionText,
                        { color: isDark ? '#fdfbf7' : colors.ink },
                        rtlTextStyle,
                      ]}
                    >
                      {isReordering
                        ? (isRTL ? 'إنهاء الترتيب' : 'Done Reordering')
                        : (isRTL ? 'إعادة ترتيب المقاطع (سحب وإفلات)' : 'Reorder Songs (Drag & Drop)')}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* 4. Queue All */}
                <TouchableOpacity
                  style={[
                    styles.actionRow,
                    { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
                    isRTL && { flexDirection: 'row-reverse' },
                  ]}
                  onPress={() => {
                    onClose();
                    onQueueAll?.();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(23,163,152,0.15)' }]}>
                    <ListPlus size={16} color="#17a398" />
                  </View>
                  <Text
                    style={[
                      styles.actionText,
                      { color: isDark ? '#fdfbf7' : colors.ink },
                      rtlTextStyle,
                    ]}
                  >
                    {isRTL ? 'إضافة كل المقاطع لقائمة الانتظار' : 'Queue All Songs'}
                  </Text>
                </TouchableOpacity>

                {/* 5. Download All */}
                <TouchableOpacity
                  style={[
                    styles.actionRow,
                    { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
                    isRTL && { flexDirection: 'row-reverse' },
                  ]}
                  disabled={isDownloadingAll}
                  onPress={() => {
                    onClose();
                    onDownloadAll?.();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(23,163,152,0.15)' }]}>
                    {isDownloadingAll ? (
                      <ActivityIndicator size="small" color="#17a398" />
                    ) : (
                      <Download size={16} color="#17a398" />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.actionText,
                      { color: isDark ? '#fdfbf7' : colors.ink },
                      rtlTextStyle,
                    ]}
                  >
                    {isDownloadingAll
                      ? `${isRTL ? 'جاري التنزيل' : 'Downloading'} (${downloadStats?.done || 0}/${downloadStats?.total || 0})`
                      : (isRTL ? 'تنزيل جميع المقاطع' : 'Download All Songs')}
                  </Text>
                </TouchableOpacity>

                {/* 6. Enable / Disable DJ Mix Mode */}
                {canBeMix && (
                  <TouchableOpacity
                    style={[
                      styles.actionRow,
                      { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
                      isRTL && { flexDirection: 'row-reverse' },
                    ]}
                    onPress={() => {
                      onClose();
                      onToggleMix?.();
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconBox, { backgroundColor: isMixActive ? '#f59e0b' : 'rgba(23,163,152,0.15)' }]}>
                      <Sliders size={16} color={isMixActive ? '#000000' : '#17a398'} />
                    </View>
                    <Text
                      style={[
                        styles.actionText,
                        { color: isDark ? '#fdfbf7' : colors.ink },
                        rtlTextStyle,
                      ]}
                    >
                      {isMixActive
                        ? (isRTL ? 'تعطيل وضع مكس DJ' : 'Disable DJ Mix Mode')
                        : (isRTL ? 'تفعيل وضع مكس DJ' : 'Enable DJ Mix Mode')}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* 7. Delete Playlist (Owner) */}
                {isOwner && (
                  <TouchableOpacity
                    style={[
                      styles.actionRow,
                      { borderBottomWidth: 0, marginTop: 4 },
                      isRTL && { flexDirection: 'row-reverse' },
                    ]}
                    onPress={() => {
                      onClose();
                      onDelete?.();
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconBox, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                      <Trash2 size={16} color="#ef4444" />
                    </View>
                    <Text
                      style={[
                        styles.actionText,
                        { color: '#ef4444', fontWeight: '900' },
                        rtlTextStyle,
                      ]}
                    >
                      {isRTL ? 'حذف قائمة التشغيل' : 'Delete Playlist'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: Platform.OS === 'android' ? 0 : 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.4,
  },
  sheetSubtitle: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 6,
  },
  actionList: {
    paddingTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
