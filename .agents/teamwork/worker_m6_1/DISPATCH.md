## 2026-11-04T20:59:30Z
You are worker_m6_1, a high-precision backend and networking performance engineer.
Your Working Directory: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_m6_1\
Mandatory inputs to read before starting:
1. `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\ORIGINAL_REQUEST.md`
2. `c:\Users\mohamed\Downloads\rivo-main\PROJECT.md`
3. `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\explorer_survey_3\survey_navigation_network.md`
4. `c:\Users\mohamed\Downloads\rivo-main\AGENTS.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Assigned Milestone:
Milestone M6: Network Data Consumption Optimization (Requirement R6).
Target: Minimize application runtime network data usage by reducing redundant API calls, preventing duplicate fetches, enforcing caching strategies (ETag / 304 / Cache-Control), and optimizing payload transfers (gzip compression).

Your Exclusive File Ownership:
- `c:\Users\mohamed\Downloads\rivo-main\rivo-main\server\index.js`
- `c:\Users\mohamed\Downloads\rivo-main\rivo-main\server\routes\albums.js`
- `c:\Users\mohamed\Downloads\rivo-main\rivo-main\server\package.json`
- `c:\Users\mohamed\Downloads\rivo-main\rivo-main\src\native\components\CachedImage.js`
- `c:\Users\mohamed\Downloads\rivo-main\rivo-main\src\native\context\SocketContext.js`

Technical Tasks:
1. In `server/index.js` and `server/package.json`:
   Add `compression` middleware so all REST JSON responses are gzipped, dramatically slashing network bandwidth.
2. In `server/routes/albums.js` and `server/index.js`:
   Implement standard HTTP caching with `Cache-Control: public, max-age=300` and ETag generation supporting `If-None-Match` returning `304 Not Modified` when content has not changed.
3. In `src/native/components/CachedImage.js`:
   Ensure local filesystem disk cache is verified before triggering any remote image fetch.
4. In `src/native/context/SocketContext.js`:
   Debounce socket reconnect events and duplicate catalog queries to prevent polling storms.
5. Adhere to AGENTS.md rule 3 (request cancellation & AbortSignal) and rule 5 (backend stability & security).

Verification Requirements:
- Run `python scripts/run_e2e_tests.py` from `c:\Users\mohamed\Downloads\rivo-main\rivo-main` and verify that all test tiers pass without regressions.
- Update `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_m6_1\progress.md` continuously.
- Deliver `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_m6_1\handoff.md` with:
  - Observation: Files modified and exact changes made.
  - Logic Chain: Measured network data and request reduction.
  - Verification: Test command execution logs and results.
- Send a message back to parent when completed.
