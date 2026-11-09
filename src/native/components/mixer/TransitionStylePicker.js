import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import {
  Wand2,
  Zap,
  Activity,
  Radio,
  Sparkles,
  Music2,
  Volume2,
  Check,
} from 'lucide-react-native';
import { calculateBarsDuration } from '../../utils/musicAnalysis';
import TouchSlider from './TouchSlider';
import { styles } from './miniMixerStyles';

export const TRANSITION_STYLES = [
  {
    id: 'auto',
    name: 'Auto',
    nameAr: 'تلقائي',
    desc: 'Smart AI: analyzes BPM & harmonic key to craft the ideal transition',
    descAr: 'ذكاء اصطناعي ذكي: يحلل الإيقاع والمفتاح الهارموني لصنع انتقال مثالي',
    icon: Wand2,
    badge: 'AI Smart',
    badgeAr: 'ذكي تلقائي',
    color: '#10b981',
  },
  {
    id: 'rise',
    name: 'Rise',
    nameAr: 'تصاعد',
    desc: 'High-pass tension sweep with punchy bass drop on the first downbeat',
    descAr: 'تصاعد تشويقي بترددات عالية مع هبوط بيز قوي على أول إيقاع',
    icon: Zap,
    badge: 'Buildup & Drop',
    badgeAr: 'تصاعد وهبوط',
    color: '#f59e0b',
  },
  {
    id: 'blend',
    name: 'Blend',
    nameAr: 'اندماج سلس',
    desc: 'Balanced 3-band EQ crossfade with sub-bass frequency swap',
    descAr: 'تلاشي متوازن عبر معادل الصوت مع تبديل ترددات البيز الفرعي',
    icon: Activity,
    badge: 'Bass Swap',
    badgeAr: 'تبديل البيز',
    color: '#10b981',
  },
  {
    id: 'wave',
    name: 'Wave',
    nameAr: 'موجة',
    desc: 'Low-pass wave sweep rhythmically washing out highs into the new track',
    descAr: 'موجة فلتر هابطة تمهد إيقاعياً لدخول المقطع الجديد بسلاسة',
    icon: Radio,
    badge: 'Filter Sweep',
    badgeAr: 'مسح الترددات',
    color: '#06b6d4',
  },
  {
    id: 'melt',
    name: 'Melt',
    nameAr: 'ذوبان',
    desc: 'Harmonic frequency melting crossfade, ideal for melodic & vocal changes',
    descAr: 'ذوبان نغمي وتوافقي، مثالي للألحان وتغيرات الصوت الغنائي',
    icon: Sparkles,
    badge: 'Harmonic Morph',
    badgeAr: 'تحول نغمي',
    color: '#a855f7',
  },
  {
    id: 'slam',
    name: 'Slam',
    nameAr: 'صدمة',
    desc: 'Instant downbeat cut directly on the beat with zero overlapping clutter',
    descAr: 'قطع فوري ودقيق على ضربة الإيقاع بدون أي تداخل صوتي',
    icon: Music2,
    badge: 'Downbeat Cut',
    badgeAr: 'قطع على الإيقاع',
    color: '#ef4444',
  },
  {
    id: 'fade',
    name: 'Fade',
    nameAr: 'تلاشي',
    desc: 'Classic equal-power crossfade preserving constant acoustic loudness',
    descAr: 'تلاشي كلاسيكي متساوي القدرة للحفاظ على استقرار مستوى الصوت',
    icon: Volume2,
    badge: 'Equal-Power',
    badgeAr: 'قوة متساوية',
    color: '#3b82f6',
  },
];

export const BAR_OPTIONS = [1, 2, 4, 8, 16];

