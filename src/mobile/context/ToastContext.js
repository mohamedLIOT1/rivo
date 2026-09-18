import React, { createContext, useContext, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [message, setMessage] = useState('');
  const [type, setType] = useState('success'); // 'success' | 'error'
  const opacity = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(100)).current;

  const showToast = (msg, toastType = 'success') => {
    setMessage(msg);
    setType(toastType);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(slideY, { toValue: 0, tension: 40, friction: 7, useNativeDriver: true })
    ]).start();

    setTimeout(() => {
      hideToast();
    }, 3000);
  };

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 100, duration: 300, useNativeDriver: true })
    ]).start();
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Animated.View
        style={[
          styles.toast,
          {
            opacity,
            transform: [{ translateY: slideY }],
            backgroundColor: type === 'success' ? '#1DB954' : '#ef4444'
          }
        ]}
      >
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 9999,
  },
  text: {
    color: '#000',
    fontWeight: '800',
    fontSize: 14,
    textAlign: 'center',
  },
});
