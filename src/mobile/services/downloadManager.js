import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

const OFFLINE_TRACKS_KEY = '@liofy_offline_tracks_v1';
const TRACKS_DIR = `${FileSystem.documentDirectory}liofy_tracks/`;

async function resolveYouTubeMobile(inputUrl) {
  if (!inputUrl) return null;
  const match = inputUrl.match(/(?:v=|\/|embed\/|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  const videoId = match ? match[1] : (inputUrl.length === 11 ? inputUrl : null);
  if (!videoId) return null;

  const instances = [
    'https://inv.nadeko.net',
    'https://yewtu.be',
    'https://yt.artemislena.eu',
    'https://invidious.nerdvpn.de',
    'https://inv.us.projectsegfau.lt',
    'https://invidious.privacydev.net',
    'https://invidious.tiekoetter.com'
  ];

  for (const base of instances) {
    try {
      const res = await fetch(`${base}/api/v1/videos/${videoId}?fields=adaptiveFormats,formatStreams`);
      if (!res.ok) continue;
      const data = await res.json();
      const formats = data.adaptiveFormats || data.formatStreams || [];
      const audio = formats.find(f => f.type?.includes('audio/mp4')) ||
                    formats.find(f => f.type?.includes('audio')) ||
                    formats.find(f => f.container === 'm4a');
      if (audio?.url) return audio.url;
    } catch {}
  }
  return null;
}

// Ensure directory exists
const ensureDirExists = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(TRACKS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(TRACKS_DIR, { intermediates: true });
    }
  } catch (err) {
    console.error('Error ensuring directory exists:', err);
  }
};

/**
 * Downloads audio file to physical phone storage
 * @param {Object} track - Track object with id, title, artist, audioUrl, coverUrl
 * @param {Function} onProgress - Progress callback (percentage)
 */
export const downloadTrack = async (track, onProgress = null) => {
  try {
    await ensureDirExists();
    const trackId = track._id || track.id;
    let audioUrl = track.audioUrl;

    if (!audioUrl) {
      throw new Error('رابط الصوت غير متوفر للتنزيل');
    }

    // ── Resolve YouTube links before downloading ──
    if (audioUrl.includes('youtube.com') || audioUrl.includes('youtu.be') || track.source === 'YouTube') {
      const resolved = await resolveYouTubeMobile(audioUrl || trackId);
      if (resolved) audioUrl = resolved;
    }

    // Use proxy for remote URLs if not already resolved to a direct stream
    if (audioUrl.startsWith('http') && !audioUrl.includes('googlevideo.com') && !audioUrl.includes('localhost')) {
      audioUrl = `${API_BASE_URL}/api/proxy-audio?url=${encodeURIComponent(audioUrl)}`;
    }

    const fileUri = `${TRACKS_DIR}${trackId}.mp3`;

    // Download audio file to local storage
    const downloadResumable = FileSystem.createDownloadResumable(
      audioUrl,
      fileUri,
      {},
      (downloadProgress) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        if (onProgress) {
          onProgress(Math.round(progress * 100));
        }
      }
    );

    const result = await downloadResumable.downloadAsync();
    
    if (!result || !result.uri) {
      throw new Error('فشل تنزيل ملف الصوت');
    }

    // Save offline record in AsyncStorage
    const offlineTracks = await getDownloadedTracks();
    const newTrackRecord = {
      ...track,
      _id: trackId,
      id: trackId,
      localAudioUri: result.uri,
      isDownloaded: true,
      downloadedAt: new Date().toISOString(),
    };

    const updatedCatalog = [newTrackRecord, ...offlineTracks.filter(t => (t._id || t.id) !== trackId)];
    await AsyncStorage.setItem(OFFLINE_TRACKS_KEY, JSON.stringify(updatedCatalog));

    return newTrackRecord;
  } catch (err) {
    console.error('Failed to download track:', err);
    throw err;
  }
};

/**
 * Get list of all locally downloaded tracks
 */
export const getDownloadedTracks = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(OFFLINE_TRACKS_KEY);
    if (!jsonValue) return [];

    const tracks = JSON.parse(jsonValue);

    // Verify files actually exist on disk
    const verifiedTracks = [];
    for (const track of tracks) {
      if (track.localAudioUri) {
        const fileInfo = await FileSystem.getInfoAsync(track.localAudioUri);
        if (fileInfo.exists) {
          verifiedTracks.push(track);
        }
      }
    }

    return verifiedTracks;
  } catch (err) {
    console.error('Error reading offline tracks:', err);
    return [];
  }
};

/**
 * Remove downloaded audio file from phone storage
 */
export const removeDownloadedTrack = async (trackId) => {
  try {
    const fileUri = `${TRACKS_DIR}${trackId}.mp3`;
    const fileInfo = await FileSystem.getInfoAsync(fileUri);

    if (fileInfo.exists) {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    }

    const offlineTracks = await getDownloadedTracks();
    const updatedCatalog = offlineTracks.filter(t => (t._id || t.id) !== trackId);
    await AsyncStorage.setItem(OFFLINE_TRACKS_KEY, JSON.stringify(updatedCatalog));

    return true;
  } catch (err) {
    console.error('Error removing downloaded track:', err);
    return false;
  }
};

/**
 * Check if a track is downloaded locally
 */
export const isTrackDownloaded = async (trackId) => {
  try {
    const offlineTracks = await getDownloadedTracks();
    return offlineTracks.some(t => (t._id || t.id) === trackId);
  } catch (err) {
    return false;
  }
};
