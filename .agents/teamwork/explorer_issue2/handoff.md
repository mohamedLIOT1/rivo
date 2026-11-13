# Handoff Report: Issue 2 (Requirement R3) — Offline Vault Playback, Filtering, and Dedicated Podcasts Tab

## Executive Summary
This investigation analyzed the three core defects specified in Issue 2 (Requirement R3):
1. **Offline Playback Failure**: Traced the exact trigger of `"Playback error: Offline song file is missing or damaged, and device is offline"` to `streamResolverHelper.js:131`, caused by lack of storage manifest lookup for tracks queued from external screens, strict path protocol rejections in `verifyLocalAudioFile`, and destructive "auto-heal" deletion routines (`streamResolverHelper.js:117` and `streamResolverHelper.js:184`) that wipe storage records and delete local files during playback attempts.
2. **Secular Artist Leakage in Quran Tab**: Traced why secular artists (e.g. Cairokee, Lege-Cy) leak into the Quran tab in `OfflineScreen.js:85` and `src/utils/quranUtils.js:255`. `isQuranContent` unconditionally accepts `item.isQuran === true` (often inherited from playlists or imports), checks description text against `QURAN_REGEX` without boundary safeguards, and completely lacks a secular artist/genre exclusion filter.
3. **Missing Dedicated Podcasts Section**: Traced `OfflineScreen.js:40` and `OfflineHeroHeader.js:157`, which currently only implement three tabs (`all`, `music`, `quran`). Downloaded podcasts are erroneously lumped into `music` (`!isQuranContent(t)`). A dedicated `podcasts` tab, isolated state filtering, accurate tab counters, and podcast badges in `OfflineTrackItem.js` are required.

---

## 1. Observation

