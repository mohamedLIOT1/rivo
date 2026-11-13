# Issue 7 (Requirement R8): Genre and Tag Classification Accuracy — Technical Investigation & Handoff Report

## 1. Observation

### 1.1 Affected Files and Key Locations
- **`server/utils/genreClassifier.js`**:
  - Lines 37 & 51:
    ```javascript
    priority: def.isQuran ? 100 : (def.isPodcast ? 95 : (key === 'SHAABI' || key === 'RAP' ? 90 : 80))
    priority: def.isQuran ? 100 : (def.isPodcast ? 95 : (key === 'SHAABI' || key === 'RAP' ? 90 : 70))
    ```
    Artificial priority boost: SHAABI and RAP are hardcoded with priority `90`, whereas all other musical genres (INDIE, ROCK, METAL, TARAB, CLASSICAL, JAZZ, EDM, RNB, LOFI) are assigned priority `80` (artists) and `70` (keywords).
  - Lines 58-59:
    ```javascript
    ARTIST_INDEX.sort((a, b) => b.priority - a.priority || b.normalized.length - a.normalized.length);
    KEYWORD_INDEX.sort((a, b) => b.priority - a.priority || b.normalized.length - a.normalized.length);
    ```
    Because priority sorting precedes length sorting, any Rap or Shaabi keyword/artist is evaluated *before* any keywords or artists from Rock, Indie, Tarab, Classical, Jazz, Electronic, R&B, etc.
  - Lines 233-247 (Step 5: Fallback Artist Search in Title):
    ```javascript
    for (const item of ARTIST_INDEX) {
      if (matchesPattern(fullText, item.normalized)) {
        return {
          genre: item.genre.name,
          ...
        };
      }
    }
    ```
    Matches artist stage names across the entire `fullText` (title + artist + album + tags + description) without checking whether the matched word is an ambiguous dictionary noun (e.g. "future", "queen", "santa", "flower/وردة", "morning/صباح", "meteor/شهاب").
  - Lines 249-279 (Step 6 & 7: Fallback Collapse to Pop):
    ```javascript
    // 6. Linguistic / Script Heuristic
    if (hasArabicScript(rawCombined)) {
      const ap = GENRES.ARABIC_POP;
      return { genre: ap.name, ... };
    }
    // 7. General Fallback
    const pop = GENRES.POP;
    return { genre: pop.name, ... };
    ```
    Every track lacking an exact dictionary hit is unconditionally forced into "Arabic Pop" (if Arabic script is present) or "Pop" (for all other languages).

- **`server/utils/genreRules/textNormalizer.js`**:
  - Lines 74-88 (`matchesPattern`):
    ```javascript
    function matchesPattern(haystackNorm, needleNorm) {
      if (!haystackNorm || !needleNorm) return false;
      if (haystackNorm === needleNorm) return true;
      
      // Direct substring match
      if (haystackNorm.includes(needleNorm)) {
        // If needle is short (<= 3 chars), require word boundary
        if (needleNorm.length <= 3) {
          const regex = new RegExp(`(^|\\s)${escapeRegex(needleNorm)}(\\s|$)`, 'i');
          return regex.test(haystackNorm);
        }
        return true;
      }
      return false;
    }
    ```
    Any pattern with length `> 3` executes `haystackNorm.includes(needleNorm)` with **zero word boundary checks**.
    - Rap keyword `'trap'` (length 4) matches `"trapped"`, `"strapped"`, `"claptrap"`.
    - In Arabic script, `'تراب'` (length 4) matches Arabic words containing those letters as a substring:
      - `"اقتراب"` (coming closer / approach)
      - `"اغتراب"` (alienation / exile)
      - `"التراب"` (dirt / earth)
      - `"بتراب"`
      Result: Any emotional, acoustic, or Tarab track containing "اقتراب" or "اغتراب" is categorized as **Rap / Hip-Hop**.
    - Rap keyword `'diss'` (length 4) matches `"dissolve"`, `"dissonance"`, `"dismiss"`.
    - Rap keyword `'bars'` (length 4) matches `"barstool"`, `"rebars"`.
    - Rap keyword `'drill'` (length 5) matches `"drilling"`, `"mandrill"`.
    - Rap artist `'santa'` (length 5) matches `"santana"` (Carlos Santana), `"santa claus"`.
    - Rap artist `'flex'` (length 4) matches `"flexible"`.

