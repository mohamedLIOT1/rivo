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
      protocol === 'file:' ||
      hostname === 'localhost' && !host.includes('5000')
    ) {
      return 'http://192.168.42.128:5000';
    }
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://192.168.42.128:5000';
    }
    return `${protocol}//${host}`;
  }

  return 'http://192.168.42.128:5000';
})();

export const getApiUrl = (endpoint) => {
  const base = API_BASE_URL.replace(/\/$/, '');
  const path = endpoint.replace(/^\//, '');
  return `${base}/${path}`;
};
