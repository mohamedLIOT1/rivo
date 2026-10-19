/**
 * Rivo Client-Side Router Utility
 * Maps structured screen states to clean, bookmarkable URLs and vice versa.
 */
import { isDesktopApp } from '../version';

export function buildUrl(screen, params = {}) {
  let path = '/';
  switch (screen) {
    case 'home':
      path = '/';
      break;
    case 'search':
      if (params.query || params.q) {
        path = `/search?q=${encodeURIComponent(params.query || params.q)}`;
      } else {
        path = '/search';
      }
      break;
    case 'library':
      path = '/library';
      break;
    case 'quran':
      path = '/quran';
      break;
    case 'stats':
      path = '/stats';
      break;
    case 'download':
      path = '/download';
      break;
    case 'admin':
      path = '/admin';
      break;
    case 'profile':
      if (params.userId) {
        path = `/user/${encodeURIComponent(params.userId)}`;
      } else {
        path = '/profile';
      }
      break;
    case 'playlist':
      if (params.id || params._id) {
        const id = String(params.id || params._id);
        path = id === 'liked' ? '/playlist/liked' : `/playlist/${encodeURIComponent(id)}`;
      } else if (params.name) {
        path = `/album/${encodeURIComponent(params.name)}`;
      } else {
        path = '/library';
      }
      break;
    case 'artist':
      if (params.name) {
        path = `/artist/${encodeURIComponent(params.name)}`;
      } else {
        path = '/search';
      }
      break;
    default:
      path = '/';
  }

  // On native desktop (Tauri WebView2), keep base index.html intact via hash
  // to prevent blank 404 pages upon window reload or restart.
  if (isDesktopApp) {
    return `#${path}`;
  }
  return path;
}

export function parseLocation(pathname = '/', search = '') {
  let cleanPath = pathname || '/';
  let cleanSearch = search || '';

  // Priority to hash if present (especially in Tauri / Desktop app)
  if (typeof window !== 'undefined' && window.location.hash) {
    const hashVal = window.location.hash.replace(/^#/, '');
    if (hashVal) {
      const qIdx = hashVal.indexOf('?');
      if (qIdx >= 0) {
        cleanPath = hashVal.slice(0, qIdx) || '/';
        cleanSearch = hashVal.slice(qIdx);
      } else {
        cleanPath = hashVal;
      }
    }
  }

  // Normalize /index.html and trailing slashes
  cleanPath = cleanPath.replace(/^\/index\.html/i, '').replace(/^index\.html/i, '') || '/';
  if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
    cleanPath = cleanPath.slice(0, -1);
  }

  const queryParams = new URLSearchParams(cleanSearch || '');
  const searchQ = queryParams.get('q') || '';
  const lowerPath = cleanPath.toLowerCase();

  if (lowerPath === '' || lowerPath === '/' || lowerPath === '/home') {
    return { screen: 'home', params: {} };
  }

  if (lowerPath === '/search') {
    return { screen: 'search', params: { query: searchQ } };
  }

  if (lowerPath === '/library') {
    return { screen: 'library', params: {} };
  }

  if (lowerPath === '/quran') {
    return { screen: 'quran', params: {} };
  }

  if (lowerPath === '/stats') {
    return { screen: 'stats', params: {} };
  }

  if (lowerPath === '/download' || lowerPath === '/downloads') {
    return { screen: 'download', params: {} };
  }

  if (lowerPath === '/admin') {
    return { screen: 'admin', params: {} };
  }

  if (lowerPath === '/profile') {
    return { screen: 'profile', params: { userId: null } };
  }

  // /user/:id or /profile/:id
  if (lowerPath.startsWith('/user/') || lowerPath.startsWith('/profile/')) {
    const rawId = cleanPath.split('/')[2];
    const userId = rawId ? decodeURIComponent(rawId) : null;
    return { screen: 'profile', params: { userId } };
  }

  // /playlist/:id
  if (lowerPath.startsWith('/playlist/')) {
    const rawId = cleanPath.split('/')[2];
    const id = rawId ? decodeURIComponent(rawId) : '';
    return { screen: 'playlist', params: { id } };
  }

  // /album/:name
  if (lowerPath.startsWith('/album/')) {
    const rawName = cleanPath.substring(7);
    const name = rawName ? decodeURIComponent(rawName) : '';
    return { screen: 'playlist', params: { albumName: name } };
  }

  // /artist/:name
  if (lowerPath.startsWith('/artist/')) {
    const rawName = cleanPath.substring(8);
    const name = rawName ? decodeURIComponent(rawName) : '';
    return { screen: 'artist', params: { name } };
  }

  return { screen: 'home', params: {} };
}
