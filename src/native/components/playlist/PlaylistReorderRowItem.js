import React from 'react';
import { View, Text, Image, Animated, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { Trash2, GripVertical } from 'lucide-react-native';
import { normalizeCoverUri } from '../../utils/coverUtils';
import { colors } from '../../theme/colors';

export const QUEUE_ROW_HEIGHT = 64;

export const PlaylistReorderRowItem = React.memo(function PlaylistReorderRowItem({
  item,
  index,
  isDragging,
  isTargetSlot,
  isAboveTarget,
  panHandler,
  panY,
  isDark,
  onRemove,
}) {
  return (
    <Animated.View
      style={[
        styles.reorderRow,
        !isDark && styles.reorderRowLight,
        {
          backgroundColor: isDragging
            ? (isDark ? '#19332b' : '#c8f2e9')
            : isTargetSlot
            ? (isDark ? '#152520' : '#e6f7f3')
            : (isDark ? '#0c1815' : '#f8fafc'),
          borderColor: (isDragging || isTargetSlot) ? colors.mint : 'transparent',
          transform: [
            { translateY: isDragging ? panY : 0 },
            { scale: isDragging ? 1.03 : 1 }
          ],
          zIndex: isDragging ? 9999 : 1,
          elevation: isDragging && Platform.OS !== 'android' ? 24 : 0,
        },
      ]}
    >
      {isTargetSlot && (
        <View
          style={[
            styles.dropIndicatorBar,
            isAboveTarget ? { top: -2 } : { bottom: -2 },
            { backgroundColor: colors.mint }
          ]}
        />
      )}
      <View style={{ width: 26, alignItems: 'center' }}>
        <Text style={{ fontSize: 11, fontWeight: '800', color: '#94a3b8' }}>{index + 1}</Text>
      </View>
      <Image
        source={{ uri: normalizeCoverUri(item?.cover || item?.coverUrl) }}
        style={{ width: 40, height: 40, borderRadius: 6, marginHorizontal: 8, backgroundColor: '#1f2e2a' }}
        resizeMode="cover"
        fadeDuration={0}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: isDark ? '#ffffff' : '#0b1110' }} numberOfLines={1}>
          {item?.title || 'Untitled'}
        </Text>
        <Text style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b' }} numberOfLines={1}>
          {item?.artist || 'Unknown Artist'}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TouchableOpacity
          onPress={() => onRemove(item, index)}
          style={[styles.reorderBtn, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#fee2e2', borderColor: '#ef4444' }]}
          activeOpacity={0.7}
        >
          <Trash2 size={15} color="#ef4444" />
        </TouchableOpacity>

        <View
          {...(panHandler || {})}
          style={[
            styles.dragHandle,
            { backgroundColor: isDragging ? colors.mint + '44' : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)') }
          ]}
          hitSlop={{ top: 20, bottom: 20, left: 16, right: 16 }}
        >
          <GripVertical size={18} color={isDragging ? colors.mint : (isDark ? '#94a3b8' : '#64748b')} />
        </View>
      </View>
    </Animated.View>
  );
}, (prev, next) => {
  return (
    prev.item === next.item &&
    prev.index === next.index &&
    prev.isDragging === next.isDragging &&
    prev.isTargetSlot === next.isTargetSlot &&
    prev.isAboveTarget === next.isAboveTarget &&
    prev.isDark === next.isDark &&
    prev.panHandler === next.panHandler
  );
});

const styles = StyleSheet.create({
  reorderRow: {
    height: QUEUE_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2e2a',
    backgroundColor: '#0c1815',
  },
  reorderRowLight: {
    backgroundColor: '#f8fafc',
    borderBottomColor: '#e2e8f0',
  },
  dropIndicatorBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 1.5,
    zIndex: 10,
  },
  reorderBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandle: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default PlaylistReorderRowItem;
