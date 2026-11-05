import { API_BASE_URL } from '../../config';

export const autoPersistFinishedTrack = async (track) => {
  if (!track || !track.title) return;
  const tid = String(track._id || track.id || '');
  if (/^[a-f0-9]{24}$/i.test(tid) && track.source === 'Rivo' && !track.isExternal) return;

  try {
    await fetch(`${API_BASE_URL}/api/tracks/auto-persist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: tid,
        title: track.title,
        artist: track.artist,
        album: track.album,
        cover: track.cover || track.coverUrl,
        audioUrl: track.audioUrl || track.streamUrl,
        duration: track.duration,
        youtubeId: track.youtubeId,
        source: track.source || 'YouTube',
      }),
    });
  } catch {}
};

export const broadcastListeningActivity = (activeToken, track, playingState, posSeconds = 0) => {
  if (!activeToken) return;

  const payload = {
    track: track ? {
      id: track._id || track.id,
      title: track.title,
      artist: track.artist,
      cover: track.coverUrl || track.cover,
      audioUrl: track.audioUrl,
      duration: track.duration,
    } : null,
    isPlaying: Boolean(playingState),
    currentTime: Math.max(0, Number(posSeconds) || 0),
  };

  fetch(`${API_BASE_URL}/api/users/listening-activity`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${activeToken}`,
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
};
