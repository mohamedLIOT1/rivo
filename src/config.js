/**
 * Rivo config — API URL resolution (safe for all environments including Capacitor Android APK)
 */

export const API_BASE_URL = (() => {
  // 1. Running inside browser (desktop, tablet, mobile web)
  if (typeof window !== 'undefined') {
    const { hostname, protocol, host } = window.location;
    if (
      window.Capacitor ||
      protocol === 'capacitor:' ||
      protocol === 'file:'
    ) {
      return 'https://rivo-m.duckdns.org';
    }
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && !host.includes('5000')) {
      return 'http://localhost:5000';
    }
    // Always use current HTTPS origin in web production
    return `${protocol}//${host}`;
  }

  // 2. Explicit environment variable if provided
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }

  return 'https://rivo-m.duckdns.org';
})();

export const getApiUrl = (endpoint) => {
  const base = API_BASE_URL.replace(/\/$/, '');
  const path = endpoint.replace(/^\//, '');
  return `${base}/${path}`;
};
