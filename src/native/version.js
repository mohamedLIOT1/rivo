import { Platform } from 'react-native';

// Centralized Application Versions for Mobile Layer (APK / IPA)
export const ANDROID_VERSION = '1.9.9.8';
export const ANDROID_BUILD = '91';

export const IOS_VERSION = '1.9.9.8';
export const IOS_BUILD = '91';

export const isAndroid = Platform.OS === 'android';
export const APP_PLATFORM = isAndroid ? 'android' : 'ios';
export const APP_VERSION = isAndroid ? ANDROID_VERSION : IOS_VERSION;
export const BUILD_NUMBER = isAndroid ? ANDROID_BUILD : IOS_BUILD;
export const PLATFORM_NAME = isAndroid ? 'Rivo for Android (APK)' : 'Rivo for iOS (IPA)';
export const FULL_VERSION = `v${APP_VERSION} (Build ${BUILD_NUMBER}) [${isAndroid ? 'APK' : 'IPA'}]`;
export const BUILD_DATE = '2026-10-25';

export default {
  version: APP_VERSION,
  build: BUILD_NUMBER,
  platform: APP_PLATFORM,
  name: PLATFORM_NAME,
  fullName: FULL_VERSION,
  date: BUILD_DATE,
};
