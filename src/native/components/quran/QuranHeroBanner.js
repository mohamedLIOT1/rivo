import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Platform } from 'react-native';
import { BookOpen, Search, Radio } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import CassetteTag from '../../ui/CassetteTag';

export const QuranHeroBanner = React.memo(function QuranHeroBanner({
  styles,
  isRTL,
  t,
  onOpenRadio,
  searchQuery,
  setSearchQuery,
}) {
  return (
    <View style={styles.bannerOuter}>
      <View style={styles.bannerShadow} />
      <View style={styles.banner}>
        <View style={[styles.bannerTopRow, isRTL && { flexDirection: 'row-reverse' }]}>
          <View style={styles.quranPill}>
            <BookOpen size={13} color={colors.ink} />
            <Text style={[styles.quranPillText, isRTL && { letterSpacing: 0, fontFamily: Platform.OS === 'ios' ? 'Geeza Pro' : 'sans-serif' }]}>
              {t('quran.holyQuranAudio')}
            </Text>
          </View>
          <CassetteTag label={t('quran.recitationsTag')} bg={colors.ink} textColor={colors.mint} />
        </View>

        <Text style={[styles.arabicTitle, { textAlign: isRTL ? 'right' : 'left' }]}>
          {t('quran.title')}
        </Text>
        <TouchableOpacity style={styles.radioBannerBtn} onPress={onOpenRadio} activeOpacity={0.85}>
          <Radio size={16} color="#000000" strokeWidth={2.5} />
          <Text style={[styles.radioBannerBtnText, isRTL && { letterSpacing: 0, fontFamily: Platform.OS === 'ios' ? 'Geeza Pro' : 'sans-serif' }]}>
            {t('quran.radioLive')}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.arabicSub, { textAlign: isRTL ? 'right' : 'left' }]}>
          {t('quran.heroRecitationsDesc')}
        </Text>

        {/* Search bar inside Quran */}
        <View style={[styles.searchBar, isRTL && { flexDirection: 'row-reverse' }]}>
          <Search size={16} color={colors.ink} style={isRTL ? { marginLeft: 8 } : { marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { textAlign: isRTL ? 'right' : 'left' }]}
            placeholder={t('quran.searchPlaceholder')}
            placeholderTextColor={colors.grayText}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>
    </View>
  );
});

export default QuranHeroBanner;