- **`server/utils/genreRules/genreDefinitions.js`**:
  - Line 270 (`GENERIC_GENRES`):
    ```javascript
    const GENERIC_GENRES = new Set([
      'pop', 'imported', 'other', 'unknown', 'stereo', 'music', 'single', 'audio',
      'track', 'various', 'soundtrack', 'general', ''
    ]);
    ```
    `'pop'` and `'soundtrack'` are included in `GENERIC_GENRES`. Legitimate explicit genres ("Pop", "Soundtrack", "Film Score") are discarded, forcing tracks into the fallback pipeline where they misclassify.
  - Shaabi and Mahraganat are conflated into a single entry: `SHAABI: { name: 'Mahraganat / Shaabi' }`.
  - Tarab is conflated with Classical: `TARAB: { name: 'Tarab / Classical' }`, while Western Classical also exists as `CLASSICAL: { name: 'Classical' }`.
  - Lack of a dedicated `SOUNDTRACK` / `INSTRUMENTAL` genre causes instrumental film scores and game music to collapse into "Pop".

- **`src/native/utils/genreClassifier.js` & `src/utils/genreClassifier.js`**:
  - `src/native/utils/genreClassifier.js` maintains an independent, out-of-sync copy of `GENRES`.
  - In `src/native/utils/genreClassifier.js` lines 349-361:
    Iterates sequentially over `Object.values(GENRES)`. Because `SHAABI` and `RAP` are keys 2 and 3 in the object, they are evaluated before Indie, Tarab, Arabic Pop, Rock, Metal, EDM, and R&B!
  - `src/native/utils/genreClassifier.js` uses `fullText.includes(normalizeSearchText(k))` with no word boundaries for all keywords.
  - `src/utils/genreClassifier.js` lines 6-47 exports a divergent `GENRE_MAP` with mismatching keys (`'Mahraganat'` instead of `'Mahraganat / Shaabi'`, `'Classic / Tarab'` instead of `'Tarab / Classical'`, `'Electronic'` instead of `'EDM / Electronic'`, and missing `Rock`, `Metal`, `Lo-Fi`, `Jazz`, `Classical`, `Pop`).

- **Server Ingestion Routers**:
  - `server/routes/tracks/tracksImportRouter.js` line 222:
    `const classification = classifyGenre({ title, artist, album });`
    Existing `genre`, `tags`, and `description` are dropped.
  - `server/routes/tracks/tracksPersistenceRouter.js` line 160:
    `const classification = classifyGenre({ title: cleanTitle, artist: cleanArtist, album: cleanAlbum });`
  - `server/routes/tracks/tracksResolutionRouter.js` line 51:
    `const classification = classifyGenre({ title: cleanTitle, artist: cleanArtist, album: cleanAlbum });`
  - `server/routes/playlists/playlistImportService.js` line 70:
    `genre: itemIsQuran ? 'Holy Quran' : classifyGenre({ title: item.title, artist: trackArtist, album: finalAlbumName }).genre`
  - `server/utils/trackMetadataUtils.js` lines 21-39:
    Implements `fetchTrackMetadata(title, artist)` which queries iTunes and returns `primaryGenreName`, but it is **never called** in any router!

- **Recommendation & Queue Feedback**:
  - `src/utils/tasteAlgorithm.js` lines 56-60 & 167-179:
    ```javascript
    export function detectTrackGenre(track) {
      if (!track) return 'Pop';
      const res = classifyGenre(track);
      return res.genre || 'Pop';
    }
    ```
    Because `classifyGenre` collapses diverse songs into Rap or Pop, `preferredGenreSet` clusters recommended tracks almost exclusively into Rap or Pop, perpetuating the bias into queue generation (R7) and playlist AI recommendations (R2).

---

## 2. Logic Chain

1. **Premise 1**: The user reported: *"songs are accurately categorized into their proper genres, preventing over-generalization where diverse tracks are erroneously labeled solely as rap or pop."*
2. **Step 2 (The Rap Over-Generalization Mechanism)**:
   - In `genreClassifier.js`, SHAABI and RAP have an artificial priority of `90`, while all other music genres have `70` or `80`.
   - In `textNormalizer.js`, any search term longer than 3 characters is checked using raw `includes()` without word boundaries.
   - The Rap keyword `'تراب'` (Trap) is a 4-letter Arabic substring. It is contained within common Arabic words such as `"اقتراب"` (approach) and `"اغتراب"` (exile / longing), which are frequent themes in classical Arabic, Tarab, and Indie songs.
   - The Rap keyword `'diss'` matches `"dissolve"` and `"dissonance"`.
   - The Rap keyword `'bars'` matches `"barstool"`.
   - In Step 5, artist matching across the title checks words like `"future"`, `"santa"`, and `"flex"` without requiring delimiters or multi-word context.
   - Consequently, tracks from varied genres (Pop, Rock, Indie, Tarab) containing these words in their title or description are pulled into `RAP` because `RAP` has priority `90` and precedes all other genres in index evaluation.
