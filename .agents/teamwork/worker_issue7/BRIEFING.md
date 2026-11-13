# BRIEFING — 2026-11-09T10:55:00Z

## Mission
Implement genuine fix for Issue 7 (Requirement R8): Genre and Tag Classification Accuracy. Ensure accurate categorization, prevent over-generalization where diverse tracks are erroneously labeled solely as rap or pop, fix substring boundary bugs, refine priority/fallbacks, separate Shaabi/Mahraganat and Tarab/Classical, add Bollywood/Indic, and sync client/server classifiers.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue7\
- Original parent: 193c595c-a003-4225-a80b-3e8dcd945268
- Milestone: Issue 7 / R8 Genre and Tag Classification Accuracy

## 🔒 Key Constraints
- DO NOT CHEAT. All implementations must be genuine.
- DO NOT read test source code to understand expected behaviour before implementing.
- EXCLUSIVE WRITE OWNERSHIP:
  * `server/utils/genreClassifier.js`
  * `server/utils/genreRules/genreDefinitions.js`
  * `server/utils/genreRules/textNormalizer.js`
  * `src/utils/genreClassifier.js`
  * `src/native/utils/genreClassifier.js`
  * `server/routes/tracks/tracksImportRouter.js`
  * `server/routes/tracks/tracksPersistenceRouter.js`
  * `server/routes/tracks/tracksResolutionRouter.js`
  * `scripts/verify_issue7_genres.js` (for verification)
  * `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue7\`
- 400-line modularization rule, vibe coding guidelines.

## Current Parent
- Conversation ID: 193c595c-a003-4225-a80b-3e8dcd945268
- Updated: 2026-11-09T08:32:15Z

## Task Summary
- **What to build**: Fix word boundary matching in `textNormalizer.js` (prevent "اقتراب" matching "تراب", "trapped" matching "trap", etc.). Equalize RAP/SHAABI priority boost and refine artist matching and fallback logic in `genreClassifier.js`. Refine `genreDefinitions.js` to preserve pop/soundtrack, separate Shaabi vs Mahraganat, Tarab vs Classical, and add Bollywood/Indic. Sync web/native client classifiers. Forward existing genre and tags in tracks routers.
- **Success criteria**: Accurate categorization across genres, no false positive matches on substrings, accurate preservation of metadata, passes verification script.
- **Interface contracts**: `PROJECT.md`, `explorer_issue7/handoff.md`
- **Code layout**: `server/utils/genreRules/`, `server/utils/`, `src/utils/`, `src/native/utils/`, `server/routes/tracks/`

## Key Decisions Made
- Implemented Unicode-aware regex boundary matching `(^|[^\p{L}\p{N}])needle([^\p{L}\p{N}]|$)` with 'iu' flags in `textNormalizer.js` for both Arabic and Latin text.
- Removed artificial priority 90 boost for RAP and SHAABI; unified artist priority to 80 and keyword priority to 70.
- Protected ambiguous single-word artist names ("future", "queen", "santa", "وردة", "صباح") from title matches unless delimited by separator/feat prefixes.
- Eliminated unconditional fallback to Pop/Arabic Pop; added multi-feature cue detection (Rock, Metal, Indie, Tarab, Classical, Soundtrack, Jazz, EDM, Lo-Fi, R&B, Bollywood, Shaabi, Mahraganat, Khaleeji).
- Preserved user/external metadata in track routers (`tracksImportRouter.js`, `tracksPersistenceRouter.js`, `tracksResolutionRouter.js`).
- Synchronized client taxonomy (`src/utils/genreClassifier.js` and `src/native/utils/genreClassifier.js`) in parity with server definitions.

## Change Tracker
- **Files modified**:
  * `server/utils/genreRules/textNormalizer.js`: Word-boundary regex matching across all needle lengths.
  * `server/utils/genreRules/genreDefinitions.js`: Expanded taxonomy, separated Shaabi/Mahraganat and Tarab/Classical, added Soundtrack and Bollywood/Indic, removed pop/soundtrack from generic discard list.
  * `server/utils/genreClassifier.js`: Equalized priorities, ambiguous artist guard, multi-feature detection step.
  * `src/native/utils/genreClassifier.js`: Synchronized 19-genre taxonomy, boundary matching, and fallback logic (<400 lines).
  * `src/utils/genreClassifier.js`: Synchronized canonical genre taxonomy map and translations.
  * `server/routes/tracks/tracksImportRouter.js`: Forward existing genre/tags/description into classifyGenre.
  * `server/routes/tracks/tracksPersistenceRouter.js`: Forward existing genre/tags/description into classifyGenre.
  * `server/routes/tracks/tracksResolutionRouter.js`: Forward existing genre/tags/description into classifyGenre.
  * `scripts/verify_issue7_genres.js`: Verification test suite.
- **Build status**: PASS (node -c and verify script 100% pass)
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS. All 27 server test cases, 27 native client test cases, needle boundary tests, generic filter tests, and Quran/podcast isolation tests pass.
- **Lint status**: PASS. All 8 modified source files are under 400 lines and syntax clean (`node -c`).
- **Tests added/modified**: `scripts/verify_issue7_genres.js` added.

## Loaded Skills
- None
