## 2026-11-04T20:59:21Z
You are worker_m4_1, a high-precision React Native performance and list virtualization engineer.
Your Working Directory: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_m4_1\
Mandatory inputs to read before starting:
1. `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\ORIGINAL_REQUEST.md`
2. `c:\Users\mohamed\Downloads\rivo-main\PROJECT.md`
3. `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\explorer_survey_3\survey_navigation_network.md`
4. `c:\Users\mohamed\Downloads\rivo-main\AGENTS.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Assigned Milestone:
Milestone M4: Bottom Navigation Responsiveness & Virtualization (Requirement R4).
Target: Eliminate lag, freezes, and sluggishness when switching between bottom navigation tabs (Music, Quran, Playlists, Vault), ensuring immediate and fluid transitions.

Your Exclusive File Ownership:
- `c:\Users\mohamed\Downloads\rivo-main\rivo-main\src\native\screens\QuranScreen.js`
- `c:\Users\mohamed\Downloads\rivo-main\rivo-main\src\native\screens\OfflineScreen.js`
- `c:\Users\mohamed\Downloads\rivo-main\rivo-main\src\native\screens\ProfileScreen.js`
- `c:\Users\mohamed\Downloads\rivo-main\rivo-main\src\native\screens\StatsScreen.js`

Technical Tasks:
1. In `QuranScreen.js`:
   Migrate heavy non-virtualized lists from `<ScrollView>` to `<FlatList>` with optimized windowing (`windowSize={5}`, `initialNumToRender={10}`, `maxToRenderPerBatch={10}`, `removeClippedSubviews={true}`).
   Wrap component in `React.memo` to avoid re-renders when other tabs or playback updates occur.
2. In `OfflineScreen.js`:
   Virtualize track/album lists using `<FlatList>` with memoized item renderers. Wrap component in `React.memo`.
3. In `ProfileScreen.js` and `StatsScreen.js`:
   Wrap in `React.memo` and stabilize callbacks to ensure zero unnecessary re-renders when navigation tabs change.
4. Adhere strictly to AGENTS.md rules (rule 2 Context/State isolation, rule 4 FlatList virtualization).

Verification Requirements:
- Run `python scripts/run_e2e_tests.py` from `c:\Users\mohamed\Downloads\rivo-main\rivo-main` and verify that all test tiers pass without regressions.
- Update `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_m4_1\progress.md` continuously.
- Deliver `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_m4_1\handoff.md` with:
  - Observation: Files modified and exact changes made.
  - Logic Chain: Why this guarantees 60fps bottom navigation switching.
  - Verification: Test command execution logs and results.
- Send a message back to parent when completed.