3. **Step 3 (The Pop Over-Generalization Mechanism)**:
   - For all tracks where keywords or artists do not hit the hardcoded dictionary, Step 6 and Step 7 execute.
   - Step 6 assigns `"Arabic Pop"` to any track with Arabic characters.
   - Step 7 assigns `"Pop"` to any other track.
   - Legitimate genres provided by external APIs (e.g. `"Soundtrack"`, `"Pop"`) are discarded by `GENERIC_GENRES`.
   - Routers (`tracksImportRouter`, `tracksPersistenceRouter`, `tracksResolutionRouter`) fail to pass `genre` or `tags` into `classifyGenre`, depriving the classifier of metadata.
   - Consequently, diverse genres (Rock, Heavy Metal, Jazz, Classical, Blues, Indie, Soundtrack, EDM, R&B) that do not match the narrow dictionary default unconditionally to "Pop" (or "Arabic Pop").
4. **Step 4 (Genre Conflation and Taxonomic Gaps)**:
   - Traditional Shaabi (Acoustic folk, Ahmed Adaweya, Abdel Basset Hamouda, Tarek El Sheikh, Ahmed Sheba) is grouped together with electronic street festival music (Mahraganat, Essam Sasa, Hamo Bika, Hassan Shakosh).
   - Tarab is labeled "Tarab / Classical", colliding with Western Classical music.
   - Instrumental and soundtrack scores lack a designated genre, defaulting to Pop.
5. **Step 5 (Client-Server Desynchronization)**:
   - `src/native/utils/genreClassifier.js` and `src/utils/genreClassifier.js` duplicate classification logic without priority sorting or word boundary enforcement.
   - Mismatched genre keys in `GENRE_MAP` cause client-side taste and mood algorithms (`tasteAlgorithm.js`) to miss genre clusters.
6. **Conclusion**: Resolving the over-generalization requires:
   - Removing the artificial 90 priority bias for Rap and Shaabi.
   - Enforcing strict word boundary matching across all pattern lengths in `matchesPattern`.
   - Blacklisting ambiguous single-word stage names from loose title matching.
   - Removing `'pop'` and `'soundtrack'` from `GENERIC_GENRES`.
   - Separating Shaabi and Mahraganat into distinct genres.
   - Establishing a dedicated `Soundtrack / Instrumental` genre.
   - Passing `genre` and `tags` through all track ingestion and persistence routers.
   - Synchronizing definitions across server and client utilities.

---

## 3. Caveats

- **No Mutating Edits Performed**: This is a read-only investigation. No source files have been modified.
- **No Test Source Code Inspected**: In strict compliance with user instructions ("The team must NOT read test source code to understand expected behaviour before implementing"), no test files (such as `tests/test_genreClassifier.js`) were read or inspected.
- **External Network Dependency for iTunes Metadata**: `fetchTrackMetadata` queries `itunes.apple.com`. In offline or firewalled environments, external metadata fetching may time out; the classifier must remain fully functional using local title, artist, album, and keyword heuristics.

---

## 4. Conclusion & Architectural Fix Proposal

### 4.1 Taxonomic Refinement
Expand `GENRES` in `server/utils/genreRules/genreDefinitions.js` and `src/native/utils/genreClassifier.js` to 18 canonical genres:

