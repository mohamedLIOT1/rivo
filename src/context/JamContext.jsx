import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config';
import { resumeAudioContext } from '../utils/audioEngine';
import { useUI } from './UIContext';
import { useAudioPlayer } from './AudioContext';
import { useUser } from './UserContext';

const JamContext = createContext(null);

const getStoredToken = () => {
  try {
    return localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
  } catch {
    return '';
  }
};

export function JamProvider({ children }) {
  const { currentUser } = useUser();
  const { currentTrack, isPlaying, currentTime, setJamSync, syncRemotePlayState } = useAudioPlayer();
  const { showToast, setIsJamOpen, setIsChatOpen, setChatTargetUser, setUnreadChatCount, isChatOpen, chatTargetUser } = useUI();

  const [socket, setSocket] = useState(null);
  const [jamSession, setJamSession] = useState(null);

  const jamSessionRef = useRef(jamSession);
  useEffect(() => { jamSessionRef.current = jamSession; }, [jamSession]);

  const currentUserRef = useRef(currentUser);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  const syncRemotePlayStateRef = useRef(syncRemotePlayState);
  useEffect(() => { syncRemotePlayStateRef.current = syncRemotePlayState; }, [syncRemotePlayState]);

  const isChatOpenRef = useRef(isChatOpen);
  useEffect(() => { isChatOpenRef.current = isChatOpen; }, [isChatOpen]);

  const chatTargetUserRef = useRef(chatTargetUser);
  useEffect(() => { chatTargetUserRef.current = chatTargetUser; }, [chatTargetUser]);

  const activeNotificationsRef = useRef({});

  // ── Actions ──────────────────────────────────────────────────────────
  const startJam = useCallback((openModal = true) => {
    resumeAudioContext();
    const cur = currentUserRef.current;
    const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = jamSessionRef.current?.code || `JAM-${randomCode}`;
    const userPayload = cur 
      ? { id: cur.id || cur._id, name: cur.name, avatar: cur.avatar }
      : { id: `user-${Math.floor(1000 + Math.random() * 9000)}`, name: 'Guest Listener', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop' };

    if (!jamSessionRef.current?.code) {
      const initialRoom = {
        code,
        hostId: socket?.id || 'host',
        hostUserId: userPayload.id,
        hostOnlyControl: false,
        currentTrack: currentTrack || null,
        isPlaying: Boolean(isPlaying),
        currentTime: Number(currentTime) || 0,
        updatedAt: Date.now(),
        queue: [],
        members: [{
          ...userPayload,
          socketId: socket?.id || 'host',
          isHost: true
        }]
      };
      setJamSession(initialRoom);
      setJamSync({ socket, jamSession: initialRoom });
    }

    if (socket) {
      if (!socket.connected) socket.connect();
      socket.emit('jam:join_room', {
        roomCode: code,
        user: userPayload,
        currentTrack: currentTrack || null,
        isPlaying: Boolean(isPlaying),
        currentTime: Number(currentTime) || 0
      });
      showToast(`Jam Session active: ${code}`);
    } else {
      showToast(`Jam Session created: ${code}`);
    }

    if (openModal) {
      setIsJamOpen(true);
    }
    return code;
  }, [socket, currentTrack, isPlaying, currentTime, setJamSync, showToast, setIsJamOpen]);

  const startJamWithTargetUser = useCallback((target) => {
    const code = startJam(true);
    const targetId = target?.id || target?._id;
    const cur = currentUserRef.current;
    if (socket && targetId && code) {
      socket.emit('jam:invite_user', {
        recipientId: targetId,
        roomCode: code,
        host: {
          id: cur?.id || cur?._id,
          name: cur?.name || 'Friend',
          avatar: cur?.avatar || ''
        }
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
    const userPayload = cur 
      ? { id: cur.id || cur._id, name: cur.name, avatar: cur.avatar }
      : { id: `user-${Math.floor(1000 + Math.random() * 9000)}`, name: 'Guest Listener', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop' };

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
    if (jamSessionRef.current && socket && memberOrId) {
      const targetSocketId = typeof memberOrId === 'object' ? memberOrId.socketId : memberOrId;
      const targetUserId = typeof memberOrId === 'object' ? (memberOrId.id || memberOrId._id) : undefined;
      socket.emit('jam:transfer_host', {
        roomCode: jamSessionRef.current.code,
        targetSocketId,
        targetUserId
      });
    }
  }, [socket]);

  const kickMember = useCallback((memberOrId) => {
    if (jamSessionRef.current && socket && memberOrId) {
      const memberSocketId = typeof memberOrId === 'object' ? memberOrId.socketId : memberOrId;
      const memberId = typeof memberOrId === 'object' ? (memberOrId.id || memberOrId._id) : undefined;
      socket.emit('jam:kick_member', {
        roomCode: jamSessionRef.current.code,
        memberSocketId,
        memberId
      });
    }
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
        const userPayload = curUser 
          ? { id: curUser.id || curUser._id, name: curUser.name, avatar: curUser.avatar }
          : { id: `user-${Math.floor(1000 + Math.random() * 9000)}`, name: 'Guest Listener', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop' };
        s.emit('jam:join_room', { roomCode: jamSessionRef.current.code, user: userPayload });
      }
    });

    s.on('jam:room_updated', (room) => {
      const isFirstJoin = !jamSessionRef.current;
      setJamSession(room);
      setJamSync({ socket: s, jamSession: room });
      if (isFirstJoin && room?.currentTrack && syncRemotePlayStateRef.current && room.initiatorId !== s.id) {
        syncRemotePlayStateRef.current({
          isPlaying: Boolean(room.isPlaying),
          currentTrack: room.currentTrack,
          currentTime: room.currentTime,
          updatedAt: room.updatedAt
        });
      }
    });

    s.on('jam:promoted_to_host', () => {
      showToast('👑 You are now the host of this Jam session!');
    });

    s.on('jam:kicked', (data) => {
      showToast({
        type: 'error',
        message: data?.reason || 'You were kicked from the Jam room by the host.'
      });
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

    s.on('chat:message', (msg) => {
      const cur = currentUserRef.current;
      const myId = String(cur?.id || cur?._id || '');
      const recipientId = String(msg.recipient?._id || msg.recipient || '');
      const senderId = String(msg.sender?._id || msg.sender || '');
      if (senderId && senderId === myId) return;
      if (recipientId && myId && recipientId !== myId) return;

      const isOpenWithSender = isChatOpenRef.current && String(chatTargetUserRef.current?.id || chatTargetUserRef.current?._id) === senderId;
      if (isOpenWithSender) {
        s.emit('chat:mark_read', { senderId });
      } else {
        setUnreadChatCount(prev => prev + 1);
        const senderName = msg.senderName || 'Someone';
        const preview = msg.text || (msg.track ? `Shared song: ${msg.track.title || 'a track'}` : (msg.jamInvite ? 'Invited you to a Jam Session' : 'Sent an attachment'));

        if (msg.jamInvite?.roomCode) {
          showToast({
            type: 'jam',
            title: `📻 Jam Session • ${senderName}`,
            body: `Invited you to a live Jam Session! Tap to join (${msg.jamInvite.roomCode})`,
            roomCode: msg.jamInvite.roomCode,
            sender: { id: senderId, name: senderName, avatar: msg.senderAvatar }
          });
        } else {
          showToast({
            type: 'chat',
            title: `💬 ${senderName}`,
            body: preview,
            sender: { id: senderId, name: senderName, avatar: msg.senderAvatar }
          });
        }
      }
    });

    return () => s.disconnect();
  }, [currentUser?.id, currentUser?._id, setJamSync, syncRemotePlayState, showToast, setIsJamOpen, setUnreadChatCount]);

  useEffect(() => {
    if (socket) {
      setJamSync({ socket, jamSession });
    }
  }, [socket, jamSession, setJamSync]);

  const value = {
    socket,
    jamSession,
    startJam,
    startJamWithTargetUser,
    joinJam,
    leaveJam,
    transferHost,
    kickMember,
  };

  return <JamContext.Provider value={value}>{children}</JamContext.Provider>;
}

export function useJam() {
  const ctx = useContext(JamContext);
  if (!ctx) {
    throw new Error('useJam must be used within a JamProvider');
  }
  return ctx;
}
