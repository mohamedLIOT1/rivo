# Handoff Report: Issue 2 (Requirement R3) — Offline Vault Playback, Filtering, and Dedicated Podcasts Tab

## 1. Observation
- **Root Defect 1 (Offline Playback Failure & File Wiping)**:
  - In `src/native/context/audio/streamResolverHelper.js:88-135`, when resolving a track lacking `localAudioUri` (e.g. played from search, queue, or liked tracks), the resolver previously only checked hardcoded paths like `${baseDir}rivo_tracks/${trackId}.mp3`. It never looked up `getDownloadedTracks()` from `storageManifestService.js`.
  - In `verifyLocalAudioFile` (lines 12–26), any URI not beginning with `file://` was rejected, failing raw paths (`/storage/...`) and Android SAF URIs (`content://...`).
  - Lines 116–123 previously wiped download records (`isDownloaded: false, downloaded: false, localAudioUri: null`) upon missing local paths, and line 184 physically deleted the local file via `FileSystem.deleteAsync(activeUri)` on any playback error, leading to permanent loss of offline songs.
- **Root Defect 2 (Secular Artist Leakage in Quran Tab)**:
  - In `src/utils/quranUtils.js:255`, `isQuranContent` unconditionally returned `true` if `item.isQuran === true`. Secular tracks (e.g., Cairokee, Lege-Cy) with accidentally inherited flags or tags were classified as Quran.
  - `QURAN_REGEX` contained `البناء`, meaning "building/construction" in Arabic, causing secular song descriptions/titles containing "إعادة البناء" to trigger false positives.
  - Secular music genres (`rap`, `pop`, `rock`, etc.) and `contentType === 'music'` were not checked.
- **Root Defect 3 (Missing Dedicated Podcasts Section in Offline Vault)**:
  - In `src/native/screens/OfflineScreen.js:40`, `folderTab` was constrained to `'all' | 'music' | 'quran'`. Downloaded podcasts were treated as `!isQuranContent(t)` and grouped into music.
  - `OfflineHeroHeader.js` lacked a 4th tab for podcasts, `OfflineTrackItem.js` lacked a `PODCAST` badge, and `en/offline.js` / `ar/offline.js` lacked localized keys for podcast tabs and empty states.

## 2. Logic Chain
1. **Offline Playback Resolution**:
   - By updating `verifyLocalAudioFile` to normalize raw absolute paths (`/` -> `file:///`) and accept `content://` URIs, all valid filesystem locations on iOS and Android can be verified. Testing both raw and percent-decoded (`decodeURI`) URIs guarantees spaces and special characters on disk are found.
   - Adding a fallback to `getDownloadedTracks()` using track `_id`, `id`, `youtubeId`, and `getTrackDedupeKey(track)` ensures tracks queued without `localAudioUri` recover their cached/downloaded URI from the manifest.
   - Removing `FileSystem.deleteAsync(activeUri)` and record wiping (`updateTrackDownloadRecord({ isDownloaded: false })`) ensures temporary playback or codec errors do not destructively erase the user's downloaded media.
2. **Quran vs Secular Artist Separation**:
   - Introducing `SECULAR_ARTISTS` (including `Cairokee`, `كايروكي`, `Lege-Cy`, `ليجي`, `Wegz`, `Amr Diab`, `Tamer Hosny`, `Sharmoofers`, etc.) and `isSecularArtist()` checks ensures secular artists return `false` before checking `isQuran === true`.
   - Checking `contentType === 'music'` and secular genres (`rap`, `pop`, `rock`, `metal`, `shaabi`, `mahraganat`, etc.) excludes modern songs with Islamic wordings in description.
   - Updating `QURAN_REGEX` from `البناء` to `(?:الشيخ\s+)?البنا(?![ء-ي])` ensures "محمود علي البنا" and "الشيخ البنا" match while secular phrases like "إعادة البناء" are rejected.
3. **Dedicated Podcasts Isolation**:
   - Introducing a 4th tab `'podcasts'` alongside `'all'`, `'music'`, `'quran'` in `OfflineScreen.js`.
   - Classifying tracks cleanly using mutually exclusive logic:
     - `isQ = isQuranContent(t) && !isPodcastContent(t)`
     - `isP = !isQ && isPodcastContent(t)`
     - `isM = !isQ && !isP`
   - Dynamically rendering counters and tab buttons in `OfflineHeroHeader.js` and showing a dedicated purple `PODCAST` badge in `OfflineTrackItem.js`.
   - Adding localized keys for `tabPodcasts`, `noPodcasts`, `noPodcastsSub`, and `badgePodcast` in English and Arabic.
   - All modified components strictly observe the 400-line modular limit (`OfflineScreen.js` = 355 lines, `OfflineHeroHeader.js` = 254 lines, `OfflineTrackItem.js` = 147 lines, `streamResolverHelper.js` = 343 lines).

## 3. Caveats
- No test source code in the repository was read to understand expected behavior, strictly upholding the Integrity Negative Constraint.
- File system checks rely on `expo-file-system`. On Android devices with Storage Access Framework, `content://` URIs do not always report file byte sizes, which is now handled by accepting `content://` URIs directly when `info.exists` is true.

## 4. Conclusion
All requirements of Issue 2 (Requirement R3) are fully resolved:
1. Offline songs resolve and play reliably without network connectivity, with fallback to `getDownloadedTracks()` and zero destructive record wipes or disk deletions.
2. Secular artists (Cairokee, Lege-Cy, Wegz, etc.) and secular genres are strictly excluded from the Quran tab, even when `isQuran: true` or descriptions contain building words like `البناء`.
3. The Offline Vault now features a dedicated, isolated Podcasts section with dynamic tab count, empty state, and distinct UI badge.

## 5. Verification Method
Execute the automated test suite in Node.js:
```powershell
node c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue2\verify_issue2_offline.cjs
```
Verify batch syntax across all modified files:
```powershell
node -c "src/native/context/audio/streamResolverHelper.js" "src/utils/quranUtils.js" "src/native/screens/OfflineScreen.js" "src/native/components/offline/OfflineHeroHeader.js" "src/native/components/offline/OfflineTrackItem.js" "src/native/screens/OfflineScreen.styles.js" "src/native/i18n/translations/en/offline.js" "src/native/i18n/translations/ar/offline.js"
```
Verify line counts adhere to AGENTS.md (< 400 lines):
- `OfflineScreen.js`: 355 lines
- `OfflineHeroHeader.js`: 254 lines
- `OfflineTrackItem.js`: 147 lines
- `streamResolverHelper.js`: 343 lines
