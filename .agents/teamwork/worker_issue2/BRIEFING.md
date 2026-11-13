# BRIEFING — 2026-11-09T08:47:00Z

## Mission
Implement the genuine fix for Issue 2 (Requirement R3): Offline Vault Playback, Filtering, and Dedicated Podcasts Tab.

## 🔒 My Identity
- Archetype: worker / implementer
- Roles: implementer, qa, specialist
- Working directory: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue2\
- Original parent: 193c595c-a003-4225-a80b-3e8dcd945268
- Milestone: Issue 2 Fix

## 🔒 Key Constraints
- DO NOT CHEAT: No hardcoding, no facade/dummy implementations, real state & logic.
- NEGATIVE CONSTRAINT: The team must NOT read test source code to understand expected behaviour before implementing.
- Exclusive write ownership:
  - `src/native/context/audio/streamResolverHelper.js`
  - `src/utils/quranUtils.js`
  - `src/native/screens/OfflineScreen.js`
  - `src/native/components/offline/OfflineHeroHeader.js`
  - `src/native/components/offline/OfflineTrackItem.js`
  - `src/native/screens/OfflineScreen.styles.js`
  - `src/native/i18n/translations/en/offline.js`
  - `src/native/i18n/translations/ar/offline.js`
  - Working directory: `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue2\`

## Current Parent
- Conversation ID: 193c595c-a003-4225-a80b-3e8dcd945268
- Updated: 2026-11-09T08:47:00Z

## Task Summary
- **What to build**:
  1. Fix offline track playback resolution in `streamResolverHelper.js`: fallback to `getDownloadedTracks()` by trackId if track has no `localAudioUri`, robust `verifyLocalAudioFile` handling raw absolute paths / SAF `content://` / percent-encoded paths, and remove destructive auto-heal routines that wipe metadata and delete local files on playback failure.
  2. Fix Quran vs secular filtering in `src/utils/quranUtils.js`: secular artist blacklist, secular genre / contentType rejection, fix regex false positive on common Arabic words like `البناء`.
  3. Add dedicated 4th tab 'podcasts' in `OfflineScreen.js` and components (`OfflineHeroHeader.js`, `OfflineTrackItem.js`), update styles & i18n (`en/offline.js`, `ar/offline.js`).
- **Success criteria**:
  - Offline songs play reliably without internet.
  - Secular artists (Cairokee, Lege-Cy, etc.) strictly excluded from Quran tab.
  - Podcasts cleanly isolated in dedicated tab.
  - Verification scripts and syntax checks pass.
- **Interface contracts**: Follow AGENTS.md, PROJECT.md, and explorer_issue2/handoff.md.

## Change Tracker
- **Files modified**:
  - `src/native/context/audio/streamResolverHelper.js`: Added manifest lookup fallback via `getDownloadedTracks()`, enhanced `verifyLocalAudioFile` to support raw absolute paths, SAF `content://` URIs, and percent-encoded paths; eliminated destructive storage record wiping and disk deletions.
  - `src/utils/quranUtils.js`: Added `SECULAR_ARTISTS` blacklist, `SECULAR_GENRES`, `isSecularArtist`, fixed `QURAN_REGEX` on `البناء`, and hardened `isQuranContent` to strictly reject secular artists and genres.
  - `src/native/screens/OfflineScreen.js`: Added 4th `'podcasts'` tab, `podcastCount`, mutually exclusive 3-way isolation (Music, Quran, Podcasts), podcasts empty state. Line count: 355 lines (<= 400).
  - `src/native/components/offline/OfflineHeroHeader.js`: Added 4th tab button for Podcasts with count. Line count: 254 lines (<= 400).
  - `src/native/components/offline/OfflineTrackItem.js`: Added purple `PODCAST` badge for podcast items. Line count: 147 lines (<= 400).
  - `src/native/screens/OfflineScreen.styles.js`: Adjusted `folderTabBar` gap, padding, and text font size for 4-button responsive layout.
  - `src/native/i18n/translations/en/offline.js`: Added podcast tab, empty state, and badge strings.
  - `src/native/i18n/translations/ar/offline.js`: Added podcast tab, empty state, and badge strings.
- **Build status**: All 8 files pass `node -c` syntax check.
- **Pending issues**: None.

## Quality Status
- **Build/test result**: Pass (all 6 test suites in `verify_issue2_offline.cjs` passed with 100% success).
- **Lint status**: Clean.
- **Tests added/modified**: `verify_issue2_offline.cjs` covering line limits, secular artist exclusion, vault tab isolation, manifest fallback, i18n keys, and functional mock resolution.

## Loaded Skills
- None requested specifically in dispatch.

## Key Decisions Made
- Excluded secular artists even if `isQuran: true` was corrupted.
- Removed destructive local file deletion and record wiping on playback errors.
- Kept all components strictly under 400 lines adhering to AGENTS.md.

## Artifact Index
- `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue2\DISPATCH.md` — Dispatch prompt
- `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue2\BRIEFING.md` — Situational awareness
- `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue2\progress.md` — Liveness heartbeat
- `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue2\verify_issue2_offline.cjs` — Verification test suite
- `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue2\handoff.md` — Final handoff report
