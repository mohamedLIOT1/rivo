/**
 * Web Notifications & Tab Title Alert Utilities
 * Uses Service Worker notifications when active, with safe window.Notification fallback.
 */

const DEFAULT_ICON = '/icon-192.png';

let flashIntervalId = null;
let savedOriginalTitle = null;
let flashListenersAttached = false;

function isPageBackgroundOrUnfocused() {
  if (typeof document === 'undefined') return false;
  return (
    document.hidden ||
    (typeof document.hasFocus === 'function' && !document.hasFocus())
  );
}

/**
 * Returns true when the tab is visible and the window currently has focus.
 */
export function isWindowFocusedAndVisible() {
  if (typeof document === 'undefined') return true;
  return document.visibilityState === 'visible' && !isPageBackgroundOrUnfocused();
}

/**
 * Safely returns current Web Notification permission:
 * 'unsupported' | 'granted' | 'denied' | 'default'
 */
export function getNotificationPermission() {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return window.Notification.permission || 'unsupported';
  } catch {
    return 'unsupported';
  }
}

/**
 * Requests browser Web Notification permission (must be triggered by a user gesture).
 * Never throws; returns resulting permission state.
 */
export async function requestWebNotificationPermission() {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    if (window.Notification.permission !== 'default') {
      return window.Notification.permission;
    }
    const result = await window.Notification.requestPermission();
    return result || getNotificationPermission();
  } catch {
    return getNotificationPermission();
  }
}

function handleReturnToTab() {
  if (!isPageBackgroundOrUnfocused()) {
    stopTabTitleFlash();
  }
}

export function stopTabTitleFlash() {
  if (flashIntervalId !== null) {
    clearInterval(flashIntervalId);
    flashIntervalId = null;
  }
  if (typeof document !== 'undefined' && savedOriginalTitle !== null) {
    document.title = savedOriginalTitle;
    savedOriginalTitle = null;
  }
  if (flashListenersAttached) {
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', handleReturnToTab);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleReturnToTab);
    }
    flashListenersAttached = false;
  }
}

/**
 * Alternates document.title between alertTitle and the original title every 1000ms
 * while the page is hidden or unfocused, and restores it as soon as the user returns.
 */
export function flashTabTitle(alertTitle) {
  if (typeof document === 'undefined' || !alertTitle) return;

  if (!isPageBackgroundOrUnfocused()) {
    stopTabTitleFlash();
    return;
  }

  if (flashIntervalId !== null) {
    clearInterval(flashIntervalId);
    flashIntervalId = null;
  }

  if (savedOriginalTitle === null) {
    savedOriginalTitle = document.title;
  }

  if (!flashListenersAttached) {
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleReturnToTab);
    }
    document.addEventListener('visibilitychange', handleReturnToTab);
    flashListenersAttached = true;
  }

  let showingAlert = true;
  document.title = alertTitle;

  flashIntervalId = setInterval(() => {
    if (!isPageBackgroundOrUnfocused()) {
      stopTabTitleFlash();
      return;
    }
    showingAlert = !showingAlert;
    document.title = showingAlert ? alertTitle : (savedOriginalTitle ?? document.title);
  }, 1000);
}

/**
 * Shows an OS/browser Web Notification when the page is hidden or unfocused
 * and Notification permission is granted.
 */
export async function showWebChatNotification({ title, body, icon, tag, data, onClick }) {
  if (!isPageBackgroundOrUnfocused()) return false;
  if (getNotificationPermission() !== 'granted') return false;

  const resolvedIcon = icon || DEFAULT_ICON;
  const resolvedTag = tag ? String(tag) : 'rivo-chat';
  const resolvedTitle = title || 'Rivo';

  // Prefer active Service Worker registration so OS click events route through sw.js
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const existingReg = await navigator.serviceWorker.getRegistration();
      if (existingReg && existingReg.active) {
        const reg = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((resolve) => setTimeout(() => resolve(existingReg), 500))
        ]);
        if (reg && typeof reg.showNotification === 'function') {
          await reg.showNotification(resolvedTitle, {
            body: body || '',
            icon: resolvedIcon,
            badge: DEFAULT_ICON,
            tag: resolvedTag,
            renotify: true,
            data: data || {}
          });
          return true;
        }
      }
    } catch {
      // Fall back to direct Notification API below
    }
  }

  try {
    const n = new window.Notification(resolvedTitle, {
      body: body || '',
      icon: resolvedIcon,
      tag: resolvedTag,
      renotify: true,
      data: data || {}
    });
    n.onclick = () => {
      try {
        window.focus();
        if (typeof onClick === 'function') onClick(data);
        n.close();
      } catch {}
    };
    return true;
  } catch {
    return false;
  }
}

/**
 * Subscribes to Service Worker notification click messages ('OPEN_CHAT_FROM_NOTIFICATION')
 * and returns a cleanup unsubscribe function.
 */
export function subscribeSwNotificationOpen(onOpen) {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker || typeof onOpen !== 'function') {
    return () => {};
  }
  const handleSwMessage = (event) => {
    if (event.data?.type === 'OPEN_CHAT_FROM_NOTIFICATION' && event.data?.data) {
      onOpen(event.data.data);
    }
  };
  navigator.serviceWorker.addEventListener('message', handleSwMessage);
  return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
}
