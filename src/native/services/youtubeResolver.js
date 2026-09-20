import { API_BASE_URL } from '../config';

export const resolveYouTubeStream = async (trackId) => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/tracks/${trackId}/stream`);
    if (res.ok) {
      const data = await res.json();
      return data.url || data.streamUrl || null;
    }
  } catch {
    return null;
  }
  return null;
};
