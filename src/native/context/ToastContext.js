import React, { createContext, useContext, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors } from '../theme/colors';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef(null);

  const showToast = (message, type = 'info') => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToast({ message, type });

    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();

    timeoutRef.current = setTimeout(() => {
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setToast(null));
    }, 2400);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Animated.View style={[styles.toastContainer, { opacity: opacityAnim }]}>
          <View style={styles.toastBox}>
            <View style={[styles.indicator, toast.type === 'error' && styles.indicatorError]} />
            <Text style={styles.toastText} numberOfLines={2}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20,
    zIndex: 9999,
    alignItems: 'center',
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderWidth: 2.5,
    borderColor: colors.ink,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 2,
    maxWidth: '90%',
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
});