### 1.1 Offline Playback Error Origin & Mechanism
- **File**: `rivo-main/src/native/context/audio/streamResolverHelper.js`
- **Lines 45–133**:
```javascript
export const resolveTrackPlaybackUri = async ({
  track,
  isVocalOnly,
  updateVocalStatus,
  signal,
}) => {
  if (!track) return null;

  const trackId = String(track._id || track.id || '');
  const candidateLocal = track.localAudioUri ||
    (track.nativeAudioUri && (track.nativeAudioUri.startsWith('file://') || track.nativeAudioUri.includes('rivo_tracks/')) ? track.nativeAudioUri : null) ||
    (track.audioUrl && (track.audioUrl.startsWith('file://') || track.audioUrl.includes('rivo_tracks/')) ? track.audioUrl : null);

  let validLocalUri = null;

  // 1. Check direct local candidate with re-anchoring
  if (candidateLocal) {
    const check = await verifyLocalAudioFile(candidateLocal);
    if (check && check.exists && check.size >= 5000) {
      validLocalUri = check.uri;
    } else if (check && check.exists && check.size < 5000) {
      // Corrupt/empty file on disk: purge it
      await FileSystem.deleteAsync(check.uri, { idempotent: true }).catch(() => {});
    }
  }

  // 2. If candidate wasn't valid, scan candidate files in rivo_tracks / rivo_vault
  if (!validLocalUri && FileSystem.documentDirectory) {
    const docDir = FileSystem.documentDirectory;
    const baseDir = docDir.endsWith('/') ? docDir : `${docDir}/`;
    const candidates = [];

    if (trackId) {
      candidates.push(`${baseDir}rivo_tracks/${trackId}.mp3`);
      candidates.push(`${baseDir}rivo_tracks/${trackId}.m4a`);
      candidates.push(`${baseDir}rivo_tracks/${trackId}`);
      candidates.push(`${baseDir}rivo_vault/${trackId}.mp3`);
      candidates.push(`${baseDir}rivo_vault/${trackId}.m4a`);
    }

    if (candidateLocal) {
      const filename = candidateLocal.split('/').pop()?.split('?')[0];
      if (filename && filename !== trackId) {
        candidates.push(`${baseDir}rivo_tracks/${filename}`);
        candidates.push(`${baseDir}rivo_vault/${filename}`);
      }
    }

    for (const cand of candidates) {
      try {
        const cInfo = await FileSystem.getInfoAsync(cand);
        if (cInfo && cInfo.exists && typeof cInfo.size === 'number' && cInfo.size >= 5000) {
          validLocalUri = cand;
          break;
        }
      } catch {}
    }
  }

  // 3. If recovered a valid local file, auto-heal track record in storage
  if (validLocalUri) {
    if (track.localAudioUri !== validLocalUri || track.nativeAudioUri !== validLocalUri) {
      track.localAudioUri = validLocalUri;
      track.nativeAudioUri = validLocalUri;
      if (trackId) {
        updateTrackDownloadRecord(trackId, {
          localAudioUri: validLocalUri,
          nativeAudioUri: validLocalUri,
          audioUrl: validLocalUri,
          isDownloaded: true,
          downloaded: true,
        }).catch(() => {});
      }
    }
    return validLocalUri;
  }

  // 4. If local file was expected but missing/corrupt on disk, auto-heal storage record
  if (track.isDownloaded || track.downloaded || candidateLocal) {
    if (trackId) {
      updateTrackDownloadRecord(trackId, {
        isDownloaded: false,
        downloaded: false,
        localAudioUri: null,
        nativeAudioUri: null,
      }).catch(() => {});
    }
  }

  // 5. If local file was expected but damaged/missing, check network before failing
  if (track.isDownloaded || track.downloaded || candidateLocal) {
    const netState = await NetInfo.fetch().catch(() => null);
    const isOnline = netState ? (netState.isConnected && netState.isInternetReachable !== false) : true;
    if (!isOnline) {
      throw new Error('Offline song file is missing or damaged, and device is offline');
    }
  }
...
```
- **File**: `rivo-main/src/native/context/audio/useAudioPlaybackCore.js`
- **Lines 245–304**:
```javascript
      const uri = await resolveTrackPlaybackUri({
        track,
        isVocalOnly: isVocalOnlyRef.current,
        updateVocalStatus,
        signal: abortController.signal,
      });
...
    } catch (err) {
      if (!abortController.signal.aborted) {
        showToast?.(`Playback error: ${err.message || 'Stream unavailable'}`, 'error');
        setIsPlaying(false);
        isPlayingRef.current = false;
        updateMediaNotification(false, repeatModeRef.current, isShuffleRef.current, isLikedTrack, track);
      }
    }
```
- **File**: `rivo-main/src/native/context/audio/streamResolverHelper.js`
- **Lines 12–26** (`verifyLocalAudioFile`):
```javascript
export const verifyLocalAudioFile = async (rawUri) => {
  if (!rawUri || typeof rawUri !== 'string') return null;
  const reanchored = reanchorDocumentUri(rawUri);
  if (!reanchored || !reanchored.startsWith('file://')) return null;

  try {
    const info = await FileSystem.getInfoAsync(reanchored);
    if (info && info.exists && typeof info.size === 'number' && info.size >= 5000) {
      return { uri: reanchored, size: info.size, exists: true };
    }
    return { uri: reanchored, size: info?.size || 0, exists: Boolean(info?.exists) };
  } catch {
    return null;
  }
};
```
- **File**: `rivo-main/src/native/context/audio/streamResolverHelper.js`
- **Lines 180–200** (destructive `createAudioSound` catch block):
```javascript
    if (activeUri && typeof activeUri === 'string' && activeUri.startsWith('file://') && (!signal || !signal.aborted)) {
      console.warn('[streamResolverHelper] AVPlayer failed on local file, falling back to online stream:', err?.message);

      // Delete corrupt local file and heal storage record
      await FileSystem.deleteAsync(activeUri, { idempotent: true }).catch(() => {});
      const trackId = String(track?._id || track?.id || '');
      if (trackId) {
        updateTrackDownloadRecord(trackId, {
          isDownloaded: false,
          downloaded: false,
          localAudioUri: null,
          nativeAudioUri: null,
        }).catch(() => {});
      }

      // Check network before fallback
      const netState = await NetInfo.fetch().catch(() => null);
      const isOnline = netState ? (netState.isConnected && netState.isInternetReachable !== false) : true;
      if (!isOnline) {
        throw new Error('This offline media file is damaged and cannot be played while offline');
      }
```

