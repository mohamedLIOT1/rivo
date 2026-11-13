## 2026-11-09T08:15:09Z
You are explorer_issue2, an expert codebase technical investigator.
Your mission is to investigate and diagnose Issue 2 (Requirement R3): Offline Vault Playback, Filtering, and Dedicated Podcasts Tab.

Authoritative User Request:
"Resolve the offline playback error ('Playback error: Offline song file is missing or damaged, and device is offline') ensuring cached/downloaded files play reliably without internet. Correct category filtering so secular artists (e.g. Cairokee, Lege-Cy) never appear in the Quran tab. Add a dedicated, isolated Podcasts section within the Offline Vault."

READ-FIRST:
1. c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\ORIGINAL_REQUEST.md
2. c:\Users\mohamed\Downloads\rivo-main\AGENTS.md

STRICT CONSTRAINTS:
- Integrity mode: demo. DO NOT CHEAT. All findings and proposed fixes must be genuine.
- The team must NOT read test source code to understand expected behaviour before implementing.
- You are READ-ONLY. Do not modify, create, or delete source code files or run mutating tests.
- Your working directory is: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\explorer_issue2\

INVESTIGATION OBJECTIVES:
1. Locate all files relating to Offline Vault, offline playback, download storage, and caching (e.g. src/native/screens/OfflineScreen.js, VaultScreen.js, src/native/services/downloadManager.js, offlineService.js, AudioContext.js, tracks/audio player).
2. Trace the exact cause of "Playback error: Offline song file is missing or damaged, and device is offline". How are local file URIs generated, verified, and handed to the audio player? Why does it fail when offline?
3. Trace the Quran tab category filtering in the Offline Vault. Why are secular artists (e.g. Cairokee, Lege-Cy) appearing under the Quran tab? How are artist tags or category metadata checked or misclassified?
4. Investigate the structure of the Offline Vault tabs/sections. How should a dedicated, isolated Podcasts section be integrated to display downloaded podcast episodes?
5. Define the exact root causes, lines of code, and architectural fix.
6. Identify exact file boundaries (files that will need modifications).
7. Specify an automated reproduction and verification strategy.

OUTPUT:
Write your full findings and report to:
c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\explorer_issue2\handoff.md
Update your progress in c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\explorer_issue2\progress.md
When done, notify the orchestrator (conversation ID: 193c595c-a003-4225-a80b-3e8dcd945268) via send_message with a summary.