1. `QURAN`: Code `QURAN`, Name `Holy Quran`, Arabic `قرآن كريم`
2. `PODCAST`: Code `PODCAST`, Name `Podcast`, Arabic `بودكاست`
3. `SHAABI`: Code `SHAABI`, Name `Shaabi`, Arabic `شعبي` (Traditional Egyptian Shaabi / Folk)
4. `MAHRAGANAT`: Code `MAHRAGANAT`, Name `Mahraganat`, Arabic `مهرجانات` (Electro-Shaabi)
5. `RAP`: Code `RAP`, Name `Rap / Hip-Hop`, Arabic `راب / هيب هوب`
6. `INDIE`: Code `INDIE`, Name `Indie / Alternative`, Arabic `إندي / بديل`
7. `TARAB`: Code `TARAB`, Name `Tarab`, Arabic `طرب أصيل` (Classic Arabic Tarab)
8. `ARABIC_POP`: Code `AR-POP`, Name `Arabic Pop`, Arabic `بوب عربي`
9. `KHALEEJI`: Code `KHALEEJI`, Name `Khaleeji`, Arabic `خليجي`
10. `ROCK`: Code `ROCK`, Name `Rock`, Arabic `روك`
11. `METAL`: Code `METAL`, Name `Metal`, Arabic `ميتال`
12. `ELECTRONIC`: Code `EDM`, Name `EDM / Electronic`, Arabic `إلكترونيك / EDM`
13. `RNB`: Code `RNB`, Name `R&B / Soul`, Arabic `آر أند بي / سول`
14. `LOFI`: Code `LOFI`, Name `Lo-Fi`, Arabic `لو-فاي`
15. `JAZZ`: Code `JAZZ`, Name `Jazz / Blues`, Arabic `جاز / بلوز`
16. `CLASSICAL`: Code `CLASSIC`, Name `Classical`, Arabic `موسيقى كلاسيكية` (Western Classical / Symphony)
17. `SOUNDTRACK`: Code `SOUNDTRACK`, Name `Soundtrack / Instrumental`, Arabic `موسيقى تصويرية`
18. `POP`: Code `POP`, Name `Pop`, Arabic `بوب عالمي`

### 4.2 Exact Code Fixes Required

#### 1. `server/utils/genreRules/textNormalizer.js`
Replace `matchesPattern`:
```javascript
function matchesPattern(haystackNorm, needleNorm) {
  if (!haystackNorm || !needleNorm) return false;
  if (haystackNorm === needleNorm) return true;
  
  // Enforce word boundaries for all tokens to prevent root collisions (e.g. 'تراب' in 'اقتراب')
  const escaped = escapeRegex(needleNorm);
  const regex = new RegExp(`(^|[\\s\\-_/\\\\|:;,()\\[\\]{}])(?:ال)?${escaped}([\\s\\-_/\\\\|:;,()\\[\\]{}]|$)`, 'i');
  return regex.test(haystackNorm);
}
```

#### 2. `server/utils/genreClassifier.js`
- **Equalize Priorities**:
  Change lines 37 & 51 so all musical genres share equal priority (`85` for artists, `75` for keywords):
  ```javascript
  priority: def.isQuran ? 100 : (def.isPodcast ? 95 : 85)
  priority: def.isQuran ? 100 : (def.isPodcast ? 95 : 75)
  ```
- **Ambiguous Artist Guard in Step 5**:
  Define a set of ambiguous dictionary words:
  ```javascript
  const AMBIGUOUS_ARTISTS = new Set([
    'future', 'queen', 'santa', 'flex', 'flx', 'rose',
    'وردة', 'صباح', 'شهاب', 'مهاب', 'شاهين', 'الضبع', 'عنبة', 'كزبرة', 'فيلو'
  ]);
  ```
  In Step 5 (artist search in title):
  ```javascript
  for (const item of ARTIST_INDEX) {
    if (AMBIGUOUS_ARTISTS.has(item.normalized)) {
      // Ambiguous single-word stage names MUST NOT match plain title words unless separated by delimiters
      const delimiterRegex = new RegExp(`(^|[\\-_|/:]\\s*|feat\\.?\\s+|ft\\.?\\s+|by\\s+)${escapeRegex(item.normalized)}(\\s*[\\-_|/:]|\\s*$)`, 'i');
      if (!delimiterRegex.test(fullText)) continue;
    }
    if (matchesPattern(fullText, item.normalized)) {
      return { genre: item.genre.name, ... };
    }
  }
  ```
- **Respect Explicit Genres in Step 2**:
  Remove `'pop'` and `'soundtrack'` from `GENERIC_GENRES`.
  If `normExplicit` matches an alias in `ALIAS_INDEX`, return that canonical genre immediately.

#### 3. Ingestion Routers
In:
- `server/routes/tracks/tracksImportRouter.js` line 222
- `server/routes/tracks/tracksPersistenceRouter.js` line 160
- `server/routes/tracks/tracksResolutionRouter.js` line 51
- `server/routes/playlists/playlistImportService.js` line 70
Change calls from:
`classifyGenre({ title, artist, album })`
To:
`classifyGenre({ title, artist, album, genre, tags, description })`
And incorporate `fetchTrackMetadata(title, artist)` to capture iTunes `primaryGenreName` during external resolution.

