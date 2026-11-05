import { useState, useRef, useCallback } from 'react';
import { updateAudioProgress } from '../AudioProgressContext';
import { updateMediaNotification } from '../../services/mediaControls';

export const useJamPlaybackSync = ({
  currentUser,
  currentTrackRef,
  soundRef,
  isPlayingRef,
  shouldBePlayingRef,
  loadedTrackIdRef,
  playbackStatusRef,
  progressRef,
  setCurrentTrack,
  setIsPlaying,
  seekToCallbackRef,
  playTrackCallbackRef,
  likedTrackIds = [],
  repeatModeRef,
  isShuffleRef,
}) => {
  const jamSyncRef = useRef({ socket: null, jamSession: null, isHost: false });
  const [jamSession, setJamSessionState] = useState(null);
  const [remoteDevicePlayback, setRemoteDevicePlayback] = useState(null);
  const lastRemoteSeekRef = useRef(0);
  const lastSyncPayloadRef = useRef({ time: 0, trackId: '', timestamp: 0 });

  const isJamHost = useCallback(() => {
    const session = jamSyncRef.current?.jamSession;
    if (!session) return false;
    if (jamSyncRef.current.isHost) return true;
    const sock = jamSyncRef.current?.socket;
    const sockId = sock?.id;
    const myId = String(currentUser?._id || currentUser?.id || '');

    if (session.hostUserId && myId && String(session.hostUserId) === myId) return true;
    if (sockId && session.hostId && session.hostId === sockId) return true;
    if (Array.isArray(session.members)) {
      const me = session.members.find(m => (sockId && m.socketId === sockId) || (myId && String(m.id || m._id) === myId));
      if (me && me.isHost) return true;
    }
    return false;
  }, [currentUser]);

  const canControlJam = useCallback(() => {
    const session = jamSyncRef.current?.jamSession;
    if (!session) return false;
    if (isJamHost()) return true;
    return !session.hostOnlyControl;
  }, [isJamHost]);

  const setJamSync = useCallback(({ socket, jamSession: newJamSession, isHost }) => {
    if (socket !== undefined) {
      if (jamSyncRef.current.socket && jamSyncRef.current.socket !== socket) {
        jamSyncRef.current.socket.off('jam:get_host_time');
        jamSyncRef.current.socket.off('device:remote_playing');
      }
      jamSyncRef.current.socket = socket;
      if (socket) {
        socket.off('jam:get_host_time');
        socket.on('jam:get_host_time', ({ requesterSocketId }) => {
          if (isJamHost()) {
            socket.emit('jam:report_host_time', {
              roomCode: jamSyncRef.current.jamSession?.code || jamSyncRef.current.jamSession?.roomCode,
              currentTime: playbackStatusRef.current?.currentTime || 0,
              isPlaying: isPlayingRef.current,
              currentTrack: currentTrackRef.current,
              requesterSocketId
            });
          }
        });

        socket.off('device:force_pause');
        socket.on('device:force_pause', async () => {
          shouldBePlayingRef.current = false;
          if (soundRef.current) {
            await soundRef.current.pauseAsync().catch(() => {});
          }
          isPlayingRef.current = false;
          setIsPlaying(false);
        });

        socket.off('device:remote_playing');
        socket.on('device:remote_playing', (data) => {
          setRemoteDevicePlayback(data);
        });
      }
    }
    if (newJamSession !== undefined) {
      jamSyncRef.current.jamSession = newJamSession;
      setJamSessionState(newJamSession);
    }
    if (isHost !== undefined) {
      jamSyncRef.current.isHost = isHost;
    }
  }, [isJamHost, playbackStatusRef, isPlayingRef, currentTrackRef, shouldBePlayingRef, soundRef, setIsPlaying]);

  const syncFromOnlineTrack = useCallback(({ track, isPlaying: onlinePlaying, currentTime: onlineTime, duration: onlineDur }) => {
    if (track) {
      const prevTrack = currentTrackRef.current;
      const isNewTrack = !prevTrack || String(prevTrack._id || prevTrack.id || prevTrack.title) !== String(track._id || track.id || track.title);
      currentTrackRef.current = track;
      setCurrentTrack(track);
      isPlayingRef.current = Boolean(onlinePlaying);
      setIsPlaying(Boolean(onlinePlaying));
      if (onlineTime !== undefined && onlineDur !== undefined) {
        progressRef.current = { currentTime: onlineTime, duration: onlineDur };
        updateAudioProgress({ currentTime: onlineTime, duration: onlineDur });
      }

      if (isNewTrack && jamSyncRef.current.jamSession && jamSyncRef.current.socket && canControlJam()) {
        const roomCode = String(jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode || '').trim().toUpperCase();
        if (roomCode) {
          jamSyncRef.current.socket.emit('jam:sync_play_state', {
            roomCode,
            isPlaying: Boolean(onlinePlaying),
            currentTrack: track,
            currentTime: Number(onlineTime || 0),
            initiatorId: jamSyncRef.current.socket.id,
            userId: currentUser?._id || currentUser?.id,
            isUserAction: true,
            userAction: 'play_track',
          });
        }
      }
    }
  }, [canControlJam, currentUser, currentTrackRef, setCurrentTrack, isPlayingRef, setIsPlaying, progressRef]);

  const pauseNativePlayback = useCallback(async () => {
    try {
      shouldBePlayingRef.current = false;
      if (soundRef.current) {
        await soundRef.current.pauseAsync().catch(() => {});
        isPlayingRef.current = false;
        setIsPlaying(false);
      }
    } catch {}
  }, [shouldBePlayingRef, soundRef, isPlayingRef, setIsPlaying]);

  const syncRemotePlayState = useCallback(async ({ isPlaying: syncPlaying, currentTrack: syncTrack, currentTime: syncTime, updatedAt, serverTime, isPeriodic, isSeek, userAction }) => {
    let targetTime = Number(syncTime) || 0;
    const refTimestamp = Number(updatedAt || serverTime || 0);
    if (syncPlaying && refTimestamp > 0) {
      const elapsed = (Date.now() - refTimestamp) / 1000;
      if (elapsed > 0 && elapsed < 0.8) {
        targetTime += elapsed;
      }
    }

    const cur = currentTrackRef.current;
    const curLoadedId = loadedTrackIdRef.current;
    const syncTrackId = syncTrack ? String(syncTrack._id || syncTrack.id) : null;
    const isDifferentTrack = Boolean(syncTrackId && (!curLoadedId || syncTrackId !== curLoadedId));
    const nowTime = Date.now();

    if (isSeek || userAction === 'seek') {
      lastRemoteSeekRef.current = nowTime;
      if (jamSyncRef.current.jamSession) {
        jamSyncRef.current.jamSession.currentTime = targetTime;
        jamSyncRef.current.jamSession.updatedAt = Date.now();
        if (syncPlaying !== undefined) jamSyncRef.current.jamSession.isPlaying = Boolean(syncPlaying);
        if (syncTrack) jamSyncRef.current.jamSession.currentTrack = syncTrack;
        setJamSessionState({ ...jamSyncRef.current.jamSession });
      }
      progressRef.current = { ...progressRef.current, currentTime: targetTime };
      updateAudioProgress({ currentTime: targetTime, duration: progressRef.current.duration });
      if (syncPlaying !== undefined) {
        shouldBePlayingRef.current = Boolean(syncPlaying);
        isPlayingRef.current = Boolean(syncPlaying);
        setIsPlaying(Boolean(syncPlaying));
      }
      if (seekToCallbackRef.current) {
        await seekToCallbackRef.current(targetTime, true);
      }
      return;
    }

    const isStateTransition = (syncPlaying !== undefined && Boolean(syncPlaying) !== isPlayingRef.current);
    const isUserAction = Boolean(userAction || !isPeriodic);
    if (!isUserAction && !isStateTransition && !isDifferentTrack && Math.abs(targetTime - (lastSyncPayloadRef.current.time || 0)) < 0.5 && (nowTime - (lastSyncPayloadRef.current.timestamp || 0) < 350)) {
      return;
    }
    lastSyncPayloadRef.current = { time: targetTime, trackId: syncTrackId || '', timestamp: nowTime };

    if (syncPlaying === false) {
      shouldBePlayingRef.current = false;
      setIsPlaying(false);
      isPlayingRef.current = false;
      if (soundRef.current) {
        try {
          await soundRef.current.pauseAsync();
        } catch {}
      }
      if (syncTrack) {
        setCurrentTrack(syncTrack);
      }
      if (targetTime !== undefined) {
        progressRef.current = { ...progressRef.current, currentTime: Math.max(0, targetTime) };
        updateAudioProgress({ currentTime: Math.max(0, targetTime), duration: progressRef.current.duration });
      }
      if (jamSyncRef.current.jamSession) {
        jamSyncRef.current.jamSession.isPlaying = false;
        if (syncTrack) jamSyncRef.current.jamSession.currentTrack = syncTrack;
        jamSyncRef.current.jamSession.currentTime = targetTime;
        jamSyncRef.current.jamSession.updatedAt = Date.now();
        setJamSessionState({ ...jamSyncRef.current.jamSession });
      }
      const trackForNotif = syncTrack || cur;
      if (trackForNotif) {
        const isLikedTrack = likedTrackIds.some(id => String(id) === String(trackForNotif._id || trackForNotif.id));
        updateMediaNotification(false, repeatModeRef?.current || 'off', isShuffleRef?.current || false, isLikedTrack, {
          ...trackForNotif,
          currentTime: targetTime !== undefined ? targetTime : (playbackStatusRef.current?.currentTime || 0),
          duration: playbackStatusRef.current?.duration || Number(trackForNotif?.duration || 240)
        });
      }
      return;
    }

    if (isDifferentTrack && syncTrack && playTrackCallbackRef.current) {
      playTrackCallbackRef.current(syncTrack, [], false, targetTime, true, false, true);
      return;
    }

    if (syncPlaying === true && !isPlayingRef.current && soundRef.current) {
      shouldBePlayingRef.current = true;
      isPlayingRef.current = true;
      setIsPlaying(true);
      soundRef.current.playAsync().catch(() => {});
    }
  }, [
    currentTrackRef, loadedTrackIdRef, progressRef, shouldBePlayingRef,
    isPlayingRef, setIsPlaying, seekToCallbackRef, soundRef, setCurrentTrack,
    likedTrackIds, repeatModeRef, isShuffleRef, playbackStatusRef, playTrackCallbackRef
  ]);

  const broadcastPlayState = useCallback((nextPlaying, overrideTrack, overrideTime, isSeek = false) => {
    const session = jamSyncRef.current?.jamSession;
    const socket = jamSyncRef.current?.socket;
    if (!session || !socket) return;
    if (!canControlJam()) return;

    const roomCode = String(session.code || session.roomCode || '').trim().toUpperCase();
    if (!roomCode) return;

    const track = overrideTrack || currentTrackRef.current;
    const time = overrideTime !== undefined ? Number(overrideTime) : (playbackStatusRef.current?.currentTime || 0);
    const playing = Boolean(nextPlaying !== undefined ? nextPlaying : isPlayingRef.current);

    // Keep local jamSession state updated immediately so host never desyncs
    if (jamSyncRef.current.jamSession) {
      jamSyncRef.current.jamSession = {
        ...jamSyncRef.current.jamSession,
        isPlaying: playing,
        currentTime: time,
        updatedAt: Date.now(),
        ...(track ? { currentTrack: track } : {}),
      };
      setJamSessionState({ ...jamSyncRef.current.jamSession });
    }

    socket.emit('jam:sync_play_state', {
      roomCode,
      isPlaying: playing,
      currentTrack: track,
      currentTime: time,
      initiatorId: socket.id,
      userId: currentUser?._id || currentUser?.id,
      isUserAction: true,
      isSeek: Boolean(isSeek),
      userAction: isSeek ? 'seek' : (playing ? 'play' : 'pause'),
    });
  }, [canControlJam, currentTrackRef, currentUser, isPlayingRef, playbackStatusRef]);

  const lastBroadcastRef = useRef({ isPlaying: null, trackId: null });

  const onHostPlayStateChange = useCallback((playing, track, time) => {
    if (!isJamHost()) return;
    const session = jamSyncRef.current?.jamSession;
    if (!session) return;
    const t = track || currentTrackRef.current;
    const tId = String(t?._id || t?.id || '');
    if (lastBroadcastRef.current.isPlaying === playing && lastBroadcastRef.current.trackId === tId) {
      return;
    }
    lastBroadcastRef.current = { isPlaying: playing, trackId: tId };
    broadcastPlayState(playing, t, time);
  }, [isJamHost, broadcastPlayState, currentTrackRef]);

  // Keep jamSyncRef updated with latest helpers
  jamSyncRef.current.broadcastPlayState = broadcastPlayState;
  jamSyncRef.current.canControlJam = canControlJam;
  jamSyncRef.current.isJamHost = isJamHost;
  jamSyncRef.current.onHostPlayStateChange = onHostPlayStateChange;

  return {
    jamSyncRef,
    jamSession,
    setJamSessionState,
    remoteDevicePlayback,
    setRemoteDevicePlayback,
    isJamHost,
    canControlJam,
    setJamSync,
    syncFromOnlineTrack,
    pauseNativePlayback,
    syncRemotePlayState,
    broadcastPlayState,
    onHostPlayStateChange,
  };
};
