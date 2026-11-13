## 2026-11-04T20:21:34Z
You are Subagent worker_m1_1, the Dead Code Cleanup Specialist.
Your Working Directory: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_m1_1\
Target Codebase Directory: c:\Users\mohamed\Downloads\rivo-main\rivo-main

MANDATORY FIRST STEP:
Read c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\ORIGINAL_REQUEST.md, c:\Users\mohamed\Downloads\rivo-main\PROJECT.md, and c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\spec_miner_survey_1\survey_spec.md before starting work.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You own dead code deletion and obsolete script/subproject removal. Do NOT edit live feature code in AudioContext, UserContext, or screens that are assigned to subsequent milestones, except removing dead imports for deleted files. NOTE: Do NOT delete CachedImage.js (it will be integrated in Milestone 6).

MISSION (Milestone 1: Dead Code Elimination & Repository Cleanup):
1. Permanently delete confirmed dead components:
   - src/native/screens/OnlineWebView.js
   - src/screens/MixesScreen.jsx
   - src/native/screens/MixesScreen.js
   - src/components/EqualizerModal.jsx
   - src/native/components/EqualizerModal.js
   - src/native/components/ModeToggle.js
   - src/native/ui/BrutalButton.js
2. Permanently delete obsolete script archives and unreferenced scripts:
   - rivo-main/scripts/archive/ (all 37 files)
   - Unreferenced scripts in rivo-main/scripts/ (keep only active build/bench scripts: e.g. generate_splash.ps1, publish-ota.js, benchmark_fallbacks.py; DO NOT touch root verification scripts: benchmark_playback.py, test_stream_proxy.py, verify_duckdns_playback.py, test_duckdns_timeout.py).
3. Permanently delete abandoned subprojects and binary bloat:
   - rivo-main/android-webview/
   - rivo-main/desktop-app/
   - rivo-main/release-desktop/Rivo.exe
   - rivo-main/ios_main.hermes.bundle
   - rivo-main/ios_main.jsbundle
   - rivo-main/assets-ios/
   - rivo-main/ios_assets/
   - rivo-main/assets/assets/assets/
4. Clean any unused import statements in src/App.jsx, App.js, or package.json referencing deleted files.
5. Verify repository build and syntax:
   - Run syntax/lint checks on modified files to verify no broken imports or runtime syntax errors.
6. Write your structured handoff report in:
   c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_m1_1\handoff.md
7. Update progress.md in your working directory.
8. Send a completion message via send_message to Recipient="8cd4123f-4f86-489e-a96c-a775446c7867" when finished.
