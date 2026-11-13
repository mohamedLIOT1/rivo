# Architectural & Dead Code Survey Specification (Step 0)

**Author**: `spec_miner_survey_1` (Codebase & Architecture Spec Miner)  
**Date**: 2026-11-04  
**Target Codebase**: `c:\Users\mohamed\Downloads\rivo-main\rivo-main`  
**Governing Documents**: `c:\Users\mohamed\Downloads\rivo-main\AGENTS.md`, `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\ORIGINAL_REQUEST.md`

---

## Executive Summary

A comprehensive architectural and dead code audit across the Rivo repository (`rivo-main`, root scripts, backend, web frontend, and native mobile layer) was conducted. The audit revealed severe architectural debt originating from rapid vibe coding:
1. **68 monolithic source files exceed the 400-line limit** enforced by `AGENTS.md`, with the largest files exceeding 2,500 to 3,700 lines (`src/context/AudioContext.jsx`: 3,729 lines; `src/native/context/AudioContext.js`: 3,006 lines; `server/routes/tracks.js`: 2,620 lines; `src/native/services/downloadManager.js`: 2,575 lines; `src/native/screens/LibraryScreen.js`: 2,544 lines; `src/components/FullPlayerModal.jsx`: 2,467 lines; `server/utils/helpers.js`: 2,440 lines).
2. **Massive dead code and obsolete assets**:
   - **8 confirmed dead components and screens** totaling 2,658 lines of unused code (including `OnlineWebView.js` with 1,177 lines and both native and web `MixesScreen` with 1,145 lines).
   - **103 obsolete scripts** in `rivo-main/scripts/` (37 in `archive/` and 66 unreferenced in root `scripts/`).
   - **2 completely abandoned standalone projects**: `android-webview/` (full Java/Kotlin Gradle project) and `desktop-app/` (.NET C# WinForms project).
   - **Binary pollution in git**: `release-desktop/Rivo.exe` (118 MB binary checked into git), `bin/yt-dlp.exe` (17.8 MB), `bin/yt-dlp` (3.07 MB), and build bundles in repo root (`ios_main.hermes.bundle` 4.75 MB, `ios_main.jsbundle` 3.57 MB).
   - **Duplicate asset directories**: `assets-ios/` and `ios_assets/` (unreferenced duplicates with redundant nested paths `assets/assets/assets/logo.png`).
3. **Severe performance bottlenecks directly explaining the reported bugs**:
   - **Cold Start Black Screen (R3)**: Caused by synchronous FileSystem directory scanning, loading multi-megabyte `manifest.json` and 4,000-track JSON payloads into memory on the JS thread during boot on low-RAM (1.5GB) Android devices.
   - **Bottom Navigation Lag (R4)**: Caused by broken `useMemo` invalidation in `UserContext.js` (15 unstabilized callbacks) and `SocketContext.js` (9 unstabilized callbacks), lack of `React.memo` on screens and modals, keep-alive holding heavy screens mounted, and non-virtualized `ScrollView` in `OfflineScreen` and `ProfileScreen`.
   - **Initial Boot Album Layout Shift (R5)**: Pinpointed to `src/native/screens/HomeScreen.js` lines 69–92: when `albums` is initially empty, `HomeScreen` computes fallback grouped album cards from `userTracks` and immediately mounts them; when the network/cache resolves seconds later, `albums` is overwritten, violently shifting layout.
   - **Network Consumption (R6)**: `GET /api/tracks` queries 4,000 tracks unpaginated, `/api/app/version` is polled on multiple triggers, search fetches lack `AbortSignal` causing duplicate in-flight requests, and every like/playlist change triggers full `/api/auth/me` re-sync.
   - **Security Vulnerabilities**: Reflected CORS in `/api/tracks/stream-proxy` lines 1315–1320 allowing any origin with credentials, hardcoded production server paths (`/home/ubuntu/`), and `exec(deployCmd)` running raw shell scripts.

---

## 1. Files Exceeding the 400-Line Limit (AGENTS.md Violation)

A total of **68 files** violate the strict 400-line architectural ceiling. They are categorized below with modularization blueprints.

### 1.1 Native Frontend Layer (`src/native/` & `App.js`) — 32 Files

| # | File Path | Line Count | Current Responsibilities & Monolithic Scope | Modularization Target / Split Plan |
|---|-----------|------------|---------------------------------------------|------------------------------------|
| 1 | `src/native/context/AudioContext.js` | 3,006 | Playback queue, expo-av engine, lock screen notifications, DJ crossfading, vocal isolation, offline playback, jam sessions, download manager bridging. | Split into: `useAudioPlaybackCore.js`, `useAudioQueue.js`, `useDjCrossfade.js`, `useMediaSession.js`, `useVocalIsolation.js`, `AudioContext.js` (<350 lines). |
| 2 | `src/native/services/downloadManager.js` | 2,575 | Download state, YouTube stream resolution, file storage, manual JS-thread ID3 v2 embedding (`fastUint8ToBase64`), manifest serialization, legacy key migration. | Split into: `downloadQueueService.js`, `storageManifestService.js`, `id3TagService.js`, `downloadManager.js` (<400 lines). |
| 3 | `src/native/screens/LibraryScreen.js` | 2,544 | Playlists, liked songs, albums, artists, history, import/export, drag-and-drop playlist reordering, multi-nested `ScrollView`s. | Split into: `LibraryPlaylistsTab.js`, `LibraryAlbumsTab.js`, `LibraryArtistsTab.js`, `LibraryHistoryTab.js`, `LibraryScreen.js`. |
| 4 | `src/native/components/FullPlayerModal.js` | 2,181 | Modal shell, vinyl animation, progress slider, lyrics viewer, queue editor, EQ controls, DJ transition trigger, recommendation radar. | Split into: `FullPlayerTrackInfo.js`, `FullPlayerControls.js`, `FullPlayerLyricsView.js`, `FullPlayerQueueView.js`, `FullPlayerModal.js`. |
| 5 | `src/native/screens/ProfileScreen.js` | 2,133 | User profile display, avatar upload, stats summary, social friend cards, followers/following lists, liked songs tab, unvirtualized lists. | Split into: `ProfileHeader.js`, `ProfileSocialModal.js`, `ProfileLikedTracks.js`, `ProfileScreen.js`. |
| 6 | `src/native/components/MiniMixerModal.js` | 1,889 | Crossfade parameters, DJ mixing curves, dual deck preloading, waveform visualization, tempo match. | Split into: `MixerControls.js`, `MixerWaveform.js`, `MixerPresetSelector.js`, `MiniMixerModal.js`. |
| 7 | `src/native/components/JamRoomModal.js` | 1,666 | Socket room listener, shared playlist, live chat messages, host controls, participant avatars, vote-skip logic. | Split into: `JamMemberList.js`, `JamQueueList.js`, `JamChatBox.js`, `JamRoomModal.js`. |
| 8 | `App.js` | 1,434 | Root shell, OTA updater, APK installer, tab navigation, drawer menu, notifications listener, 15+ modal states, inline styles. | Split into: `useAppUpdateGuard.js`, `AppHeader.js`, `AppTabNavigation.js`, `AppDrawerMenu.js`, `App.js` (<350 lines). |
| 9 | `src/native/screens/AdminScreen.js` | 1,398 | Track upload, metadata edit, bulk delete, user management, server telemetry, system health. | Split into: `AdminTrackManager.js`, `AdminUserManager.js`, `AdminSystemStats.js`, `AdminScreen.js`. |
| 10 | `src/native/screens/SearchScreen.js` | 1,396 | Search input, genre chip grid, live query debounce, fuzzy search, remote YouTube fallback, user search, cassette card rendering. | Split into: `SearchHeader.js`, `SearchGenreGrid.js`, `SearchResultsList.js`, `SearchScreen.js`. |
| 11 | `src/native/components/ChatModal.js` | 1,197 | Socket chat messaging, friend selection, audio attachment preview, message bubbles, read receipt updates. | Split into: `ChatConversationList.js`, `ChatMessagesView.js`, `ChatInputBar.js`, `ChatModal.js`. |
| 12 | `src/native/components/CreatePlaylistModal.js` | 1,184 | Playlist creation form, cover image picker, track search & multi-select, privacy toggle, transition duration settings. | Split into: `PlaylistForm.js`, `PlaylistTrackPicker.js`, `CreatePlaylistModal.js`. |
| 13 | `src/native/screens/OnlineWebView.js` | 1,177 | Old WebView container with injected JavaScript bridge, postMessage handlers, native audio hijacking. | **CONFIRMED DEAD CODE** — Delete entirely. |
| 14 | `src/native/screens/OfflineScreen.js` | 1,169 | Vault manager, non-virtualized downloaded song list, storage gauge, batch track export, metadata repair, filter chips. | Split into: `VaultStorageGauge.js`, `VaultTrackList.js` (with FlatList), `OfflineScreen.js`. |
| 15 | `src/native/components/AlbumDetailModal.js` | 1,080 | Album header, track list, play all, save album, edit album modal trigger, artist link. | Split into: `AlbumHeader.js`, `AlbumTrackList.js`, `AlbumDetailModal.js`. |
| 16 | `src/native/components/ArtistDetailModal.js` | 1,051 | Artist banner, bio, top tracks, discography albums list, follow button. | Split into: `ArtistHeader.js`, `ArtistDiscography.js`, `ArtistDetailModal.js`. |
| 17 | `src/native/components/SettingsModal.js` | 1,026 | Audio quality, theme toggle, nav bar preference, lockscreen toggles, storage clear, app cache reset, version card. | Split into: `AudioSettingsTab.js`, `StorageSettingsTab.js`, `GeneralSettingsTab.js`, `SettingsModal.js`. |
| 18 | `src/native/components/UserDetailModal.js` | 949 | Friend profile modal, mutual friends, shared tracks, follow/unfollow toggle, direct message CTA. | Split into: `UserDetailHeader.js`, `UserActivityList.js`, `UserDetailModal.js`. |
| 19 | `src/native/services/youtubeResolver.js` | 887 | Query sanitization, Innertube client config rotation, stream cache management, backend proxy URL builder, fallback chains. | Split into: `queryCleaner.js`, `streamCache.js`, `innertubeClient.js`, `youtubeResolver.js`. |
| 20 | `src/native/components/SongRadarModal.js` | 854 | Audio fingerprinting recorder, recognition status, matched song preview, direct play / library add. | Split into: `RadarMicVisualizer.js`, `RadarMatchCard.js`, `SongRadarModal.js`. |
| 21 | `src/native/screens/HomeScreen.js` | 753 | Greeting header, featured albums grid, popularity-sorted tracks FlatList, pull-to-refresh, genre filters. | Split into: `HomeGreetingHeader.js`, `HomeAlbumsCarousel.js`, `HomeScreen.js`. |
| 22 | `src/native/screens/QuranScreen.js` | 705 | 114 Surahs list, reciter picker modal, Ayah audio player, Quran radio stations, non-virtualized ScrollView. | Split into: `SurahFlatList.js`, `ReciterPickerModal.js`, `QuranRadioStations.js`, `QuranScreen.js`. |
| 23 | `src/native/components/IntroAuthModal.js` | 660 | Auth tabs (Login, Register, Guest), email input, password validation, error display, auth token persistence. | Split into: `LoginForm.js`, `RegisterForm.js`, `IntroAuthModal.js`. |
| 24 | `src/native/components/FloatingNavMenu.js` | 659 | FAB expand/collapse animation, radial button icons, badge indicators, backdrop touch dismiss. | Split into: `FloatingMenuPill.js`, `FloatingNavMenu.js`. |
| 25 | `src/native/screens/StatsScreen.js` | 651 | Weekly listening charts, top artists, top genres, streak counter, total listening minutes gauge. | Split into: `StatsListeningChart.js`, `StatsTopArtists.js`, `StatsScreen.js`. |
| 26 | `src/native/components/FriendActivityModal.js` | 613 | Real-time presence cards, live track status, listen-along button, user status badges. | Split into: `FriendActivityCard.js`, `FriendActivityModal.js`. |
| 27 | `src/native/context/UserContext.js` | 590 | Auth token state, user profile, playlists array, albums array, likes array, 15 unmemoized async handlers. | Split into: `useAuthService.js`, `usePlaylistService.js`, `UserContext.js`. |
| 28 | `src/native/components/AddSongModal.js` | 562 | YouTube URL import, direct audio upload, metadata extraction, genre selection, album selector. | Split into: `UploadSongForm.js`, `ImportYoutubeForm.js`, `AddSongModal.js`. |
| 29 | `src/native/theme/appStyles.js` | 561 | Monolithic global stylesheet for entire native application. | Split into: `headerStyles.js`, `modalStyles.js`, `tabStyles.js`, `appStyles.js`. |
| 30 | `src/native/components/AddAlbumModal.js` | 560 | Album name, artist, cover upload, multi-track attachment picker, release year. | Split into: `AlbumDetailsForm.js`, `AddAlbumModal.js`. |
| 31 | `src/native/context/SocketContext.js` | 486 | Socket.io connection lifecycle, jam session room events, chat event handlers, unmemoized callbacks. | Split into: `useSocketConnection.js`, `useJamSocketEvents.js`, `SocketContext.js`. |
| 32 | `src/native/screens/MixesScreen.js` | 480 | Old DJ mixes screen with BPM cards and mix presets. | **CONFIRMED DEAD CODE** — Delete entirely. |

---

### 1.2 Web Frontend Layer (`src/` excluding `src/native/`) — 26 Files

| # | File Path | Line Count | Current Responsibilities & Monolithic Scope | Modularization Target / Split Plan |
|---|-----------|------------|---------------------------------------------|------------------------------------|
| 33 | `src/context/AudioContext.jsx` | 3,729 | Web HTML5 audio element controller, playlist queue, Dj crossfade engine, YouTube streaming, Jam synchronization. | Split into: `useWebAudioQueue.js`, `useWebDjEngine.js`, `useWebJamSync.js`, `AudioContext.jsx`. |
| 34 | `src/components/FullPlayerModal.jsx` | 2,467 | Web full-screen player modal, lyrics display, waveforms, queue inspector, sound spectrum visualizer. | Split into: `FullPlayerVisualizer.jsx`, `FullPlayerLyrics.jsx`, `FullPlayerModal.jsx`. |
| 35 | `src/screens/PlaylistScreen.jsx` | 2,034 | Playlist details, cover art upload, track reordering, public/private toggles, batch delete, export. | Split into: `PlaylistTracksTable.jsx`, `PlaylistEditModal.jsx`, `PlaylistScreen.jsx`. |
| 36 | `src/components/MiniMixerModal.jsx` | 1,582 | Dual deck WebAudio audio nodes, crossfade duration sliders, filter curves, automated mix preview. | Split into: `WebAudioEngine.js`, `MixerCurves.jsx`, `MiniMixerModal.jsx`. |
| 37 | `src/screens/SearchScreen.jsx` | 1,451 | Web search interface, live query debounce, search history chips, filtered tabs, artist and album cards. | Split into: `SearchFilterTabs.jsx`, `SearchTrackResults.jsx`, `SearchScreen.jsx`. |
| 38 | `src/screens/AdminScreen.jsx` | 1,409 | Web admin console, track uploads, song metadata editor, user table, system resource usage charts. | Split into: `AdminTrackTable.jsx`, `AdminUserTable.jsx`, `AdminScreen.jsx`. |
| 39 | `src/screens/ProfileScreen.jsx` | 1,189 | User dashboard, listening stats graphs, friend list, profile bio and avatar editor, liked songs tab. | Split into: `ProfileStatsCard.jsx`, `ProfileLikedGrid.jsx`, `ProfileScreen.jsx`. |
| 40 | `src/utils/offlineStorage.js` | 1,063 | IndexedDB wrapper for web caching, blob storage, offline song download and retrieval. | Split into: `indexedDbCore.js`, `blobStorage.js`, `offlineStorage.js`. |
| 41 | `src/components/AddAlbumModal.jsx` | 833 | Album creation dialog, cover file dropzone, track metadata fields. | Split into: `AlbumDropzone.jsx`, `AddAlbumModal.jsx`. |
| 42 | `src/components/ChatModal.jsx` | 816 | Web chat drawer, message thread, user list, friend request actions. | Split into: `ChatThread.jsx`, `ChatUserList.jsx`, `ChatModal.jsx`. |
| 43 | `src/screens/QuranScreen.jsx` | 720 | Web Quran reader, Surah list, audio reciter selection, translation viewer. | Split into: `SurahTable.jsx`, `QuranAudioPlayer.jsx`, `QuranScreen.jsx`. |
| 44 | `src/components/MiniPlayer.jsx` | 700 | Desktop & Web persistent bottom audio player bar, progress bar slider, volume popup, lyrics toggle. | Split into: `MiniPlayerSeekbar.jsx`, `MiniPlayerVolume.jsx`, `MiniPlayer.jsx`. |
| 45 | `src/screens/MixesScreen.jsx` | 665 | Web DJ mixes screen with DJ presets. | **CONFIRMED DEAD CODE** — Delete entirely. |
| 46 | `src/context/UserContext.jsx` | 657 | Web auth provider, JWT token storage, user profile, playlists collection, sync triggers. | Split into: `useWebAuth.js`, `useWebPlaylists.js`, `UserContext.jsx`. |
| 47 | `src/App.jsx` | 625 | Web app layout, sidebar navigation, top header, screen router wrapper, global modal mounts. | Split into: `WebSidebar.jsx`, `WebHeader.jsx`, `App.jsx`. |
| 48 | `src/components/AddSongModal.jsx` | 615 | Web modal for track uploading, audio drag-and-drop, YouTube resolver integration. | Split into: `AudioUploadDropzone.jsx`, `AddSongModal.jsx`. |
| 49 | `src/utils/quranUtils.js` | 586 | Surah list metadata, reciter URLs, Quran identification rules, Arabic text normalization. | Split into: `surahMetadata.js`, `quranTextNormalizer.js`, `quranUtils.js`. |
| 50 | `src/screens/ArtistScreen.jsx` | 578 | Artist header banner, popular tracks table, albums discography grid. | Split into: `ArtistPopularTracks.jsx`, `ArtistScreen.jsx`. |
| 51 | `src/components/JamRoomModal.jsx` | 546 | Web Jam Room UI, synchronized listening widget, participant avatars. | Split into: `JamParticipants.jsx`, `JamRoomModal.jsx`. |
| 52 | `src/components/Navigation.jsx` | 538 | Web desktop sidebar navigation links, brand logo, playlist shortcuts, theme toggle. | Split into: `SidebarPlaylistsList.jsx`, `Navigation.jsx`. |
| 53 | `src/components/SongRadarModal.jsx` | 509 | Web browser microphone recorder, AudioContext analyzer, recognition loader. | Split into: `MicAnalyzer.js`, `SongRadarModal.jsx`. |
| 54 | `src/components/CreatePlaylistModal.jsx` | 507 | Web modal for playlist creation, privacy toggle, cover upload. | Split into: `CreatePlaylistModal.jsx` (<300 lines). |
| 55 | `src/screens/LibraryScreen.jsx` | 498 | Web library screen tabs: playlists, albums, artists, downloaded tracks. | Split into: `LibraryScreen.jsx` (<350 lines). |
| 56 | `src/components/SettingsModal.jsx` | 496 | Web settings dialog: stream audio quality, storage clear, shortcuts help. | Split into: `SettingsModal.jsx` (<300 lines). |
| 57 | `src/screens/HomeScreen.jsx` | 484 | Web home dashboard, hero banner, recent playlists, top tracks grid. | Split into: `HomeHeroBanner.jsx`, `HomeScreen.jsx`. |
| 58 | `src/components/ListeningActivityPanel.jsx` | 446 | Desktop sidebar widget showing live friend listening statuses and song cards. | Split into: `ListeningActivityCard.jsx`, `ListeningActivityPanel.jsx`. |

---

### 1.3 Backend Layer (`server/`) — 10 Files

| # | File Path | Line Count | Current Responsibilities & Monolithic Scope | Modularization Target / Split Plan |
|---|-----------|------------|---------------------------------------------|------------------------------------|
| 59 | `server/routes/tracks.js` | 2,620 | Track search, audio upload, YouTube resolve, proxy stream, vocal status, lyrics management, deduplication. | Split into: `routes/tracks/crud.js`, `routes/tracks/stream.js`, `routes/tracks/lyrics.js`, `routes/tracks/vocals.js`, `routes/tracks.js` (<300 lines). |
| 60 | `server/utils/helpers.js` | 2,440 | YouTube Innertube extraction, yt-dlp execution, Invidious/Piped fallback scraper, FFmpeg probe, audio validation. | Split into: `utils/ytInnertube.js`, `utils/ytdlpRunner.js`, `utils/invidiousScraper.js`, `utils/ffmpegProbe.js`, `utils/helpers.js`. |
| 61 | `server/sockets/index.js` | 1,008 | Socket.io connection lifecycle, Jam sessions rooms, synchronized playback broadcast, real-time chat, Discord activity sync. | Split into: `sockets/jamHandler.js`, `sockets/chatHandler.js`, `sockets/presenceHandler.js`, `sockets/index.js`. |
| 62 | `server/routes/playlists.js` | 787 | Playlist CRUD, track addition/removal, reordering, visibility toggle, public playlist fork, cover upload. | Split into: `routes/playlists/tracks.js`, `routes/playlists/crud.js`, `routes/playlists.js`. |
| 63 | `server/index.js` | 766 | Express app setup, rate limiting, static asset fallback, deploy-webhook child_process, version check endpoints, route mounting. | Split into: `middleware/corsConfig.js`, `routes/version.js`, `routes/deployWebhook.js`, `server/index.js` (<350 lines). |
| 64 | `server/routes/albums.js` | 685 | Album CRUD, track assignment, public albums query, album cover upload, Spotify lookup scraper. | Split into: `routes/albums/crud.js`, `routes/albums/lookup.js`, `routes/albums.js`. |
| 65 | `server/discordActivity.js` | 615 | Discord Bot / RPC gateway, rich presence listening updates, Discord account linking tokens. | Split into: `discord/rpcService.js`, `discord/linkService.js`, `server/discordActivity.js`. |
| 66 | `server/utils/vocalSeparator.js` | 535 | Vocal isolation pipeline, Demucs/UVR subprocess spawn, HF Spaces fallback proxy, stem audio streaming. | Split into: `vocal/uvrRunner.js`, `vocal/hfSpacesClient.js`, `server/utils/vocalSeparator.js`. |
| 67 | `server/routes/ai.js` | 528 | Google Gemini Generative AI prompt builder, song mood analysis, playlist generation, audio recommendations. | Split into: `ai/geminiClient.js`, `ai/playlistGenerator.js`, `server/routes/ai.js`. |
| 68 | `server/routes/users.js` | 496 | User profile query, friend search, followers/following, avatar upload, password reset. | Split into: `routes/users/social.js`, `routes/users/profile.js`, `server/routes/users.js`. |

---

## 2. Complete Inventory of Confirmed Dead Code & Obsolete Artifacts

The following assets and files have been systematically verified via cross-reference scanning to have **zero active references** in production execution. They are confirmed targets for permanent deletion under Requirement R2.

### 2.1 Confirmed Dead Components & Screens (Total: 2,658 Lines)

1. `src/native/screens/OnlineWebView.js` (1,177 lines)  
   - **Reason**: 100% orphaned. Abandoned when Rivo switched to pure React Native (`App.js:450: "100% PURE NATIVE APP SHELL (NO WEBVIEW)"`). Zero imports.
2. `src/screens/MixesScreen.jsx` (665 lines)  
   - **Reason**: 100% orphaned. Not imported in `src/App.jsx` or `src/components/ScreenRouter.jsx`.
3. `src/native/screens/MixesScreen.js` (480 lines)  
   - **Reason**: 100% orphaned. Not imported or mounted in `App.js` or `FloatingNavMenu.js`.
4. `src/components/EqualizerModal.jsx` (123 lines)  
   - **Reason**: 100% orphaned. Not imported in any web component or screen.
5. `src/native/components/EqualizerModal.js` (6 lines)  
   - **Reason**: Returns `null`. Not imported anywhere in `App.js` or `MobileModals.js`.
6. `src/native/components/CachedImage.js` (104 lines)  
   - **Reason**: 0 references across the codebase. All components use standard `<Image>` or `Image` from `react-native`.
7. `src/native/components/ModeToggle.js` (61 lines)  
   - **Reason**: 0 references. Online/offline mode toggle is handled in drawer/settings directly.
8. `src/native/ui/BrutalButton.js` (42 lines)  
   - **Reason**: 0 references across the codebase. Replaced by direct `TouchableOpacity` with brutal styling.

### 2.2 Obsolete Scripts in `rivo-main/scripts/` (Total: 103 Scripts)

#### 2.2.1 `rivo-main/scripts/archive/` (37 Confirmed Dead Scripts)
All 37 scripts inside `rivo-main/scripts/archive/` are legacy prototypes from older builds (v1.9.5–v2.0.4) and must be permanently deleted:
- `repack-ipa-v1995.py`, `repack-ipa-v1998.py`, `repack-ipa-v1999.py`, `repack-ipa.js`, `repack_android_v204.py`, `repack_remote.js`
- `benchmark_spaces.py`, `check_err.py`, `check_models.py`, `check_more_uvr.py`, `check_placebo.py`, `check_spaces_status.py`, `check_trans_remote.py`
- `find_chroma.js`, `find_running_spaces.py`, `find_track.js`, `run_mafesh_mane3.py`, `search_hf_spaces.py`
- `test_b3xn.py`, `test_cpu_uvr.py`, `test_denoise.py`, `test_high_quality.py`, `test_kim_spaces.py`, `test_netynet.py`, `test_nev.py`, `test_purify.py`, `test_real_track.py`, `test_rifd.py`, `test_spaces.py`, `test_spaces2.py`, `test_spaces3.py`, `test_spaces4.py`, `test_spaces5.py`, `test_teamup.py`, `test_timing.py`, `test_token.py`, `test_vocal_cleanup.py`

#### 2.2.2 Unreferenced Ad-Hoc Scripts in `rivo-main/scripts/` (66 Scripts)
The following 66 scripts have 0 references in `package.json`, CI, or application code (only `publish-ota.js` is referenced by `"npm run ota"`):
`analyze_all_tracks.py`, `benchmark_fallbacks.py`, `build-desktop.ps1`, `build_ios_ipa.py`, `cache_supernova.py`, `check_albums_embedded.py`, `check_direct_tracks.py`, `check_ghaba_db.py`, `check_users_tracks.py`, `check_yt_urls.py`, `debug_server_extract.py`, `deploy_production.py`, `fast_deploy.py`, `fetch_docs_instances.py`, `fetch_healthy_instances.py`, `fetch_piped_instances.py`, `generate_android_icons.js`, `generate_installer_graphics.py`, `generate_splash.ps1`, `get_invidious_links.py`, `inspect_tracks_db.py`, `investigate_yt.py`, `monitor-ios-build.js`, `parse_remote_cookies.py`, `precache_all_tracks.js`, `publish-release.js`, `query_album.py`, `query_mategy.py`, `query_specific_songs.py`, `repack_android.py`, `repack_ipa.py`, `repair_corrupted_track.py`, `run_investigation.py`, `run_remote.py`, `seed-tracks.cjs`, `step_debug.js`, `test_bgutil_http.py`, `test_bgutil_http_cookies.py`, `test_cache_run.py`, `test_clients_remote.py`, `test_cookie_auth.py`, `test_ignore_config.py`, `test_ignore_config_cookies.py`, `test_innertube_clients.py`, `test_innertube_cookies.py`, `test_innertube_debug.py`, `test_innertube_details.py`, `test_innertube_local.py`, `test_innertube_variations.py`, `test_invidious_fast.py`, `test_music_player.py`, `test_piped_new.py`, `test_player_timeout.py`, `test_remote_stream.py`, `test_resolve_stream.py`, `test_server_debug.py`, `test_stream_endpoint.py`, `test_stream_fallback_provider.js`, `test_stream_investigation.py`, `test_ytdlp_clients.py`, `test_ytdlp_clients_part2.py`, `test_ytdlp_verbose.py`, `test_ytdlp_with_cookies.py`, `trace_pipeline.py`, `trace_substeps.py`, `verify_indexes_and_tracks.py`.

### 2.3 Obsolete Root Scripts in `c:\Users\mohamed\Downloads\rivo-main\`

- `scripts/update_discord_activity.py` and `scripts/update_sockets.py` in root `scripts/` (0 references).
- Ad-hoc root debug scripts:
  - `debug_403.py`, `run_test_remote.py`, `test_direct_headers.py`, `test_duckdns_timeout.py`, `test_ffprobe.py`, `test_ghaba.py`, `test_innertube_profiles.py` (one-off debug scripts).
  - Stale JSON dumps in root: `live_duckdns_verification.json`, `playback_benchmark_results.json`.
  *(Note: `benchmark_playback.py`, `test_stream_proxy.py`, and `verify_duckdns_playback.py` are preserved for milestone QA verification per ORIGINAL_REQUEST.md line 34).*

### 2.4 Abandoned Standalone Sub-Projects & Redundant Directories

1. `rivo-main/android-webview/`:
   - An entire standalone Android project (`com.rivo.web`) with Gradle build files, Kotlin MainActivity, and XML layouts.
   - **Status**: 100% abandoned and unreferenced.
2. `rivo-main/desktop-app/`:
   - A standalone C# / .NET 10 Windows Forms wrapper (`desktop-app.csproj`, `Form1.cs`).
   - **Status**: 100% abandoned and superseded by Tauri (`src-tauri/`).
3. `rivo-main/release-desktop/`:
   - Contains `Rivo.exe` (**118 MB binary checked into git!**) and WebView2 XML files.
   - **Status**: Checked-in binaries must be removed from git tracking.
4. `rivo-main/bin/`:
   - Contains `yt-dlp.exe` (17.8 MB) and `yt-dlp` (3.07 MB). These binaries bloat repository size and should be downloaded dynamically if needed rather than checked into git.
5. `rivo-main/ios_main.hermes.bundle` (4.75 MB) & `ios_main.jsbundle` (3.57 MB):
   - Compiled production Hermes JavaScript bundles committed directly to repository root.
   - **Status**: Build artifacts that violate AGENTS.md binary file rules.
6. Redundant Asset Folders:
   - `rivo-main/assets-ios/` and `rivo-main/ios_assets/` (duplicate unreferenced asset directories).
   - `rivo-main/assets/assets/assets/logo.png` (accidental deep nested recursive subfolder).

---

## 3. Detailed Audit of AGENTS.md Compliance

### 3.1 High-Frequency State Isolation (currentTime, progress ticks, download progress)
- **Violation in Native `AudioContext.js` (lines 200, 2975–2991)**:
  - While `AudioProgressContext` is defined, `downloadingIds` and `progressRef.current` are passed directly inside `controls` in the general `AudioContext.Provider`.
  - Inside `AudioProvider`, `const [progress, setProgress] = useState({ currentTime: 0, duration: 0 })` resides in the main provider component. On every progress tick (~250ms), `setProgress` executes, causing the entire 3,000-line `AudioProvider` component body to re-execute!
- **Violation in Web `AudioContext.jsx` (lines 147, 3619–3620, 3678–3681)**:
  - `const [currentTime, setCurrentTime] = useState(...)` resides in the root `AudioProvider`. Even though getter properties are used on `value`, `currentTime` state updates trigger full re-evaluations of the provider.
- **Violation in `MiniPlayer.js` (line 6)**:
  - Directly calls `const { currentTime, duration } = useAudioProgress();`, causing the entire `MiniPlayer` component tree, buttons, text, and icons to re-render multiple times per second during audio playback.
- **Violation in `MobileModals.js` & `FullPlayerModal.js`**:
  - `MobileModals.js` (lines 50–54, 88–94) maintains a permanent flag `hasMountedFullPlayerRef.current = true`. Once the user opens the full player once, `FullPlayerModal` remains permanently mounted in the React tree in the background (`visible={false}`).
  - Because `FullPlayerModal.js` (line 423) calls `useAudioProgress()`, it continuously re-renders 2,181 lines of lyrics, waveforms, and queues in the background on every playback tick even when hidden!

### 3.2 Context Provider Memoization & Callback Stabilization
- **Critical Failure in Native `UserContext.js` (lines 156–581)**:
  - `UserContext.js` wraps `value` in `useMemo`, BUT its dependency array contains 15 async functions: `login`, `register`, `logout`, `updateProfile`, `toggleLikeTrack`, `fetchPublicTracks`, `syncUserData`, `createPlaylist`, `updatePlaylist`, `updatePlaylistTransitions`, `uploadPlaylistCover`, `togglePlaylistVisibility`, `addToPlaylist`, `removeTrackFromPlaylist`, `deletePlaylist`.
  - **NONE of these 15 functions are wrapped in `useCallback()`!**
  - Result: Every time `UserProvider` re-renders, all 15 functions are recreated with new object references. This invalidates `useMemo` on every single render. Every consumer of `useUser()` across the entire app is forced to re-render continuously.
- **Critical Failure in Native `SocketContext.js` (lines 486)**:
  - 9 functions passed to `value` (`joinJam`, `leaveJam`, `addToJamQueue`, `removeFromJamQueue`, `reorderJamQueue`, `transferJamHost`, `kickJamMember`, `syncJamPlayState`, `sendChatMessage`) lack `useCallback()`, breaking provider memoization.
- **Partial Failure in Native `AudioContext.js` (line 2991)**:
  - `setVolume`, `toggleAutoDownloadFinished`, `removeDownloadedTrack`, `removeDownloadedTracksBatch` lack `useCallback()`.

### 3.3 Pure Components & React.memo on Heavy Components
- **Audit Findings**:
  - Out of 75 components checked, only 12 use `React.memo`.
  - Heavy modals lacking `React.memo`: `AddSongModal.js`, `AddAlbumModal.js`, `CreatePlaylistModal.js`, `JamRoomModal.js`, `MiniMixerModal.js`, `SettingsModal.js`, `UserDetailModal.js`, `IntroAuthModal.js`, `TrackActionMenuModal.js`.
  - Heavy screens lacking `React.memo`: `OfflineScreen.js`, `QuranScreen.js`, `ProfileScreen.js`, `StatsScreen.js`, `AdminScreen.js`.
  - Even where `React.memo` was added (e.g. `HomeScreen.js`, `LibraryScreen.js`), unstable props and context re-render storms bypass the memoization.

### 3.4 Main-Thread I/O & AsyncStorage / FileSystem Debouncing
- **Severe Bottleneck in `src/native/services/downloadManager.js` (lines 765–810)**:
  - When downloading MP3 tracks, `downloadManager.js` executes `fastUint8ToBase64()`: it reads the entire multi-megabyte MP3 binary into JavaScript memory, builds an ID3 v2.3 tag in a JS Uint8Array, converts the entire multi-megabyte array to a Base64 string in JS, and writes it back using `FileSystem.writeAsStringAsync(fileUri, finalB64, { encoding: Base64 })`.
  - On low-spec devices (1.5GB RAM), converting 5MB–10MB binary data to Base64 in JavaScript freezes the JS thread for 2 to 5 seconds per song!
- **Violation in Manifest Persistence (`downloadManager.js:210–235`)**:
  - `commitToStorageAndManifest` serializes the full downloaded list to JSON (`JSON.stringify(list)`) and writes simultaneously to `AsyncStorage` and `FileSystem.writeAsStringAsync(MANIFEST_FILE, jsonStr)` without timer debouncing (minimum 3–5 seconds per AGENTS.md rule 4).
- **Violation in Virtualization (`OfflineScreen.js` & `ProfileScreen.js`)**:
  - `OfflineScreen.js` renders all downloaded vault tracks inside a non-virtualized `<ScrollView>`. If a user has 100+ downloaded tracks, hundreds of native views are instantiated simultaneously.
  - `ProfileScreen.js` renders liked tracks, history, and custom playlists inside `<ScrollView>` instead of `<FlatList>`.

### 3.5 Async Lifecycle & Request Cancellation
- **Audit Findings**:
  - **181 `fetch()` calls across the frontend lack an `AbortSignal`**.
  - In `src/native/screens/SearchScreen.js` (lines 136, 175): Live search typing fires API calls on every debounce interval without passing an `AbortSignal`. Rapid typing causes out-of-order responses and redundant bandwidth consumption.
  - In `App.js` (line 264): App version checking `/api/app/version` lacks `AbortSignal`.
  - In `src/native/context/UserContext.js` (line 182): Album fetch `/api/albums` lacks `AbortSignal`.

### 3.6 Backend Server Stability & Security
- **Critical CORS Reflection Vulnerability in `server/routes/tracks.js` (lines 1315–1320)**:
  - In `/api/tracks/stream-proxy`:
    ```javascript
    const clientOrigin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', clientOrigin);
    if (clientOrigin !== '*') {
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    ```
  - This dynamically reflects ANY incoming origin and enables credentials, bypassing the strict whitelist defined in `server/index.js` (lines 36–70).
- **System Command Execution via Unauthenticated / Webhook Routes (`server/index.js:471–521`)**:
  - `app.post('/api/deploy-webhook', ...)` executes `exec(deployCmd, { shell: '/bin/bash' })` containing raw shell commands (`git fetch`, `npm run build`, `cp -rf dist/* /home/ubuntu/dist/`).
  - Contains hardcoded production paths (`/home/ubuntu/dist/`, `/var/www/html/`, `/home/ubuntu/rivo/cookies.txt`).
- **Synchronous Subprocess Execution in Streaming Path (`server/utils/helpers.js:1583`)**:
  - Calls `execSync(`ffmpeg -v error -i ...`)` synchronously during stream processing, blocking the Node.js event loop.

---

## 4. Root Cause Analysis for Specific Bug Requirements

### 4.1 Cold Start Black Screen on 1.5GB RAM Android Devices (R3)
- **Root Cause Chain**:
  1. During cold boot, `App.js` mounts 7 nested Context Providers.
  2. `UserProvider` executes `loadStoredAuth()` which calls `Promise.all` on AsyncStorage keys, followed immediately by `setTimeout(..., 0)` parsing `CACHE_TRACKS_KEY` (containing up to 4,000 serialized tracks) and `CACHE_ALBUMS_KEY`.
  3. Simultaneously, `AudioProvider` boots and initializes `downloadManager.js` which performs FileSystem checks, reads `manifest.json`, and cleans legacy keys.
  4. Concurrently, `App.js` executes `cleanupOldApkInstallers()` performing directory scans on `cacheDirectory` and `documentDirectory`.
  5. The JavaScript thread on a 1.5GB RAM device is overwhelmed by heavy JSON parsing and asynchronous bridge I/O before the native frame can render, triggering Android's ActivityManager freeze / black screen ANR.

### 4.2 Bottom Navigation Responsiveness & Tab Freezes (R4)
- **Root Cause Chain**:
  1. `UserContext.js` invalidates its `useMemo` on every render due to 15 unmemoized function definitions.
  2. When the user taps a tab, `activeTab` updates in `App.js`, forcing a top-to-bottom re-render of all mounted screens.
  3. `visitedTabs` in `App.js` keeps all previously visited tabs mounted simultaneously in the DOM/native view hierarchy using `display: flex/none`.
  4. When switching to `OfflineScreen` or `LibraryScreen`, non-virtualized `ScrollView`s with hundreds of track rows must lay out and calculate heights.
  5. If music is playing, `FullPlayerModal` (kept mounted in the background by `MobileModals.js`) re-renders every 250ms on progress ticks, contending with the tab switch transition.

### 4.3 Cold Boot Content Layout Shifts & Flickering (R5)
- **Root Cause Pinpointed to Exact File and Lines**:
  - **File**: `src/native/screens/HomeScreen.js`, lines 69–92.
  - **Mechanism**:
    ```javascript
    const displayAlbums = useMemo(() => {
      const dbAlbums = (albums || []).filter((alb) => !isQuranContent(alb));
      if (dbAlbums.length > 0) return dbAlbums;

      // Fallback: Group from userTracks
      const map = new Map();
      (userTracks || []).forEach((t) => {
        ...
      });
      return Array.from(map.values()).slice(0, 16);
    }, [albums, userTracks]);
    ```
  - On initial render, `albums` is `[]` (server request in flight). `HomeScreen` falls back to grouping `userTracks` into pseudo-albums and renders them immediately.
  - 1–2 seconds later, `fetchPublicTracks()` receives the official albums array from `/api/albums`. `albums` state updates, causing `displayAlbums` to completely replace the grouped albums with database albums, violently shifting cards and layout.

### 4.4 Excessive Network Data Consumption (R6)
- **Root Cause Chain**:
  1. `server/routes/tracks.js` line 91 sets `.limit(4000)`. Every initial app launch downloads up to 4,000 track objects in one uncompressed response.
  2. `checkAppUpdates()` in `App.js` is fired on startup, on every resume from background (`AppState === 'active'`), and whenever user email changes.
  3. Every single track "like" or playlist modification calls `syncUserData()` which downloads the entire `/api/auth/me` user payload anew.
  4. Search inputs lack request cancellation (`AbortController`), so typing a 5-letter word triggers 4 redundant in-flight network requests that download full payloads before being discarded.

---

## 5. Specification Mining Tables

### 5.1 Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Architecture | 400-Line Modularization Ceiling | Mandatory split rule for files exceeding 400 lines across frontend and backend. | Source files in `src/`, `App.js`, `server/` | Modular hooks, services, sub-components (<400 lines) | Performance degradation, fragile regressions | `AGENTS.md` Rule 1 |
| 2 | Performance | High-Frequency State Isolation | Rapidly ticking audio states must reside in isolated contexts (`AudioProgressContext`). | `currentTime`, `duration`, download % | Ref-based listeners, isolated context providers | Re-render storm across entire component tree | `AGENTS.md` Rule 2; `AudioContext.js:32` |
| 3 | Performance | Context Provider Value Memoization | All context providers must wrap `value` in `useMemo` with stabilized callback dependencies. | State values, stabilized callbacks | Memoized context object reference | Re-renders child tree on every parent render | `AGENTS.md` Rule 2; `UserContext.js:558` |
| 4 | Performance | Virtualized List Rendering | Screen lists (vault, library, liked songs) must use virtualized `FlatList` with `keyExtractor`. | Arrays of tracks/albums/playlists | Virtualized windowed render tree | Out-of-memory, frame drops, tab freezes | `AGENTS.md` Rule 4; `OfflineScreen.js:8` |
| 5 | Storage & I/O | Main-Thread Storage Debouncing | Manifest and cache writes to `AsyncStorage` and `FileSystem` must be debounced (min 3–5s). | Track lists, download manifests | Asynchronously persisted file/storage records | UI thread freeze, audio stutter, ANR | `AGENTS.md` Rule 4; `downloadManager.js:210` |
| 6 | Networking | Async Request Cancellation | Every `fetch` and network query must accept and check `AbortSignal`. | HTTP requests, search queries | Cancelled in-flight requests | Race conditions, duplicate bandwidth usage | `AGENTS.md` Rule 3; `SearchScreen.js:136` |
| 7 | Security | Strict CORS & Backend Hardening | Restrict origin to official domains, prevent wildcard credentials reflection. | HTTP Origin header | `Access-Control-Allow-Origin: <whitelist>` | 403 Forbidden on untrusted origins | `AGENTS.md` Rule 5; `tracks.js:1315` |
| 8 | Mobile Boot | Cold Start Crash Guard | Guards against faulty OTA bundles on boot and rolls back if crashes exceed threshold. | Boot flag in AsyncStorage | Rolled back stock bundle or healthy flag | Clears bundle on 5 consecutive crashes | `otaService.js:55` |
| 9 | UI Navigation | Keep-Alive Tab Shell | Tab switching using `visitedTabs` Set and `display: flex/none` style toggles. | `activeTab` string | Preserved component states across tabs | Contends with JS thread if tabs are unoptimized | `App.js:976, 1082` |
| 10 | Content Rendering | Initial Boot Album Fallback | Dynamic grouping of user tracks into album cards when database albums are empty. | `albums`, `userTracks` arrays | Top 16 grouped album cards | Layout shift when database albums load | `HomeScreen.js:69–92` |

### 5.2 Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | `HomeScreen` Album Grouping | Cold start with empty `albums: []` followed by delayed API response | Renders fallback albums grouped from `userTracks`, then immediately flashes and shifts layout when `albums` arrives (`HomeScreen.js:70–92`). |
| 2 | `MobileModals` FullPlayer Lifecycle | Opening and closing `FullPlayerModal` once during session | Sets `hasMountedFullPlayerRef.current = true`. `FullPlayerModal` remains mounted permanently, re-rendering on every audio tick even while hidden (`MobileModals.js:88`). |
| 3 | `UserContext` Provider Value Memo | Any state change in `UserProvider` (e.g. auth check) | Recreates all 15 unstabilized function references, invalidating `useMemo` and triggering re-renders across all consumer components (`UserContext.js:558`). |
| 4 | `downloadManager` ID3 Embedding | Downloading an MP3 on 1.5GB RAM Android device | Executes `fastUint8ToBase64` in JavaScript thread, blocking main JS thread for several seconds and causing audio playback jitter (`downloadManager.js:777`). |
| 5 | `tracks/stream-proxy` CORS | Request from arbitrary third-party domain (e.g. `evil.com`) | Bypasses CORS whitelist and reflects `evil.com` with `Access-Control-Allow-Credentials: true` (`tracks.js:1315–1320`). |
| 6 | `SearchScreen` Live Query | Rapidly typing search characters (e.g. "Wegz") | Dispatches multiple fetches without `AbortSignal`. Later characters can resolve before earlier ones, resulting in stale search results (`SearchScreen.js:136`). |
| 7 | `OfflineScreen` Large Vault | User with 200+ downloaded tracks opening Vault tab | Instantiates 200+ native `<View>` rows inside `<ScrollView>`, causing severe frame drops and navigation lag (`OfflineScreen.js:2`). |
| 8 | `deploy-webhook` Route | HTTP POST to `/api/deploy-webhook` with valid secret | Executes synchronous shell commands via `child_process.exec` and forces process termination (`index.js:503, 518`). |

---

## 6. Actionable Recommendations for Implementation Pods

1. **Dead Code Elimination Pod**:
   - Permanently delete `src/native/screens/OnlineWebView.js`, `src/native/screens/MixesScreen.js`, `src/screens/MixesScreen.jsx`, `src/native/components/EqualizerModal.js`, `src/components/EqualizerModal.jsx`, `src/native/components/CachedImage.js`, `src/native/components/ModeToggle.js`, `src/native/ui/BrutalButton.js`.
   - Delete all 37 scripts in `rivo-main/scripts/archive/` and 66 unreferenced scripts in `rivo-main/scripts/`.
   - Remove abandoned sub-projects: `android-webview/`, `desktop-app/`, and delete `release-desktop/Rivo.exe` (118 MB) from git.
   - Delete redundant asset folders: `assets-ios/`, `ios_assets/`, and remove root bundles `ios_main.hermes.bundle` and `ios_main.jsbundle`.
2. **Architecture & Refactoring Pod**:
   - Split top monolithic files (`AudioContext.js`, `downloadManager.js`, `LibraryScreen.js`, `FullPlayerModal.js`, `App.js`, `tracks.js`, `helpers.js`) into sub-modules under 400 lines.
   - Wrap all 15 functions in `UserContext.js` and 9 functions in `SocketContext.js` with `useCallback()`.
   - Unmount `FullPlayerModal` when hidden instead of keeping it permanently mounted in `MobileModals.js`.
3. **Performance & Cold Start Pod**:
   - Fix R5: Remove the fallback grouped album generation in `HomeScreen.js:69–92` or seed `INITIAL_ALBUMS` stably so initial boot renders the exact same structure without layout shifting.
   - Fix R3: Defer non-critical startup tasks in `App.js` and `UserContext.js` (APK cleanup, version checks, full library sync) using `InteractionManager.runAfterInteractions` or requestIdleCallback.
   - Fix R4: Replace `<ScrollView>` in `OfflineScreen.js` and `ProfileScreen.js` with virtualized `<FlatList>`.
   - Offload or optimize ID3 tag writing in `downloadManager.js` to avoid main-thread Base64 encoding.
4. **Network & Backend Pod**:
   - Fix R6: Add pagination to `GET /api/tracks` or compress payload; add `AbortController` to all 181 frontend fetch calls.
   - Fix Security: Fix CORS header reflection in `/api/tracks/stream-proxy` (lines 1315–1320); remove hardcoded `/home/ubuntu` paths.
