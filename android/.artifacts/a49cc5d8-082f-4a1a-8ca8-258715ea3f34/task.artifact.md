# Task: Fix Audio Playback in Android APK

- [ ] Update `AndroidManifest.xml` with required permissions for background playback and services.
- [ ] Refactor `AudioContext.js` to handle Base64 audio and improve stability.
    - [ ] Add Base64 to temporary file conversion logic.
    - [ ] Implement `isLoading` state and UI feedback (Toast/Alert).
    - [ ] Optimize `setAudioModeAsync` configuration.
- [ ] Update `SongItem.js` to show loading state when a song is being prepared.
- [ ] Verify build and playback (manual check instructions).
