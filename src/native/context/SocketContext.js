import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { API_BASE_URL } from '../config';
import { useUser } from './UserContext';
import { useAudioPlayer } from './AudioContext';
import { showChatNotification, dismissChatNotification } from '../services/mediaControls';
import { useToast } from './ToastContext';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { currentUser, token } = useUser();
  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);
  const { syncRemotePlayState, setJamSync, playNextTrack, playPrevTrack } = useAudioPlayer();
  const syncRemotePlayStateRef = useRef(syncRemotePlayState);
  useEffect(() => {
    syncRemotePlayStateRef.current = syncRemotePlayState;
  }, [syncRemotePlayState]);
  const playNextTrackRef = useRef(playNextTrack);
  useEffect(() => {
    playNextTrackRef.current = playNextTrack;
  }, [playNextTrack]);
  const playPrevTrackRef = useRef(playPrevTrack);
  useEffect(() => {
    playPrevTrackRef.current = playPrevTrack;
  }, [playPrevTrack]);

  const { showToast } = useToast();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [jamSession, setJamSession] = useState(null);
  const jamSessionRef = useRef(null);
  useEffect(() => {
    jamSessionRef.current = jamSession;
  }, [jamSession]);
  const [chatMessages, setChatMessages] = useState([]);

  const myId = String(currentUser?._id || currentUser?.id || '');
  const isCurrentUserHost = Boolean(
    jamSession &&
      ((jamSession.hostUserId && myId && String(jamSession.hostUserId) === myId) ||
        (socket && jamSession.hostId === socket.id) ||
        (jamSession.members || []).some(m => (socket && m.socketId === socket.id) || (myId && String(m.id || m._id) === myId && m.isHost)))
  );
  const isCurrentUserHostRef = useRef(isCurrentUserHost);
  useEffect(() => {
    isCurrentUserHostRef.current = isCurrentUserHost;
  }, [isCurrentUserHost]);

  useEffect(() => {
    if (setJamSync) {
      setJamSync({ socket, jamSession, isHost: isCurrentUserHost });
    }
  }, [socket, jamSession, isCurrentUserHost, setJamSync]);

  useEffect(() => {
    const s = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: { token },
    });

    s.on('connect', () => {
      setIsConnected(true);
      const cur = currentUserRef.current;
      if (cur) {
        const uId = cur._id || cur.id;
        s.emit('user:online', { userId: uId });
        s.emit('user_connected', {
          userId: uId,
          name: cur.name,
          avatar: cur.avatar,
        });
      }

      // Re-join active Jam room on reconnect/network switch
      if (jamSessionRef.current?.code || jamSessionRef.current?.roomCode) {
        const roomCode = jamSessionRef.current.code || jamSessionRef.current.roomCode;
        s.emit('jam:join_room', {
          roomCode,
          user: cur ? {
            id: cur._id || cur.id,
            _id: cur._id || cur.id,
            name: cur.name,
            avatar: cur.avatar || '',
          } : {
            id: s.id,
            _id: s.id,
            name: 'Listener',
            avatar: '',
          }
        });
      }
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen to real Jam Room server events with automatic synchronization
    s.on('jam:room_updated', (data) => {
      const isFirstJoin = !jamSessionRef.current;
      setJamSession(data);
      // Only auto-trigger initial track sync if this is the first join into room
      if (isFirstJoin && data?.currentTrack && syncRemotePlayStateRef.current) {
        if (data.initiatorId && data.initiatorId === s.id) return;
        syncRemotePlayStateRef.current({
          isPlaying: data.isPlaying,
          currentTrack: data.currentTrack,
          currentTime: data.currentTime,
          updatedAt: data.updatedAt,
        });
      }
    });

    s.on('jam:sync_play_state', (data) => {
      if (data) {
        setJamSession(prev => {
          if (prev) {
            return {
              ...prev,
              isPlaying: data.isPlaying !== undefined ? Boolean(data.isPlaying) : prev.isPlaying,
              currentTime: data.currentTime !== undefined ? Number(data.currentTime) : prev.currentTime,
              currentTrack: data.currentTrack || prev.currentTrack,
              updatedAt: data.updatedAt || Date.now(),
            };
          }
          if (data.roomCode) {
            return {
              code: data.roomCode,
              isPlaying: Boolean(data.isPlaying),
              currentTime: Number(data.currentTime) || 0,
              currentTrack: data.currentTrack,
              updatedAt: data.updatedAt || Date.now(),
              members: []
            };
          }
          return null;
        });

        if (syncRemotePlayStateRef.current) {
          if (data.initiatorId && data.initiatorId === s.id) return;
          syncRemotePlayStateRef.current(data);
        }
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
        syncRemotePlayStateRef.current({
          isPlaying: false,
          currentTrack: data?.currentTrack,
          currentTime: data?.currentTime,
          updatedAt: Date.now(),
        });
      }
    });

    s.on('jam:advance_host_queue', () => {
      if (isCurrentUserHostRef.current && playNextTrackRef.current) {
        playNextTrackRef.current(true);
      }
    });

    s.on('jam:prev_track', () => {
      if (isCurrentUserHostRef.current && playPrevTrackRef.current) {
        playPrevTrackRef.current(true);
      }
    });

    // Cross-Device Mutual Exclusion: Force pause this mobile device when other device starts playing
    s.on('device:force_pause', () => {
      if (syncRemotePlayStateRef.current) {
        syncRemotePlayStateRef.current({ isPlaying: false });
      }
    });

    s.on('jam:you_are_host', ({ roomCode }) => {
      const cur = currentUserRef.current;
      const myId = String(cur?._id || cur?.id || s.id);
      setJamSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          hostId: s.id,
          hostUserId: cur?._id || cur?.id || null,
          members: (prev.members || []).map(m => ({
            ...m,
            isHost: m.socketId === s.id || (myId && String(m.id || m._id) === myId)
          }))
        };
      });
      showToast('You are now the Jam Room Host! 👑', 'info');
    });

    s.on('jam:host_changed', ({ hostId, hostUserId, hostName }) => {
      setJamSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          hostId,
          hostUserId,
          members: (prev.members || []).map(m => ({
            ...m,
            isHost: m.socketId === hostId || (hostUserId && String(m.id || m._id) === String(hostUserId))
          }))
        };
      });
      if (hostName) {
        showToast(`Jam Host transferred to ${hostName}`, 'info');
      }
    });

    s.on('jam_updated', (data) => {
      setJamSession(data);
    });

    s.on('jam:kicked', () => {
      setJamSession(null);
    });

    s.on('jam_ended', () => {
      setJamSession(null);
    });

    s.on('new_chat_message', (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    s.on('chat:message', (msg) => {
      const cur = currentUserRef.current || currentUser;
      const myId = String(cur?._id || cur?.id || '');
      const recipientId = String(msg.recipient?._id || msg.recipient || '');
      const senderId = String(msg.sender?._id || msg.sender || '');
      if (senderId && senderId === myId) return;
      if (!recipientId || (myId && recipientId === myId)) {
        showChatNotification({
          senderId: senderId,
          senderName: msg.senderName || 'Friend',
          message: msg.text || (msg.track ? `Shared song: ${msg.track.title || 'a track'}` : (msg.jamInvite ? 'Invited you to a Jam Session' : 'Sent an attachment')),
          isJam: Boolean(msg.jamInvite?.roomCode),
          roomCode: msg.jamInvite?.roomCode,
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
          onPress: () => {
            if (joinJamRef.current) {
              joinJamRef.current(data.roomCode);
            }
          }
        });
      }
    });

    s.on('chat:dismiss_notification', ({ senderId }) => {
      if (senderId) {
        dismissChatNotification(senderId);
      }
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [token, currentUser?._id, currentUser?.id]);

  const joinJam = (roomCode, initialTrack = null, isPlaying = false, currentTime = 0) => {
    if (socket && isConnected && roomCode) {
      const cleanCode = String(roomCode).trim().toUpperCase();
      const userPayload = currentUser ? {
        id: currentUser._id || currentUser.id,
        _id: currentUser._id || currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar || '',
      } : {
        id: socket.id,
        _id: socket.id,
        name: 'Listener',
        avatar: '',
      };

      // Set optimistic room state in mobile so the room renders immediately with active track
      setJamSession({
        code: cleanCode,
        roomCode: cleanCode,
        hostId: socket.id,
        hostUserId: userPayload.id,
        isHost: true,
        currentTrack: initialTrack || null,
        isPlaying: Boolean(isPlaying),
        currentTime: Number(currentTime) || 0,
        updatedAt: Date.now(),
        members: [{
          ...userPayload,
          socketId: socket.id,
          isHost: true,
        }],
        queue: [],
      });

      socket.emit('jam:join_room', {
        roomCode: cleanCode,
        user: userPayload,
        currentTrack: initialTrack || null,
        isPlaying: Boolean(isPlaying),
        currentTime: Number(currentTime) || 0
      });
    }
  };
  const joinJamRef = useRef(joinJam);
  useEffect(() => {
    joinJamRef.current = joinJam;
  }, [socket, isConnected, currentUser]);

  const leaveJam = () => {
    const code = jamSession?.code || jamSession?.roomCode;
    if (socket && isConnected && code) {
      socket.emit('jam:leave_room', { roomCode: code });
    }
    setJamSession(null);
  };

  const addToJamQueue = (track) => {
    const code = jamSession?.code || jamSession?.roomCode;
    if (socket && isConnected && code && track) {
      socket.emit('jam:add_to_queue', { roomCode: code, track });
    }
  };

  const removeFromJamQueue = (trackIndex, trackId) => {
    const code = jamSession?.code || jamSession?.roomCode;
    if (socket && isConnected && code) {
      socket.emit('jam:remove_from_queue', { roomCode: code, trackIndex, trackId });
    }
  };

  const reorderJamQueue = (fromIndex, toIndex) => {
    const code = jamSession?.code || jamSession?.roomCode;
    if (socket && isConnected && code) {
      socket.emit('jam:reorder_queue', { roomCode: code, fromIndex, toIndex });
    }
  };

  const transferJamHost = (member) => {
    const code = jamSession?.code || jamSession?.roomCode;
    if (socket && isConnected && code && member) {
      socket.emit('jam:transfer_host', {
        roomCode: code,
        targetSocketId: member.socketId,
        targetUserId: member.id || member._id,
      });
    }
  };

  const kickJamMember = (member) => {
    const code = jamSession?.code || jamSession?.roomCode;
    if (socket && isConnected && code && member) {
      socket.emit('jam:kick_member', {
        roomCode: code,
        memberSocketId: member.socketId,
        memberId: member.id || member._id,
      });
    }
  };

  const syncJamPlayState = (isPlaying, currentTrack, currentTime) => {
    const rawCode = jamSession?.code || jamSession?.roomCode;
    if (socket && isConnected && rawCode && jamSession) {
      const cleanCode = String(rawCode).trim().toUpperCase();
      const cur = currentUserRef.current || currentUser;
      const myId = String(cur?._id || cur?.id || socket.id);
      const isHost = (jamSession.hostId === socket.id) ||
        (jamSession.hostUserId && String(jamSession.hostUserId) === myId) ||
        (jamSession.members || []).some(m => (m.socketId === socket.id || (myId && String(m.id || m._id) === myId)) && m.isHost);
      const canControl = isHost || !jamSession.hostOnlyControl;
      if (!canControl) return;

      socket.emit('jam:sync_play_state', {
        roomCode: cleanCode,
        isPlaying: Boolean(isPlaying),
        currentTrack,
        currentTime: Number(currentTime || 0),
        initiatorId: socket.id,
        userId: myId,
      });
    }
  };

  const sendChatMessage = (text, recipientId = null) => {
    if (!socket || !isConnected || !text.trim()) return;
    const msg = {
      id: Date.now().toString(),
      senderId: currentUser?._id || currentUser?.id,
      senderName: currentUser?.name || 'Listener',
      senderAvatar: currentUser?.avatar,
      text: text.trim(),
      recipientId,
      timestamp: new Date().toISOString(),
    };
    socket.emit('send_chat_message', msg);
    setChatMessages((prev) => [...prev, msg]);
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        jamSession,
        chatMessages,
        joinJam,
        leaveJam,
        addToJamQueue,
        removeFromJamQueue,
        reorderJamQueue,
        transferJamHost,
        kickJamMember,
        syncJamPlayState,
        sendChatMessage,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
