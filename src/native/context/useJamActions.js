import { useCallback } from 'react';

export function useJamActions({
  socket,
  jamSession,
  setJamSession,
  jamSessionRef,
  currentUser,
  currentUserRef,
}) {
  const emitJamAction = useCallback((event, payload) => {
    const code = jamSession?.code || jamSession?.roomCode;
    if (socket && code) socket.emit(event, { roomCode: code, ...payload });
  }, [socket, jamSession]);

  const createJam = useCallback((roomCode = null, initialTrack = null, isPlaying = false, currentTime = 0) => {
    let cleanCode = roomCode ? String(roomCode).trim().toUpperCase() : null;
    if (!cleanCode) {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      cleanCode = `JAM-${randomNum}`;
    }
    const cur = currentUserRef?.current || currentUser;
    const userPayload = cur ? {
      id: cur._id || cur.id,
      _id: cur._id || cur.id,
      name: cur.name,
      avatar: cur.avatar || '',
    } : { id: socket?.id || 'host', _id: socket?.id || 'host', name: 'Listener', avatar: '' };

    const initialRoom = {
      code: cleanCode,
      roomCode: cleanCode,
      hostId: socket?.id || 'host',
      hostUserId: userPayload.id,
      isHost: true,
      currentTrack: initialTrack || null,
      isPlaying: Boolean(isPlaying),
      currentTime: Number(currentTime) || 0,
      updatedAt: Date.now(),
      members: [{ ...userPayload, socketId: socket?.id || 'host', isHost: true }],
      queue: [],
    };

    setJamSession(initialRoom);

    if (socket) {
      if (!socket.connected) socket.connect();
      socket.emit('jam:create_room', {
        roomCode: cleanCode,
        user: userPayload,
        currentTrack: initialTrack || null,
        isPlaying: Boolean(isPlaying),
        currentTime: Number(currentTime) || 0,
      });
      socket.emit('jam:join_room', {
        roomCode: cleanCode,
        user: userPayload,
        currentTrack: initialTrack || null,
        isPlaying: Boolean(isPlaying),
        currentTime: Number(currentTime) || 0,
      });
    }

    return cleanCode;
  }, [socket, currentUser, currentUserRef, setJamSession]);

  const joinJam = useCallback((roomCode, initialTrack = null, isPlaying = false, currentTime = 0) => {
    if (!roomCode) return;
    const cleanCode = String(roomCode).trim().toUpperCase();
    const cur = currentUserRef?.current || currentUser;
    const userPayload = cur ? {
      id: cur._id || cur.id,
      _id: cur._id || cur.id,
      name: cur.name,
      avatar: cur.avatar || '',
    } : { id: socket?.id || 'user', _id: socket?.id || 'user', name: 'Listener', avatar: '' };

    setJamSession({
      code: cleanCode,
      roomCode: cleanCode,
      hostId: socket?.id || null,
      hostUserId: userPayload.id,
      isHost: false,
      currentTrack: initialTrack || null,
      isPlaying: Boolean(isPlaying),
      currentTime: Number(currentTime) || 0,
      updatedAt: Date.now(),
      members: [{ ...userPayload, socketId: socket?.id || null, isHost: false }],
      queue: [],
    });

    if (socket) {
      if (!socket.connected) socket.connect();
      socket.emit('jam:join_room', {
        roomCode: cleanCode,
        user: userPayload,
        currentTrack: initialTrack || null,
        isPlaying: Boolean(isPlaying),
        currentTime: Number(currentTime) || 0
      });
    }
  }, [socket, currentUser, currentUserRef, setJamSession]);

  const leaveJam = useCallback(() => {
    const code = jamSessionRef?.current?.code || jamSessionRef?.current?.roomCode || jamSession?.code || jamSession?.roomCode;
    if (socket && code) socket.emit('jam:leave_room', { roomCode: code });
    setJamSession(null);
  }, [socket, jamSession, jamSessionRef, setJamSession]);

  const addToJamQueue = useCallback((track) => {
    if (track) emitJamAction('jam:add_to_queue', { track });
  }, [emitJamAction]);

  const removeFromJamQueue = useCallback((trackIndex, trackId) => {
    emitJamAction('jam:remove_from_queue', { trackIndex, trackId });
  }, [emitJamAction]);

  const reorderJamQueue = useCallback((fromIndex, toIndex) => {
    emitJamAction('jam:reorder_queue', { fromIndex, toIndex });
  }, [emitJamAction]);

  const transferJamHost = useCallback((member) => {
    if (!member) return;
    const targetSocketId = typeof member === 'object' ? member.socketId : member;
    const targetUserId = typeof member === 'object' ? (member.id || member._id) : undefined;
    emitJamAction('jam:transfer_host', { targetSocketId, targetUserId });
  }, [emitJamAction]);

  const kickJamMember = useCallback((member) => {
    if (!member) return;
    const memberSocketId = typeof member === 'object' ? member.socketId : member;
    const memberId = typeof member === 'object' ? (member.id || member._id) : undefined;
    emitJamAction('jam:kick_member', { memberSocketId, memberId });
  }, [emitJamAction]);

  const syncJamPlayState = useCallback((isPlaying, currentTrack, currentTime) => {
    const rawCode = jamSession?.code || jamSession?.roomCode;
    if (socket && rawCode && jamSession) {
      const cleanCode = String(rawCode).trim().toUpperCase();
      const cur = currentUserRef?.current || currentUser;
      const myId = String(cur?._id || cur?.id || socket.id);
      const isHost = (jamSession.hostId === socket.id) ||
        (jamSession.hostUserId && String(jamSession.hostUserId) === myId) ||
        (jamSession.members || []).some(m => (m.socketId === socket.id || (myId && String(m.id || m._id) === myId)) && m.isHost);
      if (!isHost && jamSession.hostOnlyControl) return;

      const playing = Boolean(isPlaying);
      const time = Number(currentTime || 0);

      setJamSession(prev => prev ? {
        ...prev,
        isPlaying: playing,
        currentTime: time,
        ...(currentTrack ? { currentTrack } : {}),
        updatedAt: Date.now(),
      } : prev);

      socket.emit('jam:sync_play_state', {
        roomCode: cleanCode,
        isPlaying: playing,
        currentTrack,
        currentTime: time,
        initiatorId: socket.id,
        userId: myId,
      });
    }
  }, [socket, jamSession, currentUser, currentUserRef, setJamSession]);

  return {
    createJam,
    joinJam,
    leaveJam,
    addToJamQueue,
    removeFromJamQueue,
    reorderJamQueue,
    transferJamHost,
    kickJamMember,
    syncJamPlayState,
  };
}
