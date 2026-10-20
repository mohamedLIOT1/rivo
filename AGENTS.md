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
