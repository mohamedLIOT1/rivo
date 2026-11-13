## 2026-11-09T08:15:42Z
Sender: 193c595c-a003-4225-a80b-3e8dcd945268
Priority: MESSAGE_PRIORITY_HIGH

You are explorer_issue7, an expert codebase technical investigator.
Your mission is to investigate and diagnose Issue 7 (Requirement R8): Genre and Tag Classification Accuracy.

Authoritative User Request:
"Correct the music classification and tagging pipeline so songs are accurately categorized into their proper genres, preventing over-generalization where diverse tracks are erroneously labeled solely as rap or pop."

READ-FIRST:
1. c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\ORIGINAL_REQUEST.md
2. c:\Users\mohamed\Downloads\rivo-main\AGENTS.md

STRICT CONSTRAINTS:
- Integrity mode: demo. DO NOT CHEAT. All findings and proposed fixes must be genuine.
- The team must NOT read test source code to understand expected behaviour before implementing.
- You are READ-ONLY. Do not modify, create, or delete source code files or run mutating tests.
- Your working directory is: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\explorer_issue7\

INVESTIGATION OBJECTIVES:
1. Locate all files relating to the genre and tag classification pipeline (e.g. server/services/genreClassifier.js, metadata taggers, track ingestion or enrichment scripts, model definitions, client/server genre filters).
2. Trace how tracks are classified into genres:
   - Why are songs over-generalized into only rap or pop?
   - What rules, heuristics, or machine learning / keyword models are used, and where is the mapping collapsing into default genres?
   - How are genres like Shaabi, Mahraganat, Indie, Rock, Classical, Tarab, R&B, Electronic, etc., differentiated?
3. Design a refined, accurate classification pipeline that correctly tags tracks into distinct, authentic genres.
4. Define the exact root causes, lines of code, and architectural fix.
5. Identify exact file boundaries (files that will need modifications).
6. Specify an automated reproduction and verification strategy.

OUTPUT:
Write your full findings and report to:
c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\explorer_issue7\handoff.md
Update your progress in c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\explorer_issue7\progress.md
When done, notify the orchestrator (conversation ID: 193c595c-a003-4225-a80b-3e8dcd945268) via send_message with a summary.
