import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  Animated, PanResponder, Platform, Dimensions, Alert,
} from 'react-native';
import { Trash2, GripVertical } from 'lucide-react-native';
import { normalizeCoverUri, DEFAULT_COVER } from '../../utils/coverUtils';
import { useTranslation } from '../../context/LocalizationContext';
import { isArabicText } from '../../theme/typography';
import { colors } from './fullPlayerStyles';
import { queueStyles as styles } from './fullPlayerQueueStyles';

const QUEUE_ROW_HEIGHT = 72;

export const QueueRowItem = React.memo(function QueueRowItem({
  item,
  index,
  isItemPlaying,
  isDragging,
  isTargetSlot,
  isAboveTarget,
  panHandler,
  panY,
  deckBg,
  deckBorder,
  isDark,
  onPlay,
  onRemove,
  canDrag,
}) {
  const rawCover = item?.coverUrl || item?.cover || item?.coverImage || item?.thumbnail || item?.artwork || DEFAULT_COVER;
  const itemCover = normalizeCoverUri(rawCover, item);
  const [thumbUri, setThumbUri] = useState(itemCover);

  useEffect(() => {
    setThumbUri(itemCover);
  }, [itemCover]);

  const titleColor = isItemPlaying ? colors.mint : (isDark ? '#ffffff' : '#0f172a');
  const artistColor = isDark ? '#94a3b8' : '#64748b';
  const controlBtnBg = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';

  return (
    <Animated.View
      style={[
        styles.queueItem,
        {
          backgroundColor: isDragging
            ? (isDark ? '#19332b' : '#c8f2e9')
            : isTargetSlot
            ? (isDark ? '#152520' : '#e6f7f3')
            : isItemPlaying
            ? (isDark ? '#14201c' : '#e6f4f1')
            : deckBg,
          borderColor: (isDragging || isTargetSlot || isItemPlaying) ? colors.mint : deckBorder,
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

      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}
        onPress={onPlay}
        activeOpacity={0.75}
        disabled={isDragging}
      >
        <Image
          source={{ uri: thumbUri }}
          style={styles.queueThumb}
          fadeDuration={0}
          resizeMode="cover"
          onError={() => setThumbUri(DEFAULT_COVER)}
        />
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text
            style={[
              styles.queueTitle,
              { color: titleColor },
              isArabicText(item?.title) && {
                letterSpacing: 0,
                fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
              },
            ]}
            numberOfLines={1}
          >
            {item?.title || 'Unknown Title'}
          </Text>
          <Text
            style={[
              styles.queueArtist,
              { color: artistColor },
              isArabicText(item?.artist) && {
                letterSpacing: 0,
                fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
              },
            ]}
            numberOfLines={1}
          >
            {item?.artist || 'Unknown Artist'}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.queueControlsRow}>
        <TouchableOpacity
          onPress={onRemove}
          style={[styles.queueActionBtn, { backgroundColor: controlBtnBg }]}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          activeOpacity={0.7}
        >
          <Trash2 size={15} color={isDark ? '#f87171' : '#ef4444'} />
        </TouchableOpacity>

        {canDrag && (
          <View
            {...(panHandler || {})}
            style={[
              styles.dragHandle,
              { backgroundColor: isDragging ? colors.mint + '44' : controlBtnBg }
            ]}
            hitSlop={{ top: 20, bottom: 20, left: 16, right: 16 }}
          >
            <GripVertical size={16} color={isDragging ? colors.mint : (isDark ? '#94a3b8' : '#64748b')} />
          </View>
        )}
      </View>
    </Animated.View>
  );
}, (prev, next) => {
  return (
    prev.item === next.item &&
    prev.isItemPlaying === next.isItemPlaying &&
    prev.isDragging === next.isDragging &&
    prev.isTargetSlot === next.isTargetSlot &&
    prev.isAboveTarget === next.isAboveTarget &&
    prev.deckBg === next.deckBg &&
    prev.deckBorder === next.deckBorder &&
    prev.canDrag === next.canDrag &&
    prev.isDark === next.isDark
  );
});

export const FullPlayerQueueView = React.memo(function FullPlayerQueueView({
  queue,
  trackId,
  isDark,
  deckBg,
  deckBorder,
  playTrack,
  removeFromQueue,
  reorderQueue,
  clearQueue,
  isPlaying = false,
  togglePlay,
}) {
  const { t, isRTL } = useTranslation();
  const rtlTextStyle = useMemo(() => (
    isRTL ? {
      letterSpacing: 0,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    } : null
  ), [isRTL]);

  const [draggingIdx, setDraggingIdx] = useState(null);
  const [hoverIdx, setHoverIdx] = useState(null);
  const draggingIdxRef = useRef(null);
  const hoverIdxRef = useRef(null);
  const panY = useRef(new Animated.Value(0)).current;
  const listRef = useRef(null);
  const scrollOffsetRef = useRef(0);

  const createPanResponder = (index) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        draggingIdxRef.current = index;
        hoverIdxRef.current = index;
        setDraggingIdx(index);
        setHoverIdx(index);
        panY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        panY.setValue(gestureState.dy);
        const deltaSlots = Math.round(gestureState.dy / QUEUE_ROW_HEIGHT);
        const maxIdx = Math.max(0, queue.length - 1);
        const nextHover = Math.max(0, Math.min(maxIdx, index + deltaSlots));
        if (hoverIdxRef.current !== nextHover) {
          hoverIdxRef.current = nextHover;
          setHoverIdx(nextHover);
        }
      },
      onPanResponderRelease: () => {
        const from = index;
        const to = hoverIdxRef.current;
        if (to !== null && to !== undefined && to !== from && typeof reorderQueue === 'function') {
          reorderQueue(from, to);
        }
        draggingIdxRef.current = null;
        hoverIdxRef.current = null;
        setDraggingIdx(null);
        setHoverIdx(null);
        panY.setValue(0);
      },
      onPanResponderTerminate: () => {
        draggingIdxRef.current = null;
        hoverIdxRef.current = null;
        setDraggingIdx(null);
        setHoverIdx(null);
        panY.setValue(0);
      },
    });
  };

  const panResponders = useMemo(() => {
    return queue.map((_, i) => createPanResponder(i));
  }, [queue.length]);

  const renderItem = useCallback(({ item, index }) => {
    const isItemPlaying = String(item._id || item.id) === trackId;
    const isDragging = draggingIdx === index;
    const isTargetSlot = hoverIdx === index && draggingIdx !== null && draggingIdx !== index;
    const isAboveTarget = hoverIdx !== null && draggingIdx !== null && hoverIdx < draggingIdx;

    return (
      <QueueRowItem
        item={item}
        index={index}
        isItemPlaying={isItemPlaying}
        isDragging={isDragging}
        isTargetSlot={isTargetSlot}
        isAboveTarget={isAboveTarget}
        panHandler={panResponders[index] ? panResponders[index].panHandlers : null}
        panY={panY}
        deckBg={deckBg}
        deckBorder={deckBorder}
        isDark={isDark}
        onPlay={() => {
          if (isItemPlaying) {
            if (!isPlaying && togglePlay) {
              togglePlay();
            } else if (playTrack) {
              playTrack(item, queue, false, 0, false, false, true);
            }
          } else if (playTrack) {
            playTrack(item, queue, false, 0, false, false, true);
          }
        }}
        onRemove={() => removeFromQueue && removeFromQueue(index)}
        canDrag={queue.length > 1}
      />
    );
  }, [trackId, draggingIdx, hoverIdx, panResponders, panY, deckBg, deckBorder, isDark, playTrack, queue, removeFromQueue, isPlaying, togglePlay]);

  return (
    <View style={{ flex: 1 }}>
      {queue.length > 0 && (
        <View style={styles.queueHeaderRow}>
          <Text style={[styles.queueHeaderTitle, { color: isDark ? colors.mint : colors.ink }, rtlTextStyle]}>
            {isRTL ? `التالي (${queue.length})` : `UP NEXT (${queue.length})`}
          </Text>
          <TouchableOpacity
            style={styles.clearQueueBtn}
            onPress={() => {
              Alert.alert(
                'Clear Queue',
                'Remove all upcoming songs from queue?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear All', style: 'destructive', onPress: clearQueue }
                ]
              );
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.clearQueueBtnText, rtlTextStyle]}>{isRTL ? 'مسح الكل' : 'CLEAR ALL'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        ref={listRef}
        data={queue}
        scrollEnabled={draggingIdx === null}
        onScroll={(e) => {
          scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        keyExtractor={(item, index) => `${item._id || item.id || 'track'}-${index}`}
        getItemLayout={(_, index) => ({
          length: QUEUE_ROW_HEIGHT,
          offset: QUEUE_ROW_HEIGHT * index,
          index,
        })}
        initialNumToRender={Platform.OS === 'android' ? 6 : 10}
        maxToRenderPerBatch={Platform.OS === 'android' ? 6 : 8}
        windowSize={Platform.OS === 'android' ? 3 : 5}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS === 'android'}
        renderItem={renderItem}
        contentContainerStyle={styles.queueBody}
        ListEmptyComponent={
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ color: '#9ca3af', fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo' }}>
              Queue is empty.
            </Text>
          </View>
        }
      />
    </View>
  );
});

export default FullPlayerQueueView;
