/**
 * Liofy config — API URL resolution (safe for all environments)
 */

export const API_BASE_URL = (() => {
  // 1. Vite env variable (set at build time for production)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  // 2. Same origin (when served from the Express server itself on Railway)
  if (typeof window !== 'undefined') {
    const { hostname, protocol, host } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
    return `${protocol}//${host}`;
  }
  return '';
})();

export const getApiUrl = (endpoint) => {
  const base = API_BASE_URL.replace(/\/$/, '');
  const path = endpoint.replace(/^\//, '');
  return `${base}/${path}`;
};
