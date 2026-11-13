# Subagent Handoff Report: Step 0 Architectural & Dead Code Survey

**Author**: `spec_miner_survey_1` (Codebase & Architecture Spec Miner)  
**Recipient**: `parent` (`8cd4123f-4f86-489e-a96c-a775446c7867`)  
**Date**: 2026-11-04  
**Working Directory**: `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\spec_miner_survey_1`  
**Primary Deliverable**: `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\spec_miner_survey_1\survey_spec.md`

---

## 1. Observation

### 1.1 Files Exceeding the 400-Line Limit (AGENTS.md Rule 1)
Using Python directory scanning across `src/`, `App.js`, and `server/` (excluding disallowed directories `node_modules`, `dist`, `build`, `.gradle`, `src-tauri/target`), exactly **68 source files** exceed 400 lines:
- **Native Frontend (32 files)**: `src\native\context\AudioContext.js` (3,006 lines), `src\native\services\downloadManager.js` (2,575 lines), `src\native\screens\LibraryScreen.js` (2,544 lines), `src\native\components\FullPlayerModal.js` (2,181 lines), `src\native\screens\ProfileScreen.js` (2,133 lines), `src\native\components\MiniMixerModal.js` (1,889 lines), `src\native\components\JamRoomModal.js` (1,666 lines), `App.js` (1,434 lines), `src\native\screens\AdminScreen.js` (1,398 lines), `src\native\screens\SearchScreen.js` (1,396 lines), `src\native\components\ChatModal.js` (1,197 lines), `src\native\components\CreatePlaylistModal.js` (1,184 lines), `src\native\screens\OnlineWebView.js` (1,177 lines), `src\native\screens\OfflineScreen.js` (1,169 lines), `src\native\components\AlbumDetailModal.js` (1,080 lines), `src\native\components\ArtistDetailModal.js` (1,051 lines), `src\native\components\SettingsModal.js` (1,026 lines), `src\native\components\UserDetailModal.js` (949 lines), `src\native\services\youtubeResolver.js` (887 lines), `src\native\components\SongRadarModal.js` (854 lines), `src\native\screens\HomeScreen.js` (753 lines), `src\native\screens\QuranScreen.js` (705 lines), `src\native\components\IntroAuthModal.js` (660 lines), `src\native\components\FloatingNavMenu.js` (659 lines), `src\native\screens\StatsScreen.js` (651 lines), `src\native\components\FriendActivityModal.js` (613 lines), `src\native\context\UserContext.js` (590 lines), `src\native\components\AddSongModal.js` (562 lines), `src\native\theme\appStyles.js` (561 lines), `src\native\components\AddAlbumModal.js` (560 lines), `src\native\context\SocketContext.js` (486 lines), `src\native\screens\MixesScreen.js` (480 lines).
- **Web Frontend (26 files)**: `src\context\AudioContext.jsx` (3,729 lines), `src\components\FullPlayerModal.jsx` (2,467 lines), `src\screens\PlaylistScreen.jsx` (2,034 lines), `src\components\MiniMixerModal.jsx` (1,582 lines), `src\screens\SearchScreen.jsx` (1,451 lines), `src\screens\AdminScreen.jsx` (1,409 lines), `src\screens\ProfileScreen.jsx` (1,189 lines), `src\utils\offlineStorage.js` (1,063 lines), `src\components\AddAlbumModal.jsx` (833 lines), `src\components\ChatModal.jsx` (816 lines), `src\screens\QuranScreen.jsx` (720 lines), `src\components\MiniPlayer.jsx` (700 lines), `src\screens\MixesScreen.jsx` (665 lines), `src\context\UserContext.jsx` (657 lines), `src\App.jsx` (625 lines), `src\components\AddSongModal.jsx` (615 lines), `src\utils\quranUtils.js` (586 lines), `src\screens\ArtistScreen.jsx` (578 lines), `src\components\JamRoomModal.jsx` (546 lines), `src\components\Navigation.jsx` (538 lines), `src\components\SongRadarModal.jsx` (509 lines), `src\components\CreatePlaylistModal.jsx` (507 lines), `src\screens\LibraryScreen.jsx` (498 lines), `src\components\SettingsModal.jsx` (496 lines), `src\screens\HomeScreen.jsx` (484 lines), `src\components\ListeningActivityPanel.jsx` (446 lines).
- **Backend (10 files)**: `server\routes\tracks.js` (2,620 lines), `server\utils\helpers.js` (2,440 lines), `server\sockets\index.js` (1,008 lines), `server\routes\playlists.js` (787 lines), `server\index.js` (766 lines), `server\routes\albums.js` (685 lines), `server\discordActivity.js` (615 lines), `server\utils\vocalSeparator.js` (535 lines), `server\routes\ai.js` (528 lines), `server\routes\users.js` (496 lines).

