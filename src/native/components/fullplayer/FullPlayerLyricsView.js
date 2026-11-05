import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, Platform, KeyboardAvoidingView,
} from 'react-native';
import { CheckCircle2, Edit3, ListMusic, Plus, X, Check } from 'lucide-react-native';
import { parseLrcLyrics } from '../../../utils/lrcParser';
import { useAudioProgress } from '../../context/AudioProgressContext';
import { useTranslation } from '../../context/LocalizationContext';
import { isArabicText } from '../../theme/typography';
import { colors } from './fullPlayerStyles';
import { lyricsStyles as styles } from './fullPlayerLyricsStyles';

export const LyricLineRow = React.memo(function LyricLineRow({
  line,
  isActive,
  isDark,
  onSeek,
}) {
  const isAr = isArabicText(line?.text);

  return (
    <TouchableOpacity
      onPress={() => {
        if (typeof onSeek === 'function' && typeof line?.time === 'number' && line.time >= 0) {
          onSeek(line.time);
        }
      }}
      activeOpacity={0.7}
      style={[
        styles.lyricLineBox,
        isActive && {
          backgroundColor: isDark ? 'rgba(23, 163, 152, 0.2)' : 'rgba(23, 163, 152, 0.15)',
          borderColor: colors.mint,
          borderWidth: 1.5,
        }
      ]}
    >
      <Text
        style={[
          styles.lyricLineText,
          { color: isActive ? (isDark ? '#ffffff' : colors.ink) : (isDark ? '#9ca3af' : '#4b5563') },
          isAr && {
            textAlign: 'right',
            fontFamily: Platform.OS === 'ios' ? 'Geeza Pro' : 'sans-serif',
            lineHeight: isActive ? 28 : 25,
            letterSpacing: 0,
          },
          isActive && styles.lyricLineTextActive
        ]}
      >
        {line.text}
      </Text>
    </TouchableOpacity>
  );
});

