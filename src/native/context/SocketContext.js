import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import io from 'socket.io-client';
import { API_BASE_URL } from '../config';
import { useUser } from './UserContext';
import { useAudioPlayer } from './AudioContext';
import { showChatNotification, dismissChatNotification } from '../services/mediaControls';
import { useToast } from './ToastContext';
import { useJamActions } from './useJamActions';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { currentUser, token, fetchPublicTracks } = useUser();
  const fetchPublicTracksRef = useRef(fetchPublicTracks); fetchPublicTracksRef.current = fetchPublicTracks;
  const currentUserRef = useRef(currentUser); currentUserRef.current = currentUser;

  const { syncRemotePlayState, setJamSync, playNextTrack, playPrevTrack } = useAudioPlayer();
  const syncRemotePlayStateRef = useRef(syncRemotePlayState); syncRemotePlayStateRef.current = syncRemotePlayState;
  const playNextTrackRef = useRef(playNextTrack); playNextTrackRef.current = playNextTrack;
  const playPrevTrackRef = useRef(playPrevTrack); playPrevTrackRef.current = playPrevTrack;

  const { showToast } = useToast();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [jamSession, setJamSession] = useState(null);
  const jamSessionRef = useRef(null);
  jamSessionRef.current = jamSession;
  const [chatMessages, setChatMessages] = useState([]);

  const myId = String(currentUser?._id || currentUser?.id || '');
  const isCurrentUserHost = Boolean(
    jamSession &&
      ((jamSession.hostUserId && myId && String(jamSession.hostUserId) === myId) ||
        (socket && jamSession.hostId === socket.id) ||
        (jamSession.members || []).some(m => ((socket && m.socketId === socket.id) || (myId && String(m.id || m._id) === myId)) && Boolean(m.isHost)))
  );
  const isCurrentUserHostRef = useRef(isCurrentUserHost);
  isCurrentUserHostRef.current = isCurrentUserHost;

  useEffect(() => {
    if (setJamSync) setJamSync({ socket, jamSession, isHost: isCurrentUserHost });
  }, [socket, jamSession, isCurrentUserHost, setJamSync]);

  const {
    createJam,
    joinJam,
    leaveJam,
    addToJamQueue,
    removeFromJamQueue,
    reorderJamQueue,
    transferJamHost,
    kickJamMember,
    syncJamPlayState,
  } = useJamActions({
    socket,
    jamSession,
    setJamSession,
    jamSessionRef,
    currentUser,
    currentUserRef,
  });

  const joinJamRef = useRef(joinJam);
  joinJamRef.current = joinJam;

  useEffect(() => {
    const s = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: { token },
    });

    let connectDebounceTimer = null;
    let lastConnectTime = 0;
    const CONNECT_DEBOUNCE_MS = 2000;

    const emitConnectHandshake = () => {
      const cur = currentUserRef.current;
      if (cur) {
        const uId = cur._id || cur.id;
        s.emit('user:online', { userId: uId });
        s.emit('user_connected', { userId: uId, name: cur.name, avatar: cur.avatar });
      }
      const activeCode = jamSessionRef.current?.code || jamSessionRef.current?.roomCode;
      if (activeCode) {
        s.emit('jam:join_room', {
          roomCode: activeCode,
          user: cur ? { id: cur._id || cur.id, _id: cur._id || cur.id, name: cur.name, avatar: cur.avatar || '' } : { id: s.id, _id: s.id, name: 'Listener', avatar: '' }
        });
      }
    };

    s.on('connect', () => {
      setIsConnected(true);
      const now = Date.now();
      if (now - lastConnectTime < CONNECT_DEBOUNCE_MS) {
        if (!connectDebounceTimer) {
          connectDebounceTimer = setTimeout(() => {
            connectDebounceTimer = null;
            lastConnectTime = Date.now();
            emitConnectHandshake();
          }, CONNECT_DEBOUNCE_MS);
        }
        return;
      }
      if (connectDebounceTimer) { clearTimeout(connectDebounceTimer); connectDebounceTimer = null; }
      lastConnectTime = now;
      emitConnectHandshake();
    });

    s.on('disconnect', () => setIsConnected(false));

    let catalogDebounceTimer = null;
    let lastCatalogFetchTime = 0;
    const onCatalogUpdate = () => {
      const now = Date.now();
      if (now - lastCatalogFetchTime < 10000) {
        if (!catalogDebounceTimer) {
          catalogDebounceTimer = setTimeout(() => {
            catalogDebounceTimer = null;
            lastCatalogFetchTime = Date.now();
            if (fetchPublicTracksRef.current) fetchPublicTracksRef.current();
          }, 10000 - (now - lastCatalogFetchTime));
        }
        return;
      }
      if (catalogDebounceTimer) { clearTimeout(catalogDebounceTimer); catalogDebounceTimer = null; }
      lastCatalogFetchTime = now;
      if (fetchPublicTracksRef.current) fetchPublicTracksRef.current();
    };

    ['track:created', 'track:updated', 'track:deleted', 'album:created', 'album:updated', 'album:deleted'].forEach(evt => s.on(evt, onCatalogUpdate));

    // Listen to jam:room_created, jam:room_updated, jam_updated to instantly sync session
    const handleRoomUpdate = (data) => {
      if (!data) return;
      const isFirstJoin = !jamSessionRef.current;
      setJamSession(data);
      if (isFirstJoin && data?.currentTrack && syncRemotePlayStateRef.current && (!data.initiatorId || data.initiatorId !== s.id)) {
        syncRemotePlayStateRef.current({ isPlaying: data.isPlaying, currentTrack: data.currentTrack, currentTime: data.currentTime, updatedAt: data.updatedAt });
      }
    };
    s.on('jam:room_created', handleRoomUpdate);
    s.on('jam:room_updated', handleRoomUpdate);
    s.on('jam_updated', handleRoomUpdate);

    s.on('jam:sync_play_state', (data) => {
      if (!data) return;
      setJamSession(prev => prev ? {
        ...prev,
        isPlaying: data.isPlaying !== undefined ? Boolean(data.isPlaying) : prev.isPlaying,
        currentTime: data.currentTime !== undefined ? Number(data.currentTime) : prev.currentTime,
        currentTrack: data.currentTrack || prev.currentTrack,
        updatedAt: data.updatedAt || Date.now(),
      } : (data.roomCode ? {
        code: data.roomCode, isPlaying: Boolean(data.isPlaying), currentTime: Number(data.currentTime) || 0,
        currentTrack: data.currentTrack, updatedAt: data.updatedAt || Date.now(), members: []
      } : null));
      if (syncRemotePlayStateRef.current && (!data.initiatorId || data.initiatorId !== s.id)) {
        syncRemotePlayStateRef.current(data);
      }
    });

    s.on('jam:on_play_state_changed', (data) => {
      setJamSession(prev => prev ? ({
        ...prev,
        isPlaying: Boolean(data?.isPlaying),
        currentTime: data?.currentTime !== undefined ? Number(data.currentTime) : prev.currentTime,
        currentTrack: data?.currentTrack || prev.currentTrack,
        updatedAt: data?.updatedAt || Date.now(),
      }) : null);
    });

    s.on('jam:pause_all', (data) => {
      setJamSession(prev => prev ? ({ ...prev, isPlaying: false, updatedAt: Date.now() }) : null);
      if (data?.initiatorId !== s.id && syncRemotePlayStateRef.current) {
        syncRemotePlayStateRef.current({ isPlaying: false, currentTrack: data?.currentTrack, currentTime: data?.currentTime, updatedAt: Date.now() });
      }
    });

    s.on('jam:advance_host_queue', () => { if (isCurrentUserHostRef.current && playNextTrackRef.current) playNextTrackRef.current(true); });
    s.on('jam:prev_track', () => { if (isCurrentUserHostRef.current && playPrevTrackRef.current) playPrevTrackRef.current(true); });
    s.on('device:force_pause', () => { if (syncRemotePlayStateRef.current) syncRemotePlayStateRef.current({ isPlaying: false }); });

    s.on('jam:you_are_host', () => {
      const cur = currentUserRef.current;
      const curId = String(cur?._id || cur?.id || s.id);
      setJamSession(prev => prev ? {
        ...prev, hostId: s.id, hostUserId: cur?._id || cur?.id || null,
        members: (prev.members || []).map(m => ({ ...m, isHost: m.socketId === s.id || (curId && String(m.id || m._id) === curId) }))
      } : prev);
      showToast('You are now the Jam Room Host! 👑', 'info');
    });

    s.on('jam:host_changed', ({ hostId, hostUserId, hostName }) => {
      setJamSession(prev => prev ? {
        ...prev, hostId, hostUserId,
        members: (prev.members || []).map(m => ({ ...m, isHost: m.socketId === hostId || (hostUserId && String(m.id || m._id) === String(hostUserId)) }))
      } : prev);
      if (hostName) showToast(`Jam Host transferred to ${hostName}`, 'info');
    });

    s.on('jam:control_mode_changed', ({ hostOnlyControl }) => {
      setJamSession(prev => prev ? ({ ...prev, hostOnlyControl: Boolean(hostOnlyControl) }) : null);
    });
    s.on('jam:kicked', () => setJamSession(null));
    s.on('jam_ended', () => setJamSession(null));
    s.on('new_chat_message', (msg) => setChatMessages(prev => [...prev, msg]));

    s.on('chat:message', (msg) => {
      const cur = currentUserRef.current || currentUser;
      const curId = String(cur?._id || cur?.id || '');
      const recipientId = String(msg.recipient?._id || msg.recipient || '');
      const senderId = String(msg.sender?._id || msg.sender || '');
      if (senderId && senderId === curId) return;
      if (!recipientId || (curId && recipientId === curId)) {
        showChatNotification({
          senderId, senderName: msg.senderName || 'Friend',
          message: msg.text || (msg.track ? `Shared song: ${msg.track.title || 'a track'}` : (msg.jamInvite ? 'Invited you to a Jam Session' : 'Sent an attachment')),
          isJam: Boolean(msg.jamInvite?.roomCode), roomCode: msg.jamInvite?.roomCode,
        });
      }
    });

    s.on('jam:invite_received', (data) => {
      if (data?.roomCode) {
        showToast({
          title: 'Jam Invite 📻',
          message: `${data.host?.name || 'A friend'} invited you to join Jam ${data.roomCode}! Tap to join.`,
          avatar: data.host?.avatar || '',
          type: 'info',
          duration: 6000,
          onPress: () => { if (joinJamRef.current) joinJamRef.current(data.roomCode); }
        });
      }
    });

    s.on('chat:dismiss_notification', ({ senderId }) => { if (senderId) dismissChatNotification(senderId); });

    setSocket(s);

    return () => {
      if (catalogDebounceTimer) clearTimeout(catalogDebounceTimer);
      if (connectDebounceTimer) clearTimeout(connectDebounceTimer);
      s.disconnect();
    };
  }, [token, currentUser?._id, currentUser?.id]);

  const sendChatMessage = useCallback((text, recipientId = null) => {
    if (!socket || !text.trim()) return;
    socket.emit('send_chat_message', {
      id: Date.now().toString(),
      senderId: currentUser?._id || currentUser?.id,
      senderName: currentUser?.name || 'Listener',
      senderAvatar: currentUser?.avatar,
      text: text.trim(),
      recipientId,
      timestamp: new Date().toISOString(),
    });
    setChatMessages(prev => [...prev, {
      id: Date.now().toString(), senderId: currentUser?._id || currentUser?.id, senderName: currentUser?.name || 'Listener',
      senderAvatar: currentUser?.avatar, text: text.trim(), recipientId, timestamp: new Date().toISOString()
    }]);
  }, [socket, currentUser]);

  const value = useMemo(() => ({
    socket, isConnected, jamSession, isCurrentUserHost, chatMessages, createJam, joinJam, leaveJam,
    addToJamQueue, removeFromJamQueue, reorderJamQueue, transferJamHost, kickJamMember, syncJamPlayState, sendChatMessage
  }), [
    socket, isConnected, jamSession, isCurrentUserHost, chatMessages, createJam, joinJam, leaveJam,
    addToJamQueue, removeFromJamQueue, reorderJamQueue, transferJamHost, kickJamMember, syncJamPlayState, sendChatMessage
  ]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => useContext(SocketContext);
export default SocketContext;