export default function TransitionStylePicker({
  style = 'auto',
  onSelectStyle,
  bars = 4,
  duration = 8,
  bpmA = 120,
  onSelectBars,
  onChangeDuration,
  isRTL = false,
  rtlTextStyle,
  onDragStart,
  onDragEnd,
}) {
  const activeStyleObj = TRANSITION_STYLES.find(t => t.id === style) || TRANSITION_STYLES[0];

  return (
    <>
      {/* 2. TRANSITION STYLE • RIVO PRESETS (2-COLUMN GRID) */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, rtlTextStyle]}>
            {isRTL ? 'نمط الانتقال • قوالب ريفو' : 'TRANSITION STYLE • RIVO PRESETS'}
          </Text>
          <Text style={styles.sectionBadgeText}>
            {isRTL ? (activeStyleObj.badgeAr || activeStyleObj.badge) : activeStyleObj.badge}
          </Text>
        </View>

        <View style={styles.styleGrid2Col}>
          {TRANSITION_STYLES.map((st) => {
            const Icon = st.icon;
            const isSel = style === st.id;
            return (
              <TouchableOpacity
                key={st.id}
                style={[
                  styles.styleCard2Col,
                  isSel && {
                    borderColor: st.color,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    shadowColor: st.color,
                    shadowOpacity: 0.35,
                    shadowRadius: 8,
                    elevation: Platform.OS === 'android' ? 0 : 2,
                  },
                ]}
                onPress={() => onSelectStyle?.(st.id)}
                activeOpacity={0.75}
              >
                <View style={styles.styleCardTop}>
                  <View style={[styles.styleIconBox, { backgroundColor: isSel ? st.color : 'rgba(255,255,255,0.06)' }]}>
                    <Icon size={15} color={isSel ? '#000000' : st.color} />
                  </View>
                  <Text style={[styles.styleName, isSel && { color: '#ffffff', fontWeight: 'bold' }]} numberOfLines={1}>
                    {isRTL ? (st.nameAr || st.name) : st.name}
                  </Text>
                  {isSel && <Check size={14} color={st.color} strokeWidth={3} style={{ marginLeft: 'auto' }} />}
                </View>
                <Text style={styles.styleDesc} numberOfLines={2}>
                  {isRTL ? (st.descAr || st.desc) : st.desc}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 3. DURATION & QUANTIZED BARS */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, rtlTextStyle]}>
            {isRTL ? 'المدة والمقاييس الموسيقية' : 'DURATION & QUANTIZED BARS'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.barsValText}>
              {bars} {isRTL ? 'مقياس' : (bars === 1 ? 'Bar' : 'Bars')}
            </Text>
            <Text style={{ color: '#64748b', fontSize: 11 }}>•</Text>
            <Text style={styles.durationValText}>
              {duration}{isRTL ? 'ث' : 's'}
            </Text>
          </View>
        </View>

        {/* 5 Quantized Bar Buttons */}
        <View style={styles.pillRow}>
          {BAR_OPTIONS.map((numBars) => {
            const bSec = calculateBarsDuration(numBars, bpmA);
            const isSel = bars === numBars;
            return (
              <TouchableOpacity
                key={numBars}
                style={[styles.barPill, isSel && styles.barPillActive]}
                onPress={() => onSelectBars?.(numBars)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                activeOpacity={0.7}
              >
                <Text style={[styles.barPillText, isSel && styles.barPillTextActive]} numberOfLines={1}>
                  {numBars} {isRTL ? 'مقياس' : (numBars === 1 ? 'Bar' : 'Bars')}
                </Text>
                <Text style={[styles.barPillSub, isSel && styles.barPillSubActive]} numberOfLines={1}>
                  ~{bSec}{isRTL ? 'ث' : 's'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Fine-Tuning TouchSlider */}
        <View style={{ marginTop: 10 }}>
          <TouchSlider
            min={1}
            max={48}
            step={0.5}
            value={duration}
            onChange={onChangeDuration}
            trackColor="#10b981"
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
          <View style={styles.sliderScaleRow}>
            <Text style={styles.sliderScaleText}>
              {isRTL ? '1ث سريع' : '1s Fast'}
            </Text>
            <Text style={[styles.sliderScaleText, styles.sliderScaleTextCenter]}>
              {isRTL ? '4-8ث قياسي' : '4-8s DJ'}
            </Text>
            <Text style={styles.sliderScaleText}>
              {isRTL ? '48ث أقصى' : '48s Max'}
            </Text>
          </View>
        </View>
      </View>
    </>
  );
}
