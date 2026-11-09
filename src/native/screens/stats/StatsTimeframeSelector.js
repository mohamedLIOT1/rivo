import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

export default function StatsTimeframeSelector({ timeframe, onChangeTimeframe, isRTL = false }) {
  const isAllTime = timeframe === 'all_time';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.btn, !isAllTime && styles.btnActive]}
        onPress={() => onChangeTimeframe('weekly')}
        activeOpacity={0.8}
      >
        <Text style={[styles.btnText, !isAllTime && styles.btnTextActive]}>
          {isRTL ? 'هذا الأسبوع' : 'WEEKLY'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, isAllTime && styles.btnActive]}
        onPress={() => onChangeTimeframe('all_time')}
        activeOpacity={0.8}
      >
        <Text style={[styles.btnText, isAllTime && styles.btnTextActive]}>
          {isRTL ? 'كل الأوقات' : 'ALL-TIME'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ede5d3',
    borderWidth: 2,
    borderColor: '#082621',
    borderRadius: 8,
    padding: 2,
    marginVertical: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  btnActive: {
    backgroundColor: '#082621',
  },
  btnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#082621',
    textTransform: 'uppercase',
  },
  btnTextActive: {
    color: '#26c4b7',
  },
});
