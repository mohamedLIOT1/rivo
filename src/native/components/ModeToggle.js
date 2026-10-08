import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Pressable,
} from 'react-native';
import { Wifi, WifiOff, RotateCcw, ChevronUp } from 'lucide-react-native';
import { useConnectivity } from '../context/ConnectivityContext';
import { colors } from '../theme/colors';

/**
 * ModeToggle
 *
 * Floating pill button that sits above the bottom navigation bar.
 * Shows the current mode (🌐 Online / 📱 Offline), lets the user
 * tap to switch, and expand for auto/manual settings.
 */
export default function ModeToggle() {
  const {
    appMode,
    isAutoMode,
    networkState,
    toggleMode,
    resetToAuto,
  } = useConnectivity();

  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;

  const isOnline = appMode === 'online';

  const handleToggle = () => {
    toggleMode();
  };

  const handleExpand = () => {
    const toValue = expanded ? 0 : 1;
    setExpanded(!expanded);
    Animated.timing(expandAnim, {
      toValue,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

  const expandedHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 72],
  });

  return (
    <View style={styles.wrapper}>
      {/* Expanded panel (auto/manual info) */}
      <Animated.View style={[styles.expandedPanel, { height: expandedHeight, opacity: expandAnim }]}>
        <View style={styles.expandedContent}>
          {/* Status row */}
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: networkState.isConnected ? '#22c55e' : '#ef4444' }]} />
            <Text style={styles.statusText}>
              {networkState.isConnected
                ? `Connected (${networkState.type})`
                : 'No connection'}
            </Text>
          </View>

          {/* Mode info & reset */}
          <View style={styles.modeRow}>
            <Text style={styles.modeLabel}>
              {isAutoMode ? '🔄 AUTO MODE' : '🔒 MANUAL MODE'}
            </Text>
            {!isAutoMode && (
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={resetToAuto}
                activeOpacity={0.7}
              >
                <RotateCcw size={10} color={colors.teal} />
                <Text style={styles.resetText}>AUTO</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.View>

      {/* Main toggle pill */}
      <View style={styles.pillRow}>
        {/* Expand button */}
        <TouchableOpacity
          style={styles.expandBtn}
          onPress={handleExpand}
          activeOpacity={0.7}
        >
          <Animated.View style={{
            transform: [{
              rotate: expandAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '180deg'],
              }),
            }],
          }}>
            <ChevronUp size={12} color="#9ca3af" />
          </Animated.View>
        </TouchableOpacity>

        {/* Toggle button */}
        <TouchableOpacity
          style={[
            styles.togglePill,
            isOnline ? styles.toggleOnline : styles.toggleOffline,
          ]}
          onPress={handleToggle}
          activeOpacity={0.8}
        >
          {isOnline ? (
            <Wifi size={13} color="#0b1110" strokeWidth={2.5} />
          ) : (
            <WifiOff size={13} color={colors.teal} strokeWidth={2.5} />
          )}
          <Text
            style={[
              styles.toggleText,
              isOnline ? styles.toggleTextOnline : styles.toggleTextOffline,
            ]}
          >
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 62, // Just above the bottom tab bar (56px + some spacing)
    right: 12,
    alignItems: 'flex-end',
    zIndex: 100,
  },

  // Expanded info panel
  expandedPanel: {
    overflow: 'hidden',
    marginBottom: 4,
  },
  expandedContent: {
    backgroundColor: '#141d1b',
    borderWidth: 1.5,
    borderColor: '#263330',
    borderRadius: 10,
    padding: 10,
    gap: 6,
    minWidth: 180,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    color: '#9ca3af',
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeLabel: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 9,
    color: '#fdfbf7',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(23,163,152,0.15)',
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  resetText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 8,
    color: colors.teal,
  },

  // Main pill row
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expandBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#141d1b',
    borderWidth: 1,
    borderColor: '#263330',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Toggle pill
  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#0b1110',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  toggleOnline: {
    backgroundColor: colors.teal,
  },
  toggleOffline: {
    backgroundColor: '#182321',
    borderColor: colors.teal,
  },
  toggleText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  toggleTextOnline: {
    color: '#0b1110',
  },
  toggleTextOffline: {
    color: colors.teal,
  },
});