#### 4. Client Utilities
Synchronize `src/native/utils/genreClassifier.js`, `src/utils/genreClassifier.js`, and `src/native/utils/tasteAlgorithm.js` with the 18-genre taxonomy and word-boundary pattern matching.

---

## 5. Verification Method

### 5.1 Automated Standalone Reproduction & Verification Suite
Create an automated, non-mutating validation script (e.g. `scripts/verifyGenreClassification.js`) that tests the classification engine against a suite of positive, negative, and edge-case track payloads:

```javascript
const assert = require('assert');
const { classifyGenre } = require('../server/utils/genreClassifier');

const testCases = [
  // 1. Root-collision checks (MUST NOT be Rap)
  { input: { title: "اقتراب الوعد الحق", artist: "أحمد النجار" }, expected: "Arabic Pop" },
  { input: { title: "أغنية عن الاغتراب", artist: "كايروكي" }, expected: "Indie / Alternative" },
  { input: { title: "Future Days", artist: "Pearl Jam" }, expected: "Rock" },
  { input: { title: "Future Nostalgia", artist: "Dua Lipa" }, expected: "Pop" },
  { input: { title: "Dancing Queen", artist: "ABBA" }, expected: "Pop" },
  { input: { title: "Smooth", artist: "Carlos Santana" }, expected: "Rock" },
  { input: { title: "Dissonance & Dissolve", artist: "The Cure" }, expected: "Indie / Alternative" },

  // 2. Shaabi vs Mahraganat Distinction
  { input: { title: "بنت السلطان", artist: "أحمد عدوية" }, expected: "Shaabi" },
  { input: { title: "أنا مش عارفني", artist: "عبد الباسط حمودة" }, expected: "Shaabi" },
  { input: { title: "سوق البنات", artist: "محمود الليثي" }, expected: "Shaabi" },
  { input: { title: "مهرجان بنت الجيران", artist: "حسن شاكوش وعمر كمال" }, expected: "Mahraganat" },
  { input: { title: "مهرجان كلها بالاونطة", artist: "عصام صاصا" }, expected: "Mahraganat" },

  // 3. Authentic Genre Coverage (Preventing Default Pop)
  { input: { title: "Comfortably Numb", artist: "Pink Floyd" }, expected: "Rock" },
  { input: { title: "Master of Puppets", artist: "Metallica" }, expected: "Metal" },
  { input: { title: "So What", artist: "Miles Davis" }, expected: "Jazz / Blues" },
  { input: { title: "Moonlight Sonata", artist: "Beethoven" }, expected: "Classical" },
  { input: { title: "Time", artist: "Hans Zimmer", genre: "Soundtrack" }, expected: "Soundtrack / Instrumental" },
  { input: { title: "Summer", artist: "Calvin Harris" }, expected: "EDM / Electronic" },
  { input: { title: "Thinkin Bout You", artist: "Frank Ocean" }, expected: "R&B / Soul" },
  { input: { title: "الأماكن", artist: "محمد عبده" }, expected: "Khaleeji" },
  { input: { title: "إنت عمري", artist: "أم كلثوم" }, expected: "Tarab" },
  { input: { title: "تملي معاك", artist: "عمرو دياب" }, expected: "Arabic Pop" },
  { input: { title: "Lofi Study Session", artist: "Lofi Girl" }, expected: "Lo-Fi" },
  { input: { title: "سورة الكهف", artist: "مشاري العفاسي" }, expected: "Holy Quran" }
];

let passed = 0;
for (const tc of testCases) {
  const result = classifyGenre(tc.input);
  assert.strictEqual(result.genre, tc.expected, `Failed for "${tc.input.title}": expected "${tc.expected}", got "${result.genre}"`);
  passed++;
}
console.log(`All ${passed} classification tests passed successfully!`);
```

### 5.2 Verification Invalidation Conditions
The fix is considered invalid if:
1. "Pearl Jam - Future Days" or "Dua Lipa - Future Nostalgia" is classified as "Rap / Hip-Hop".
2. Arabic tracks containing "اقتراب" or "اغتراب" are classified as "Rap / Hip-Hop".
3. "Ahmed Adaweya" or "Abdel Basset Hamouda" are classified as "Mahraganat" instead of "Shaabi".
4. Movie soundtracks and classical pieces with genre "Soundtrack" are stripped and labeled "Pop".
5. Secular tracks (e.g. Cairokee, Lege-Cy) are marked `isQuran: true`.
