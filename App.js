import React from 'react';
import { StyleSheet, View, Text, StatusBar, SafeAreaView } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#082621" />
      <View style={styles.content}>
        <Text style={styles.title}>RIVO</Text>
        <Text style={styles.subtitle}>Sonic Dispensary</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#082621',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#26c4b7',
    marginTop: 6,
    fontWeight: '700',
  },
});
