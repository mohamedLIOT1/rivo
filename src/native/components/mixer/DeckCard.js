import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Play, Square, Minus, Plus, RotateCcw } from 'lucide-react-native';
import WaveformCueBox from './WaveformCueBox';
import TouchSlider from './TouchSlider';
import { formatTime } from '../../utils/timeUtils';
import { deckStyles as styles } from './deckCardStyles';

export default function DeckCard({
  deck = 'A',
  track,
  musicalData,
  color,
  duration = 210,
  position = 0,
  onChangePosition,
  overlapDuration = 6,
  volume = 100,
  onChangeVolume,
  speed = 1.0,
  onChangeSpeed,
  referenceBpm,
  isPlayingSolo = false,
  isLoadingAudio = false,
  onToggleSolo,
  peaks = [],
  cursorProgress = 0,
  isRTL = false,
  onDragStart,
  onDragEnd,
}) {
  const isDeckA = deck === 'A';
  const accentColor = isDeckA ? '#ef4444' : '#10b981';
  const safeDur = Math.max(10, Number(duration) || 210);

  const speedDelta = speed !== 1.0 ? ((speed - 1) * 100).toFixed(0) : null;
  const isBpmSynced = referenceBpm && musicalData?.bpm
    ? Math.abs(speed - Number((referenceBpm / musicalData.bpm).toFixed(2))) < 0.015
    : false;

  return (
    <View style={[styles.deckCard, !isDeckA && styles.deckCardB]}>
      {/* ── 1. Track Identity & Musical Metadata Row ── */}
      <View style={styles.deckHeaderRow}>
        <View style={styles.deckTitleGroup}>
          <View
            style={[
              styles.deckBadgePill,
              {
                backgroundColor: isDeckA ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                borderColor: isDeckA ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)',
              },
            ]}
          >
            <View style={[styles.deckDot, { backgroundColor: accentColor }]} />
            <Text style={[styles.deckBadgeText, { color: accentColor }]}>
              {isRTL ? (isDeckA ? 'المقطع أ' : 'المقطع ب') : (isDeckA ? 'DECK A' : 'DECK B')}
            </Text>
          </View>
          <Text style={styles.deckTrackTitle} numberOfLines={1}>
            {track?.title || (isDeckA ? 'Track A' : 'Track B')}
          </Text>
        </View>

        <View style={styles.deckMetaGroup}>
          {musicalData?.key && color ? (
            <View style={[styles.camelotPill, { backgroundColor: color.bg, borderColor: color.border }]}>
              <Text style={[styles.camelotText, { color: color.text }]}>{musicalData.key}</Text>
            </View>
          ) : null}
          {musicalData?.bpm ? (
            <Text style={styles.bpmText}>{musicalData.bpm} BPM</Text>
          ) : null}
        </View>
      </View>

      {/* ── 2. Dedicated Cue Control & Solo Preview Action Bar ── */}
      <View style={styles.deckControlsBar}>
        {/* Solo Audition Preview Button */}
        <TouchableOpacity
          style={[
            styles.soloBtn,
            isPlayingSolo && (isDeckA ? styles.soloBtnActiveA : styles.soloBtnActiveB),
          ]}
          onPress={onToggleSolo}
          disabled={isLoadingAudio}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        >
          {isLoadingAudio && isPlayingSolo ? (
            <ActivityIndicator size="small" color={isDeckA ? '#fff' : '#0b1110'} />
          ) : isPlayingSolo ? (
            <Square size={11} color={isDeckA ? '#fff' : '#0b1110'} fill={isDeckA ? '#fff' : '#0b1110'} />
          ) : (
            <Play size={11} color={isDeckA ? '#f87171' : '#34d399'} fill={isDeckA ? '#f87171' : '#34d399'} />
          )}
          <Text
            style={[
              styles.soloBtnText,
              !isDeckA && { color: '#34d399' },
              isPlayingSolo && (isDeckA ? styles.soloBtnTextActive : styles.soloBtnTextActiveB),
            ]}
            numberOfLines={1}
          >
            {isPlayingSolo
              ? (isRTL ? 'إيقاف المعاينة' : 'Stop Preview')
              : (isRTL
                  ? (isDeckA ? 'معاينة الخروج' : 'معاينة الدخول')
                  : (isDeckA ? 'Preview Mix-Out' : 'Preview Mix-In'))}
          </Text>
        </TouchableOpacity>

        {/* Precise Cue Position Stepper */}
        <View style={[styles.stepperBox, !isDeckA && { borderColor: 'rgba(16,185,129,0.4)' }]}>
          <Text style={[styles.stepperPrefix, !isDeckA && { color: '#10b981' }]}>
            {isRTL ? (isDeckA ? 'نقطة الخروج:' : 'نقطة الدخول:') : (isDeckA ? 'Mix-Out:' : 'Mix-In:')}
          </Text>
          <TouchableOpacity
            onPress={() => onChangePosition?.(isDeckA ? Math.max(5, position - 1) : Math.max(0, position - 1))}
            style={styles.stepBtn}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            activeOpacity={0.6}
          >
            <Minus size={11} color="#94a3b8" />
          </TouchableOpacity>
          <Text style={[styles.stepVal, !isDeckA && { color: '#34d399' }]}>{formatTime(position)}</Text>
          <TouchableOpacity
            onPress={() => onChangePosition?.(isDeckA ? Math.min(safeDur, position + 1) : Math.min(safeDur - 5, position + 1))}
            style={styles.stepBtn}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            activeOpacity={0.6}
          >
            <Plus size={11} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 3. Subline Timing Info ── */}
      <View style={styles.timingSubline}>
        <Text style={[styles.timingSublineTextAccent, { color: isDeckA ? '#f87171' : '#34d399' }]}>
          {isRTL ? (isDeckA ? 'نقطة الخروج: ' : 'نقطة الدخول: ') : (isDeckA ? 'Mix-Out: ' : 'Mix-In: ')}
          {formatTime(position)} / {formatTime(safeDur)} ({Math.round((position / safeDur) * 100)}%)
        </Text>
        <Text style={styles.timingSublineTextMuted}>
          {isDeckA
            ? (isRTL ? `المتبقي: ${formatTime(Math.max(0, safeDur - position))}` : `Remaining: ${formatTime(Math.max(0, safeDur - position))}`)
            : (isRTL ? `يبدأ عند: ${formatTime(position)} (تخطي المقدمة)` : `Starts: ${formatTime(position)} (Intro skipped)`)}
        </Text>
      </View>

      {/* ── 4. Interactive Waveform Track ── */}
      <WaveformCueBox
        peaks={peaks}
        duration={safeDur}
        position={position}
        overlapDuration={overlapDuration}
        mode={isDeckA ? 'out' : 'in'}
        onSeek={onChangePosition}
        accentColor={accentColor}
        tagText={isRTL ? (isDeckA ? 'تداخل' : 'دخول') : (isDeckA ? 'Overlap' : 'Entry')}
        isPlaying={isPlayingSolo}
        cursorProgress={cursorProgress}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      />

      {/* ── 5. Dedicated Volume Slider Section (Full-Width Row) ── */}
      <View style={styles.sliderSection}>
        <View style={styles.sliderHeaderRow}>
          <View style={styles.sliderTitleWithBadge}>
            <Text style={[styles.sliderSectionTitle, { color: isDeckA ? '#f87171' : '#34d399' }]}>
              {isRTL ? '🔊 مستوى الصوت' : '🔊 Volume'}
            </Text>
            <View
              style={[
                styles.sliderValueBadge,
                {
                  backgroundColor: isDeckA ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  borderColor: isDeckA ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)',
                },
              ]}
            >
              <Text style={[styles.sliderValueBadgeText, { color: accentColor }]}>
                {volume}%
              </Text>
            </View>
          </View>

          <View style={styles.sliderActionsRight}>
            <Text style={styles.sliderStatusDesc}>
              {volume === 100
                ? (isRTL ? '100% افتراضي' : '100% Default')
                : volume > 100
                ? (isRTL ? `+${volume - 100}% تضخيم` : `+${volume - 100}% Boost`)
                : (isRTL ? `${volume - 100}% خفض` : `${volume - 100}% Cut`)}
            </Text>
            {volume !== 100 && (
              <TouchableOpacity
                onPress={() => onChangeVolume?.(100)}
                style={styles.resetBtnPill}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                activeOpacity={0.7}
              >
                <RotateCcw size={9} color="#94a3b8" />
                <Text style={styles.resetBtnText}>{isRTL ? 'إعادة (100%)' : 'Reset'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TouchSlider
          min={50}
          max={140}
          step={5}
          value={volume}
          onChange={onChangeVolume}
          trackColor={accentColor}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />

        <View style={styles.sliderScaleRow}>
          <Text style={styles.sliderScaleText}>{isRTL ? '50% (خفض -6dB)' : '50% (-6dB)'}</Text>
          <Text style={[styles.sliderScaleText, styles.sliderScaleTextCenter]}>{isRTL ? '100% (طبيعي 0dB)' : '100% (Unity)'}</Text>
          <Text style={styles.sliderScaleText}>{isRTL ? '140% (تضخيم +3dB)' : '140% (+3dB)'}</Text>
        </View>
      </View>

      {/* ── 6. Dedicated Speed / Tempo Slider Section (Full-Width Row) ── */}
      <View style={styles.sliderSection}>
        <View style={styles.sliderHeaderRow}>
          <View style={styles.sliderTitleWithBadge}>
            <Text style={[styles.sliderSectionTitle, { color: isDeckA ? '#f59e0b' : '#06b6d4' }]}>
              {isRTL ? '⚡ السرعة والإيقاع' : '⚡ Speed / Tempo'}
            </Text>
            <View
              style={[
                styles.sliderValueBadge,
                {
                  backgroundColor: isDeckA ? 'rgba(245, 158, 11, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                  borderColor: isDeckA ? 'rgba(245, 158, 11, 0.4)' : 'rgba(6, 182, 212, 0.4)',
                },
              ]}
            >
              <Text style={[styles.sliderValueBadgeText, { color: isDeckA ? '#f59e0b' : '#06b6d4' }]}>
                {speed.toFixed(2)}x
              </Text>
            </View>
            {speedDelta && (
              <Text style={[styles.speedDeltaText, { color: speed > 1.0 ? '#34d399' : '#f87171' }]}>
                {speed > 1.0 ? `+${speedDelta}%` : `${speedDelta}%`}
              </Text>
            )}
          </View>

          <View style={styles.sliderActionsRight}>
            {!isDeckA && referenceBpm && musicalData?.bpm ? (
              <TouchableOpacity
                onPress={() => {
                  const ratio = Math.max(0.85, Math.min(1.15, Number((referenceBpm / musicalData.bpm).toFixed(2))));
                  onChangeSpeed?.(ratio);
                }}
                style={[styles.bpmSyncPill, isBpmSynced && styles.bpmSyncPillActive]}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                activeOpacity={0.7}
              >
                <Text style={[styles.bpmSyncText, isBpmSynced && styles.bpmSyncTextActive]}>
                  {isRTL ? `⚡ مزامنة (${referenceBpm})` : `⚡ Sync (${referenceBpm})`}
                </Text>
              </TouchableOpacity>
            ) : null}

            {speed !== 1.0 && (
              <TouchableOpacity
                onPress={() => onChangeSpeed?.(1.0)}
                style={styles.resetBtnPill}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                activeOpacity={0.7}
              >
                <RotateCcw size={9} color="#94a3b8" />
                <Text style={styles.resetBtnText}>{isRTL ? 'إعادة (1.0x)' : '1.0x'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TouchSlider
          min={0.85}
          max={1.15}
          step={0.01}
          value={speed}
          onChange={onChangeSpeed}
          trackColor={isDeckA ? '#f59e0b' : '#06b6d4'}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />

        <View style={styles.sliderScaleRow}>
          <Text style={styles.sliderScaleText}>0.85x (-15%)</Text>
          <Text style={[styles.sliderScaleText, styles.sliderScaleTextCenter]}>1.00x (Original)</Text>
          <Text style={styles.sliderScaleText}>1.15x (+15%)</Text>
        </View>
      </View>

      {/* ── 7. Quick Jump Cue Presets ── */}
      <View style={styles.quickJumpRow}>
        <Text style={styles.quickJumpLabel}>{isRTL ? 'انتقال سريع:' : 'Quick Jump:'}</Text>
        {isDeckA
          ? [
              { label: isRTL ? 'راديو (45%)' : 'Radio (45%)', p: 0.45 },
              { label: isRTL ? 'اللازمة (65%)' : 'Chorus (65%)', p: 0.65 },
              { label: isRTL ? 'الخاتمة (85%)' : 'Outro (85%)', p: 0.85 },
              { label: isRTL ? 'كاملة (99%)' : 'Full (99%)', p: 0.99 },
            ].map((qj, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.quickChip}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                onPress={() => onChangePosition?.(Math.floor(safeDur * qj.p))}
                activeOpacity={0.7}
              >
                <Text style={styles.quickChipText}>{qj.label}</Text>
              </TouchableOpacity>
            ))
          : [
              { label: isRTL ? 'البداية (0:00)' : 'Start (0:00)', sec: 0 },
              { label: isRTL ? 'تخطي المقدمة (+12ث)' : 'Skip Intro (+12s)', sec: 12 },
              { label: isRTL ? 'بداية الإيقاع (+24ث)' : 'Drop (+24s)', sec: 24 },
            ].map((qj, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.quickChip}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                onPress={() => onChangePosition?.(Math.min(safeDur - 5, qj.sec))}
                activeOpacity={0.7}
              >
                <Text style={styles.quickChipText}>{qj.label}</Text>
              </TouchableOpacity>
            ))}
      </View>
    </View>
  );
}
