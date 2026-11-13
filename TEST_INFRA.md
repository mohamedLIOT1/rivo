# Rivo E2E Test Infrastructure Specification

**Document Version:** 1.0.0  
**Target Codebase:** `rivo-main/`  
**Milestone:** MT (E2E Testing Track)  
**Author:** test_writer_mt_1 (E2E Test Suite Architect)  
**Verification Target:** Local development environment boundary without production DB mutation  

---

## 1. Overview & Architecture

The Rivo E2E Test Suite provides an independent, opaque-box automated regression runner and feature verification system for the **Rivo Engineering Transition**. It verifies architectural refactoring, performance fixes, dead code elimination, and network data optimization across React Native mobile client code, React Web / Tauri desktop interfaces, and Node.js/Express backend services.

### Key Architectural Tenets
1. **Opaque-Box Verification**: The test suite evaluates observable system contracts, static AST/configuration invariants, network payloads, and simulated runtime interactions without relying on mock facades that artificially pass.
2. **Local Environment Boundary**: All tests execute strictly within the local repository boundary. No remote MongoDB production clusters or external services are modified.
3. **Progressive Testability**: The runner captures authentic baseline pass/fail signals across all project milestones (M1–M6), allowing implementation pods to incrementally flip failure signals to green as features are delivered.
4. **Cross-Platform Resilience**: Engineered in pure standard Python 3.12 without external pip dependencies (`pytest`-compatible and standard `unittest`-discoverable), supporting Windows (cp1252/UTF-8 terminal reconfiguration), Linux, and macOS.

---

## 2. Test Suite Directory Layout

```
rivo-main/
├── scripts/
│   └── run_e2e_tests.py            # Primary CLI test runner executable
├── tests/
│   ├── __init__.py                 # Root tests package
│   └── e2e/
│       ├── __init__.py             # E2E test suite package
│       ├── harness.py              # Shared AST, XML, cache simulator, and network utilities
│       ├── test_tier1_features.py  # Tier 1: 51 test cases across 10 inventoried features
│       ├── test_tier2_boundaries.py# Tier 2: 15 boundary & corner case test cases
│       ├── test_tier3_combinations.py # Tier 3: 9 cross-feature combination test cases
│       └── test_tier4_workloads.py # Tier 4: 9 real-world workload scenario test cases
├── TEST_INFRA.md                   # Complete test infrastructure specification
└── TEST_READY.md                   # Test suite readiness declaration & baseline summary
```

---

## 3. Test Tier Breakdown

The suite is structured into four distinct verification tiers:

### Tier 1: Feature Coverage (51 Test Cases)
Provides >= 5 discrete, rigorous test cases per inventoried feature:
1. **Dead Code & Obsolete Components Deletion** (6 test cases):
   - Absence of unreferenced screens: `OnlineWebView.js`, `MixesScreen.js`/`MixesScreen.jsx`.
   - Absence of obsolete components: `EqualizerModal.js`/`EqualizerModal.jsx`, `ModeToggle.js`, `BrutalButton.js`.
   - Absence of abandoned subprojects: `android-webview/`, `desktop-app/`.
   - Elimination of binary bloat: `release-desktop/Rivo.exe` (118MB), `ios_main.hermes.bundle`, `ios_main.jsbundle`, `assets-ios/`.
2. **Hermes Bytecode Compilation Pipeline** (5 test cases):
   - Invocation of `hermesc` bytecode compiler in `scripts/publish-ota.js`.
   - Binary bytecode emission flags (`-emit-binary`, `-O`).
   - Manifest metadata verification in `server/ota-manifest.json` (`bundleSize`, `version`, `bundleUrl`).
   - Native Hermes flag validation in `MainApplication.kt` (`isHermesEnabled`).
   - Release bundle minification flags (`--dev false`).
3. **Splash Screen Layer-List Fix** (5 test cases):
   - Existence and XML validity of `android/app/src/main/res/drawable/splashscreen.xml`.
   - Root `<layer-list>` element verification.
   - Background color item `@color/splashscreen_background`.
   - Required `@drawable/splashscreen_image` item to eliminate cold boot black screen hang.
   - Gravity attribute `android:gravity="center"` to prevent logo distortion.
