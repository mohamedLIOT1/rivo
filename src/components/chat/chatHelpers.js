import { API_BASE_URL } from '../../config';

export const getToken = () => {
  try {
    return localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
  } catch {
    return '';
  }
};

export const isWindowActiveAndFocused = () => {
  if (typeof document === 'undefined') return true;
  return (
    document.visibilityState === 'visible' &&
    !document.hidden &&
    (typeof document.hasFocus === 'function' ? document.hasFocus() : true)
  );
};

export async function apiSendChatMessage(payload) {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}/api/chat/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  return res.json();
}
