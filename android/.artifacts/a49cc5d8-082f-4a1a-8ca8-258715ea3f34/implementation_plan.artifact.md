# Fix Song Playback Issues in Android APK

The user reports that songs are not playing in the APK build. Based on the code analysis, several issues could be causing this, primarily related to how audio URIs (especially large base64 strings and proxied YouTube streams) are handled on Android.

## User Review Required

> [!IMPORTANT]
> The app currently stores uploaded songs as **Base64 strings** in the database. When playing these songs, the app passes the entire Base64 string as a URI to `expo-av`. This is likely to fail on Android for full-length songs due to URI length limits in the native bridge.
> I will implement a fix to save Base64 data to a temporary local file before playback.

## Proposed Changes

### [Component] Audio Playback (Mobile)

#### [MODIFY] [AudioContext.js](file:///C:/Users/mohamed/Desktop/liofy/src/mobile/context/AudioContext.js)
- Implement a mechanism to detect Base64 audio URIs and save them to a temporary file using `expo-file-system` before passing them to `Audio.Sound.createAsync`.
- Add a "loading" state to prevent multiple concurrent playback attempts and provide UI feedback.
- Improve error handling by using `Alert` or `ToastAndroid` to show playback errors in the APK (where `console.error` is invisible).
- Ensure `setAudioModeAsync` is called correctly to support Android background playback.
- Add a check for `API_BASE_URL` to ensure it's absolute and reachable.

#### [MODIFY] [SongItem.js](file:///C:/Users/mohamed/Desktop/liofy/src/mobile/components/SongItem.js)
- Add a loading indicator (spinner) when a song is being prepared for playback (especially useful for slow proxy resolutions).

### [Component] Android Configuration

#### [MODIFY] [AndroidManifest.xml](file:///C:/Users/mohamed/Desktop/liofy/android/app/src/main/AndroidManifest.xml)
- Ensure all necessary permissions are present for background audio playback and network access. (Current permissions look mostly okay, but I will double-check for `FOREGROUND_SERVICE` if background play is intended).

## Verification Plan

### Automated Tests
- Since this is a native issue, automated unit tests might not catch it. I will rely on manual verification and logcat.

### Manual Verification
1. **Test with YouTube songs:** Verify that the proxy resolves and plays correctly.
2. **Test with Uploaded songs (Base64):** Verify that the base64-to-file conversion works and the song plays.
3. **Check Error Feedback:** Intentionally trigger an error (e.g., wrong URL) and verify that a Toast/Alert appears.
4. **Background Play:** Start a song and move the app to background to ensure it continues playing.
