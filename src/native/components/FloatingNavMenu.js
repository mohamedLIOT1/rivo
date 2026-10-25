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
  const [dockedSide, setDockedSide] = useState(null); // null | 'left' | 'right'

  // Gesture dragging values
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const screenWidth = Dimensions.get('window').width;

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

  const snapBackToCenter = useCallback(() => {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      friction: 7,
      tension: 65,
      useNativeDriver: false,
    }).start(() => {
      setDockedSide(null);
    });
  }, [pan]);

  const dockToEdge = useCallback((side, releaseY) => {
    const targetX = side === 'left' ? -(screenWidth / 2 - 14) : (screenWidth / 2 - 14);
    // Clamp Y to safe screen bounds
    const clampedY = Math.max(-300, Math.min(60, pan.y._value || 0));

    Animated.spring(pan, {
      toValue: { x: targetX, y: clampedY },
      friction: 7,
      tension: 70,
      useNativeDriver: false,
    }).start(() => {
      setDockedSide(side);
    });
  }, [pan, screenWidth]);

  // PanResponder for drag-to-edge docking and return-to-center
  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (isOpen) return false;
        return Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;
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
        const finalX = gestureState.moveX;
        if (finalX < screenWidth * 0.18) {
          dockToEdge('left', gestureState.moveY);
        } else if (finalX > screenWidth * 0.82) {
          dockToEdge('right', gestureState.moveY);
        } else {
          snapBackToCenter();
        }
      },
    });
  }, [isOpen, screenWidth, dockToEdge, snapBackToCenter, pan]);

  const openMenu = useCallback(() => {
    if (dockedSide) {
      snapBackToCenter();
      return;
    }
    setIsOpen(true);

    Animated.parallel([
      Animated.timing(menuAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(rotateAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.stagger(
        35,
        itemAnims.slice(0, visibleMenuItems.length).map((anim) =>
          Animated.spring(anim, {
            toValue: 1,
            friction: 6,
            tension: 75,
            useNativeDriver: true,
          })
        )
      ),
    ]).start();
  }, [dockedSide, snapBackToCenter, menuAnim, rotateAnim, itemAnims, visibleMenuItems.length]);

  const closeMenu = useCallback((callback) => {
    Animated.parallel([
      Animated.timing(menuAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.parallel(
        itemAnims.slice(0, visibleMenuItems.length).map((anim) =>
          Animated.timing(anim, {
            toValue: 0,
            duration: 160,
            useNativeDriver: true,
          })
        )
      ),
    ]).start(() => {
      setIsOpen(false);
      if (typeof callback === 'function') callback();
    });
  }, [menuAnim, rotateAnim, itemAnims, visibleMenuItems.length]);

  const handleToggle = useCallback(() => {
    if (dockedSide) {
      snapBackToCenter();
      return;
    }
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }, [dockedSide, snapBackToCenter, isOpen, openMenu, closeMenu]);

  const handleSelectTab = useCallback((screen) => {
    closeMenu(() => {
      onTabPress(screen);
    });
  }, [closeMenu, onTabPress]);

  // Rotations & fades for icons
  const rLogoRotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  const rLogoOpacity = rotateAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [1, 0, 0],
  });

  const overlayOpacity = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // Check if item is currently active screen
  const isItemActive = (screen) => {
    if (screen === 'home' || screen === 'music') return activeTab === 'music' || activeTab === 'home';
    return activeTab === screen;
  };

  return (
    <>
      {/* ── Fixed Floating Button At Bottom Center (with Pan drag-to-edge) ── */}
      <Animated.View
        style={[
          styles.fabWrapper,
          {
            bottom: Platform.OS === 'ios' ? 24 : 16,
            transform: [{ translateX: pan.x }, { translateY: pan.y }],
            opacity: isOpen ? 0 : 1, // Fix Item 3: Hide background FAB when open so no double X!
          },
        ]}
        pointerEvents={isOpen ? 'none' : 'box-none'}
        {...panResponder.panHandlers}
      >
        {/* Glow / Pulse Ring */}
        {!isOpen && !dockedSide && (
          <Animated.View
            style={[
              styles.fabPulseRing,
              {
                borderColor: isDark ? colors.teal : colors.ink,
                transform: [{ scale: pulseAnim }],
                opacity: pulseAnim.interpolate({
                  inputRange: [1, 1.14],
                  outputRange: [0.4, 0],
                }),
              },
            ]}
          />
        )}

        {/* Center Circular Trigger Button */}
        <TouchableOpacity
          style={[
            styles.fabButton,
            isDark ? styles.fabButtonDark : styles.fabButtonLight,
            dockedSide && (dockedSide === 'left' ? styles.fabDockedLeft : styles.fabDockedRight),
          ]}
          onPress={handleToggle}
          activeOpacity={0.88}
        >
          {dockedSide ? (
            /* Docked Pill Handle */
            <View style={styles.dockedHandleBar} />
          ) : (
            /* Normal Hub Grid Icon */
            <Animated.View
              style={[
                styles.fabIconContainer,
                {
                  opacity: rLogoOpacity,
                  transform: [{ rotate: rLogoRotate }],
                },
              ]}
            >
              <NavHubIcon
                size={26}
                color={isDark ? '#0b1110' : '#26c4b7'}
              />
            </Animated.View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* ── Modal Overlay + Radial Menu Items ── */}
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
                { opacity: overlayOpacity },
              ]}
            >
              {/* Radial Arc Items Container - Anchored to center bottom */}
              <View
                style={[
                  styles.arcContainer,
                  { bottom: (Platform.OS === 'ios' ? 24 : 16) + BUTTON_SIZE / 2 },
                ]}
              >
                {visibleMenuItems.map((item, index) => {
                  const anim = itemAnims[index] || new Animated.Value(0);
                  const pos = itemPositions[index] || { dX: 0, dY: -ARC_RADIUS };
                  const active = isItemActive(item.screen);
                  const Icon = item.icon;

                  const translateX = anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, pos.dX],
                  });

                  const translateY = anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, pos.dY],
                  });

                  const scale = anim.interpolate({
                    inputRange: [0, 0.4, 1],
                    outputRange: [0.1, 0.7, 1],
                  });

                  const opacity = anim.interpolate({
                    inputRange: [0, 0.3, 1],
                    outputRange: [0, 0.8, 1],
                  });

                  return (
                    <Animated.View
                      key={item.id}
                      style={[
                        styles.arcItemWrapper,
                        {
                          transform: [{ translateX }, { translateY }, { scale }],
                          opacity,
                        },
                      ]}
                    >
                      <TouchableOpacity
                        style={[
                          styles.arcCircle,
                          isDark ? styles.arcCircleDark : styles.arcCircleLight,
                          active && styles.arcCircleActive,
                        ]}
                        onPress={() => handleSelectTab(item.screen)}
                        activeOpacity={0.8}
                      >
                        <Icon
                          size={22}
                          color={active ? '#0b1110' : (isDark ? colors.mint : '#0b1110')}
                          strokeWidth={active ? 2.8 : 2.2}
                        />

                        {/* Active Indicator Glow Ring */}
                        {active && <View style={styles.activeGlowRing} />}
                      </TouchableOpacity>

                      {/* Monospace Brutalist Label with pill backdrop for zero overlapping */}
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
  fabDockedLeft: {
    width: 22,
    height: 56,
    borderRadius: 0,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderLeftWidth: 0,
    backgroundColor: '#082621',
    borderColor: colors.teal,
  },
  fabDockedRight: {
    width: 22,
    height: 56,
    borderRadius: 0,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    borderRightWidth: 0,
    backgroundColor: '#082621',
    borderColor: colors.teal,
  },
  dockedHandleBar: {
    width: 4,
    height: 22,
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
