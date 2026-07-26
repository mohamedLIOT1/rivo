# Task: Fix Audio Playback & Proxy Stability

- [ ] **Server Fixes**
    - [ ] Update `server/index.js` with robust YouTube resolution (more instances).
    - [ ] Fix `/api/soundcloud/stream` to stream audio instead of returning JSON.
    - [ ] Improve `extractVideoId` and proxy error handling.
- [ ] **Mobile Fixes**
    - [ ] Update `AudioContext.js` to handle proxied streams more reliably.
    - [ ] Fix logging to show full URLs for debugging.
    - [ ] Add a more descriptive error toast.
- [ ] **Deployment & Verification**
    - [ ] Build and install fresh APK.
    - [ ] Test YouTube resolution.
    - [ ] Test SoundCloud streaming.
