## 2026-11-09T08:31:35Z
You are worker_issue3, an expert frontend and full-stack engineer.
Your task is to implement the genuine fix for Issue 3 (Requirement R4): Complete Podcasts Isolation and Navigation.

Authoritative User Request:
"Ensure Podcasts are strictly isolated from Music and Quran across both mobile and web. Opening podcast playlists must never display music or Quran playlists. Fix missing translation key `nav.podcastsLibrary` in the web navigation sidebar."

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

NEGATIVE CONSTRAINT:
The team must NOT: read test source code to understand expected behaviour before implementing.

ARCHITECTURAL BLUEPRINT & INVESTIGATION REPORT:
Read: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\explorer_issue3\handoff.md
Also read:
1. c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\ORIGINAL_REQUEST.md
2. c:\Users\mohamed\Downloads\rivo-main\AGENTS.md
3. c:\Users\mohamed\Downloads\rivo-main\PROJECT.md

EXCLUSIVE WRITE OWNERSHIP (You may ONLY edit these files):
- `src/native/i18n/translations/en/nav.js`
- `src/native/i18n/translations/ar/nav.js`
- `src/components/Navigation.jsx`
- `src/context/NavigationContext.jsx`
- Your working directory: `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue3\`

IMPLEMENTATION REQUIREMENTS:
1. `src/native/i18n/translations/en/nav.js` & `src/native/i18n/translations/ar/nav.js`:
   - Add `podcastsLibrary: 'Podcast Library'` to `en/nav.js`.
   - Add `podcastsLibrary: 'مكتبة البودكاست'` to `ar/nav.js`.
2. `src/components/Navigation.jsx`:
   - Fix playlist filtering logic so when `libraryMode === 'podcasts'`, it only displays podcast playlists and strictly excludes music and Quran playlists.
   - When `libraryMode === 'quran'`, display only Quran playlists.
   - When `libraryMode === 'music'`, display only secular music playlists (excluding Quran and Podcasts).
   - Fix liked count calculation in `Navigation.jsx` to respect the three-way isolation (`music`, `quran`, `podcasts`).
3. `src/context/NavigationContext.jsx`:
   - When selecting a podcast playlist, set or preserve `libraryMode = 'podcasts'`. Do NOT collapse podcast playlists into `libraryMode = 'music'`.
   - Ensure strict separation between music, quran, and podcasts across all playlist selection handlers.

VERIFICATION:
Create and run a local verification script (e.g. `scripts/verify_issue3_podcasts_nav.js`) asserting:
- `translate('en', 'nav.podcastsLibrary')` returns `'Podcast Library'`.
- `translate('ar', 'nav.podcastsLibrary')` returns `'مكتبة البودكاست'`.
- Playlist filtering with `libraryMode === 'podcasts'` displays only podcast playlists and 0 music/Quran playlists.
- Syntax check across all touched files (`node -c`).

OUTPUT:
Write your full implementation and test results to:
`c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue3\handoff.md`
Update your progress in `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue3\progress.md`
When complete, notify orchestrator (193c595c-a003-4225-a80b-3e8dcd945268) via send_message.