### 1.2 Secular Artists in Quran Tab Filtering
- **File**: `rivo-main/src/utils/quranUtils.js`
- **Lines 3, 252–261**:
```javascript
export const QURAN_REGEX = /(سورة|سوره|قرآن|قران|المصحف|مصحف|تلاوة|تلاوه|ترتيل|تجويد|المنشاوي|عبد\s*الباسط|الحصري|البناء|الطبلاوي|العفاسي|ماهر\s*المعيقلي|السديس|الشريم|ياسر\s*الدوسري|مشاري\s*العفاسي|أحمد\s*العجمي|سعد\s*الغامدي|\bsurah\b|\bquran\b|\bkoran\b|\brecitation\b|\btajweed\b|\btartil\b|\bmushaf\b)/i;

export function isQuranContent(item, artist = '', album = '') {
  if (!item) return false;
  if (typeof item === 'object') {
    if (item.isQuran === true || item.genre === 'quran-radio') return true;
    const str = `${item.title || item.name || ''} ${item.artist || ''} ${item.album || ''} ${item.genre || ''} ${item.description || ''}`;
    return QURAN_REGEX.test(str);
  }
  const str = `${item} ${artist} ${album}`;
  return QURAN_REGEX.test(str);
}
```
- **File**: `rivo-main/src/native/screens/OfflineScreen.js`
- **Lines 77–88**:
```javascript
  const quranCount = useMemo(() => (offlineTracks || []).filter(isQuranContent).length, [offlineTracks]);
  const musicCount = useMemo(() => (offlineTracks || []).filter((t) => !isQuranContent(t)).length, [offlineTracks]);

  const displayedTracks = useMemo(() => {
    return (filteredOfflineTracks || []).filter((t) => {
      if (!t) return false;
      const isQ = isQuranContent(t);
      if (folderTab === 'music') return !isQ;
      if (folderTab === 'quran') return isQ;
      return true;
    });
  }, [filteredOfflineTracks, folderTab]);
```
- **Observation**:
  - `QURAN_REGEX` contains `البناء`. In Arabic, `البناء` means "construction/building". Titles or descriptions containing "إعادة البناء" or similar trigger false positives.
  - If a track object contains `isQuran: true` (e.g. from a user saving to a playlist in Quran screen or an auto-search tag), `isQuranContent` returns `true` immediately without inspecting the artist.
  - Known secular music artists (`Cairokee`, `كايروكي`, `Lege-Cy`, `ليجي`, `Wegz`, `Marwan Pablo`, `Amr Diab`, etc.) have no exclusion check in `isQuranContent`.

### 1.3 Missing Podcasts Tab in Offline Vault
- **File**: `rivo-main/src/native/screens/OfflineScreen.js`
- **Line 40**:
```javascript
  const [folderTab, setFolderTab] = useState('all'); // 'all' | 'music' | 'quran'
```
- **Lines 197–200**:
```javascript
        folderTab={folderTab}
        setFolderTab={setFolderTab}
        musicCount={musicCount}
        quranCount={quranCount}
```
- **File**: `rivo-main/src/native/components/offline/OfflineHeroHeader.js`
- **Lines 156–224**:
  Contains only 3 tab buttons: `ALL`, `🎵 MUSIC`, `📖 QURAN`. No Podcasts tab exists.
- **File**: `rivo-main/src/native/components/offline/OfflineTrackItem.js`
- **Lines 80–106**:
  Badges only distinguish `HOLY QURAN`, `IMPORTED MP3`, or `OFFLINE SONG`. No `PODCAST` badge exists.

---

## 2. Logic Chain

