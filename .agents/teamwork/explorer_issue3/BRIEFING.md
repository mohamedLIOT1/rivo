# BRIEFING — 2026-11-09T08:26:00Z

## Mission
Investigate and diagnose Issue 3 (Requirement R4): Complete Podcasts Isolation and Navigation across web and mobile, plus fix missing `nav.podcastsLibrary` translation key.

## 🔒 My Identity
- Archetype: explorer
- Roles: codebase investigation, synthesis
- Working directory: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\explorer_issue3\
- Original parent: 193c595c-a003-4225-a80b-3e8dcd945268
- Milestone: Issue 3 (Requirement R4) Investigation

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Integrity mode: demo. DO NOT CHEAT. All findings and proposed fixes must be genuine.
- The team must NOT read test source code to understand expected behaviour before implementing.
- You are READ-ONLY. Do not modify, create, or delete source code files or run mutating tests.
- Working directory: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\explorer_issue3\
- Respect AGENTS.md rules (no node_modules, dist, etc.).

## Current Parent
- Conversation ID: 193c595c-a003-4225-a80b-3e8dcd945268
- Updated: 2026-11-09T08:26:00Z

## Investigation State
- **Explored paths**:
  - `src/components/Navigation.jsx` (desktop and mobile navigation sidebar & playlist lists)
  - `src/native/i18n/translations/en/nav.js` and `ar/nav.js` (`nav.podcastsLibrary` translation keys)
  - `src/native/i18n/index.js` (fallback mechanism returning raw key)
  - `src/context/NavigationContext.jsx` (`libraryMode`, `handleSelectPlaylistView`, `navigateTo('playlist')`)
  - `src/components/ScreenRouter.jsx` (tracks injection to `PlaylistScreen` & back navigation)
  - `src/screens/PlaylistScreen.jsx` (liked tracks & playlist items filtering by `libraryMode`)
  - `src/screens/LibraryScreen.jsx` (tabs and playlist filtering in web library)
  - `src/native/screens/LibraryScreen.js` (mobile library playlists rendering)
  - `src/native/screens/HomeScreen.js` and `src/screens/HomeScreen.jsx` (music feed track filtering)
  - `src/components/settings/ContentPreferencesCard.jsx` (missing podcasts toggle)
  - `src/components/AppModals.jsx` (`AddToPlaylistModal`, `CreatePlaylistModal`)
  - `src/App.jsx` (`musicPlaylists`, `quranPlaylists`, `handleCreatePlaylist`)
  - `server/models/User.js` & `server/routes/playlists.js` (playlist schema & creation route)
- **Key findings**:
  1. `nav.podcastsLibrary` is completely missing from `en/nav.js` and `ar/nav.js`. The translation fallback in `src/native/i18n/index.js` returns the raw key `"nav.podcastsLibrary"`, which is truthy, bypassing the UI fallback `|| 'Podcast Library'` and rendering verbatim on screen.
  2. In `Navigation.jsx` line 86, playlists are filtered via `.filter(pl => isQuranContent(pl) === (libraryMode === 'quran'))`. In podcast mode, `libraryMode === 'quran'` is `false`. Because music playlists have `isQuranContent(pl) === false`, `false === false` is `true`, so all music playlists leak into the podcast sidebar!
  3. Opening a podcast playlist triggers `NavigationContext.jsx` lines 148 & 223: `const isQ = Boolean(pl.isQuran || isQuranContent(pl)); setLibraryMode(isQ ? 'quran' : 'music');`. Because a podcast playlist is not Quran, it forcibly overwrites `libraryMode` to `'music'`, destroying the podcast navigation context.
  4. In `PlaylistScreen.jsx` line 367, liked tracks are filtered by `libraryMode === 'quran' ? isQuranContent(t) : !isQuranContent(t)`. When `libraryMode === 'podcasts'`, `!isQuranContent(t)` returns all music songs instead of podcast episodes.
  5. In `LibraryScreen.jsx`, only 'music' and 'quran' tabs exist, and `musicPlaylists` bundles all `!isQuranContent` items including podcast playlists.
  6. In mobile `LibraryScreen.js`, all playlists are rendered together without any separation or mode filtering.
  7. `server/models/User.js` and `server/routes/playlists.js` do not store or accept `isPodcast: Boolean`.
  8. `ContentPreferencesCard.jsx` is missing the podcast toggle required by R9/R4.
- **Unexplored areas**: None remaining. All objectives and call chains thoroughly mapped.

## Key Decisions Made
- Fully documented root causes, evidence chains, 17 target files, and automated reproduction strategy. Ready to draft `handoff.md`.

## Artifact Index
- DISPATCH.md — Recorded dispatch message
- BRIEFING.md — Situational awareness and state
- progress.md — Heartbeat and step tracking
- handoff.md — Final comprehensive 5-component handoff report
