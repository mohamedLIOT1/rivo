# Orchestration Plan — 9-Issue Resolution & Hardening

## Overview
Execute a parallel subagent workflow across all 9 reported issues in Rivo:
1. Issue 1 (R2): AI Recommendations Refresh and Performance
2. Issue 2 (R3): Offline Vault Playback, Filtering, and Dedicated Podcasts Tab
3. Issue 3 (R4): Complete Podcasts Isolation and Navigation
4. Issue 4 (R5): Mobile DJ Mix Controls & Professional UX Overhaul
5. Issue 5 (R6): Playback Startup Latency & Stream Optimization
6. Issue 6 (R7): Queue AI Suggestions Relevance
7. Issue 7 (R8): Genre and Tag Classification Accuracy
8. Issue 8 (R9): Web Content Preferences Podcast Toggle
9. Issue 9 (R10): Listening Activity and Real-Time Stats Calculation

## Strict Constraints & Anti-Cheat
- DISPATCH-ONLY: The orchestrator never writes/modifies source code or executes test commands.
- Integrity Mode: demo — ZERO TOLERANCE FOR CHEATING. No mocks, no hardcoded responses, no dummy facades.
- Negative Constraint: The team must NOT read test source code to understand expected behaviour before implementing.
- File boundary isolation: concurrent workers must have exclusive write ownership.

## Phase Execution
- **Phase 1: Parallel Diagnostic Survey**:
  Dispatch 9 specialized `teamwork_explorer` subagents concurrently across Issues 1 to 9.
  Each explorer diagnoses the root causes, identifies exact code locations, and specifies remediation and verification scripts.
- **Phase 2: Synthesis & Boundary Allocation**:
  Synthesize all 9 reports, resolve any cross-module overlaps, verify strict write boundary isolation, update `PROJECT.md`.
- **Phase 3: Parallel Implementation**:
  Dispatch dedicated `teamwork_worker` subagents to implement genuine fixes, run unit tests, and verify locally.
- **Phase 4: Independent Review & Adversarial Stress Testing**:
  Dispatch `teamwork_reviewer` and `teamwork_challenger` agents to verify code quality, UX fluidity, and edge-case resilience.
- **Phase 5: Forensic Integrity Audit & Final Gate**:
  Dispatch `teamwork_auditor` for static/runtime anti-cheat verification.
- **Phase 6: Final Reporting & Handoff to Sentinel**.
