# Liofy Mobile Enhancements & Fixes

This plan covers fixing audio playback issues, implementing missing profile/playlist features, and transitioning the UI language to English.

## User Review Required

> [!IMPORTANT]
> - **Audio Playback**: The fix for audio involves ensuring the proxy logic is robust. Since Railway IPs are often blocked by YouTube, I will ensure the fallback mechanisms (Piped/Cobalt) are correctly utilized in the mobile app.
> - **Language**: The entire UI will be translated from Arabic to English as requested.
> - **Profile Picture**: Without native image picker libraries installed, I will provide a way to update the avatar URL or use a text-based input for now.

## Proposed Changes

### [UI Language & Translation]

#### [MODIFY] [App.js](file:///C:/Users/mohamed/Desktop/liofy/App.js)
- Translate bottom tab labels (Home, Search, Offline, Library, Profile).

#### [MODIFY] [HomeScreen.js](file:///C:/Users/mohamed/Desktop/liofy/src/mobile/screens/HomeScreen.js)
- Translate "الرئيسية" to "Home", "إضافة أغنية" to "Add Song", "متصل/أوفلاين" to "Online/Offline", etc.

#### [MODIFY] [SearchScreen.js](file:///C:/Users/mohamed/Desktop/liofy/src/mobile/screens/SearchScreen.js)
- Translate titles and placeholders to English.

#### [MODIFY] [LibraryScreen.js](file:///C:/Users/mohamed/Desktop/liofy/src/mobile/screens/LibraryScreen.js)
- Translate tabs (Liked, Playlists) and empty states.

#### [MODIFY] [ProfileScreen.js](file:///C:/Users/mohamed/Desktop/liofy/src/mobile/screens/ProfileScreen.js)
- Translate all labels and buttons.
- **New Feature**: Add Playlist Navigation (view playlist details).
- **New Feature**: Add Profile Picture Editing (URL update).

### [Audio Playback]

#### [MODIFY] [AudioContext.js](file:///C:/Users/mohamed/Desktop/liofy/src/mobile/context/AudioContext.js)
- Improve URL resolution logic to handle potential Railway proxy failures.

### [Playlist Features]

#### [MODIFY] [LibraryScreen.js](file:///C:/Users/mohamed/Desktop/liofy/src/mobile/screens/LibraryScreen.js)
- Add "Edit" and "Delete" functionality for playlists.

---

## Verification Plan

### Automated Tests
- I will verify the code compiles and screens render without syntax errors.

### Manual Verification
1. Open the app and verify the UI is in English.
2. Go to Profile, click a playlist, and verify it shows the songs inside.
3. Try to change the profile name/bio and verify it saves.
4. Try playing a song and check logs if it fails (simulated).
