import React, { createContext, useContext, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Image, Platform, StatusBar } from 'react-native';
import { MessageSquare } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { normalizeCoverUri } from '../utils/coverUtils';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-30)).current;
  const timeoutRef = useRef(null);

  const dismissToast = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -30,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setToast(null));
  };

  const showToast = (messageOrObj, type = 'info', options = {}) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    let message = '';
    let toastType = type;
    let title = '';
    let avatar = '';
    let onPress = null;
    let duration = 2800;

    if (messageOrObj && typeof messageOrObj === 'object') {
      message = messageOrObj.message || messageOrObj.text || '';
      toastType = messageOrObj.type || type || 'info';
      title = messageOrObj.title || messageOrObj.senderName || '';
      avatar = messageOrObj.avatar || messageOrObj.senderAvatar || '';
      onPress = messageOrObj.onPress || null;
      duration = messageOrObj.duration || (toastType === 'chat' ? 4000 : 2800);
    } else {
      message = String(messageOrObj || '');
      toastType = type;
      if (typeof options === 'function') {
        onPress = options;
      } else if (options && typeof options === 'object') {
        title = options.title || options.senderName || '';
        avatar = options.avatar || options.senderAvatar || '';
        onPress = options.onPress || null;
        duration = options.duration || (toastType === 'chat' ? 4000 : 2800);
      }
    }

    setToast({
      message,
      type: toastType,
      title,
      avatar,
      onPress,
    });

    slideAnim.setValue(toastType === 'chat' ? -40 : 20);
    opacityAnim.setValue(0);

    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    timeoutRef.current = setTimeout(() => {
      dismissToast();
    }, duration);
  };

  const handlePress = () => {
    if (toast && typeof toast.onPress === 'function') {
      const cb = toast.onPress;
      dismissToast();
      cb();
    } else {
      dismissToast();
    }
  };

  const isChat = toast?.type === 'chat';

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      {toast && (
        isChat ? (
          <Animated.View
            style={[
              styles.chatToastContainer,
              {
                opacity: opacityAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.chatToastBox}
              activeOpacity={0.88}
              onPress={handlePress}
            >
              <View style={styles.chatAvatarWrapper}>
                {toast.avatar ? (
                  <Image
                    source={{ uri: normalizeCoverUri(toast.avatar) }}
                    style={styles.chatAvatar}
                  />
                ) : (
                  <View style={styles.chatAvatarFallback}>
                    <MessageSquare size={18} color="#00E5FF" />
                  </View>
                )}
                <View style={styles.chatOnlineDot} />
              </View>

              <View style={styles.chatContentWrap}>
                <View style={styles.chatHeaderRow}>
                  <Text style={styles.chatSenderName} numberOfLines={1}>
                    {toast.title || 'Friend'}
                  </Text>
                  <Text style={styles.chatTag}>NEW MESSAGE</Text>
                </View>
                <Text style={styles.chatMessageText} numberOfLines={1}>
                  {toast.message}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Animated.View
            style={[
              styles.toastContainer,
              {
                opacity: opacityAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {toast.onPress ? (
              <TouchableOpacity
                style={styles.toastBox}
                activeOpacity={0.85}
                onPress={handlePress}
              >
                <View style={[styles.indicator, toast.type === 'error' && styles.indicatorError]} />
                <Text style={styles.toastText} numberOfLines={2}>
                  {toast.message}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.toastBox}>
                <View style={[styles.indicator, toast.type === 'error' && styles.indicatorError]} />
                <Text style={styles.toastText} numberOfLines={2}>
                  {toast.message}
                </Text>
              </View>
            )}
          </Animated.View>
        )
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  // Regular bottom toast
  toastContainer: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20,
    zIndex: 99999,
    alignItems: 'center',
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.teal,
    marginRight: 10,
  },
  indicatorError: {
    backgroundColor: colors.crimson,
  },
  toastText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
  },

  // Interactive top chat notification banner
  chatToastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : ((StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 28)),
    left: 16,
    right: 16,
    zIndex: 99999,
    alignItems: 'center',
  },
  chatToastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#0F1A17',
    borderWidth: 1.5,
    borderColor: '#00E5FF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 12,
  },
  chatAvatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  chatAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1E2C28',
    borderWidth: 1,
    borderColor: '#00E5FF',
  },
  chatAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#162521',
    borderWidth: 1,
    borderColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00E5FF',
    borderWidth: 1.5,
    borderColor: '#0F1A17',
  },
  chatContentWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  chatSenderName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
    marginRight: 8,
  },
  chatTag: {
    color: '#00E5FF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  chatMessageText: {
    color: '#A0B2AC',
    fontSize: 12.5,
    fontWeight: '500',
  },
});
