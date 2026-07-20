/**
 * Socket.io Real-Time Jam Session Engine & Event Service
 */

import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config';

let socket = null;

export function getJamSocket() {
  if (!socket) {
    socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true
    });

    socket.on('connect', () => {
      console.log('⚡ Connected to Liofy Real-Time Jam Socket:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('Jam Socket Connection Notice:', err.message);
    });
  }
  return socket;
}

export function joinJamRoom(roomCode, user) {
  const s = getJamSocket();
  if (s) {
    s.emit('jam:join_room', { roomCode, user });
  }
}

export function syncJamPlayState(roomCode, isPlaying, currentTrackId, currentTime) {
  const s = getJamSocket();
  if (s) {
    s.emit('jam:sync_play_state', { roomCode, isPlaying, currentTrackId, currentTime });
  }
}

export function subscribeToJamRoom(onRoomUpdated, onPlayStateChanged) {
  const s = getJamSocket();
  if (!s) return () => {};

  s.on('jam:room_updated', onRoomUpdated);
  s.on('jam:on_play_state_changed', onPlayStateChanged);

  return () => {
    s.off('jam:room_updated', onRoomUpdated);
    s.off('jam:on_play_state_changed', onPlayStateChanged);
  };
}