export const FullPlayerLyricsView = React.memo(function FullPlayerLyricsView({
  lyrics,
  isLoadingLyrics,
  isDark,
  deckBg,
  deckBorder,
  textTitle,
  textSub,
  seekTo,
  onSaveLyrics,
  isVerifiedLyrics = false,
  lyricsVerifiedBy = '',
}) {
  const { t, isRTL } = useTranslation();
  const { currentTime = 0 } = useAudioProgress();
  const lyricsScrollRef = useRef(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editText, setEditText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const lyricsList = useMemo(() => {
    if (!lyrics) return [];
    return parseLrcLyrics(lyrics);
  }, [lyrics]);

  const activeLyricIndex = useMemo(() => {
    if (!lyricsList.length) return -1;
    if (lyricsList[0]?.isUnsynced || lyricsList[0]?.time < 0) return -1;
    return lyricsList.findIndex((line, idx) => {
      const nextLine = lyricsList[idx + 1];
      const curTime = typeof currentTime === 'number' ? currentTime : 0;
      return curTime >= line.time && (!nextLine || curTime < nextLine.time);
    });
  }, [lyricsList, currentTime]);

  useEffect(() => {
    if (activeLyricIndex >= 0 && lyricsScrollRef.current) {
      lyricsScrollRef.current.scrollTo({
        y: Math.max(0, activeLyricIndex * 48 - 120),
        animated: true,
      });
    }
  }, [activeLyricIndex]);

  const handleOpenEdit = () => {
    if (Array.isArray(lyricsList) && lyricsList.length > 0) {
      const formatted = lyricsList.map(l => {
        const m = Math.floor(l.time / 60);
        const s = Math.floor(l.time % 60);
        const cs = Math.floor((l.time % 1) * 100);
        if (l.isUnsynced || l.time < 0) return l.text;
        return `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}] ${l.text}`;
      }).join('\n');
      setEditText(formatted);
    } else {
      setEditText(typeof lyrics === 'string' ? lyrics : '');
    }
    setIsEditOpen(true);
  };

  const handleSave = async () => {
    if (onSaveLyrics) {
      setIsSaving(true);
      try {
        await onSaveLyrics(editText);
      } finally {
        setIsSaving(false);
      }
    }
    setIsEditOpen(false);
  };

  return (
    <ScrollView
      ref={lyricsScrollRef}
      contentContainerStyle={styles.lyricsBody}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.lyricsCard, { backgroundColor: deckBg, borderColor: deckBorder }]}>
        <View style={[styles.lyricsCardHeaderRow, { borderBottomColor: isDark ? '#1f2e2a' : '#ded2bb' }, isRTL && { flexDirection: 'row-reverse' }]}>
          <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }, isRTL && { flexDirection: 'row-reverse' }]}>
            {isVerifiedLyrics && (
              <View style={[styles.verifiedTag, isRTL && { flexDirection: 'row-reverse' }]}>
                <CheckCircle2 size={12} color={colors.mint} />
                <Text style={styles.verifiedTagText}>
                  {lyricsVerifiedBy ? t('player.verifiedLyrics', { name: lyricsVerifiedBy }) : (isRTL ? 'كلمات موثقة' : 'VERIFIED LYRICS')}
                </Text>
              </View>
            )}
            <Text style={[styles.lyricsHeader, { color: textSub }]}>{t('player.lyrics') || 'OFFICIAL TRANSCRIPT'}</Text>
          </View>
          <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, isRTL && { flexDirection: 'row-reverse' }]}>
            {isLoadingLyrics && (
              <ActivityIndicator size="small" color={colors.mint} />
            )}
            <TouchableOpacity
              onPress={handleOpenEdit}
              style={[styles.lyricsActionBtn, isRTL && { flexDirection: 'row-reverse' }]}
              activeOpacity={0.8}
            >
              <Edit3 size={14} color="#000000" strokeWidth={2.5} />
              <Text style={styles.lyricsActionBtnText}>{isRTL ? 'تعديل' : 'EDIT'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {lyricsList.length > 0 ? (
          <View style={styles.lyricsLinesList}>
            {lyricsList.map((line, idx) => (
              <LyricLineRow
                key={idx}
                line={line}
                isActive={idx === activeLyricIndex}
                isDark={isDark}
                onSeek={seekTo}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyLyricsBox}>
            <View style={styles.emptyLyricsBadge}>
              <ListMusic size={28} color={colors.mint} strokeWidth={2} />
            </View>
            <Text style={[styles.emptyLyricsTitle, { color: textTitle }, isRTL && { textAlign: 'center' }]}>
              {t('player.noLyrics') || 'No Lyrics Found'}
            </Text>
            <Text style={styles.emptyLyricsText}>
              {isLoadingLyrics ? 'Retrieving synchronized lyrics...' : 'Lyrics could not be loaded for this track.'}
            </Text>
            <TouchableOpacity
              onPress={handleOpenEdit}
              style={[styles.lyricsActionBtn, { marginTop: 20, paddingHorizontal: 16 }]}
              activeOpacity={0.8}
            >
              <Plus size={15} color="#000000" strokeWidth={2.5} />
              <Text style={styles.lyricsActionBtnText}>ADD / SYNC LYRICS</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Modal
        visible={isEditOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEditOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.editLyricsOverlay}
        >
          <View style={[styles.editLyricsCard, { backgroundColor: deckBg, borderColor: deckBorder }]}>
            <View style={styles.editLyricsHeader}>
              <View>
                <Text style={[styles.editLyricsTitle, { color: textTitle }]}>Edit Lyrics</Text>
                <Text style={[styles.editLyricsSubtitle, { color: textSub }]}>LRC timestamp format</Text>
              </View>
              <TouchableOpacity onPress={() => setIsEditOpen(false)} style={styles.editLyricsCloseBtn}>
                <X size={20} color={textSub} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.editLyricsInput, { color: textTitle, borderColor: deckBorder, backgroundColor: isDark ? '#07100e' : '#f9f6f0' }]}
              multiline
              value={editText}
              onChangeText={setEditText}
              placeholder="Paste [mm:ss.xx] synced lyrics or plain text..."
              placeholderTextColor="#64748b"
            />
            <View style={styles.editLyricsActions}>
              <TouchableOpacity
                onPress={() => setIsEditOpen(false)}
                style={[styles.editLyricsCancelBtn, { borderColor: deckBorder }]}
                disabled={isSaving}
              >
                <Text style={[styles.editLyricsCancelText, { color: textSub }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                style={[styles.editLyricsSaveBtn, isSaving && { opacity: 0.6 }]}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <>
                    <Check size={16} color="#000000" strokeWidth={3} />
                    <Text style={styles.editLyricsSaveText}>SAVE & SYNC</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
});

export default FullPlayerLyricsView;
