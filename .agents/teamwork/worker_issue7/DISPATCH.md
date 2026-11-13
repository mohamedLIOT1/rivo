## 2026-11-09T08:32:15Z
You are worker_issue7, an expert metadata and classification algorithms engineer.
Your task is to implement the genuine fix for Issue 7 (Requirement R8): Genre and Tag Classification Accuracy.

Authoritative User Request:
"Correct the music classification and tagging pipeline so songs are accurately categorized into their proper genres, preventing over-generalization where diverse tracks are erroneously labeled solely as rap or pop."

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

NEGATIVE CONSTRAINT:
The team must NOT: read test source code to understand expected behaviour before implementing.

ARCHITECTURAL BLUEPRINT & INVESTIGATION REPORT:
Read: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\explorer_issue7\handoff.md
Also read:
1. c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\ORIGINAL_REQUEST.md
2. c:\Users\mohamed\Downloads\rivo-main\AGENTS.md
3. c:\Users\mohamed\Downloads\rivo-main\PROJECT.md

EXCLUSIVE WRITE OWNERSHIP (You may ONLY edit these files):
- `server/utils/genreClassifier.js`
- `server/utils/genreRules/genreDefinitions.js`
- `server/utils/genreRules/textNormalizer.js`
- `src/utils/genreClassifier.js`
- `src/native/utils/genreClassifier.js`
- `server/routes/tracks/tracksImportRouter.js`
- `server/routes/tracks/tracksPersistenceRouter.js`
- `server/routes/tracks/tracksResolutionRouter.js`
- Your working directory: `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue7\`

IMPLEMENTATION REQUIREMENTS:
1. `server/utils/genreRules/textNormalizer.js`:
   - Fix `matchesPattern`: for all needles (including length > 3), enforce word boundary matching instead of raw substring `includes()`.
   - Prevent Arabic needles like `'تراب'` (Trap) from matching words like `"اقتراب"` (coming closer) or `"اغتراب"` (exile).
   - Prevent English needles like `'trap'`, `'diss'`, `'drill'`, `'bars'`, `'santa'`, `'flex'` from matching `"trapped"`, `"dissolve"`, `"mandrill"`, `"santana"`, `"flexible"`.
2. `server/utils/genreClassifier.js`:
   - Remove artificial priority 90 boost for RAP and SHAABI (equalize to standard priority 80/70, so specific genre terms take precedence by length and specificity).
   - In Step 5 (artist title search), restrict matching to unambiguous multi-word stage names or strict word boundaries; do not match common nouns ("future", "santa", "queen", "وردة", "صباح").
   - Eliminate unconditional fallback to "Arabic Pop" or "Pop"; implement multi-feature detection (Rock, Metal, Indie, Classical, Tarab, Jazz, Electronic, R&B, Soundtrack, Shaabi, Mahraganat).
3. `server/utils/genreRules/genreDefinitions.js`:
   - Remove `'pop'` and `'soundtrack'` from `GENERIC_GENRES` (do not discard valid explicit genres).
   - Separate Shaabi vs Mahraganat into distinct genres.
   - Separate Tarab vs Classical into distinct genres.
   - Add `BOLLYWOOD_INDIC` genre definition.
4. Synchronize `src/utils/genreClassifier.js` and `src/native/utils/genreClassifier.js` with the server genre taxonomy.
5. In server track routers (`tracksImportRouter.js`, `tracksPersistenceRouter.js`, `tracksResolutionRouter.js`), forward existing `genre` and `tags` into `classifyGenre` so metadata is preserved.

VERIFICATION:
Create and run a local verification script (e.g. `scripts/verify_issue7_genres.js`) asserting:
- Classical/Tarab tracks with titles like "اقتراب" are NOT classified as Rap.
- Rock, Jazz, Metal, Indie, Tarab, and Soundtrack tracks are accurately categorized and do NOT collapse into Pop or Rap.
- Shaabi vs Mahraganat are correctly separated.
- Syntax check across all touched files (`node -c`).

OUTPUT:
Write your full implementation and test results to:
`c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue7\handoff.md`
Update your progress in `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue7\progress.md`
When complete, notify orchestrator (193c595c-a003-4225-a80b-3e8dcd945268) via send_message.
