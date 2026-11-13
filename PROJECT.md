# Project: Rivo 9-Issue Parallel Resolution & Hardening

## Architecture
- **Overview**: Rivo cross-platform streaming audio client (React Native mobile, React web, Tauri desktop) and Express/Node.js backend.
- **Frontend Layer**:
  - `src/native/`: React Native mobile client layer (screens, components, contexts, audio engine).
  - `src/`: React Web client layer (components, screens, contexts, routers).
- **Backend Layer**:
  - `server/`: Express REST API and Socket.IO engine (routes, services, utilities, models).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | AI Recommendations Refresh & Responsive Addition | Exclude previous tracks, randomize candidate selection, optimistic track addition without blocking waterfall | M1 (Issue 1 / R2) | explorer_issue1 |
| 2 | Offline Vault Playback, Quran Isolation & Podcasts Tab | Offline storage manifest lookup, protocol fix, Cairokee/Lege-Cy secular exclusion from Quran, dedicated Podcasts tab | M2 (Issue 2 / R3) | explorer_issue2 |
| 3 | Complete Podcasts Isolation & Web Nav Translation | `nav.podcastsLibrary` translation keys in en/ar, playlist type isolation in Navigation.jsx and NavigationContext | M3 (Issue 3 / R4) | explorer_issue3 |
| 4 | Mobile DJ Mix Controls & Professional UX Overhaul | Modularize <400 lines into `components/mixer/`, PanResponder pageX touch sliders, fix audio leaks & crossfade curves | M4 (Issue 4 / R5) | explorer_issue4 |
| 5 | Playback Startup Latency & Stream Optimization | Remove synchronous `execFileSync` event-loop blocks, eliminate mock cookies sabotage, fix proxy 403 caching | M5 (Issue 5 / R6) | explorer_issue5 |
| 6 | Queue AI Suggestions Relevance | Eliminate +70 random jitter, enforce Indic script filter (-300 penalty for unsolicited Hindi), genre compatibility | M6 (Issue 6 / R7) | explorer_issue6 |
| 7 | Genre and Tag Classification Accuracy | Enforce word boundaries for needles >3 (fix 'تراب' trap bug), remove Rap/Shaabi priority 90 bias, 18-genre taxonomy | M7 (Issue 7 / R8) | explorer_issue7 |
| 8 | Web Content Preferences Podcast Toggle | Add Podcasts toggle to ContentPreferencesCard.jsx, create ContentPreferencesModal.jsx, guard ScreenRouter.jsx | M8 (Issue 8 / R9) | explorer_issue8 |
| 9 | Listening Activity & Real-Time Stats Calculation | Mobile playback listening sync, fix weekly vs total seconds in leaderboard, eliminate fake top tracks & fake activity | M9 (Issue 9 / R10) | explorer_issue9 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | AI Recommendations Refresh & Performance (R2) | `recommendationService.js`, `ai.js`, `UserContext.js`, `LibraryScreen.js`, `PlaylistScreen.jsx`, `App.jsx` | none | IN_PROGRESS |
| M2 | Offline Vault Playback, Filtering & Podcasts Tab (R3) | `streamResolverHelper.js`, `quranUtils.js`, `OfflineScreen.js`, `OfflineHeroHeader.js`, `OfflineTrackItem.js` | none | IN_PROGRESS |
| M3 | Complete Podcasts Isolation and Navigation (R4) | `en/nav.js`, `ar/nav.js`, `Navigation.jsx`, `NavigationContext.jsx`, `server/routes/playlists.js` | none | IN_PROGRESS |
| M4 | Mobile DJ Mix Controls & UX Overhaul (R5) | `MiniMixerModal.js`, `components/mixer/*`, `playbackEngine.js`, `musicAnalysis.js` | none | IN_PROGRESS |
| M5 | Playback Startup Latency & Stream Optimization (R6) | `audioCacheUtils.js`, `streamFallbackProvider.js`, `tracks.js`, `youtubeStreamResolver.js`, `AudioContext.jsx` | none | IN_PROGRESS |
| M6 | Queue AI Suggestions Relevance (R7) | `src/utils/tasteAlgorithm.js`, `src/native/utils/tasteAlgorithm.js` | none | IN_PROGRESS |
| M7 | Genre and Tag Classification Accuracy (R8) | `genreClassifier.js`, `genreRules/*`, `genreClassifier.js` (client/native), `tracks*Router.js` | none | IN_PROGRESS |
| M8 | Web Content Preferences Podcast Toggle (R9) | `ContentPreferencesCard.jsx`, `ContentPreferencesModal.jsx`, `ScreenRouter.jsx`, `settings.js` translations | none | IN_PROGRESS |
| M9 | Listening Activity & Real-Time Stats Calculation (R10) | `audioApiHelpers.js`, `StatsScreen.jsx`, `listeningTracker.js`, `stats.js`, `listeningActivityService.js` | none | IN_PROGRESS |

