import React, { useState, useRef, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, PanResponder, Dimensions } from 'react-native';
import {
  Shuffle, SkipBack, Play, Pause, SkipForward, Repeat,
  Volume2, Disc, Mic, BookOpen, Download, CheckCircle2,
  RotateCcw, RotateCw,
} from 'lucide-react-native';
import { useAudioProgress } from '../../context/AudioProgressContext';
import { formatTime, sanitizeDuration } from '../../utils/timeUtils';
import { controlStyles as styles } from './fullPlayerControlsStyles';
import { colors } from './fullPlayerStyles';

export const FullPlayerControls = React.memo(function FullPlayerControls({
  currentTrack,
  isPlaying,
  isLoading,
  isShuffle,
  repeatMode,
  togglePlay,
  seekTo,
  playNextTrack,
  playPrevTrack,
  toggleShuffle,
  setIsShuffle,
  toggleRepeat,
  volume = 0.8,
  setVolume,
  isCurRadio,
  isCurQuran,
  isDownloaded,
  isDownloading,
  handleDownloadTrack,
  setIsSleepTimerOpen,
  setActiveTab,
  isCurPodcast = false,
  jumpBy,
  playbackRate = 1.0,
  setPlaybackRate,
}) {
  const { currentTime = 0, duration = 0, progress = 0 } = useAudioProgress();

  const PLAYBACK_SPEEDS = useMemo(() => [1, 1.25, 1.5, 2], []);
  const cyclePlaybackSpeed = useCallback(() => {
    const cur = Number(playbackRate) || 1.0;
    const curIdx = PLAYBACK_SPEEDS.findIndex(s => Math.abs(s - cur) < 0.05);
    const nextIdx = (curIdx + 1) % PLAYBACK_SPEEDS.length;
    setPlaybackRate?.(PLAYBACK_SPEEDS[nextIdx]);
  }, [playbackRate, PLAYBACK_SPEEDS, setPlaybackRate]);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPercent, setScrubPercent] = useState(0);
  const [scrubTime, setScrubTime] = useState(0);
  const { width } = Dimensions.get('window');
  const seekbarLayoutRef = useRef({ x: 32, width: width - 64 });

  const isLiveRadio = Boolean(currentTrack?.isLive || isCurRadio);
  const effectiveDuration = (duration && duration > 0)
    ? sanitizeDuration(duration, 240)
    : sanitizeDuration(currentTrack?.duration, 240);
  const progressPercent = Math.min(100, Math.max(0, progress * 100));

  const seekPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !isLiveRadio,
    onMoveShouldSetPanResponder: () => !isLiveRadio,
    onPanResponderGrant: (evt) => {
      const pageX = evt.nativeEvent.pageX;
      const barX = seekbarLayoutRef.current.x;
      const barW = Math.max(1, seekbarLayoutRef.current.width);
      let touchX = pageX - barX;
      if (evt.nativeEvent.locationX !== undefined && evt.nativeEvent.locationX >= 0 && evt.nativeEvent.locationX <= barW) {
        touchX = evt.nativeEvent.locationX;
      }
      touchX = Math.max(0, Math.min(barW, touchX));
      const pct = Math.max(0, Math.min(1, touchX / barW));
      setIsScrubbing(true);
      setScrubPercent(pct * 100);
      setScrubTime(Math.round(pct * effectiveDuration));
    },
    onPanResponderMove: (evt) => {
      const pageX = evt.nativeEvent.pageX;
      const barX = seekbarLayoutRef.current.x;
      const barW = Math.max(1, seekbarLayoutRef.current.width);
      let touchX = pageX - barX;
      if (evt.nativeEvent.locationX !== undefined && evt.nativeEvent.locationX >= 0 && evt.nativeEvent.locationX <= barW) {
        touchX = evt.nativeEvent.locationX;
      }
      touchX = Math.max(0, Math.min(barW, touchX));
      const pct = Math.max(0, Math.min(1, touchX / barW));
      setScrubPercent(pct * 100);
      setScrubTime(Math.round(pct * effectiveDuration));
    },
    onPanResponderRelease: (evt) => {
      const pageX = evt.nativeEvent.pageX;
      const barX = seekbarLayoutRef.current.x;
      const barW = Math.max(1, seekbarLayoutRef.current.width);
      let touchX = pageX - barX;
      if (evt.nativeEvent.locationX !== undefined && evt.nativeEvent.locationX >= 0 && evt.nativeEvent.locationX <= barW) {
        touchX = evt.nativeEvent.locationX;
      }
      touchX = Math.max(0, Math.min(barW, touchX));
      const pct = Math.max(0, Math.min(1, touchX / barW));
      const targetSec = Math.max(0, Math.min(effectiveDuration, Math.round(pct * effectiveDuration)));
      setScrubPercent(pct * 100);
      setScrubTime(targetSec);
      if (typeof seekTo === 'function') {
        seekTo(targetSec);
      }
      setTimeout(() => {
        setIsScrubbing(false);
      }, 350);
    },
    onPanResponderTerminate: () => {
      setIsScrubbing(false);
    }
  }), [isLiveRadio, effectiveDuration, seekTo]);

  const handleVolumePress = useCallback((evt) => {
    const touchX = evt.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, touchX / 120));
    setVolume?.(ratio);
  }, [setVolume]);

  return (
    <View>
      {/* ── Seekbar ── */}
      <View style={styles.seekSection}>
        <View
          {...seekPanResponder.panHandlers}
          onLayout={(e) => {
            const { width: layoutW, x: layoutX } = e.nativeEvent.layout;
            if (layoutW > 0) {
              seekbarLayoutRef.current = { x: layoutX || 32, width: layoutW };
            }
          }}
          style={styles.seekTouchArea}
        >
          <View style={styles.seekTrack} pointerEvents="none">
            <View
              style={[
                styles.seekFill,
                {
                  width: isLiveRadio ? '100%' : `${isScrubbing ? scrubPercent : progressPercent}%`,
                  backgroundColor: isLiveRadio ? '#ef4444' : colors.mint,
                }
              ]}
              pointerEvents="none"
            />
            {!isLiveRadio && (
              <View
                style={[
                  styles.seekThumb,
                  { left: `${Math.max(0, Math.min(100, isScrubbing ? scrubPercent : progressPercent))}%` }
                ]}
                pointerEvents="none"
              />
            )}
          </View>
        </View>

        <View style={styles.timeRow}>
          {isLiveRadio ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#ef4444' }} />
              <Text style={[styles.timeText, { color: '#ef4444', fontWeight: 'bold' }]}>LIVE 24/7 BROADCAST</Text>
            </View>
          ) : (
            <>
              <Text style={[styles.timeText, isScrubbing && { color: colors.mint, fontWeight: 'bold' }]}>
                {formatTime(isScrubbing ? scrubTime : currentTime)}
              </Text>
              <Text style={styles.timeText}>
                {formatTime(effectiveDuration)}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* ── Transport Controls ── */}
      {isCurPodcast ? (
        <View style={styles.podcastControlsRow}>
          {/* Playback Speed Toggle */}
          <TouchableOpacity
            style={styles.speedBtnCircle}
            onPress={cyclePlaybackSpeed}
            activeOpacity={0.7}
            delayPressIn={0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.speedBtnText}>
              {playbackRate || 1}x
            </Text>
          </TouchableOpacity>

          {/* Jump -15s */}
          <TouchableOpacity
            style={styles.transportBtnCircle}
            onPress={() => jumpBy ? jumpBy(-15) : seekTo?.(Math.max(0, currentTime - 15))}
            onLongPress={playPrevTrack}
            activeOpacity={0.7}
            delayPressIn={0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={styles.jumpBtnInner}>
              <RotateCcw size={25} color="#e2e8f0" strokeWidth={2.2} />
              <View style={styles.jumpTextCenter}>
                <Text style={styles.jumpNumberText}>15</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Play / Pause */}
          <TouchableOpacity
            style={styles.mainPlayBtn}
            onPress={togglePlay}
            activeOpacity={0.8}
            delayPressIn={0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#0b1110" />
            ) : isPlaying ? (
              <Pause size={24} color="#0b1110" fill="#0b1110" />
            ) : (
              <Play size={24} color="#0b1110" fill="#0b1110" style={{ marginLeft: 2 }} />
            )}
          </TouchableOpacity>

          {/* Jump +15s */}
          <TouchableOpacity
            style={styles.transportBtnCircle}
            onPress={() => jumpBy ? jumpBy(15) : seekTo?.(Math.max(0, currentTime + 15))}
            onLongPress={playNextTrack}
            activeOpacity={0.7}
            delayPressIn={0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={styles.jumpBtnInner}>
              <RotateCw size={25} color="#e2e8f0" strokeWidth={2.2} />
              <View style={styles.jumpTextCenter}>
                <Text style={styles.jumpNumberText}>15</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Next Episode */}
          <TouchableOpacity
            style={styles.transportBtnCircle}
            onPress={playNextTrack}
            activeOpacity={0.7}
            delayPressIn={0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <SkipForward size={20} color="#ffffff" fill="#ffffff" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={styles.transportBtnBox}
            onPress={() => toggleShuffle ? toggleShuffle() : setIsShuffle(!isShuffle)}
            activeOpacity={0.7}
            delayPressIn={0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Shuffle size={18} color={isShuffle ? colors.mint : '#9ca3af'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.transportBtnBox}
            onPress={playPrevTrack}
            activeOpacity={0.7}
            delayPressIn={0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <SkipBack size={20} color="#ffffff" fill="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mainPlayBtn}
            onPress={togglePlay}
            activeOpacity={0.8}
            delayPressIn={0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#0b1110" />
            ) : isPlaying ? (
              <Pause size={24} color="#0b1110" fill="#0b1110" />
            ) : (
              <Play size={24} color="#0b1110" fill="#0b1110" style={{ marginLeft: 2 }} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.transportBtnBox}
            onPress={playNextTrack}
            activeOpacity={0.7}
            delayPressIn={0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <SkipForward size={20} color="#ffffff" fill="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.transportBtnBox}
            onPress={toggleRepeat}
            activeOpacity={0.7}
            delayPressIn={0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Repeat size={18} color={repeatMode !== 'off' ? colors.mint : '#9ca3af'} />
            {repeatMode === 'one' && (
              <View style={styles.repeatOneBadge}>
                <Text style={styles.repeatOneText}>1</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ── Dashed Divider ── */}
      <View style={styles.dashedDivider} />

      {/* ── Audio Toolbar Row: Volume + Quick Actions ── */}
      <View style={styles.audioToolbarRow}>
        <View style={styles.volumeGroup}>
          <Volume2 size={16} color="#94a3b8" />
          <TouchableOpacity activeOpacity={1} onPress={handleVolumePress} style={styles.volTouchArea}>
            <View style={styles.volTrack}>
              <View style={[styles.volFill, { width: `${Math.round((volume || 0.8) * 100)}%` }]} />
              <View style={[styles.volThumb, { left: `${Math.round((volume || 0.8) * 100)}%` }]} />
            </View>
          </TouchableOpacity>
          <Text style={styles.volPercentText}>{Math.round((volume || 0.8) * 100)}%</Text>
        </View>

        <View style={styles.quickActionsGroup}>
          <TouchableOpacity
            style={styles.quickToolBtn}
            onPress={() => setIsSleepTimerOpen(true)}
            activeOpacity={0.8}
            delayPressIn={0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Disc size={17} color="#94a3b8" />
          </TouchableOpacity>

          {!isCurRadio && !isCurPodcast && (
            <TouchableOpacity
              style={styles.quickToolBtnTeal}
              onPress={() => setActiveTab('lyrics')}
              activeOpacity={0.8}
              delayPressIn={0}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {isCurQuran ? (
                <BookOpen size={17} color="#0b1110" strokeWidth={2.4} />
              ) : (
                <Mic size={17} color="#0b1110" strokeWidth={2.4} />
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.quickToolBtn}
            onPress={() => !isDownloaded && !isDownloading && handleDownloadTrack?.(currentTrack)}
            disabled={isDownloading || isDownloaded}
            activeOpacity={0.8}
            delayPressIn={0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isDownloading ? (
              <ActivityIndicator size="small" color="#17a398" />
            ) : isDownloaded ? (
              <CheckCircle2 size={17} color="#17a398" />
            ) : (
              <Download size={17} color="#94a3b8" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

export default FullPlayerControls;