4. **Native Window Theme Switch Deferral & MainApplication I/O** (5 test cases):
   - Verification that `MainActivity.kt` does NOT prematurely call `setTheme(R.style.AppTheme)` in `onCreate` before the first React Native frame paints.
   - Theme transition deferral to preserve splash window background.
   - Elimination of synchronous `cleanupOldInstallers()` disk I/O in `MainApplication.kt` `onCreate`.
   - Background thread/executor offloading for installer cleanup.
   - AndroidManifest activity launch theme verification.
5. **Immediate Cache Hydration Without Dummy Placeholders** (5 test cases):
   - Verification that `UserContext.js` initializes `tracks` and `albums` as empty arrays `[]`.
   - Permanent removal of `INITIAL_TRACKS` and `INITIAL_ALBUMS` dummy imports.
   - Elimination of artificial `setTimeout(..., 0)` delay during AsyncStorage cache reads.
   - Eager retrieval of `@rivo_cached_albums_v2` and `@rivo_cached_playlists_v2`.
   - Elimination of placeholder album flashing in `HomeScreen.js`.
6. **Bottom Tab Screen Memoization & Prop Stabilization** (5 test cases):
   - Wrapping `QuranScreen.js` in `React.memo()`.
   - Wrapping `OfflineScreen.js` in `React.memo()`.
   - Wrapping `ProfileScreen.js` in `React.memo()`.
   - Wrapping `StatsScreen.js` in `React.memo()`.
   - Elimination of dynamic `initialFilter` toggling in `App.js:1084` that breaks memoization.
7. **List Virtualization (FlatList Migration)** (5 test cases):
   - Migration of `QuranScreen.js` track/surah list to `<FlatList>`.
   - Elimination of unvirtualized `<ScrollView>` for Quran song items.
   - Definition of `keyExtractor` and virtualization windowing props.
   - Migration of `OfflineScreen.js` downloaded tracks list to `<FlatList>`.
   - Elimination of `.map()` loops over track collections inside `<ScrollView>`.
8. **Express Compression Middleware** (5 test cases):
   - Inclusion of `compression` dependency in `server/package.json`.
   - Import of `compression` in `server/index.js`.
   - Registration via `app.use(compression(...))` before catalog routes.
   - Stream filtering to prevent re-compressing already-compressed audio/video streams.
   - Order validation: compression registered before `/api/tracks` and `/api/albums`.
9. **HTTP Cache-Control & ETag 304 Support** (5 test cases):
   - Setting `Cache-Control: public, max-age=120` on `GET /api/tracks`.
   - Generating and returning `ETag` header on `GET /api/tracks`.
   - Handling `If-None-Match` request headers with `304 Not Modified` on tracks.
   - Setting `Cache-Control: public, max-age=300` and `ETag` on `GET /api/albums`.
   - Returning `304 Not Modified` on albums cache hit.
10. **Strict CORS Restrictions** (5 test cases):
    - Rejection of unauthorized third-party origins via `corsOriginHandler`.
    - Whitelisting official client origins (`localhost`, `127.0.0.1`, `tauri://localhost`, `capacitor://localhost`).
    - Prevention of wildcard origin reflection (`origin: '*'`) when `credentials: true`.
    - Strict regex anchoring (`^...$`) to prevent subdomain suffix spoofing.
    - Strict origin enforcement on `/api/tracks/stream-proxy`.

---

### Tier 2: Boundary & Corner Cases (15 Test Cases)
Validates extreme conditions, corrupted data, and boundary limits:
- **Empty Cache Handling**: `null`, empty string, and corrupted storage keys safely default to empty collections without uncaught TypeErrors.
- **Network Timeouts**: `AbortController` cancellation signals in search queries and stream proxy upstream timeout recovery.
- **Malformed API Responses**: Corrupted JSON recovery, non-array response guards, and missing field track sanitization.
- **Zero-Byte Streams**: Rejection of 0-byte audio streams, duration division-by-zero guards (`duration <= 0`), and empty download file cleanup.
- **Maximum Limit Handling**: Enforcement of query limit caps (max 1000, default 500) and normalization of negative/NaN queries.

