/**
 * Rivo config — API URL resolution (safe for all environments including Capacitor Android APK)
 */

export const API_BASE_URL = (() => {
  // 1. Explicit environment variable if provided
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }

  // 2. Running inside Capacitor Android App / WebView / Cordova / File protocol
  if (typeof window !== 'undefined') {
    const { hostname, protocol, host } = window.location;
    if (
      window.Capacitor ||
      protocol === 'capacitor:' ||
      protocol === 'file:'
    ) {
      return 'http://10.166.17.242:5000';
    }
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
    // If accessed via local network IP (e.g. 10.x.x.x or 192.168.x.x), target port 5000
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return `${protocol}//${hostname}:5000`;
    }
    return `${protocol}//${host}`;
  }

  return 'http://10.166.17.242:5000';
})();

export const getApiUrl = (endpoint) => {
  const base = API_BASE_URL.replace(/\/$/, '');
  const path = endpoint.replace(/^\//, '');
  return `${base}/${path}`;
};
