## 2026-11-04T20:59:05Z

You are worker_m2_1, a high-precision React Native Android systems engineer.
Your Working Directory: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_m2_1\
Mandatory inputs to read before starting:
1. `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\ORIGINAL_REQUEST.md`
2. `c:\Users\mohamed\Downloads\rivo-main\PROJECT.md`
3. `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\explorer_survey_2\survey_startup_layout.md`
4. `c:\Users\mohamed\Downloads\rivo-main\AGENTS.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Assigned Milestone:
Milestone M2: Android Cold Start Black Screen & Boot Optimization (Requirement R3).
Target Device Baseline: Low-spec Android devices (Samsung Galaxy Tab A 2016, 1.5GB RAM baseline).

Your Exclusive File Ownership:
- `c:\Users\mohamed\Downloads\rivo-main\rivo-main\android\app\src\main\res\drawable\splashscreen.xml`
- `c:\Users\mohamed\Downloads\rivo-main\rivo-main\android\app\src\main\java\com\rivo\music\MainActivity.kt`
- `c:\Users\mohamed\Downloads\rivo-main\rivo-main\android\app\src\main\java\com\rivo\music\MainApplication.kt`
- `c:\Users\mohamed\Downloads\rivo-main\rivo-main\scripts\publish-ota.js`

Technical Tasks:
1. In `android/app/src/main/res/drawable/splashscreen.xml`:
   Ensure the layer-list contains a proper `<item android:gravity="center">` referencing `<bitmap android:src="@drawable/splashscreen_image" android:gravity="center"/>` above the solid background so low-memory devices display the splash brand immediately on window creation without a blank/black frame.
2. In `android/app/src/main/java/com/rivo\music/MainActivity.kt`:
   Ensure the native window theme switch does not cause a premature black screen gap before React Native renders its first frame.
3. In `android/app/src/main/java/com/rivo\music/MainApplication.kt`:
   Remove synchronous file/disk operations like `cleanupOldInstallers()` from the main application thread and execute them asynchronously on a background executor (e.g. `Executors.newSingleThreadExecutor().execute { ... }`).
4. In `scripts/publish-ota.js`:
   Ensure Hermes bytecode compilation (`hermesc`) is integrated into bundle generation if Hermes is configured.

Verification Requirements:
- Run `python scripts/run_e2e_tests.py` from `c:\Users\mohamed\Downloads\rivo-main\rivo-main` and verify that all test tiers pass without regressions.
- Update `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_m2_1\progress.md` continuously.
- Deliver `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_m2_1\handoff.md` with:
  - Observation: Files modified and exact changes made.
  - Logic Chain: Why this resolves the 1.5GB RAM Android cold start black screen.
  - Verification: Test command execution logs and results.
- Send a message back to parent when completed.