---

### Tier 3: Cross-Feature Combinations (9 Test Cases)
Validates interactions between disparate system features:
- **Tab Switching During Active Playback**: Verifies `AudioProvider` is an ancestor of the tab view tree so switching tabs does not halt audio; validates `AudioProgressContext` isolation of 250ms ticks.
- **Cache Hydration vs Network Sync Race Conditions**: Verifies state determinism when remote network sync arrives before or after local AsyncStorage reads; verifies immediate auth state load (`setIsAuthLoaded(true)`).
- **GoogleVideo 403 Forbidden Stream Recovery**: Validates stream proxy detection of 403 token expiry, automatic YouTube stream re-resolution, and fallback provider activation.

---

### Tier 4: Real-World Workload Scenarios & Benchmarks (9 Test Cases)
Validates full lifecycle performance and network data reduction:
- **Cold Boot Sequence Validation**: Validates cold boot order on low-RAM (1.5GB) baseline, ensuring zero blocking disk I/O on UI thread and no layout shift.
- **Full Browsing Lifecycle Simulation**: Simulates user session navigation (Home -> Quran -> Offline -> Vault -> Player -> Background -> Resume) and verifies `useEffect` listener teardown.
- **Network Data Reduction Benchmarks**:
  - Gzip compression benchmark: enforces >= 60% payload size reduction on track catalog.
  - ETag / HTTP 304 caching benchmark: enforces >= 80% bandwidth savings across 10 user sessions.
  - Background polling debouncing: enforces >= 30-60 second debouncing on update checks.

---

## 4. Test Runner Invocation & CLI Options

The test runner can be executed directly using Python 3:

### Standard Invocations

```bash
# Run all 84 test cases across Tiers 1-4
python rivo-main/scripts/run_e2e_tests.py

# Run specific tiers (e.g. Tier 1 and Tier 2)
python rivo-main/scripts/run_e2e_tests.py --tier 1,2

# Run Tier 1 only
python rivo-main/scripts/run_e2e_tests.py --tier 1

# Run with test pattern filter
python rivo-main/scripts/run_e2e_tests.py --pattern test_splashscreen*

# Run in baseline mode (captures baseline without non-zero exit code)
python rivo-main/scripts/run_e2e_tests.py --baseline

# Export machine-readable JSON metrics report
python rivo-main/scripts/run_e2e_tests.py --baseline --json-report test_report.json
```

### Direct `unittest` Discovery (CI/CD Native)

```bash
# Discover and run all E2E tests via standard unittest
python -m unittest discover -s rivo-main/tests/e2e -t rivo-main

# Discover and run a single tier
python -m unittest discover -s rivo-main/tests/e2e -p "test_tier1_features.py" -t rivo-main
```

---

## 5. Baseline Signals (Milestone MT)

Execution against the pre-transition codebase establishes the authoritative baseline:

| Tier | Focus Area | Total Tests | Baseline Pass | Baseline Fail | Status |
|---|---|---|---|---|---|
| **Tier 1** | Feature Coverage (10 Features) | 51 | 23 | 28 | IN_PROGRESS (M1-M6) |
| **Tier 2** | Boundary & Corner Cases | 15 | 13 | 2 | IN_PROGRESS (M5-M6) |
| **Tier 3** | Cross-Feature Combinations | 9 | 8 | 1 | IN_PROGRESS (M5) |
| **Tier 4** | Workload Scenarios & Benchmarks | 9 | 5 | 4 | IN_PROGRESS (M2-M4) |
| **TOTAL** | **Complete Transition Suite** | **84** | **49** | **35** | **ACTIVE REGRESSION RUNNER** |

All 35 baseline failures correspond precisely to planned milestones (M1–M6). As each pod refactors components and deletes dead code, the runner will track the transition progress to 100% green pass.
