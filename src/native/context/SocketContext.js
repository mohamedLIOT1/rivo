import React, { createContext, useContext, useState, useEffect } from 'react';
import io from 'socket.io-client';
import { API_BASE_URL } from '../config';
import { useUser } from './UserContext';
import { useAudioPlayer } from './AudioContext';
import { showChatNotification, dismissChatNotification } from '../services/mediaControls';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { currentUser, token } = useUser();
  const { syncRemotePlayState } = useAudioPlayer();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [jamSession, setJamSession] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);

  useEffect(() => {
    const s = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: { token },
    });

    s.on('connect', () => {
      setIsConnected(true);
      if (currentUser) {
        const uId = currentUser._id || currentUser.id;
        s.emit('user:online', { userId: uId });
        s.emit('user_connected', {
          userId: uId,
          name: currentUser.name,
          avatar: currentUser.avatar,
        });
      }
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen to real Jam Room server events
    s.on('jam:room_updated', (data) => {
      setJamSession(data);
      if (data?.currentTrack && syncRemotePlayState) {
        const myId = String(currentUser?._id || currentUser?.id || '');
        const isHost = Boolean(
          (data.hostUserId && myId && String(data.hostUserId) === myId) ||
          (data.hostId && s?.id && data.hostId === s.id)
        );
        if (!isHost) {
          syncRemotePlayState({
            isPlaying: data.isPlaying,
            currentTrack: data.currentTrack,
            currentTime: data.currentTime,
            updatedAt: data.updatedAt,
          });
        }
      }
    });

    s.on('jam:sync_play_state', (data) => {
      if (data?.currentTrack && syncRemotePlayState) {
        syncRemotePlayState(data);
      }
    });

    s.on('jam:on_play_state_changed', (data) => {
      if (data?.initiatorId !== s.id && data?.currentTrack && syncRemotePlayState) {
        syncRemotePlayState(data);
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
      const myId = String(currentUser?._id || currentUser?.id || '');
      if (myId && String(msg.recipient) === myId) {
        showChatNotification({
          senderId: msg.sender,
          senderName: msg.senderName || 'Friend',
          message: msg.text || (msg.track ? `Shared song: ${msg.track.title || 'a track'}` : (msg.jamInvite ? 'Invited you to a Jam Session' : 'Sent an attachment')),
          isJam: Boolean(msg.jamInvite?.roomCode),
          roomCode: msg.jamInvite?.roomCode,
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

  const joinJam = (roomCode) => {
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
      socket.emit('jam:join_room', { roomCode: cleanCode, user: userPayload });
    }
  };

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
    const code = jamSession?.code || jamSession?.roomCode;
    if (socket && isConnected && code) {
      socket.emit('jam:sync_play_state', {
        roomCode: code,
        isPlaying: Boolean(isPlaying),
        currentTrack,
        currentTime: Number(currentTime || 0),
        initiatorId: socket.id,
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