### 2.1 Why Offline Playback Fails ("Missing or Damaged")
1. **Observation**: `streamResolverHelper.js:131` throws `"Offline song file is missing or damaged, and device is offline"` when `validLocalUri` is null and `!isOnline`.
2. **Step 1 — Track Lookup Gap**: When a user plays a track from outside the Offline Vault (e.g. Library, Liked Songs, Search, Queue), the `track` object contains `{ _id, title, artist, audioUrl }` where `audioUrl` is a remote stream URL (`http...` or `/api/...`). `candidateLocal` is `null`. `resolveTrackPlaybackUri` only checks `candidates.push(`${baseDir}rivo_tracks/${trackId}.mp3`)`. If the track was imported or downloaded with a dedupe key, title, or alternate extension, this simple check fails. The function never queries `getDownloadedTracks()` to look up the manifest record by ID, dedupe key, or title/artist.
3. **Step 2 — URI Format & Encoding Rejection**: `verifyLocalAudioFile` checks `if (!reanchored || !reanchored.startsWith('file://')) return null`. If a file URI starts with `/` (absolute filesystem path) or `content://` (Android Storage Access Framework), it is rejected. Additionally, if the URI has unencoded spaces or percent-encoded characters, `getInfoAsync` fails to match the on-disk file unless both encoded and decoded variants are checked.
4. **Step 3 — Destructive "Auto-Heal" Deletions**: In `streamResolverHelper.js:116-123`, if `validLocalUri` is not found on the first pass, `updateTrackDownloadRecord` immediately wipes the record (`isDownloaded: false, localAudioUri: null`). In `streamResolverHelper.js:184`, if `Audio.Sound.createAsync` encounters any temporary playback issue, it calls `FileSystem.deleteAsync(activeUri)` and deletes the physical file. Any subsequent attempt to play while offline fails permanently.

### 2.2 Why Secular Artists (Cairokee, Lege-Cy) Appear in Quran Tab
1. **Observation**: In `OfflineScreen.js:85`, a track is placed in the Quran tab if `isQuranContent(t)` returns `true`.
2. **Step 1 — Blind Trust of `isQuran: true`**: In `quranUtils.js:255`, `if (item.isQuran === true) return true`. If any secular song was added or modified in a context where `isQuran` was inherited (such as creating a playlist or batch importing in Quran mode), it is permanently branded as Quran.
3. **Step 2 — Keyword Regex Matching on Descriptions**: `QURAN_REGEX` tests `${title} ${artist} ${album} ${genre} ${description}`. YouTube descriptions often include standard Arabic Islamic phrases or channel disclaimers. Furthermore, `البناء` in `QURAN_REGEX` is a common Arabic word meaning "construction", causing secular song titles/lyrics to trigger the regex.
4. **Step 3 — Complete Lack of Secular Artist Exclusion**: Neither `quranUtils.js` nor `OfflineScreen.js` verifies the artist against known secular artists. Cairokee and Lege-Cy are prominent Egyptian secular music artists (Indie/Rock and Rap respectively). Without an explicit secular artist check, any accidental tag match or corrupted flag dumps them into the Quran tab.

### 2.3 Why Podcasts Lack an Isolated Offline Vault Section
1. **Observation**: `OfflineScreen.js:40` only defines `'all' | 'music' | 'quran'`.
2. **Step 1 — Misclassification as Music**: In `OfflineScreen.js:78`, `musicCount` is calculated as `!isQuranContent(t)`. Any downloaded podcast episode is counted as music and displayed under the Music tab.
3. **Step 2 — Missing UI & Navigation**: `OfflineHeroHeader.js` has no tab button for Podcasts. There is no filter logic separating podcasts from music in the Offline Vault, violating Requirement R3 and R4.

---

## 3. Caveats
- No test files were read to understand expected behavior, strictly upholding the Integrity Mode: demo constraint.
- The investigation remained strictly read-only.
- Audio playback depends on native platform capabilities (`expo-av` and `expo-file-system`). Android SAF (`content://`) URIs must be handled gracefully alongside standard `file://` URIs.

---

## 4. Conclusion & Required Fixes

### 4.1 Fix 1: Robust Offline Playback Resolution (`streamResolverHelper.js`)
1. **Manifest Lookup**: In `resolveTrackPlaybackUri`, if `candidateLocal` is null or invalid, asynchronously query `getDownloadedTracks()`. Match by `_id`, `id`, `youtubeId`, or `getTrackDedupeKey(track)`. If found, retrieve `localAudioUri`.
2. **Resilient Local File Verification (`verifyLocalAudioFile`)**:
   - Normalize paths: if `reanchored` starts with `/` and not `file://`, prefix `file://`. Allow `content://` URIs.
   - Test both raw and `decodeURI()` / `encodeURI()` paths with `FileSystem.getInfoAsync`.
   - Require `info.exists === true` and `(info.size >= 1000 || typeof info.size !== 'number')`.
