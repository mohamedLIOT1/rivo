import { useState, useRef, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';
import { calculateCrossfadeGains } from '../../utils/musicAnalysis';
import { API_BASE_URL } from '../../config';
import { resolveAudioStream } from '../../services/youtubeResolver';

/**
 * useMixerAudition: Audio preview hook with session tracking.
 * Discards stale createAsync resolutions to guarantee zero orphan streams
 * or native memory leaks on rapid taps or modal dismissal.
 */
export default function useMixerAudition({
  trackA,
  trackB,
  mixOutPoint,
  mixInPoint,
  duration,
  volA = 100,
  volB = 100,
  speedA = 1.0,
  speedB = 1.0,
  style = 'fade',
  crossoverBias = 0.5,
}) {
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [soloPlayingDeck, setSoloPlayingDeck] = useState(null);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [soloProgress, setSoloProgress] = useState(0);
  const [liveGainA, setLiveGainA] = useState(volA);
  const [liveGainB, setLiveGainB] = useState(0);

  const auditionSessionIdRef = useRef(0);
  const soundARef = useRef(null);
  const soundBRef = useRef(null);
  const auditionTimerRef = useRef(null);

  const stopAudition = useCallback(async () => {
    auditionSessionIdRef.current += 1;

    if (auditionTimerRef.current) {
      clearInterval(auditionTimerRef.current);
      auditionTimerRef.current = null;
    }

    const sA = soundARef.current;
    soundARef.current = null;
    if (sA) {
      try {
        await sA.stopAsync();
        await sA.unloadAsync();
      } catch {}
    }

    const sB = soundBRef.current;
    soundBRef.current = null;
    if (sB) {
      try {
        await sB.stopAsync();
        await sB.unloadAsync();
      } catch {}
    }

    setIsPreviewing(false);
    setSoloPlayingDeck(null);
    setSoloProgress(0);
    setPreviewProgress(0);
    setLiveGainA(volA);
    setLiveGainB(0);
    setIsLoadingAudio(false);
  }, [volA]);

  useEffect(() => {
    return () => {
      auditionSessionIdRef.current += 1;
      if (auditionTimerRef.current) {
        clearInterval(auditionTimerRef.current);
        auditionTimerRef.current = null;
      }
      if (soundARef.current) {
        soundARef.current.stopAsync().catch(() => {});
        soundARef.current.unloadAsync().catch(() => {});
        soundARef.current = null;
      }
      if (soundBRef.current) {
        soundBRef.current.stopAsync().catch(() => {});
        soundBRef.current.unloadAsync().catch(() => {});
        soundBRef.current = null;
      }
    };
  }, []);

  const resolveStreamUrl = async (track) => {
    if (!track) return null;
    if (track.nativeAudioUri) return track.nativeAudioUri;
    if (track.localAudioUri) return track.localAudioUri;
    if (track.resolvedAudioUrl && track.resolvedAudioUrl.startsWith('http')) return track.resolvedAudioUrl;
    if (track.audioUrl && (track.audioUrl.startsWith('/uploads/') || (track.audioUrl.startsWith('http') && !track.audioUrl.includes('youtube.com')))) {
      return track.audioUrl.startsWith('/') ? `${API_BASE_URL}${track.audioUrl}` : track.audioUrl;
    }
    try {
      const u = await resolveAudioStream(track);
      if (u) {
        return u.startsWith('/') ? `${API_BASE_URL}${u}` : u;
      }
    } catch {}
    return null;
  };

  const handlePreviewSoloA = useCallback(async () => {
    if (soloPlayingDeck === 'A') {
      await stopAudition();
      return;
    }
    await stopAudition();

    const sessionId = ++auditionSessionIdRef.current;
    setSoloPlayingDeck('A');
    setIsLoadingAudio(true);

    try {
      const urlA = await resolveStreamUrl(trackA);
      if (sessionId !== auditionSessionIdRef.current || !urlA) {
        if (sessionId === auditionSessionIdRef.current) await stopAudition();
        return;
      }

      const previewDuration = Math.min(duration, 8);
      const startSec = Math.max(0, mixOutPoint - previewDuration);
      const targetVol = Math.max(0.01, Math.min(1, volA / 100));
      const spd = Number(speedA) || 1.0;

      const { sound } = await Audio.Sound.createAsync(
        { uri: urlA },
        {
          shouldPlay: true,
          positionMillis: Math.floor(startSec * 1000),
          volume: targetVol,
          rate: spd,
          shouldCorrectPitch: true,
        }
      );

      if (sessionId !== auditionSessionIdRef.current) {
        sound.stopAsync().catch(() => {});
        sound.unloadAsync().catch(() => {});
        return;
      }

      soundARef.current = sound;
      setIsLoadingAudio(false);
      setLiveGainA(volA);
      setLiveGainB(0);

      const startTime = Date.now();
      const totalMs = (previewDuration / spd) * 1000;

      auditionTimerRef.current = setInterval(() => {
        if (sessionId !== auditionSessionIdRef.current) {
          clearInterval(auditionTimerRef.current);
          return;
        }
        const elapsed = Date.now() - startTime;
        const p = Math.min(1, elapsed / totalMs);
        setSoloProgress(p);
        if (p >= 1) {
          stopAudition();
        }
      }, 100);
    } catch (err) {
      if (sessionId === auditionSessionIdRef.current) {
        await stopAudition();
      }
    }
  }, [soloPlayingDeck, stopAudition, trackA, duration, mixOutPoint, volA, speedA]);

  const handlePreviewSoloB = useCallback(async () => {
    if (soloPlayingDeck === 'B') {
      await stopAudition();
      return;
    }
    await stopAudition();

    const sessionId = ++auditionSessionIdRef.current;
    setSoloPlayingDeck('B');
    setIsLoadingAudio(true);

    try {
      const urlB = await resolveStreamUrl(trackB);
      if (sessionId !== auditionSessionIdRef.current || !urlB) {
        if (sessionId === auditionSessionIdRef.current) await stopAudition();
        return;
      }

      const previewDuration = Math.min(duration, 8);
      const startSec = Math.max(0, mixInPoint);
      const targetVol = Math.max(0.01, Math.min(1, volB / 100));
      const spd = Number(speedB) || 1.0;

      const { sound } = await Audio.Sound.createAsync(
        { uri: urlB },
        {
          shouldPlay: true,
          positionMillis: Math.floor(startSec * 1000),
          volume: targetVol,
          rate: spd,
          shouldCorrectPitch: true,
        }
      );

      if (sessionId !== auditionSessionIdRef.current) {
        sound.stopAsync().catch(() => {});
        sound.unloadAsync().catch(() => {});
        return;
      }

      soundBRef.current = sound;
      setIsLoadingAudio(false);
      setLiveGainA(0);
      setLiveGainB(volB);

      const startTime = Date.now();
      const totalMs = (previewDuration / spd) * 1000;

      auditionTimerRef.current = setInterval(() => {
        if (sessionId !== auditionSessionIdRef.current) {
          clearInterval(auditionTimerRef.current);
          return;
        }
        const elapsed = Date.now() - startTime;
        const p = Math.min(1, elapsed / totalMs);
        setSoloProgress(p);
        if (p >= 1) {
          stopAudition();
        }
      }, 100);
    } catch (err) {
      if (sessionId === auditionSessionIdRef.current) {
        await stopAudition();
      }
    }
  }, [soloPlayingDeck, stopAudition, trackB, duration, mixInPoint, volB, speedB]);

  const handleAuditionTransition = useCallback(async () => {
    if (isPreviewing) {
      await stopAudition();
      return;
    }
    await stopAudition();

    const sessionId = ++auditionSessionIdRef.current;
    setIsPreviewing(true);
    setIsLoadingAudio(true);

    try {
      const [urlA, urlB] = await Promise.all([
        resolveStreamUrl(trackA),
        resolveStreamUrl(trackB),
      ]);

      if (sessionId !== auditionSessionIdRef.current || !urlA || !urlB) {
        if (sessionId === auditionSessionIdRef.current) await stopAudition();
        return;
      }

      const multA = (Number(volA) || 100) / 100;
      const multB = (Number(volB) || 100) / 100;
      const spdA = Number(speedA) || 1.0;
      const spdB = Number(speedB) || 1.0;

      const leadInSec = 2.0;
      const seekA = Math.max(0, mixOutPoint - duration - leadInSec);
      const seekB = Math.max(0, mixInPoint);

      const [resSoundA, resSoundB] = await Promise.all([
        Audio.Sound.createAsync(
          { uri: urlA },
          {
            shouldPlay: true,
            positionMillis: Math.floor(seekA * 1000),
            volume: Math.max(0.01, Math.min(1, 1.0 * multA)),
            rate: spdA,
            shouldCorrectPitch: true,
          }
        ),
        Audio.Sound.createAsync(
          { uri: urlB },
          {
            shouldPlay: false,
            positionMillis: Math.floor(seekB * 1000),
            volume: 0,
            rate: spdB,
            shouldCorrectPitch: true,
          }
        ),
      ]);

      if (sessionId !== auditionSessionIdRef.current) {
        resSoundA.sound.stopAsync().catch(() => {});
        resSoundA.sound.unloadAsync().catch(() => {});
        resSoundB.sound.stopAsync().catch(() => {});
        resSoundB.sound.unloadAsync().catch(() => {});
        return;
      }

      soundARef.current = resSoundA.sound;
      soundBRef.current = resSoundB.sound;
      setIsLoadingAudio(false);
      setLiveGainA(Math.round(volA));
      setLiveGainB(0);

      const startTime = Date.now();
      const leadInMs = (leadInSec / spdA) * 1000;
      const transMs = Math.max(1, duration) * 1000;
      const tailMs = 2500;
      const totalMs = leadInMs + transMs + tailMs;

      let deckBStarted = false;

      auditionTimerRef.current = setInterval(() => {
        if (sessionId !== auditionSessionIdRef.current) {
          clearInterval(auditionTimerRef.current);
          return;
        }
        const elapsed = Date.now() - startTime;

        if (elapsed < leadInMs) {
          setPreviewProgress(0);
          soundARef.current?.setVolumeAsync(Math.max(0.01, Math.min(1, 1.0 * multA))).catch(() => {});
          setLiveGainA(Math.round(volA));
          setLiveGainB(0);
        } else if (elapsed <= leadInMs + transMs) {
          if (!deckBStarted) {
            deckBStarted = true;
            soundBRef.current?.playAsync().catch(() => {});
          }

          const rawP = (elapsed - leadInMs) / transMs;
          const { gainA, gainB } = calculateCrossfadeGains(rawP, style, crossoverBias);

          soundARef.current?.setVolumeAsync(Math.max(0.01, Math.min(1, gainA * multA))).catch(() => {});
          soundBRef.current?.setVolumeAsync(Math.max(0.01, Math.min(1, gainB * multB))).catch(() => {});
          setPreviewProgress(rawP);
          setLiveGainA(Math.round(gainA * multA * 100));
          setLiveGainB(Math.round(gainB * multB * 100));
        } else {
          setPreviewProgress(1);
          soundARef.current?.setVolumeAsync(0).catch(() => {});
          soundBRef.current?.setVolumeAsync(Math.max(0.01, Math.min(1, 1.0 * multB))).catch(() => {});
          setLiveGainA(0);
          setLiveGainB(Math.round(volB));
        }

        if (elapsed >= totalMs) {
          stopAudition();
        }
      }, 100);
    } catch (err) {
      if (sessionId === auditionSessionIdRef.current) {
        await stopAudition();
      }
    }
  }, [isPreviewing, stopAudition, trackA, trackB, volA, volB, speedA, speedB, mixOutPoint, duration, mixInPoint, style, crossoverBias]);

  return {
    isPreviewing,
    isLoadingAudio,
    soloPlayingDeck,
    previewProgress,
    soloProgress,
    liveGainA,
    liveGainB,
    handlePreviewSoloA,
    handlePreviewSoloB,
    handleAuditionTransition,
    stopAudition,
  };
}
