import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TRACKS_DIR = `${FileSystem.documentDirectory}rivo_tracks/`;
const COVERS_DIR = `${FileSystem.documentDirectory}rivo_covers/`;
const STORAGE_KEY = '@rivo_offline_tracks_v2';

const ensureDirs = async () => {
  const tInfo = await FileSystem.getInfoAsync(TRACKS_DIR);
  if (!tInfo.exists) await FileSystem.makeDirectoryAsync(TRACKS_DIR, { intermediates: true });

  const cInfo = await FileSystem.getInfoAsync(COVERS_DIR);
  if (!cInfo.exists) await FileSystem.makeDirectoryAsync(COVERS_DIR, { intermediates: true });
};

export const getDownloadedTracks = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const isTrackDownloaded = async (trackId) => {
  const list = await getDownloadedTracks();
  return list.some(t => String(t._id || t.id) === String(trackId));
};

export const downloadTrack = async (track, onProgress) => {
  await ensureDirs();
  const trackId = String(track._id || track.id);
  const audioFileUri = `${TRACKS_DIR}${trackId}.mp3`;
  const coverFileUri = `${COVERS_DIR}${trackId}.jpg`;

  let remoteAudioUrl = track.audioUrl || track.nativeAudioUri;
  if (!remoteAudioUrl) throw new Error('No audio URL found');

  const downloadResumable = FileSystem.createDownloadResumable(
    remoteAudioUrl,
    audioFileUri,
    {},
    (downloadProgress) => {
      const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
      if (onProgress) onProgress(Math.round(progress * 100));
    }
  );

  const result = await downloadResumable.downloadAsync();
  if (!result || result.status !== 200) {
    throw new Error('Download failed');
  }

  // Cover download
  let localCover = track.coverUrl || track.cover;
  if (localCover && localCover.startsWith('http')) {
    try {
      await FileSystem.downloadAsync(localCover, coverFileUri);
      localCover = coverFileUri;
    } catch {}
  }

  const record = {
    ...track,
    id: trackId,
    _id: trackId,
    localAudioUri: audioFileUri,
    nativeAudioUri: audioFileUri,
    coverUrl: localCover,
    isDownloaded: true,
    downloadedAt: new Date().toISOString(),
  };

  const existing = await getDownloadedTracks();
  const updated = [record, ...existing.filter(t => String(t._id || t.id) !== trackId)];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return record;
};

export const removeDownloadedTrack = async (trackId) => {
  const idStr = String(trackId);
  const audioFileUri = `${TRACKS_DIR}${idStr}.mp3`;
  const coverFileUri = `${COVERS_DIR}${idStr}.jpg`;

  await FileSystem.deleteAsync(audioFileUri, { idempotent: true }).catch(() => {});
  await FileSystem.deleteAsync(coverFileUri, { idempotent: true }).catch(() => {});

  const existing = await getDownloadedTracks();
  const updated = existing.filter(t => String(t._id || t.id) !== idStr);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
};
