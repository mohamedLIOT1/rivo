import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config';
import { resumeAudioContext } from '../utils/audioEngine';
import { playNotificationSound } from '../utils/chatSound';
import { showWebChatNotification, flashTabTitle, subscribeSwNotificationOpen, isWindowFocusedAndVisible } from '../utils/webNotification';
import { useUI } from './UIContext';
import { useAudioPlayer } from './AudioContext';
import { useUser } from './UserContext';

const JamContext = createContext(null);

const getStoredToken = () => {
  try { return localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || ''; }
  catch { return ''; }
};

const makeUserPayload = (cur) => (cur
  ? { id: cur.id || cur._id, name: cur.name, avatar: cur.avatar }
  : { id: `user-${Math.floor(1000 + Math.random() * 9000)}`, name: 'Guest Listener', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop' });

export function JamProvider({ children }) {
  const { currentUser } = useUser();
  const { currentTrack, isPlaying, setJamSync, syncRemotePlayState, audioRef } = useAudioPlayer();
  const { showToast, setIsJamOpen, setIsChatOpen, setChatTargetUser, setUnreadChatCount, isChatOpen, chatTargetUser } = useUI();

  const [socket, setSocket] = useState(null);
  const [jamSession, setJamSession] = useState(null);

  const jamSessionRef = useRef(jamSession);
  const currentUserRef = useRef(currentUser);
  const syncRemotePlayStateRef = useRef(syncRemotePlayState);
  const isChatOpenRef = useRef(isChatOpen);
  const chatTargetUserRef = useRef(chatTargetUser);

  const openChatWithUser = useCallback((userData) => {
    const id = userData?.id || userData?._id || userData?.senderId;
    if (id) {
      setChatTargetUser({
        id: String(id),
        _id: String(id),
        name: userData.name || userData.senderName || 'Friend',
        avatar: userData.avatar || userData.senderAvatar || '',
        ...(userData.isBot ? { isBot: true } : {})
      });
    }
    setIsChatOpen(true);
  }, [setChatTargetUser, setIsChatOpen]);

  const openChatWithUserRef = useRef(openChatWithUser);
  useEffect(() => {
    jamSessionRef.current = jamSession;
    currentUserRef.current = currentUser;
    syncRemotePlayStateRef.current = syncRemotePlayState;
    isChatOpenRef.current = isChatOpen;
    chatTargetUserRef.current = chatTargetUser;
    openChatWithUserRef.current = openChatWithUser;
  }, [jamSession, currentUser, syncRemotePlayState, isChatOpen, chatTargetUser, openChatWithUser]);

  useEffect(() => subscribeSwNotificationOpen(openChatWithUser), [openChatWithUser]);

  // ── Actions ──────────────────────────────────────────────────────────
  const startJam = useCallback((openModal = true) => {
    resumeAudioContext();
    const cur = currentUserRef.current;
    const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = jamSessionRef.current?.code || `JAM-${randomCode}`;
    const userPayload = makeUserPayload(cur);

    const curTime = audioRef?.current?.currentTime || 0;
    if (!jamSessionRef.current?.code) {
      const initialRoom = {
        code, hostId: socket?.id || 'host', hostUserId: userPayload.id, hostOnlyControl: false,
        currentTrack: currentTrack || null, isPlaying: Boolean(isPlaying), currentTime: curTime,
        updatedAt: Date.now(), queue: [], members: [{ ...userPayload, socketId: socket?.id || 'host', isHost: true }]
      };
      setJamSession(initialRoom);
      setJamSync({ socket, jamSession: initialRoom });
    }

    if (socket) {
      if (!socket.connected) socket.connect();
      socket.emit('jam:join_room', { roomCode: code, user: userPayload, currentTrack: currentTrack || null, isPlaying: Boolean(isPlaying), currentTime: curTime });
      showToast(`Jam Session active: ${code}`);
    } else {
      showToast(`Jam Session created: ${code}`);
    }

    if (openModal) setIsJamOpen(true);
    return code;
  }, [socket, currentTrack, isPlaying, audioRef, setJamSync, showToast, setIsJamOpen]);

  const startJamWithTargetUser = useCallback((target) => {
    const code = startJam(true);
    const targetId = target?.id || target?._id;
    const cur = currentUserRef.current;
    if (socket && targetId && code) {
      socket.emit('jam:invite_user', {
        recipientId: targetId,
        roomCode: code,
        host: { id: cur?.id || cur?._id, name: cur?.name || 'Friend', avatar: cur?.avatar || '' }
      });
      showToast(`Invited ${target?.name || 'friend'} to Jam (${code})`);
    }
    return code;
  }, [startJam, socket, showToast]);

  const joinJam = useCallback((code) => {
    if (!code) return;
    resumeAudioContext();
    const cleanCode = code.trim().toUpperCase();
    const cur = currentUserRef.current;
    const userPayload = makeUserPayload(cur);

    if (socket) {
      if (!socket.connected) socket.connect();
      socket.emit('jam:join_room', { roomCode: cleanCode, user: userPayload });
      setIsJamOpen(true);
      showToast(`Joined Jam: ${cleanCode}`);
    } else {
      setIsJamOpen(true);
      showToast(`Connecting to Jam: ${cleanCode}...`);
    }
  }, [socket, setIsJamOpen, showToast]);

  const leaveJam = useCallback(() => {
    if (jamSessionRef.current && socket) {
      socket.emit('jam:leave_room', { roomCode: jamSessionRef.current.code });
      setJamSession(null);
      setJamSync({ jamSession: null });
      showToast('Left Jam Session');
    }
  }, [socket, setJamSync, showToast]);

  const transferHost = useCallback((memberOrId) => {
    if (!jamSessionRef.current || !socket || !memberOrId) return;
    socket.emit('jam:transfer_host', {
      roomCode: jamSessionRef.current.code,
      targetSocketId: typeof memberOrId === 'object' ? memberOrId.socketId : memberOrId,
      targetUserId: typeof memberOrId === 'object' ? (memberOrId.id || memberOrId._id) : undefined
    });
  }, [socket]);

  const kickMember = useCallback((memberOrId) => {
    if (!jamSessionRef.current || !socket || !memberOrId) return;
    socket.emit('jam:kick_member', {
      roomCode: jamSessionRef.current.code,
      memberSocketId: typeof memberOrId === 'object' ? memberOrId.socketId : memberOrId,
      memberId: typeof memberOrId === 'object' ? (memberOrId.id || memberOrId._id) : undefined
    });
  }, [socket]);

  // ── Sockets Lifecycle ─────────────────────────────────────────────────
  useEffect(() => {
    const token = getStoredToken();
    const s = io(API_BASE_URL, {
      auth: { token: token || undefined },
      transports: ['websocket', 'polling']
    });
    setSocket(s);

    s.on('connect', () => {
      const curUser = currentUserRef.current;
      if (curUser?.id || curUser?._id) {
        s.emit('user:online', { userId: curUser.id || curUser._id });
      }
      if (jamSessionRef.current?.code) {
        const userPayload = makeUserPayload(curUser);
        s.emit('jam:join_room', { roomCode: jamSessionRef.current.code, user: userPayload });
      }
    });

    const syncRoom = (room) => { setJamSession(room); setJamSync({ socket: s, jamSession: room }); };
    s.on('jam:room_created', syncRoom);
    s.on('jam_updated', syncRoom);

    s.on('jam:control_mode_changed', ({ hostOnlyControl }) => {
      setJamSession(prev => prev ? ({ ...prev, hostOnlyControl: Boolean(hostOnlyControl) }) : null);
    });

    s.on('jam:room_updated', (room) => {
      const isFirstJoin = !jamSessionRef.current;
      syncRoom(room);
      if (isFirstJoin && room?.currentTrack && syncRemotePlayStateRef.current && room.initiatorId !== s.id) {
        syncRemotePlayStateRef.current({ isPlaying: Boolean(room.isPlaying), currentTrack: room.currentTrack, currentTime: room.currentTime, updatedAt: room.updatedAt });
      }
    });

    s.on('jam:promoted_to_host', () => showToast('👑 You are now the host of this Jam session!'));

    s.on('jam:kicked', (data) => {
      showToast({ type: 'error', message: data?.reason || 'You were kicked from the Jam room by the host.' });
      setJamSession(null);
      setJamSync({ jamSession: null });
      setIsJamOpen(false);
    });

    s.on('jam:sync_play_state', (data) => {
      if (data?.initiatorId && data.initiatorId === s.id) return;
      syncRemotePlayState(data);
    });

    s.on('jam:pause_all', (data) => {
      syncRemotePlayState({ isPlaying: false, currentTrack: data?.currentTrack, currentTime: data?.currentTime });
    });

    s.on('jam:host_changed', ({ hostName }) => {
      if (hostName) showToast(`Jam Host transferred to ${hostName}`);
    });

    s.on('jam:invite_received', (data) => {
      const hostObj = data?.host || {};
      const hostName = hostObj.name || data?.name || 'Friend';
      const hostAvatar = hostObj.avatar || data?.avatar || '';
      const hostId = hostObj.id || data?.id || data?.senderId;
      const roomCode = data?.roomCode;
      if (!roomCode) return;

      showToast({
        type: 'jam',
        title: `📻 Jam Invite from ${hostName}`,
        body: `Invited you to listen together in sync! Tap to join (${roomCode})`,
        roomCode,
        sender: { id: hostId, name: hostName, avatar: hostAvatar }
      });
    });

    const abortController = new AbortController();
    const refreshUnreadCount = async () => {
      try {
        const tok = getStoredToken();
        if (!tok) { setUnreadChatCount(0); return; }
        const res = await fetch(`${API_BASE_URL}/api/chat/unread-count`, { headers: { Authorization: `Bearer ${tok}` }, signal: abortController.signal });
        const data = await res.json();
        if (!abortController.signal.aborted && data && typeof data.count === 'number') setUnreadChatCount(data.count);
      } catch {}
    };

    refreshUnreadCount();
    s.on('chat:unread_count', ({ count }) => { if (typeof count === 'number') setUnreadChatCount(count); });
    s.on('chat:dismiss_notification', refreshUnreadCount);

    const dispatchIncomingAlert = ({ title, body, toastType = 'chat', roomCode, senderObj, icon, tag, data, tabTitle }) => {
      showToast({ type: toastType, position: 'top', title, body, ...(roomCode ? { roomCode } : {}), sender: senderObj });
      playNotificationSound();
      showWebChatNotification({
        title,
        body,
        icon,
        tag,
        data,
        onClick: senderObj ? () => openChatWithUserRef.current?.(senderObj) : undefined
      });
      flashTabTitle(tabTitle);
    };

    s.on('chat:message', (msg) => {
      const cur = currentUserRef.current;
      const myId = String(cur?.id || cur?._id || '');
      const recipientId = String(msg.recipient?._id || msg.recipient || '');
      const senderId = String(msg.sender?._id || msg.sender || '');
      if (senderId && senderId === myId) return;
      if (recipientId && myId && recipientId !== myId) return;

      const isScreenActive = isWindowFocusedAndVisible();
      const isOpenWithSender = isChatOpenRef.current && String(chatTargetUserRef.current?.id || chatTargetUserRef.current?._id) === senderId;

      if (isOpenWithSender && isScreenActive) {
        // User is directly looking at this chat on screen
        s.emit('chat:mark_read', { senderId });
      } else {
        // User is in another tab, app is minimized, window not focused, or chat is not open with sender
        setUnreadChatCount(prev => prev + 1);
        const senderName = msg.senderName || 'Someone';
        const isBot = Boolean(msg.isBot || senderName === 'Rivo Bot');
        const senderObj = { id: senderId, name: senderName, avatar: msg.senderAvatar, ...(isBot ? { isBot: true } : {}) };
        const preview = msg.text || (msg.track ? `Shared song: ${msg.track.title || 'a track'}` : (msg.jamInvite ? 'Invited you to a Jam Session' : 'Sent an attachment'));
        const isJamInvite = Boolean(msg.jamInvite?.roomCode);

        dispatchIncomingAlert({
          title: isJamInvite ? `📻 Jam Session • ${senderName}` : `💬 ${senderName}`,
          body: isJamInvite ? `Invited you to a live Jam Session! Tap to join (${msg.jamInvite.roomCode})` : preview,
          toastType: isJamInvite ? 'jam' : 'chat',
          roomCode: msg.jamInvite?.roomCode,
          senderObj,
          icon: msg.senderAvatar,
          tag: `rivo-chat-${senderId}`,
          data: { senderId, senderName, avatar: msg.senderAvatar, isBot },
          tabTitle: `(1) 💬 ${senderName}`
        });
      }
    });

    s.on('notification:received', (payload) => {
      if (!payload) return;
      const title = payload.title || 'Rivo Notification';
      const body = payload.body || '';
      const senderId = payload.senderId ? String(payload.senderId) : '';
      const senderName = payload.data?.senderName || title;
      const avatar = payload.data?.avatar || '';
      const senderObj = senderId ? { id: senderId, name: senderName, avatar } : undefined;
      dispatchIncomingAlert({
        title,
        body,
        senderObj,
        icon: avatar,
        tag: senderId ? `rivo-notif-${senderId}` : 'rivo-notif',
        data: { senderId, senderName, avatar, ...(payload.data || {}) },
        tabTitle: `(1) 🔔 ${title}`
      });
    });

    const handleWindowFocusOrVisible = () => {
      if (!isWindowFocusedAndVisible()) return;
      if (isChatOpenRef.current && chatTargetUserRef.current) {
        const targetId = chatTargetUserRef.current.id || chatTargetUserRef.current._id;
        if (targetId) {
          s.emit('chat:mark_read', { senderId: String(targetId) });
        }
      }
      refreshUnreadCount();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', handleWindowFocusOrVisible);
      window.addEventListener('focus', handleWindowFocusOrVisible);
    }

    return () => {
      abortController.abort();
      if (typeof window !== 'undefined') {
        window.removeEventListener('visibilitychange', handleWindowFocusOrVisible);
        window.removeEventListener('focus', handleWindowFocusOrVisible);
      }
      s.disconnect();
    };
  }, [currentUser?.id, currentUser?._id, setJamSync, syncRemotePlayState, showToast, setIsJamOpen, setUnreadChatCount]);

  useEffect(() => {
    if (socket) {
      setJamSync({ socket, jamSession });
    }
  }, [socket, jamSession, setJamSync]);

  const value = useMemo(() => ({
    socket,
    jamSession,
    startJam,
    startJamWithTargetUser,
    joinJam,
    leaveJam,
    transferHost,
    kickMember,
  }), [socket, jamSession, startJam, startJamWithTargetUser, joinJam, leaveJam, transferHost, kickMember]);

  return <JamContext.Provider value={value}>{children}</JamContext.Provider>;
}

export function useJam() {
  const ctx = useContext(JamContext);
  if (!ctx) {
    throw new Error('useJam must be used within a JamProvider');
  }
  return ctx;
}
