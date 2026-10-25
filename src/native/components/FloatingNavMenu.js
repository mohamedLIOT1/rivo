import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  TouchableWithoutFeedback,
  Modal,
  Dimensions,
  PanResponder,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useNavPreferences } from '../context/NavPreferencesContext';
import { colors } from '../theme/colors';
import NavHubIcon from '../ui/NavHubIcon';

const BUTTON_SIZE = 58;
const ITEM_CIRCLE_SIZE = 50;
const ARC_RADIUS = 124; // Expanded radial distance for comfortable spacing

export default function FloatingNavMenu({ activeTab, onTabPress }) {
  const { isDark } = useTheme();
  const { visibleMenuItems } = useNavPreferences();
  const [isOpen, setIsOpen] = useState(false);
  const [dockedSide, setDockedSide] = useState(null); // null | 'left' | 'right' | 'top' | 'bottom'

  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

  // Gesture dragging values
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  // Animation values
  const menuAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Staggered animated values for each item
  const itemAnims = useRef(visibleMenuItems.map(() => new Animated.Value(0))).current;

  // Keep itemAnims aligned with count of visible items
  useEffect(() => {
    while (itemAnims.length < visibleMenuItems.length) {
      itemAnims.push(new Animated.Value(isOpen ? 1 : 0));
    }
    while (itemAnims.length > visibleMenuItems.length) {
      itemAnims.pop();
    }
  }, [visibleMenuItems.length, isOpen, itemAnims]);

  // Subtle breathing pulse for closed FAB
  useEffect(() => {
    if (!isOpen && !dockedSide) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.14,
            duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1600,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isOpen, dockedSide, pulseAnim]);

  // Calculate arc offsets (dX, dY) for N items
  const itemPositions = useMemo(() => {
    const N = visibleMenuItems.length;
    if (N === 0) return [];
    if (N === 1) {
      return [{ dX: 0, dY: -ARC_RADIUS }];
    }

    const minAngle = 160; // Leftmost angle in degrees
    const maxAngle = 20;  // Rightmost angle in degrees
    const step = (minAngle - maxAngle) / (N - 1);

    return visibleMenuItems.map((_, i) => {
      const angleDeg = minAngle - i * step;
      const angleRad = (angleDeg * Math.PI) / 180;
      const dX = ARC_RADIUS * Math.cos(angleRad);
      const dY = -ARC_RADIUS * Math.sin(angleRad);
      return { dX, dY };
    });
  }, [visibleMenuItems]);

  // Instant snap back to center
  const snapBackToCenter = useCallback(() => {
    setDockedSide(null);
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      tension: 190,
      friction: 12,
      useNativeDriver: false,
    }).start();
  }, [pan]);

  // Instant dock to one of the 4 edges
  const dockToEdge = useCallback((side, releaseX, releaseY) => {
    setDockedSide(side);

    let targetX = 0;
    let targetY = 0;

    const halfW = SCREEN_WIDTH / 2;
    const halfBtn = BUTTON_SIZE / 2;

    if (side === 'left') {
      targetX = -(halfW - 12);
      targetY = Math.max(-(SCREEN_HEIGHT - 180), Math.min(20, releaseY - (SCREEN_HEIGHT - 80)));
    } else if (side === 'right') {
      targetX = halfW - 12;
      targetY = Math.max(-(SCREEN_HEIGHT - 180), Math.min(20, releaseY - (SCREEN_HEIGHT - 80)));
    } else if (side === 'top') {
      targetX = Math.max(-(halfW - 40), Math.min(halfW - 40, releaseX - halfW));
      targetY = -(SCREEN_HEIGHT - 100);
    } else if (side === 'bottom') {
      targetX = Math.max(-(halfW - 40), Math.min(halfW - 40, releaseX - halfW));
      targetY = 28;
    }

    Animated.spring(pan, {
      toValue: { x: targetX, y: targetY },
      tension: 260,
      friction: 14,
      useNativeDriver: false,
    }).start();
  }, [pan, SCREEN_WIDTH, SCREEN_HEIGHT]);

  // PanResponder for drag-to-edge docking across all 4 edges (instant feel)
  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (isOpen) return false;
        return Math.abs(gestureState.dx) > 8 || Math.abs(gestureState.dy) > 8;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: pan.x._value,
          y: pan.y._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        const moveX = gestureState.moveX;
        const moveY = gestureState.moveY;

        // Tap without significant drag opens menu immediately
        if (Math.abs(gestureState.dx) < 10 && Math.abs(gestureState.dy) < 10) {
          openMenu();
          return;
        }

        // Instant 4-Edge Snap: Find closest edge among (Left, Right, Top, Bottom)
        const distLeft = moveX;
        const distRight = SCREEN_WIDTH - moveX;
        const distTop = moveY;
        const distBottom = SCREEN_HEIGHT - moveY;
        const minDist = Math.min(distLeft, distRight, distTop, distBottom);

        if (minDist === distLeft) {
          dockToEdge('left', moveX, moveY);
        } else if (minDist === distRight) {
          dockToEdge('right', moveX, moveY);
        } else if (minDist === distTop) {
          dockToEdge('top', moveX, moveY);
        } else {
          dockToEdge('bottom', moveX, moveY);
        }
      },
      onPanResponderTerminate: () => {
        snapBackToCenter();
      },
    });
  }, [isOpen, pan, dockToEdge, snapBackToCenter, SCREEN_WIDTH, SCREEN_HEIGHT]);

  const openMenu = () => {
    if (dockedSide) {
      setDockedSide(null);
      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        tension: 260,
        friction: 14,
        useNativeDriver: false,
      }).start();
    }
    setIsOpen(true);
    Animated.parallel([
      Animated.spring(menuAnim, {
        toValue: 1,
        tension: 120,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.stagger(
        40,
        itemAnims.map((anim) =>
          Animated.spring(anim, {
            toValue: 1,
            tension: 110,
            friction: 7,
            useNativeDriver: true,
          })
        )
      ),
    ]).start();
  };

  const closeMenu = (callback) => {
    Animated.parallel([
      Animated.timing(menuAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      ...itemAnims.map((anim) =>
        Animated.timing(anim, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        })
      ),
    ]).start(() => {
      setIsOpen(false);
      if (callback) callback();
    });
  };

  const handleItemPress = (screen) => {
    closeMenu(() => {
      if (onTabPress) {
        onTabPress(screen);
      }
    });
  };

  // Interpolations
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  const fabScale = pulseAnim.interpolate({
    inputRange: [1, 1.14],
    outputRange: [1, 1.05],
  });

  const isDocked = Boolean(dockedSide);

  return (
    <>
      {/* ── Floating Draggable Button ── */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.fabWrapper,
          {
            bottom: Platform.OS === 'ios' ? 24 : 14,
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
            ],
            opacity: isOpen ? 0 : 1, // Single X: hidden while modal menu is open
          },
        ]}
      >
        {/* Breathing glow ring (only when dockedSide is null) */}
        {!isOpen && !isDocked && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.fabPulseRing,
              {
                borderColor: colors.mint,
                transform: [{ scale: pulseAnim }],
                opacity: pulseAnim.interpolate({
                  inputRange: [1, 1.14],
                  outputRange: [0.45, 0],
                }),
              },
            ]}
          />
        )}

        {/* The Action Button or Docked Handle */}
        <TouchableOpacity
          style={[
            styles.fabButton,
            isDark ? styles.fabButtonDark : styles.fabButtonLight,
            dockedSide === 'left' && styles.fabDockedLeft,
            dockedSide === 'right' && styles.fabDockedRight,
            dockedSide === 'top' && styles.fabDockedTop,
            dockedSide === 'bottom' && styles.fabDockedBottom,
          ]}
          onPress={() => (isDocked ? snapBackToCenter() : openMenu())}
          activeOpacity={0.85}
        >
          {isDocked ? (
            <View
              style={
                dockedSide === 'top' || dockedSide === 'bottom'
                  ? styles.dockedHandleBarH
                  : styles.dockedHandleBarV
              }
            />
          ) : (
            <Animated.View
              style={[
                styles.fabIconContainer,
                { transform: [{ rotate: spin }, { scale: fabScale }] },
              ]}
            >
              <NavHubIcon size={24} color={isDark ? '#0b1110' : '#ffffff'} strokeWidth={2.4} />
            </Animated.View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* ── Expanded Radial Arc Menu in Modal ── */}
      {isOpen && (
        <Modal
          visible={isOpen}
          transparent={true}
          animationType="none"
          onRequestClose={() => closeMenu()}
        >
          <TouchableWithoutFeedback onPress={() => closeMenu()}>
            <Animated.View
              style={[
                styles.overlay,
                {
                  opacity: menuAnim,
                },
              ]}
            >
              {/* Radial Items Arc Container */}
              <View
                style={[
                  styles.arcContainer,
                  {
                    bottom: (Platform.OS === 'ios' ? 24 : 14),
                  },
                ]}
              >
                {visibleMenuItems.map((item, index) => {
                  const Icon = item.icon;
                  const active = activeTab === item.screen;
                  const pos = itemPositions[index] || { dX: 0, dY: -ARC_RADIUS };
                  const itemAnim = itemAnims[index] || menuAnim;

                  const translateX = itemAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, pos.dX],
                  });
                  const translateY = itemAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, pos.dY],
                  });
                  const scale = itemAnim.interpolate({
                    inputRange: [0, 0.6, 1],
                    outputRange: [0, 1.15, 1],
                  });
                  const opacity = itemAnim.interpolate({
                    inputRange: [0, 0.3, 1],
                    outputRange: [0, 0.7, 1],
                  });

                  return (
                    <Animated.View
                      key={item.id}
                      style={[
                        styles.arcItemWrapper,
                        {
                          opacity,
                          transform: [
                            { translateX },
                            { translateY },
                            { scale },
                          ],
                        },
                      ]}
                    >
                      <TouchableOpacity
                        style={[
                          styles.arcCircle,
                          isDark ? styles.arcCircleDark : styles.arcCircleLight,
                          active && styles.arcCircleActive,
                        ]}
                        onPress={() => handleItemPress(item.screen)}
                        activeOpacity={0.8}
                      >
                        <Icon
                          size={22}
                          color={active ? '#0b1110' : (isDark ? colors.mint : '#0b1110')}
                          strokeWidth={active ? 2.8 : 2.2}
                        />
                        {active && <View style={styles.activeGlowRing} />}
                      </TouchableOpacity>

                      <Text
                        style={[
                          styles.arcLabel,
                          isDark ? styles.arcLabelDark : styles.arcLabelLight,
                          active && styles.arcLabelActive,
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                    </Animated.View>
                  );
                })}

                {/* Single Clean Close Button in Modal */}
                <TouchableOpacity
                  style={[
                    styles.fabButtonInModal,
                    styles.fabButtonOpen,
                  ]}
                  onPress={() => closeMenu()}
                  activeOpacity={0.88}
                >
                  <X size={24} color="#ffffff" strokeWidth={2.8} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fabWrapper: {
    position: 'absolute',
    alignSelf: 'center',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60,
  },
  fabPulseRing: {
    position: 'absolute',
    width: BUTTON_SIZE + 16,
    height: BUTTON_SIZE + 16,
    borderRadius: (BUTTON_SIZE + 16) / 2,
    borderWidth: 2,
  },
  fabButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  fabButtonDark: {
    backgroundColor: colors.mint,
    borderColor: '#0b1110',
  },
  fabButtonLight: {
    backgroundColor: '#0b1110',
    borderColor: '#26c4b7',
  },

  /* 4-Edge Docked Handles */
  fabDockedLeft: {
    width: 20,
    height: 54,
    borderRadius: 0,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderLeftWidth: 0,
    backgroundColor: '#082621',
    borderColor: colors.teal,
  },
  fabDockedRight: {
    width: 20,
    height: 54,
    borderRadius: 0,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderRightWidth: 0,
    backgroundColor: '#082621',
    borderColor: colors.teal,
  },
  fabDockedTop: {
    width: 54,
    height: 20,
    borderRadius: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderTopWidth: 0,
    backgroundColor: '#082621',
    borderColor: colors.teal,
  },
  fabDockedBottom: {
    width: 54,
    height: 20,
    borderRadius: 0,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomWidth: 0,
    backgroundColor: '#082621',
    borderColor: colors.teal,
  },

  dockedHandleBarV: {
    width: 3.5,
    height: 20,
    borderRadius: 2,
    backgroundColor: colors.mint,
  },
  dockedHandleBarH: {
    width: 20,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: colors.mint,
  },

  fabButtonOpen: {
    backgroundColor: '#ff4757',
    borderColor: '#ffffff',
  },
  fabIconContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Modal Overlay */
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  arcContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
  },
  arcItemWrapper: {
    position: 'absolute',
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  arcCircle: {
    width: ITEM_CIRCLE_SIZE,
    height: ITEM_CIRCLE_SIZE,
    borderRadius: ITEM_CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  arcCircleDark: {
    backgroundColor: '#082621',
    borderColor: colors.teal,
  },
  arcCircleLight: {
    backgroundColor: '#e6f7f4',
    borderColor: '#0b1110',
  },
  arcCircleActive: {
    backgroundColor: colors.mint,
    borderColor: '#ffffff',
  },
  activeGlowRing: {
    position: 'absolute',
    width: ITEM_CIRCLE_SIZE + 8,
    height: ITEM_CIRCLE_SIZE + 8,
    borderRadius: (ITEM_CIRCLE_SIZE + 8) / 2,
    borderWidth: 1.5,
    borderColor: colors.mint,
    opacity: 0.6,
  },
  arcLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 5,
    textAlign: 'center',
    textTransform: 'uppercase',
    backgroundColor: 'rgba(5, 10, 9, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  arcLabelDark: {
    color: '#e6f7f4',
  },
  arcLabelLight: {
    color: '#ffffff',
  },
  arcLabelActive: {
    color: colors.mint,
    fontWeight: '900',
  },
  fabButtonInModal: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
});
