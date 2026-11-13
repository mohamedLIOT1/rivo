## 2026-11-09T08:31:19Z
You are worker_issue2, an expert mobile and full-stack engineer.
Your task is to implement the genuine fix for Issue 2 (Requirement R3): Offline Vault Playback, Filtering, and Dedicated Podcasts Tab.

Authoritative User Request:
"Resolve the offline playback error ('Playback error: Offline song file is missing or damaged, and device is offline') ensuring cached/downloaded files play reliably without internet. Correct category filtering so secular artists (e.g. Cairokee, Lege-Cy) never appear in the Quran tab. Add a dedicated, isolated Podcasts section within the Offline Vault."

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

NEGATIVE CONSTRAINT:
The team must NOT: read test source code to understand expected behaviour before implementing.

ARCHITECTURAL BLUEPRINT & INVESTIGATION REPORT:
Read: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\explorer_issue2\handoff.md
Also read:
1. c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\ORIGINAL_REQUEST.md
2. c:\Users\mohamed\Downloads\rivo-main\AGENTS.md
3. c:\Users\mohamed\Downloads\rivo-main\PROJECT.md

EXCLUSIVE WRITE OWNERSHIP (You may ONLY edit these files):
- `src/native/context/audio/streamResolverHelper.js`
- `src/utils/quranUtils.js`
- `src/native/screens/OfflineScreen.js`
- `src/native/components/offline/OfflineHeroHeader.js`
- `src/native/components/offline/OfflineTrackItem.js`
- `src/native/screens/OfflineScreen.styles.js`
- `src/native/i18n/translations/en/offline.js`
- `src/native/i18n/translations/ar/offline.js`
- Your working directory: `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue2\`

IMPLEMENTATION REQUIREMENTS:
1. `src/native/context/audio/streamResolverHelper.js`:
   - Add offline storage manifest fallback: when resolving a track lacking `localAudioUri`, look up `getDownloadedTracks()` by trackId.
   - Fix file verification in `verifyLocalAudioFile`: support raw absolute paths, Android SAF URIs (`content://`), and normalize percent-encoded paths before checking existence.
   - Remove destructive "auto-heal" routines that wipe storage records (lines 116–123) and delete local files on disk (line 184) upon playback exceptions.
2. `src/utils/quranUtils.js`:
   - In `isQuranContent`, add a secular artist blacklist (e.g. `Cairokee`, `Lege-Cy`, `Marwan Pablo`, `Wegz`, `Amr Diab`, `Tamer Hosny`, `Hamaki`, `Sharmoofers`, etc.) to reject secular tracks even if marked `isQuran: true`.
   - Reject tracks with secular genres (rap, pop, rock, mahraganat, shaabi) or `contentType === 'music'`.
   - Fix `QURAN_REGEX` regex so common words like `البناء` do not false-positive.
3. `src/native/screens/OfflineScreen.js` & `src/native/components/offline/*`:
   - Add a 4th dedicated tab `'podcasts'` alongside `'all'`, `'music'`, `'quran'`.
   - Isolate `displayedTracks`: 'quran' displays only authentic Quran tracks; 'podcasts' displays only podcast tracks; 'music' excludes both Quran and Podcasts.
   - Update `OfflineHeroHeader.js` to render the Podcasts tab button and dynamic count.
   - Update `OfflineTrackItem.js` to show a `PODCAST` badge when appropriate.
   - Add localized strings for the podcasts tab in `en/offline.js` and `ar/offline.js`.

VERIFICATION:
Create and run a local verification script (e.g. `scripts/verify_issue2_offline.js`) verifying:
- Offline track resolution succeeds when offline.
- Cairokee, Lege-Cy, and secular artists are strictly excluded from Quran filtering.
- Podcasts tab filtering isolates podcast episodes cleanly.
- Syntax check across all touched files (`node -c`).

OUTPUT:
Write your full implementation and test results to:
`c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue2\handoff.md`
Update your progress in `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue2\progress.md`
When complete, notify orchestrator (193c595c-a003-4225-a80b-3e8dcd945268) via send_message.
