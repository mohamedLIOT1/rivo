import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { RefreshCw, AlertTriangle } from 'lucide-react-native';
import { colors } from '../theme/colors';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('[Rivo ErrorBoundary Caught]:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor="#0b1110" />
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <AlertTriangle size={32} color={colors.rust} />
            </View>
            <Text style={styles.title}>DISPENSARY RECOVERY</Text>
            <Text style={styles.subtitle}>
              An unexpected UI glitch occurred in offline mode. The session has been protected and stabilized.
            </Text>
            {this.state.error?.message && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText} numberOfLines={3}>
                  {this.state.error.message}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={this.handleReload}
              activeOpacity={0.8}
            >
              <RefreshCw size={14} color="#0b1110" />
              <Text style={styles.retryBtnText}>RELOAD INTERFACE</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1110',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#141d1b',
    borderWidth: 2,
    borderColor: '#263330',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    maxWidth: 340,
    width: '100%',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1.5,
    borderColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: '#0b1110',
    borderWidth: 1,
    borderColor: '#263330',
    borderRadius: 6,
    padding: 8,
    width: '100%',
    marginBottom: 16,
  },
  errorText: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: colors.rust,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.teal,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: '#0b1110',
  },
});