3. **Scan Expanded Vault Candidates**:
   - Check `rivo_tracks/` and `rivo_vault/` (`PERSISTENT_DIR`).
   - Search for `${trackId}.mp3`, `${trackId}.m4a`, `${trackId}`, plus sanitized `${title} - ${artist}` filenames.
4. **Remove Destructive Auto-Wiping**:
   - Eliminate lines 116–124 that wipe `isDownloaded` and `localAudioUri` on failed lookups.
   - In `createAudioSound` (line 184), remove `FileSystem.deleteAsync` on AVPlayer failure when offline so files are not deleted.

### 4.2 Fix 2: Strict Secular Artist Exclusion & Filtering (`quranUtils.js` & `OfflineScreen.js`)
1. **Secular Artist Blocklist in `quranUtils.js`**:
   - Define a canonical list of secular artists and music acts that can **never** be Quranic reciters:
     `'cairokee'`, `'كايروكي'`, `'lege-cy'`, `'lege cy'`, `'ليجي'`, `'ليجي سي'`, `'wegz'`, `'ويجز'`, `'marwan pablo'`, `'مروان بابلو'`, `'marwan moussa'`, `'مروان موسى'`, `'amir eid'`, `'امير عيد'`, `'sharmoofers'`, `'شارموفرز'`, `'massar egbari'`, `'مسار إجباري'`, `'amr diab'`, `'عمرو دياب'`, `'tamer hosny'`, `'تامر حسني'`, `'hamza namira'`, `'حمزة نمرة'`, `'abyusif'`, `'ابيوسف'`, `'afroto'`, `'عفروتو'`, `'essam sasa'`, `'عصام صاصا'`, etc.
   - Export helper `isSecularArtist(artist)`.
2. **Safeguard `isQuranContent`**:
   - If `isSecularArtist(item?.artist || artist)`, return `false` immediately.
   - If `item.genre` is an explicit secular music genre (`Rap`, `Shaabi`, `Indie`, `Pop`, `Rock`, `Metal`), return `false`.
   - Refine `QURAN_REGEX`: replace `البناء` with `(?:الشيخ\s+)?البنا\b` to avoid matching the Arabic noun for building.
3. **Multi-Category Filter in `OfflineScreen.js`**:
   - `isQ = isQuranContent(t) && !isPodcastContent(t) && !isSecularArtist(t.artist)`
   - `isP = isPodcastContent(t) && !isQuranContent(t)`
   - `isM = !isQ && !isP`
   - Strictly route tracks based on these mutually exclusive categories.

### 4.3 Fix 3: Dedicated Podcasts Tab in Offline Vault
1. **State & Filtering in `OfflineScreen.js`**:
   - Update `folderTab` state: `'all' | 'music' | 'quran' | 'podcasts'`.
   - Add `podcastCount`:
     ```javascript
     const podcastCount = useMemo(() => (offlineTracks || []).filter(t => isPodcastContent(t) && !isQuranContent(t)).length, [offlineTracks]);
     ```
   - Update `displayedTracks` to handle `folderTab === 'podcasts'`.
   - Add empty state message in `renderEmpty` for empty podcasts tab:
     `No Downloaded Podcasts` / `لا توجد حلقات بودكاست محملة`.
2. **UI Tab in `OfflineHeroHeader.js`**:
   - Add 4th folder tab:
     `🎙️ بودكاست (${podcastCount})` (Arabic) / `🎙️ PODCASTS (${podcastCount})` (English).
   - Ensure responsive layout so all 4 tabs display cleanly without clipping.
3. **Badge in `OfflineTrackItem.js`**:
   - Display a purple `PODCAST` / `بودكاست` pill badge when `isPodcastContent(track)` is true.

---

## 5. File Boundaries (Files to Modify)

