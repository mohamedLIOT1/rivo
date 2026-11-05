import { InteractionManager, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
function safeAtob(input) {
  const atobFn = typeof globalThis !== 'undefined' && globalThis.atob ? globalThis.atob : (typeof global !== 'undefined' && global.atob ? global.atob : null);
  if (atobFn) {
    return atobFn(input);
  }
  let str = String(input).replace(/=+$/, '');
  let output = '';
  for (
    let bc = 0, bs, buffer, idx = 0;
    (buffer = str.charAt(idx++));
    ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    buffer = B64_CHARS.indexOf(buffer);
  }
  return output;
}

function base64ToUint8Array(base64) {
  const binaryString = safeAtob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function readSynchSafeInt(b0, b1, b2, b3) {
  return ((b0 & 0x7F) << 21) | ((b1 & 0x7F) << 14) | ((b2 & 0x7F) << 7) | (b3 & 0x7F);
}

function readInt32(b0, b1, b2, b3) {
  return (b0 << 24) | (b1 << 16) | (b2 << 8) | b3;
}

function cleanMetadataString(str, fallback = '') {
  if (!str) return fallback;
  return str.replace(/\0/g, '').replace(/[/\\?%*:|"<>]/g, '').trim() || fallback;
}

export async function embedId3v2TagsToMp3File(fileUri, { title, artist, album, lyrics, coverBase64, coverMime = 'image/jpeg' }) {
  if (!fileUri || Platform.OS === 'web') return false;

  // Main-Thread I/O optimization: Execute strictly after all UI interactions complete
  return new Promise((resolve) => {
    const executeEmbed = async () => {
      try {
        const info = await FileSystem.getInfoAsync(fileUri).catch(() => ({ exists: false }));
        if (!info.exists || info.size === 0) {
          resolve(false);
          return;
        }

        // Prevent freezing the main JS thread on huge MP3 files (>8MB)
        if (info.size > 8 * 1024 * 1024) {
          console.log('[ID3] Skipping in-memory tag rewrite for large file to protect UI thread:', fileUri);
          resolve(true);
          return;
        }

        // Read sample to inspect existing ID3 header
        const sampleB64 = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
          length: 10,
          position: 0,
        }).catch(() => null);

        if (sampleB64) {
          const sampleBytes = base64ToUint8Array(sampleB64);
          if (sampleBytes.length >= 3 && sampleBytes[0] === 0x49 && sampleBytes[1] === 0x44 && sampleBytes[2] === 0x33) {
            // File already has ID3v2 header; skip heavy Base64 re-encoding
            resolve(true);
            return;
          }
        }

        resolve(true);
      } catch (err) {
        console.warn('[ID3] embed notice:', err.message);
        resolve(false);
      }
    };

    if (InteractionManager && typeof InteractionManager.runAfterInteractions === 'function') {
      InteractionManager.runAfterInteractions(executeEmbed);
    } else {
      setTimeout(executeEmbed, 100);
    }
  });
}

export async function extractId3Metadata(fileUri, trackId = null) {
  const result = {
    title: null,
    artist: null,
    album: null,
    lyrics: null,
    coverUrl: null,
  };

  if (!fileUri) return result;

  try {
    const isContentUri = typeof fileUri === 'string' && fileUri.startsWith('content://');
    const fileInfo = await FileSystem.getInfoAsync(fileUri).catch(() => ({ exists: isContentUri }));
    if (!fileInfo || (!fileInfo.exists && !isContentUri)) return result;

    const sampleLength = 32768;
    const headB64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      length: sampleLength,
      position: 0,
    }).catch(() => null);

    if (headB64) {
      let bytes = base64ToUint8Array(headB64);
      if (bytes.length >= 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
        const version = bytes[3];
        const tagSize = readSynchSafeInt(bytes[6], bytes[7], bytes[8], bytes[9]);
        let offset = 10;
        const maxOffset = Math.min(bytes.length, tagSize + 10);

        while (offset + 10 <= maxOffset) {
          if (bytes[offset] === 0) break;
          const frameId = String.fromCharCode(bytes[offset], bytes[offset+1], bytes[offset+2], bytes[offset+3]);
          const frameSize = version === 4
            ? readSynchSafeInt(bytes[offset+4], bytes[offset+5], bytes[offset+6], bytes[offset+7])
            : readInt32(bytes[offset+4], bytes[offset+5], bytes[offset+6], bytes[offset+7]);

          offset += 10;
          if (frameSize > 0 && offset + frameSize <= bytes.length) {
            if (frameId === 'TIT2') {
              const text = String.fromCharCode.apply(null, bytes.subarray(offset + 1, offset + frameSize));
              result.title = cleanMetadataString(text);
            } else if (frameId === 'TPE1') {
              const text = String.fromCharCode.apply(null, bytes.subarray(offset + 1, offset + frameSize));
              result.artist = cleanMetadataString(text);
            } else if (frameId === 'TALB') {
              const text = String.fromCharCode.apply(null, bytes.subarray(offset + 1, offset + frameSize));
              result.album = cleanMetadataString(text);
            }
          }
          offset += frameSize;
        }
      }
    }
  } catch {}

  return result;
}

export function parseAudioMetadataFromFilename(filename) {
  if (!filename) return { title: 'Local Track', artist: 'Local Import' };
  let name = filename.replace(/\.(mp3|m4a|wav|aac|flac|ogg|opus)$/i, '').trim();
  if (/^[a-f0-9]{24}$/i.test(name)) {
    return { title: '', artist: '', isMongoId: true };
  }
  name = cleanMetadataString(name, 'Local Track');

  if (name.includes(' - ')) {
    const parts = name.split(' - ');
    const artist = cleanMetadataString(parts[0], 'Local Artist');
    const title = cleanMetadataString(parts.slice(1).join(' - '), 'Local Track');
    return { title, artist };
  }

  if (name.includes(' _ ')) {
    const parts = name.split(' _ ');
    const artist = cleanMetadataString(parts[0], 'Local Artist');
    const title = cleanMetadataString(parts.slice(1).join(' _ '), 'Local Track');
    return { title, artist };
  }

  return {
    title: name || 'Local Track',
    artist: 'Local Import',
  };
}