## Exclusive Write Ownership
- **M1 (worker_issue1)**:
  - `server/routes/ai/recommendationService.js`
  - `server/routes/ai.js`
  - `src/native/context/UserContext.js`
  - `src/native/screens/LibraryScreen.js`
  - `src/screens/PlaylistScreen.jsx`
  - `src/App.jsx`
- **M2 (worker_issue2)**:
  - `src/native/context/audio/streamResolverHelper.js`
  - `src/utils/quranUtils.js`
  - `src/native/screens/OfflineScreen.js`
  - `src/native/components/offline/OfflineHeroHeader.js`
  - `src/native/components/offline/OfflineTrackItem.js`
  - `src/native/screens/OfflineScreen.styles.js`
  - `src/native/i18n/translations/en/offline.js`
  - `src/native/i18n/translations/ar/offline.js`
- **M3 (worker_issue3)**:
  - `src/native/i18n/translations/en/nav.js`
  - `src/native/i18n/translations/ar/nav.js`
  - `src/components/Navigation.jsx`
  - `src/context/NavigationContext.jsx`
- **M4 (worker_issue4)**:
  - `src/native/components/MiniMixerModal.js`
  - `src/native/components/mixer/miniMixerStyles.js`
  - `src/native/components/mixer/TouchSlider.js`
  - `src/native/components/mixer/WaveformCueBox.js`
  - `src/native/components/mixer/CrossfaderCurveGraph.js`
  - `src/native/components/mixer/DeckCard.js`
  - `src/native/components/mixer/TransitionStylePicker.js`
  - `src/native/components/mixer/useMixerAudition.js`
  - `src/native/context/audio/playbackEngine.js`
  - `src/native/utils/musicAnalysis.js`
- **M5 (worker_issue5)**:
  - `server/utils/audioCacheUtils.js`
  - `server/utils/streamFallbackProvider.js`
  - `server/routes/tracks.js`
  - `server/utils/youtubeStreamResolver.js`
  - `src/context/AudioContext.jsx`
- **M6 (worker_issue6)**:
  - `src/utils/tasteAlgorithm.js`
  - `src/native/utils/tasteAlgorithm.js`
- **M7 (worker_issue7)**:
  - `server/utils/genreClassifier.js`
  - `server/utils/genreRules/genreDefinitions.js`
  - `server/utils/genreRules/textNormalizer.js`
  - `src/utils/genreClassifier.js`
  - `src/native/utils/genreClassifier.js`
  - `server/routes/tracks/tracksImportRouter.js`
  - `server/routes/tracks/tracksPersistenceRouter.js`
  - `server/routes/tracks/tracksResolutionRouter.js`
- **M8 (worker_issue8)**:
  - `src/components/settings/ContentPreferencesCard.jsx`
  - `src/components/ContentPreferencesModal.jsx`
  - `src/components/ScreenRouter.jsx`
  - `src/native/i18n/translations/en/settings.js`
  - `src/native/i18n/translations/ar/settings.js`
- **M9 (worker_issue9)**:
  - `src/native/context/audio/audioApiHelpers.js`
  - `src/screens/StatsScreen.jsx`
  - `src/utils/listeningTracker.js`
  - `server/routes/stats.js`
  - `server/services/listeningActivityService.js`
