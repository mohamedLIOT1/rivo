// Centralized Versioning for Web & Desktop (Tauri)
export const WEB_VERSION = '1.9.9.1';
export const DESKTOP_VERSION = '1.9.9.1';

export const isDesktopApp = typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);

export const APP_PLATFORM = isDesktopApp ? 'windows' : 'web';
export const APP_VERSION = isDesktopApp ? DESKTOP_VERSION : WEB_VERSION;
export const PLATFORM_NAME = isDesktopApp ? 'Rivo Desktop (Windows)' : 'Rivo Web';
export const FULL_VERSION = `v${APP_VERSION} [${isDesktopApp ? 'Desktop' : 'Web'}]`;
export const BUILD_DATE = '2026-10-23';

export default {
  version: APP_VERSION,
  webVersion: WEB_VERSION,
  desktopVersion: DESKTOP_VERSION,
  platform: APP_PLATFORM,
  platformName: PLATFORM_NAME,
  full: FULL_VERSION,
  date: BUILD_DATE,
};
