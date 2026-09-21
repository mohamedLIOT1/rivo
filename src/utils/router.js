/**
 * Rivo Client-Side Router Utility
 * Maps structured screen states to clean, bookmarkable URLs and vice versa.
 */

export function buildUrl(screen, params = {}) {
  switch (screen) {
    case 'home':
      return '/';
    case 'search':
      if (params.query || params.q) {
        return `/search?q=${encodeURIComponent(params.query || params.q)}`;
      }
      return '/search';
    case 'library':
      return '/library';
    case 'quran':
      return '/quran';
    case 'stats':
      return '/stats';
    case 'admin':
      return '/admin';
    case 'profile':
      if (params.userId) {
        return `/user/${encodeURIComponent(params.userId)}`;
      }
      return '/profile';
    case 'playlist':
      if (params.id || params._id) {
        const id = String(params.id || params._id);
        if (id === 'liked') return '/playlist/liked';
        return `/playlist/${encodeURIComponent(id)}`;
      }
      if (params.name) {
        return `/album/${encodeURIComponent(params.name)}`;
      }
      return '/library';
    case 'artist':
      if (params.name) {
        return `/artist/${encodeURIComponent(params.name)}`;
      }
      return '/search';
    default:
      return '/';
  }
}

export function parseLocation(pathname = '/', search = '') {
  let cleanPath = pathname || '/';
  if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
    cleanPath = cleanPath.slice(0, -1);
  }

  const queryParams = new URLSearchParams(search || '');
  const searchQ = queryParams.get('q') || '';

  if (cleanPath === '' || cleanPath === '/' || cleanPath === '/home') {
    return { screen: 'home', params: {} };
  }

  if (cleanPath === '/search') {
    return { screen: 'search', params: { query: searchQ } };
  }

  if (cleanPath === '/library') {
    return { screen: 'library', params: {} };
  }

  if (cleanPath === '/quran') {
    return { screen: 'quran', params: {} };
  }

  if (cleanPath === '/stats') {
    return { screen: 'stats', params: {} };
  }

  if (cleanPath === '/admin') {
    return { screen: 'admin', params: {} };
  }

  if (cleanPath === '/profile') {
    return { screen: 'profile', params: { userId: null } };
  }

  // /user/:id or /profile/:id
  if (cleanPath.startsWith('/user/') || cleanPath.startsWith('/profile/')) {
    const rawId = cleanPath.split('/')[2];
    const userId = rawId ? decodeURIComponent(rawId) : null;
    return { screen: 'profile', params: { userId } };
  }

  // /playlist/:id
  if (cleanPath.startsWith('/playlist/')) {
    const rawId = cleanPath.split('/')[2];
    const id = rawId ? decodeURIComponent(rawId) : '';
    return { screen: 'playlist', params: { id } };
  }

  // /album/:name
  if (cleanPath.startsWith('/album/')) {
    const rawName = cleanPath.substring(7);
    const name = rawName ? decodeURIComponent(rawName) : '';
    return { screen: 'playlist', params: { albumName: name } };
  }

  // /artist/:name
  if (cleanPath.startsWith('/artist/')) {
    const rawName = cleanPath.substring(8);
    const name = rawName ? decodeURIComponent(rawName) : '';
    return { screen: 'artist', params: { name } };
  }

  return { screen: 'home', params: {} };
}