| Target File | Changes Required |
|---|---|
| `rivo-main/src/native/context/audio/streamResolverHelper.js` | Add manifest lookup via `getDownloadedTracks()`, fix `verifyLocalAudioFile` path validation and decoding, eliminate destructive record wipes and file deletions. |
| `rivo-main/src/utils/quranUtils.js` | Add secular artist blocklist (`isSecularArtist`), exclude secular artists and genres from `isQuranContent`, fix `البناء` regex false positive. |
| `rivo-main/src/native/screens/OfflineScreen.js` | Add `podcasts` tab to `folderTab`, compute `podcastCount`, isolate `displayedTracks` (mutually exclusive Music, Quran, Podcasts), add podcast empty state. Maintain < 400 lines limit. |
| `rivo-main/src/native/components/offline/OfflineHeroHeader.js` | Add 4th tab button for Podcasts (`🎙️ PODCASTS`), accept `podcastCount`, ensure balanced styling. |
| `rivo-main/src/native/components/offline/OfflineTrackItem.js` | Add badge for downloaded podcast episodes (`PODCAST` / `بودكاست`). |
| `rivo-main/src/native/screens/OfflineScreen.styles.js` | Adjust `folderTabBar` and `folderTabBtn` padding to fit 4 tabs cleanly. |
| `rivo-main/src/native/i18n/translations/en/offline.js` | Add `tabPodcasts`, `noPodcasts`, `noPodcastsSub`. |
| `rivo-main/src/native/i18n/translations/ar/offline.js` | Add `tabPodcasts`, `noPodcasts`, `noPodcastsSub`. |

---

## 6. Verification Method

### 6.1 Automated Verification Script
Create an automated test script (e.g. `scripts/verify-issue2-offline.cjs`) that executes cleanly under Node.js without remote infrastructure:

1. **Verify Offline Playback & Local URI Resolution**:
   - Mock a downloaded track with local file on disk (`file:///data/user/0/rivo_tracks/test_1.mp3`).
   - Mock `NetInfo.fetch()` returning `{ isConnected: false, isInternetReachable: false }`.
   - Call `resolveTrackPlaybackUri({ track: { _id: 'test_1', isDownloaded: true, localAudioUri: ... } })`.
   - Assert: returns valid local URI; does NOT throw `"Playback error: Offline song file is missing or damaged, and device is offline"`.
   - Call with external track `{ _id: 'test_1', title: 'Test', artist: 'Artist' }` (no `localAudioUri`).
   - Assert: queries manifest, finds `test_1`, and returns the local file URI.

2. **Verify Secular Artist Quran Exclusion**:
   - Test `isQuranContent` against secular artists with various titles:
     - `{ title: 'Samurai', artist: 'Cairokee' }` -> `false`
     - `{ title: 'Ethbat Makanak', artist: 'كايروكي' }` -> `false`
     - `{ title: 'Bet3ady', artist: 'Lege-Cy' }` -> `false`
     - `{ title: 'Mish Bel Hazz', artist: 'ليجي سي' }` -> `false`
     - `{ title: 'El Basha', artist: 'Cairokee', isQuran: true }` -> `false` (secular artist overrides corrupt flag)
     - `{ title: 'Track with إعادة البناء in description', artist: 'Cairokee' }` -> `false`
   - Test `isQuranContent` against authentic reciters:
     - `{ title: 'سورة البقرة', artist: 'مشاري العفاسي' }` -> `true`
     - `{ title: 'Surah Maryam', artist: 'محمود خليل الحصري' }` -> `true`
     - `{ title: 'تلاوة خاشعة', artist: 'عبد الباسط عبد الصمد' }` -> `true`

3. **Verify Offline Vault Tab Isolation**:
   - Provide a sample list containing: 2 secular music tracks (Cairokee, Lege-Cy), 2 Quran recitations (Al-Afasy, Al-Hussary), and 2 podcast episodes (Finjan, Daheeh).
   - Test folder tab filtering:
     - `folderTab === 'music'`: returns exactly the 2 secular music tracks (excludes Quran and Podcasts).
     - `folderTab === 'quran'`: returns exactly the 2 Quran recitations (Cairokee and Lege-Cy strictly excluded).
     - `folderTab === 'podcasts'`: returns exactly the 2 podcast episodes (strictly isolated).
     - `folderTab === 'all'`: returns all 6 tracks.

4. **Verify 400-Line Rule Compliance**:
   - Assert `OfflineScreen.js` line count <= 400.
   - Assert `OfflineHeroHeader.js` line count <= 400.
