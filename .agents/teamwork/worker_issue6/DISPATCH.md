## 2026-11-09T08:32:04Z
You are worker_issue6, an expert recommendation algorithms engineer.
Your task is to implement the genuine fix for Issue 6 (Requirement R7): Queue AI Suggestions Relevance.

Authoritative User Request:
"Fix the AI queue suggestion algorithm to ensure recommended next tracks strictly adhere to user listening history, language, and preferences, preventing out-of-context or irrelevant genres (such as unsolicited Hindi music)."

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

NEGATIVE CONSTRAINT:
The team must NOT: read test source code to understand expected behaviour before implementing.

ARCHITECTURAL BLUEPRINT & INVESTIGATION REPORT:
Read: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\explorer_issue6\handoff.md
Also read:
1. c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\ORIGINAL_REQUEST.md
2. c:\Users\mohamed\Downloads\rivo-main\AGENTS.md
3. c:\Users\mohamed\Downloads\rivo-main\PROJECT.md

EXCLUSIVE WRITE OWNERSHIP (You may ONLY edit these files):
- `src/utils/tasteAlgorithm.js`
- `src/native/utils/tasteAlgorithm.js`
- Your working directory: `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue6\`

IMPLEMENTATION REQUIREMENTS:
1. `src/utils/tasteAlgorithm.js` & `src/native/utils/tasteAlgorithm.js`:
   - Eliminate massive random jitter: replace `Math.random() * 55 + Math.random() * 15` (up to 70 pts) with controlled `Math.random() * 5` so user affinity signals (+15 to +32 pts) actually dictate the suggestions.
   - Script & Language Filter: inspect Devanagari/Indic scripts (`[\u0900-\u097F]`), Punjabi, Telugu, Tamil, and known Indic artists. If user listening history or language preferences do not contain Indian/Indic tracks, apply a strict negative penalty (-300 pts) to prevent unsolicited Hindi music from appearing in the queue.
   - Add Genre Compatibility Matrix and penalties (-50 to -60 pts) for out-of-context conflicting genres.
   - Preserve genuine user language, artist affinity, and recent track context.

VERIFICATION:
Create and run a local verification script (e.g. `scripts/verify_issue6_queue_relevance.js`) asserting:
- Queue suggestions for an Arabic/English music listener strictly contain relevant tracks and contain ZERO unsolicited Hindi/Indic tracks.
- When an active queue is playing Arabic Pop, next suggestions match the language/genre profile.
- Syntax check across all touched files (`node -c`).

OUTPUT:
Write your full implementation and test results to:
`c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue6\handoff.md`
Update your progress in `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue6\progress.md`
When complete, notify orchestrator (193c595c-a003-4225-a80b-3e8dcd945268) via send_message.
