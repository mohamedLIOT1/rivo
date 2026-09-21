import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveAudioStream } from './youtubeResolver';
import { API_BASE_URL } from '../config';

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
  if (!track) throw new Error('No track provided');
  await ensureDirs();

  const trackId = String(track._id || track.id);
  const audioFileUri = `${TRACKS_DIR}${trackId}.mp3`;
  const coverFileUri = `${COVERS_DIR}${trackId}.jpg`;

  if (onProgress) onProgress(5);

  // Check if audio file already exists locally on disk
  const existingLocalUri = (track.localAudioUri && track.localAudioUri.startsWith('file://')) ? track.localAudioUri :
                          (track.nativeAudioUri && track.nativeAudioUri.startsWith('file://')) ? track.nativeAudioUri :
                          audioFileUri;
  try {
    const existingInfo = await FileSystem.getInfoAsync(existingLocalUri);
    if (existingInfo.exists && existingInfo.size > 10000) {
      if (onProgress) onProgress(100);
      const record = {
        ...track,
        id: trackId,
        _id: trackId,
        localAudioUri: existingLocalUri,
        nativeAudioUri: existingLocalUri,
        audioUrl: existingLocalUri,
        isDownloaded: true,
        downloaded: true,
        downloadedAt: new Date().toISOString(),
      };
      const existing = await getDownloadedTracks();
      const updated = [record, ...existing.filter(t => String(t._id || t.id) !== trackId)];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return record;
    }
  } catch {}

  // Resolve direct playable/downloadable remote audio stream
  const isDirectRemote = (u) => typeof u === 'string' && u.startsWith('http') && !u.includes('youtube.com') && !u.includes('youtu.be');
  let remoteAudioUrl = null;

  if (isDirectRemote(track.audioUrl)) {
    remoteAudioUrl = track.audioUrl;
  } else if (isDirectRemote(track.nativeAudioUri)) {
    remoteAudioUrl = track.nativeAudioUri;
  }

  if (!remoteAudioUrl) {
    remoteAudioUrl = await resolveAudioStream(track);
  }

  if (!remoteAudioUrl && track.audioUrl) {
    remoteAudioUrl = `${API_BASE_URL}/api/tracks/download?url=${encodeURIComponent(track.audioUrl)}&title=${encodeURIComponent(track.title || '')}&artist=${encodeURIComponent(track.artist || '')}&id=${encodeURIComponent(trackId)}`;
  }

  if (!remoteAudioUrl) {
    throw new Error('Could not resolve audio stream for download');
  }

  if (onProgress) onProgress(15);

  // Download audio file to local documentDirectory
  let downloadedFile = null;
  try {
    const downloadResumable = FileSystem.createDownloadResumable(
      remoteAudioUrl,
      audioFileUri,
      {},
      (downloadProgress) => {
        if (downloadProgress.totalBytesExpectedToWrite > 0) {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          if (onProgress) onProgress(Math.min(95, Math.round(15 + progress * 80)));
        } else {
          if (onProgress) onProgress(50);
        }
      }
    );
    const res = await downloadResumable.downloadAsync();
    if (res && res.uri && (res.status === 200 || res.status === 206)) {
      downloadedFile = res;
    }
  } catch (e) {
    // Fall back to direct FileSystem.downloadAsync
  }

  if (!downloadedFile) {
    const fallbackRes = await FileSystem.downloadAsync(remoteAudioUrl, audioFileUri);
    if (!fallbackRes || (fallbackRes.status !== 200 && fallbackRes.status !== 206)) {
      throw new Error('Download failed from audio stream');
    }
  }

  // Validate downloaded file
  const fileInfo = await FileSystem.getInfoAsync(audioFileUri);
  if (!fileInfo.exists || fileInfo.size < 10000) {
    await FileSystem.deleteAsync(audioFileUri, { idempotent: true }).catch(() => {});
    throw new Error('Downloaded audio file is corrupted or empty');
  }

  if (onProgress) onProgress(96);

  // Cover art download
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
    audioUrl: audioFileUri,
    coverUrl: localCover,
    cover: localCover,
    isDownloaded: true,
    downloaded: true,
    downloadedAt: new Date().toISOString(),
  };

  const existing = await getDownloadedTracks();
  const updated = [record, ...existing.filter(t => String(t._id || t.id) !== trackId)];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  if (onProgress) onProgress(100);
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
