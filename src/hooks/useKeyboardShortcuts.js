import { useEffect, useRef } from 'react';

/**
 * Custom hook to handle global keyboard shortcuts for Liofy:
 * - Space / K: Toggle Play / Pause
 * - ArrowRight: Seek forward 5s (Shift + ArrowRight: 10s)
 * - ArrowLeft: Seek backward 5s (Shift + ArrowLeft: 10s)
 * - Ctrl + ArrowRight / Cmd + ArrowRight: Next song
 * - Ctrl + ArrowLeft / Cmd + ArrowLeft: Previous song
 * - ArrowUp: Volume +5%
 * - ArrowDown: Volume -5%
 * - M: Toggle Mute
 * - L: Toggle Like on current track
 * - S: Toggle Shuffle
 * - R: Toggle Repeat
 * - J: Seek backward 10s
 * - ?: Show Keyboard Shortcuts cheat sheet
 */
export function useKeyboardShortcuts({
  togglePlay,
  playNextTrack,
  playPrevTrack,
  seekTo,
  currentTime,
  duration,
  volume,
  setVolume,
  setIsShuffle,
  setIsRepeat,
  currentTrack,
  toggleLike,
  onToggleShortcutsModal,
}) {
  const prevVolumeRef = useRef(volume || 0.8);
  const currentTimeRef = useRef(currentTime);
  const durationRef = useRef(duration);
  const volumeRef = useRef(volume);

  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // 1. Ignore if typing in any text input, textarea, select or contenteditable
      const target = e.target;
      const activeEl = document.activeElement;
      const isInput = (el) => {
        if (!el) return false;
        const tag = el.tagName?.toUpperCase();
        return (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          el.isContentEditable ||
          el.getAttribute('role') === 'textbox'
        );
      };

      if (isInput(target) || isInput(activeEl)) {
        return;
      }

      // 2. Play / Pause with Space
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
        return;
      }

      // 3. Play / Pause with K
      if (e.code === 'KeyK' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        togglePlay();
        return;
      }

      // 4. Next / Prev tracks (Ctrl/Cmd + Left/Right)
      if (e.code === 'ArrowRight' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        playNextTrack();
        return;
      }

      if (e.code === 'ArrowLeft' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        playPrevTrack();
        return;
      }

      // 5. Seek Forward / Backward (ArrowRight / ArrowLeft without Ctrl/Cmd)
      if (e.code === 'ArrowRight' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 5;
        const cur = currentTimeRef.current || 0;
        const dur = durationRef.current || 999999;
        seekTo(Math.min(dur, cur + step));
        return;
      }

      if (e.code === 'ArrowLeft' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 5;
        const cur = currentTimeRef.current || 0;
        seekTo(Math.max(0, cur - step));
        return;
      }

      // 6. YouTube standard J (seek back 10s)
      if (e.code === 'KeyJ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const cur = currentTimeRef.current || 0;
        seekTo(Math.max(0, cur - 10));
        return;
      }

      // 7. Volume Up / Down
      if (e.code === 'ArrowUp' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const currentVol = volumeRef.current || 0;
        const newVol = Math.min(1, Math.round((currentVol + 0.05) * 100) / 100);
        setVolume(newVol);
        return;
      }

      if (e.code === 'ArrowDown' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const currentVol = volumeRef.current || 0;
        const newVol = Math.max(0, Math.round((currentVol - 0.05) * 100) / 100);
        setVolume(newVol);
        return;
      }

      // 8. Mute / Unmute (M)
      if (e.code === 'KeyM' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const cur = volumeRef.current || 0;
        if (cur > 0) {
          prevVolumeRef.current = cur;
          setVolume(0);
        } else {
          setVolume(prevVolumeRef.current > 0 ? prevVolumeRef.current : 0.8);
        }
        return;
      }

      // 9. Like currently playing track (L)
      if (e.code === 'KeyL' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (currentTrack?.id && toggleLike) {
          toggleLike(currentTrack.id);
        }
        return;
      }

      // 10. Shuffle (S)
      if (e.code === 'KeyS' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsShuffle((prev) => !prev);
        return;
      }

      // 11. Repeat (R)
      if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsRepeat((prev) => !prev);
        return;
      }

      // 12. Show Keyboard Shortcuts Cheat Sheet (?)
      if ((e.key === '?' || (e.shiftKey && e.code === 'Slash')) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (onToggleShortcutsModal) {
          onToggleShortcutsModal();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    togglePlay,
    playNextTrack,
    playPrevTrack,
    seekTo,
    setVolume,
    setIsShuffle,
    setIsRepeat,
    currentTrack,
    toggleLike,
    onToggleShortcutsModal,
  ]);
}
