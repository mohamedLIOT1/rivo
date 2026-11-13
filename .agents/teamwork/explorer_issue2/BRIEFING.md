# BRIEFING — 2026-11-09T08:26:45Z

## Mission
Investigate and diagnose Issue 2 (Requirement R3): Offline Vault Playback, Filtering, and Dedicated Podcasts Tab.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\explorer_issue2
- Original parent: 193c595c-a003-4225-a80b-3e8dcd945268
- Milestone: Issue 2 Investigation

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Integrity mode: demo. DO NOT CHEAT.
- Do NOT read test source code to understand expected behaviour.
- Write only to own directory (.agents/teamwork/explorer_issue2/).
- Respect AGENTS.md performance and architectural rules (never search node_modules, dist, etc.).

## Current Parent
- Conversation ID: 193c595c-a003-4225-a80b-3e8dcd945268
- Updated: 2026-11-09T08:15:09Z

## Investigation State
- **Explored paths**:
  - `src/native/context/audio/streamResolverHelper.js`
  - `src/native/context/audio/useAudioPlaybackCore.js`
  - `src/native/context/audio/useAudioDownloads.js`
  - `src/native/services/download/storageManifestService.js`
  - `src/native/services/download/deviceVaultService.js`
  - `src/native/services/downloadManager.js`
  - `src/native/screens/OfflineScreen.js`
  - `src/native/screens/OfflineScreen.styles.js`
  - `src/native/components/offline/OfflineHeroHeader.js`
  - `src/native/components/offline/OfflineTrackItem.js`
  - `src/native/hooks/useOfflineOperations.js`
  - `src/utils/quranUtils.js`
  - `src/native/utils/podcastUtils.js`
  - `src/native/utils/genreClassifier.js`
  - `server/utils/quranUtils.js`
  - `server/utils/genreClassifier.js`
  - `src/native/i18n/translations/en/offline.js`
  - `src/native/i18n/translations/ar/offline.js`
- **Key findings**:
  1. Offline playback error originates at `streamResolverHelper.js:131`: occurs because `resolveTrackPlaybackUri` fails to look up tracks in `getDownloadedTracks()` when played from library/playlists without explicit `localAudioUri`, rejects valid local paths not starting with `file://`, and contains destructive auto-wipe logic at line 116 & line 184 that deletes files and wipes records.
  2. Secular artists (Cairokee, Lege-Cy) appear in Quran tab because `isQuranContent` (`src/utils/quranUtils.js:252`) blindly honors `item.isQuran === true` and regex matches on descriptions without a secular artist blocklist.
  3. Offline Vault lacks a dedicated Podcasts tab in `OfflineScreen.js` and `OfflineHeroHeader.js`.
- **Unexplored areas**: None. All 3 requirement facets fully diagnosed.

## Key Decisions Made
- Confirmed exact lines of code causing failure and proposed precise, non-destructive architecture fixes.
- Identified strict secular artist blocklist and genre validation to be added to `isQuranContent`.
- Designed 4-tab vault layout with dedicated, isolated Podcasts section and item badge.

## Artifact Index
- DISPATCH.md — Dispatch log
- BRIEFING.md — Situational awareness
- progress.md — Liveness & heartbeat
- handoff.md — Final investigation report
