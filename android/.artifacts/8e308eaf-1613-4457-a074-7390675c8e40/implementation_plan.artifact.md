# Implementation Plan - Fix Offline Downloads & Background Playback

The goal is to fix two major issues in the Liofy music app:
1.  **Offline Downloads**: Songs appear downloaded but fail to play after app restart.
2.  **Background Playback**: Music stops when the app is in the background or the screen is locked.

## User Review Required

> [!IMPORTANT]
> To enable background playback reliably, we need to implement a **Foreground Service**. This will show a persistent notification while the app is playing music. This is a requirement for Android 13+ to prevent the system from killing the app's audio.

> [!WARNING]
> The offline issue might be related to how paths are stored in the Javascript side. I will optimize the Android WebView settings to allow better local file access, but if the issue persists, we might need to check how the songs are being saved (e.g., using `Data` directory instead of `Cache`).

## Proposed Changes

### Android Native Changes

#### [MODIFY] [MainActivity.java](file:///C:/Users/mohamed/Desktop/liofy/android/app/src/main/java/com/liofy/app/MainActivity.java)
- Improve WebView settings to allow local file access and prevent throttling.
- Implement logic to start/stop the Background Service.
- Request necessary permissions (Notifications).

#### [NEW] [BackgroundMediaService.java](file:///C:/Users/mohamed/Desktop/liofy/android/app/src/main/java/com/liofy/app/BackgroundMediaService.java)
- A simple Foreground Service to keep the app alive during playback.
- Handles a notification that informs the user the app is running in the background.

#### [MODIFY] [AndroidManifest.xml](file:///C:/Users/mohamed/Desktop/liofy/android/app/src/main/AndroidManifest.xml)
- Register the `BackgroundMediaService`.
- Ensure all required permissions are declared correctly.

## Verification Plan

### Automated Tests
- Build the project to ensure no syntax errors in the new Service and MainActivity changes.
- `gradlew assembleDebug`

### Manual Verification
1.  **Offline Test**: Download a song, close the app completely, reopen it, and try to play.
2.  **Background Test**: Start playing a song, move the app to background, lock the screen, and verify the music continues.
