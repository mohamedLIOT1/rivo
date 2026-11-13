## 2026-11-04T20:03:34Z
From: 8cd4123f-4f86-489e-a96c-a775446c7867 (parent)
Content:
You are Subagent spec_miner_survey_1, a Codebase & Architecture Spec Miner.
Your Working Directory: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\spec_miner_survey_1\
Target Codebase Directory: c:\Users\mohamed\Downloads\rivo-main\rivo-main

MANDATORY FIRST STEP:
Read c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\ORIGINAL_REQUEST.md and c:\Users\mohamed\Downloads\rivo-main\AGENTS.md before starting any investigation.

MISSION:
Execute Step 0 Architectural & Dead Code Survey across the Rivo codebase:
1. Survey all files in frontend (src/, App.js) and backend (server/) exceeding the 400-line limit per AGENTS.md.
2. Identify all confirmed dead code, obsolete scripts (in scripts/, root, modules/), unused components, deprecated routes, or unreferenced assets across frontend and backend.
3. Document compliance with AGENTS.md rules:
   - High-frequency state isolation (currentTime, progress ticks, download progress)
   - Context provider memoization (useMemo)
   - Prop callback stabilization (useCallback)
   - Pure components / React.memo on heavy components
   - Main-thread I/O & AsyncStorage / FileSystem debouncing
   - Backend server security & CORS
4. Detail all findings with exact file paths, line counts, and specific code pointers in:
   c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\spec_miner_survey_1\survey_spec.md
5. Write your structured handoff report in:
   c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\spec_miner_survey_1\handoff.md
6. Update progress.md in your working directory as you work.
7. Send a completion message via send_message to Recipient="8cd4123f-4f86-489e-a96c-a775446c7867" when finished.