### 1.2 Confirmed Dead Code & Obsolete Artifacts
- **Confirmed Dead Components & Screens (0 references)**:
  - `src\native\screens\OnlineWebView.js` (1,177 lines): Orphaned old WebView container.
  - `src\screens\MixesScreen.jsx` (665 lines): Not imported in `src/App.jsx` or `src/components/ScreenRouter.jsx`.
  - `src\native\screens\MixesScreen.js` (480 lines): Not imported in `App.js` or `FloatingNavMenu.js`.
  - `src\components\EqualizerModal.jsx` (123 lines): Unreferenced in web frontend.
  - `src\native\components\EqualizerModal.js` (6 lines): Empty dummy returning `null`.
  - `src\native\components\CachedImage.js` (104 lines): 0 references in codebase.
  - `src\native\components\ModeToggle.js` (61 lines): 0 references in codebase.
  - `src\native\ui\BrutalButton.js` (42 lines): 0 references in codebase.
- **Obsolete Scripts**:
  - `rivo-main/scripts/archive/`: 37 legacy scripts from v1.9.5–v2.0.4.
  - `rivo-main/scripts/`: 66 unreferenced scripts.
  - Root `scripts/`: `update_discord_activity.py`, `update_sockets.py`.
  - Root test scripts: `debug_403.py`, `run_test_remote.py`, `test_direct_headers.py`, `test_duckdns_timeout.py`, `test_ffprobe.py`, `test_ghaba.py`, `test_innertube_profiles.py`, `live_duckdns_verification.json`, `playback_benchmark_results.json`.
