import React, { createContext, useContext, useState, useEffect } from 'react';
import io from 'socket.io-client';
import { API_BASE_URL } from '../config';
import { useUser } from './UserContext';
import { showChatNotification, dismissChatNotification } from '../services/mediaControls';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { currentUser, token } = useUser();
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

    s.on('jam_updated', (data) => {
      setJamSession(data);
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
    if (socket && isConnected) {
      socket.emit('join_jam', { roomCode, user: currentUser });
    }
  };

  const leaveJam = () => {
    if (socket && isConnected && jamSession) {
      socket.emit('leave_jam', { roomId: jamSession.roomId });
      setJamSession(null);
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
        sendChatMessage,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
