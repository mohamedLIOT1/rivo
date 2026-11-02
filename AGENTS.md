# Agent & AI Assistant Instructions for Rivo Codebase

## Performance & Context Optimization
To keep responses lightning fast and prevent indexing lags:
- **NEVER** search, index, or load files from:
  - `node_modules/`
  - `dist/` or `build/`
  - `android/.gradle/` or `android/app/build/`
  - `src-tauri/target/`
  - `public/downloads/`
  - Any `.bundle`, `.apk`, `.ipa`, `.tar.gz`, or `.exe` files.
- The active core source code is located in:
  - Frontend: `src/`
  - Server / Backend: `server/`
  - Native Mobile Layer: `src/native/` and `App.js`
  - Desktop Native Layer: `src-tauri/`

---

## 🛡️ Vibe Coding Architectural Rules (MANDATORY FOR ALL AI & AGENTS)
These rules are strictly enforced to prevent performance degradation, memory leaks, and fragile regressions:

### 1. File Size & Modularization (The 400-Line Limit)
- **Do NOT** add new features directly into monolithic files (`AudioContext`, `App.js`, `downloadManager`, `FullPlayerModal`).
- Any file exceeding 400 lines must be split into specialized custom hooks, utilities, or sub-components.

### 2. Context & State Performance (Prevent Re-render Storms)
- **High-Frequency State Isolation:** NEVER place rapidly updating state (e.g., `currentTime`, progress ticks, sleep timer seconds, download percentage) inside a general root Context provider value. Always isolate ticks into `AudioProgressContext` or use ref-based listeners.
- **Provider Memoization:** ALL Context Provider `value` objects MUST be wrapped in `useMemo()`.
- **Prop Callbacks:** All event handlers passed down to screen trees must be stabilized with `useCallback()`.
- **Pure Components:** Use `React.memo` on heavy components (`MiniPlayer`, `FullPlayerModal`, track list cards).

### 3. Async Lifecycle & Request Cancellation
- Every `fetch`, stream resolution, or polling loop MUST accept an `AbortSignal` and check `signal.aborted` before proceeding or sleeping.
- Every `setTimeout`, `setInterval`, WebSocket listener, or native event listener MUST be cleaned up in the `useEffect` return teardown.

### 4. Mobile Disk & Main-Thread I/O (Zero UI Freezes)
- NEVER stringify and write multi-megabyte manifests to `AsyncStorage` or `FileSystem` on the main JS thread during real-time downloads or playback.
- Debounce storage updates (minimum 3–5 seconds) or update only dirty records.
- For list views (Liked songs, Library, History), ALWAYS use virtualized `<FlatList>` with `keyExtractor` and reasonable `windowSize` instead of `<ScrollView>`.

### 5. Backend Server Stability & Security
- Strict CORS: restrict to official domains and apps.
- No unauthenticated debug routes executing system commands (`execSync`, child processes).
- Proxy streaming must handle GoogleVideo 403 / token expiry with automatic stream recovery.
- All MongoDB collections must have indexes on foreign keys and queried fields (`sender`, `recipient`, `trackId`, `createdAt`).