- **Abandoned Projects & Binaries**:
  - `rivo-main/android-webview/` (entire separate Android project).
  - `rivo-main/desktop-app/` (entire separate C# WinForms project).
  - `release-desktop/Rivo.exe` (118 MB binary checked into git).
  - `bin/yt-dlp` (3.07 MB) & `bin/yt-dlp.exe` (17.8 MB).
  - `ios_main.hermes.bundle` (4.75 MB) & `ios_main.jsbundle` (3.57 MB) in root.
  - Redundant asset folders: `assets-ios/`, `ios_assets/`, `assets/assets/assets/logo.png`.

### 1.3 AGENTS.md Rule Violations Observed
- **Context Memoization Failure in `UserContext.js:558`**: `value` depends on 15 functions (`login`, `register`, `logout`, `updateProfile`, `toggleLikeTrack`, `fetchPublicTracks`, `syncUserData`, `createPlaylist`, `updatePlaylist`, `updatePlaylistTransitions`, `uploadPlaylistCover`, `togglePlaylistVisibility`, `addToPlaylist`, `removeTrackFromPlaylist`, `deletePlaylist`) that lack `useCallback()`, invalidating `useMemo` on every render.
- **Context Memoization Failure in `SocketContext.js:486`**: 9 unmemoized functions (`joinJam`, `leaveJam`, `addToJamQueue`, etc.).
- **High-Frequency State Leak in `AudioContext.js:2975`**: `downloadingIds` and `progressRef.current` inside `controls`; `const [progress, setProgress] = useState` resides in main `AudioProvider`, triggering re-render of 3,000 lines on every tick.
- **Permanent Background Mount in `MobileModals.js:50–54, 88–94`**: `hasMountedFullPlayerRef.current = true` keeps `FullPlayerModal` permanently mounted and listening to `useAudioProgress()`, re-rendering 2,181 lines every 250ms when hidden.
- **Main-Thread I/O in `downloadManager.js:777, 786–809`**: Custom `fastUint8ToBase64` encodes multi-megabyte MP3 files in JavaScript thread during download, causing 2–5s UI freezes.
- **Unvirtualized Lists in `OfflineScreen.js:2` & `ProfileScreen.js`**: Use non-virtualized `<ScrollView>` for track vaults.
- **Missing AbortSignals**: 181 `fetch()` calls without `signal`, including `SearchScreen.js:136, 175` live queries.
- **CORS Bypass in `server/routes/tracks.js:1315–1320`**: Dynamic reflection of any `req.headers.origin` with `Access-Control-Allow-Credentials: true`.
- **System Command Execution in `server/index.js:503`**: `exec(deployCmd)` runs raw bash commands.
- **Synchronous Subprocess in `server/utils/helpers.js:1583`**: `execSync('ffmpeg ...')` in streaming path.

---

## 2. Logic Chain

1. **Rule 1 (400-Line Limit)**: AGENTS.md prohibits files >400 lines. The line count scan proved 68 files exceed 400 lines, with 7 files exceeding 2,000 lines. Therefore, modularization splits are mandatory across 32 native files, 26 web files, and 10 backend files.
2. **Rule 2 (Dead Code & R2)**: Cross-reference analysis demonstrated that `OnlineWebView.js`, `MixesScreen.js`, `MixesScreen.jsx`, `EqualizerModal.js/jsx`, `CachedImage.js`, `ModeToggle.js`, `BrutalButton.js`, 103 scripts in `scripts/`, `android-webview/`, `desktop-app/`, and redundant asset folders have 0 runtime references. Deleting them eliminates ~150MB of disk bloat and 2,658 lines of dead code without breaking any feature.
3. **Requirement R5 (Cold Boot Content Shift)**: Direct inspection of `HomeScreen.js` lines 69–92 revealed that when `albums` is initially empty on boot, `displayAlbums` computes grouped album cards from `userTracks` and mounts them. When `/api/albums` finishes seconds later, `albums` updates, causing `displayAlbums` to suddenly replace the grouped cards with database albums. This directly produces the observed cold boot layout shift.
4. **Requirement R3 (Cold Start Black Screen)**: During boot on 1.5GB RAM Android devices, `App.js`, `UserContext.js`, and `AudioContext.js` run concurrent heavy AsyncStorage operations (`Promise.all`), directory scans (`cleanupOldApkInstallers`), and JSON serialization of 4,000 tracks before the first frame can paint. This starves the single JS thread and triggers the black screen hang.
5. **Requirement R4 (Tab Switching Lag)**: When switching tabs, `App.js` re-renders. Because `UserContext` and `SocketContext` invalidate `useMemo` on every render, and heavy screens (`OfflineScreen`, `LibraryScreen`) use unvirtualized `ScrollView`s while `FullPlayerModal` continually ticks in the background, the JS thread experiences extreme frame drops and freezes.
6. **Requirement R6 (Network Consumption)**: `GET /api/tracks` returns 4,000 tracks in a single unpaginated request; `checkAppUpdates` is polled repeatedly; `syncUserData` downloads full user data on every like; and `SearchScreen` lacks `AbortController` cancellation. These factors collectively cause massive redundant bandwidth usage.

---

## 3. Caveats

- **Active Verification Scripts**: While 66 ad-hoc scripts in `rivo-main/scripts/` are unreferenced, root scripts `benchmark_playback.py`, `test_stream_proxy.py`, and `verify_duckdns_playback.py` are explicitly designated for verification in `ORIGINAL_REQUEST.md` and should NOT be deleted.
- **Local Pods**: `modules/media-controls` is actively referenced by iOS CocoaPods build (`RivoMediaControls.podspec`), and `android/app/src/main/java/com/rivo/app/MediaControlsModule.kt` is its Android counterpart. They are ACTIVE native modules, not dead code.
- **Zero Production Mutations**: In accordance with Requirement R7, all observations were conducted in development mode without mutating remote production databases.

---

## 4. Conclusion

The Rivo codebase suffers from severe architectural debt, heavy monolithic files (68 files > 400 lines), 2,658 lines of dead components, 103 obsolete scripts, two abandoned subprojects, multiple broken React memoization patterns, and main-thread I/O stalls that directly account for the black screen startup hang (R3), tab navigation lag (R4), initial boot album layout shifts (R5), and network data waste (R6).

All observations, exact line numbers, code pointers, and modularization targets have been cataloged in:
`c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\spec_miner_survey_1\survey_spec.md`.

---

## 5. Verification Method

To independently verify all findings:
1. **File Line Counts**: Run Python script to scan line counts in `rivo-main`:
   ```bash
   python -c "import os; [print(f'{len(open(os.path.join(r, f), errors=\"ignore\").readlines()):5d} {os.path.join(r, f)}') for r, d, fs in os.walk('rivo-main') for f in fs if f.endswith(('.js', '.jsx')) and not any(p in r for p in ['node_modules', 'dist', 'build', '.git']) and len(open(os.path.join(r, f), errors=\"ignore\").readlines()) > 400]"
   ```
2. **Dead Components**: Check for any import of `OnlineWebView` or `MixesScreen`:
   ```bash
   powershell -Command "Select-String -Path 'rivo-main\src\**\*.js*', 'rivo-main\App.js' -Pattern 'OnlineWebView', 'MixesScreen'"
   ```
3. **HomeScreen Layout Shift Inspection**: Inspect `c:\Users\mohamed\Downloads\rivo-main\rivo-main\src\native\screens\HomeScreen.js` lines 69–92 to verify the fallback grouped album logic.
4. **UserContext Memoization Inspection**: Inspect `c:\Users\mohamed\Downloads\rivo-main\rivo-main\src\native\context\UserContext.js` lines 540–581 to verify that 15 unmemoized async functions are passed as dependencies to `useMemo`.
5. **Stream Proxy CORS Header Reflection**: Inspect `c:\Users\mohamed\Downloads\rivo-main\rivo-main\server\routes\tracks.js` lines 1315–1320.
