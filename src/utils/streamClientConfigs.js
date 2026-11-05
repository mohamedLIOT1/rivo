/**
 * Innertube API Client Context Configurations
 * Handles direct streaming contexts: VISIONOS, ANDROID_VR, ANDROID, and WEB_EMBEDDED_PLAYER.
 */

export const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

export const CLIENT_CONFIGS = [
  {
    name: 'VISIONOS',
    client: {
      clientName: 'VISIONOS',
      clientVersion: '1.02',
      deviceMake: 'Apple',
      deviceModel: 'RealityDevice17,1',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
      osName: 'visionOS',
      osVersion: '26.5.23O471',
      hl: 'en',
      timeZone: 'UTC',
      utcOffsetMinutes: 0
    },
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
      'X-Youtube-Client-Name': '101',
      'X-Youtube-Client-Version': '1.02',
      'Origin': 'https://www.youtube.com'
    }
  },
  {
    name: 'ANDROID_VR',
    client: {
      clientName: 'ANDROID_VR',
      clientVersion: '1.61.48',
      deviceMake: 'Oculus',
      deviceModel: 'Quest 3',
      osName: 'Android',
      osVersion: '12',
      hl: 'en',
      gl: 'US'
    },
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/34.0.0.12 Chrome/122.0.6261.120 VR Safari/537.36',
      'X-Youtube-Client-Name': '28',
      'X-Youtube-Client-Version': '1.61.48'
    }
  },
  {
    name: 'ANDROID',
    client: {
      clientName: 'ANDROID',
      clientVersion: '19.29.35',
      androidSdkVersion: 30,
      osName: 'Android',
      osVersion: '11',
      hl: 'en',
      gl: 'US'
    },
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'com.google.android.youtube/19.29.35 (Linux; U; Android 11) gzip',
      'X-Youtube-Client-Name': '3',
      'X-Youtube-Client-Version': '19.29.35'
    }
  },
  {
    name: 'WEB_EMBEDDED_PLAYER',
    client: {
      clientName: 'WEB_EMBEDDED_PLAYER',
      clientVersion: '1.20240726.01.00',
      hl: 'en',
      gl: 'US'
    },
    thirdParty: {
      embedUrl: 'https://www.google.com'
    },
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'X-Youtube-Client-Name': '56',
      'X-Youtube-Client-Version': '1.20240726.01.00',
      'Origin': 'https://www.youtube.com'
    }
  }
];
