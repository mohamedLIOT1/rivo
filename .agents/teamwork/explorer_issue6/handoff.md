# Technical Handoff Report: Issue 6 (Requirement R7) - Queue AI Suggestions Relevance

**Investigator**: explorer_issue6  
**Mission**: Investigate and diagnose Issue 6 (Requirement R7): Queue AI Suggestions Relevance.  
**Target Goal**: Fix the AI queue suggestion algorithm to ensure recommended next tracks strictly adhere to user listening history, language, and preferences, preventing out-of-context or irrelevant genres (such as unsolicited Hindi music).  
**Integrity Mode**: Demo (Read-only investigation, zero test code inspection, zero code mutations).

---

## 1. Observation

### 1.1 Architecture & Entry Points for Queue Suggestions and AI Recommendations
Queue suggestions and auto-queue recommendations are driven across both client (Web and Native) and server layers:

1. **Client Web Auto-Queue & Direct Selection (`src/context/AudioContext.jsx`)**:
   - **Line 2384–2418**: On single track playback (from home, search, or tap), the upcoming queue is populated using `getSmartTasteAndMoodTracks`:
     ```javascript
     const smartUpcoming = getSmartTasteAndMoodTracks({
       allTracks: pool,
       currentUser: currentUserRef.current,
       followedArtists: followed,
       likedTrackIds: likedTrackIds || [],
       excludeTrackIds: excludeSet,
       currentTrack: trackToPlay,
       limit: 20,
       maxPerArtist: 2,
     });
     const taggedUpcoming = (smartUpcoming || []).map(t => ({
       ...t,
       isSmartMoodQueue: true,
       isAiSuggestion: true,
     }));
     resolvedQueue = [trackToPlay, ...taggedUpcoming];
     ```
   - **Line 3054–3083, 3179–3220, 3279–3319**: When nearing the end of the queue or when auto-advancing with repeat off, `AudioContext.jsx` invokes `getSmartTasteAndMoodTracks` to fetch the next batch of 20 tracks, tagged with `isSmartMoodQueue: true, isAiSuggestion: true`.
   - **Line 2575–2637**: `fetchSmartShuffleTracks` calls `POST /api/ai/smart-shuffle` with `{ currentTrack: seedTrack, seedTracks: currentList.slice(0, 5), followedArtists: followed, limit: 8 }` and injects tracks marked `isAiSuggestion: true, isSmartShuffle: true`.

2. **Client Native Auto-Queue (`src/native/context/audio/useAudioQueue.js` & `useAudioPlaybackCore.js`)**:
   - **`useAudioPlaybackCore.js:228–230`**: On playing a single track, builds seed queue via `buildSmartSeedQueue(track, pool, { currentUser, followedArtists, likedTrackIds })`.
   - **`useAudioQueue.js:228–261`**: `triggerAutoQueue` runs `getSmartTasteAndMoodTracks` when playback reaches the end of the queue.

3. **Client Queue Display (`src/components/FullPlayerModal.jsx`)**:
   - **Line 225–237 & 1330–1360**: Full player partitions queue into `normalQueue` and `aiQueue` based on `t.isAiSuggestion || t.isSmartShuffle`, showing the section **"AI Suggestions ({aiQueue.length})"** and **"AI DISCOVERY"**.

4. **Playlist AI Recommendations (`src/screens/PlaylistScreen.jsx`)**:
   - **Line 685–713**: `handleFetchAiRecommendations` calls `POST /api/ai/recommendations` and appends returned tracks with `isAiSuggestion: true` to the playback queue.

5. **Server AI Routes & Services (`server/routes/ai.js` & `server/routes/ai/recommendationService.js`)**:
   - **`server/routes/ai.js:11–44`**: `POST /api/ai/recommendations` invokes `getCuratedRecommendations`.
   - **`server/routes/ai.js:223–232`**: `POST /api/ai/smart-shuffle` invokes `getSmartShuffleTracks`.
   - **`server/routes/ai/recommendationService.js:147–245`**: `getSmartShuffleTracks` selects tracks from MongoDB `Track.find(query).sort({ plays: -1 }).limit(150).lean()` and applies Gemini prompting or fallback scoring.

---

### 1.2 Observed Flaws in `src/utils/tasteAlgorithm.js` and `src/native/utils/tasteAlgorithm.js`

#### Observation A: Disproportionate Exploratory Random Jitter
In `src/utils/tasteAlgorithm.js` (lines 338–341) and `src/native/utils/tasteAlgorithm.js` (lines 343–345):
```javascript
// 11. Dynamic exploratory jitter & organic rotation (+0 to 70 pts)
// Ensures fresh organic diversity every time suggestions are requested
score += Math.random() * 55 + (Math.random() * 15);
```
- The maximum random jitter added to ANY candidate track is **70 points**.
- Compare this with the legitimate affinity bonuses:
  - Real listening history play: `+8 to +14 pts`
  - Real listened artist weight: `+up to 12 pts`
  - Liked track: `+15 pts`
  - Liked artist similarity: `+12 pts`
  - Followed artist: `+20 pts`
  - Seed artist context bonus: `+32 pts`
  - Similar-vibe genre clustering synergy: `+28 pts`
  - Unplayed novelty bonus: `+15 pts` (line 344)
  - Popularity: `+up to 10 pts` (line 336)

#### Observation B: Zero Language / Script Detection or Filtering
- Neither `src/utils/tasteAlgorithm.js` nor `src/native/utils/tasteAlgorithm.js` performs any check on language, alphabet, or script.
- There is no check for Devanagari (`\u0900-\u097F`), Gurmukhi, or other Indic scripts vs Arabic (`\u0600-\u06FF`) vs Latin.
- There is no check against `currentUser.preferences?.language` (`'ar'` | `'en'`) or browser preference (`localStorage.getItem('rivo_language')`).
- There is no check of the user's historical listening languages in `historyList` or `trackStatsMap` (`listeningTracker.js`).

#### Observation C: Destructive Fisher-Yates Shuffle on Scored Candidates
In `src/utils/tasteAlgorithm.js` (lines 388–402):
```javascript
// Dynamic top contextual selection + Fisher-Yates shuffle
let selected = [];
if (candidatePool.length > 0) {
  const topCandidatesCount = Math.min(3, candidatePool.length);
  const topPickIdx = Math.floor(Math.random() * topCandidatesCount);
  const first = candidatePool[topPickIdx];
  const rest = candidatePool.filter((_, idx) => idx !== topPickIdx);

  // Fisher-Yates shuffle the rest for non-static variety
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  selected = [first, ...rest].slice(0, limit);
}
```
Any lower-scored track that slipped into `candidatePool` due to the +70 jitter can be randomized to index 1 or 2 immediately after the currently playing song.

---

### 1.3 Observed Flaws in Genre Classification (`genreClassifier.js` and `genreDefinitions.js`)

In `src/native/utils/genreClassifier.js` (line 368) and `server/utils/genreClassifier.js` (line 268–279):
```javascript
  // 4. Arabic script heuristic
  if (/[\u0600-\u06FF]/.test(`${title} ${artist}`)) {
    return { genre: GENRES.ARABIC_POP.name, arabicGenre: GENRES.ARABIC_POP.arabicName, isQuran: false, isPodcast: false };
  }

  // 7. General Fallback
  return { genre: GENRES.POP.name, arabicGenre: GENRES.POP.arabicName, isQuran: false, isPodcast: false };
```
- In `server/utils/genreRules/genreDefinitions.js`, `GENRES` defines: `QURAN`, `SHAABI`, `RAP`, `INDIE`, `TARAB`, `ARABIC_POP`, `KHALEEJI`, `ROCK`, `METAL`, `ELECTRONIC`, `RNB`, `LOFI`, `JAZZ`, `CLASSICAL`, `POP`, `PODCAST`.
- **There is NO genre definition for Bollywood, Hindi, Punjabi, or Desi music.**
- Any Hindi/Indian song uploaded, imported, or searched that lacks Arabic letters defaults to `Pop`!
- Consequently, if a user plays a `Pop` song or if `seedGenre` is `Pop`, the Hindi song matches `preferredGenreSet` and receives the full `+28 pts` genre synergy bonus!

---

### 1.4 Observed Flaws in Server Smart Shuffle (`server/routes/ai/recommendationService.js`)

In `server/routes/ai/recommendationService.js` (lines 173–242):
- Candidate pool:
  ```javascript
  const candidatePool = await Track.find(query).sort({ plays: -1 }).limit(150).lean();
  ```
  This query pulls the top 150 songs in the entire database by play count without filtering by language, region, or genre family.
- Fallback scoring:
  ```javascript
  const scored = available.map(t => {
    let score = Math.random() * 12;
    const tArtistNorm = getPrimaryArtistNormalized(t.artist);
    const tGenre = (t.genre || '').toLowerCase().trim();
    if (followedSet.has(tArtistNorm)) score += 45;
    if (curArtistNorm && tArtistNorm === curArtistNorm) score += 25;
    if (curGenre && tGenre && (curGenre === tGenre || curGenre.includes(tGenre))) score += 35;
    score += Math.min(15, Math.log10((Number(t.plays) || 0) + 1) * 4);
    return { track: t, score };
  });
  ```
  If `curGenre` is absent or does not match, a popular Hindi song with high plays (`log10(plays + 1) * 4`) and random jitter receives 15–25 points, easily tying or beating other tracks and ending up in the top 8 returned tracks.
- Gemini prompt (lines 186–189):
  Contains NO language or negative genre constraints; it merely asks to "Select the top ${limit} tracks from this list that flow best sonically and stylistically".

---

## 2. Logic Chain

1. **Step 1: Track Scoring Distortions Lead to Irrelevant Selections (Observation A & B)**
   - When an Arabic user listens to Arabic music (e.g., Egyptian Rap, Mahraganat, Tarab, Arabic Pop):
     - An unplayed, unsolicited Hindi song has 0 listening history, 0 liked artist, and mismatched genre.
     - However, the algorithm grants it `+15 pts` (novelty bonus) + up to `+10 pts` (play count) + up to `+70 pts` (random jitter).
     - Its potential score reaches `15 + 10 + 70 = 95 points`.
     - Meanwhile, a genuine relevant track matching the user's preferred genre (`+28 pts`) with a lower random jitter roll of `+10 pts` reaches only `28 + 15 + 10 = 53 points`.
     - **Conclusion**: The 70-point exploratory jitter allows completely irrelevant songs to easily outscore relevant ones.

2. **Step 2: Fallback Genre Classification Masquerades Foreign Content (Observation 1.3)**
   - Because `genreDefinitions.js` has no Indian/Bollywood taxonomy, Indian songs (e.g. Arijit Singh, Neha Kakkar, Bollywood soundtracks) fall back to `genre: 'Pop'`.
   - When a user plays an Arabic Pop song or international Pop song, `preferredGenreSet` includes `'Pop'`.
   - The Hindi song receives `+28 pts` for genre synergy because the algorithm believes it belongs to the exact same musical category as the user's current track.

3. **Step 3: Missing Language & Script Incompatibility Filters (Observation B)**
   - The user's listening profile in `listeningTracker.js` contains 100% Arabic and Western tracks, with 0 Indic plays.
   - The application has user preferences `currentUser.preferences.language = 'ar'`.
   - Yet `tasteAlgorithm.js` never evaluates the script or language of candidates, never detects Devanagari/Indic markers, and applies 0 penalty for language mismatch.

4. **Step 4: Queue Randomization Scrambles Suggestions (Observation C)**
   - After selecting candidates, Fisher-Yates shuffling scrambles the `candidatePool`. Even if an irrelevant track scored slightly lower than the top candidate, it can be placed immediately at slot 1 or 2 in the AI queue.

5. **Step 5: Backend Smart Shuffle Injects High-Play DB Songs (Observation 1.4)**
   - The server queries the top 150 tracks by plays globally. If popular Hindi songs exist in the database, they enter the pool. Without language filtering or strict prompt instructions to Gemini, they get returned in smart shuffle.

---

## 3. Caveats

1. **User Multilingual Preference**: If a user actively listens to Hindi/Bollywood music (evidenced by their actual listening history in `listeningTracker` or followed artists), Hindi recommendations should NOT be blocked for that specific user. The algorithm must be adaptive: block unsolicited Hindi music when absent from user profile, but respect it if the user legitimately plays it.
2. **Read-Only Investigation**: No source code was modified during this investigation. Implementation and test verification must be performed by the designated implementer/tester agents.
3. **No Test Code Reading**: As strictly mandated by integrity constraints, no existing test files were read or inspected during this analysis.

---

## 4. Conclusion & Architectural Fix

The injection of out-of-context genres (specifically unsolicited Hindi music) is caused by:
1. **Uncalibrated Random Jitter**: An overwhelming `Math.random() * 55 + Math.random() * 15` (+0 to 70 pts) that overpowers actual user affinities (+15 to +32 pts).
2. **Absence of Language / Script Verification**: Zero inspection of Devanagari/Indic scripts vs user language and history.
3. **Missing Bollywood/Indian Genre Classification**: Hindi songs fall back to `Pop` and falsely trigger `+28` genre synergy.
4. **Lack of Genre Compatibility Matrix**: Incompatible genres receive 0 penalty.
5. **Unfiltered Backend Candidate Queries**: Top 150 songs in DB queried without language boundaries.

### Exact Algorithmic Improvements:

#### 1. Script & Language Compatibility Engine (Client & Server)
- Define script detectors:
  - `hasArabicScript(text)`: `/[\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF]/.test(text)`
  - `hasIndicScript(text)`: `/[\\u0900-\\u097F\\u0A00-\\u0A7F\\u0980-\\u09FF\\u0A80-\\u0D7F]/.test(text)` (Devanagari, Gurmukhi, Bengali, etc.)
  - `isIndicTrack(track)`: Returns true if title/artist has Indic script, genre is `Bollywood / Indian`, or artist/keywords match Indian/Bollywood signatures (`arijit singh`, `neha kakkar`, `badshah`, `bollywood`, `punjabi`, etc.).
- Extract user profile:
  - Check `listeningTracker.js` (`historyList` and `trackStatsMap`) + liked songs + followed artists.
  - If user has **zero** Indic plays in history and `currentTrack` is NOT Indic:
    - **Hard block / -300 pt penalty** for any Indic/Hindi candidate track. Unsolicited Hindi music is strictly excluded!
  - If `currentTrack` is Arabic, enforce Arabic language harmony (+25 pts for Arabic, normal for Western in user history, -300 pts for unsolicited foreign scripts).

#### 2. Introduce `Bollywood / Indian` Genre Definition
- In `server/utils/genreRules/genreDefinitions.js`, `server/utils/genreClassifier.js`, and `src/native/utils/genreClassifier.js`:
  - Add `BOLLYWOOD_INDIC`:
    - Code: `BOLLYWOOD`, Name: `Bollywood / Indian`, Arabic: `هندي / بوليوود`
    - Keywords: `bollywood`, `hindi`, `punjabi`, `desi`, `bhangra`, `filmi`, `بوليوود`, `هندي`
    - Artists: `arijit singh`, `neha kakkar`, `badshah`, `shreya ghoshal`, `diljit dosanjh`, `lata mangeshkar`, `kishore kumar`, `alka yagnik`, `sonu nigam`, `kumar sanu`, `udit narayan`, `a.r. rahman`, `pritam`, `jubin nautiyal`, etc.
  - In `classifyGenre`: Before fallback to `Pop`, if `hasIndicScript(fullText)` or matches Indian keywords/artists, return `Bollywood / Indian`.

#### 3. Genre Compatibility Matrix & Negative Distance Penalties
- In `tasteAlgorithm.js`:
  - Define `GENRE_COMPATIBILITY`:
    - `Rap / Hip-Hop`: compatible with `Mahraganat / Shaabi`, `R&B / Soul`, `Electronic`
    - `Mahraganat / Shaabi`: compatible with `Rap / Hip-Hop`, `Arabic Pop`
    - `Arabic Pop`: compatible with `Indie / Alternative`, `Khaleeji`, `Classic / Tarab`
    - `Classic / Tarab`: compatible with `Arabic Pop`
    - `Bollywood / Indian`: strictly isolated to `Bollywood / Indian`
  - If candidate genre is incompatible with `currentTrack`'s genre: apply `-60 pts` penalty.
  - If compatible: apply `+20 pts`.

#### 4. Rationalize Exploratory Jitter & Preserve Ranking Order
- In `tasteAlgorithm.js`:
  - Change random jitter from `Math.random() * 55 + Math.random() * 15` (+0 to 70 pts) to `Math.random() * 5` (+0 to 5 pts).
  - Jitter now acts solely as a micro tie-breaker, not an affinity override.
  - Remove destructive Fisher-Yates shuffle; return tracks ordered by verified relevance.

#### 5. Backend Server Recommendation Safeguards
- In `server/routes/ai/recommendationService.js`:
  - Filter `candidatePool` before passing to Gemini or fallback scorer:
    - If `currentTrack` is Arabic, exclude Indic/Devanagari tracks.
  - In Gemini prompt:
    - Add instruction: `STRICT REQUIREMENT: Recommended tracks must strictly match the language, culture, and musical style of the seed track (${seedStr}). Never recommend out-of-context languages or genres (e.g. do not recommend Hindi, Bollywood, or unrelated regional music when user is listening to Arabic or Western music).`
  - In fallback scorer:
    - Use `classifyGenre(t)` to ensure authentic genre comparison instead of unverified raw strings.

---

### Exact File Boundaries

| Target File | Modifications Required |
|---|---|
| `rivo-main/src/utils/tasteAlgorithm.js` | Add Indic/Arabic script detection, user history language profiling, genre compatibility matrix, unsolicited Hindi exclusion (-300 pts), reduce jitter to 0-5 pts, remove Fisher-Yates scramble. |
| `rivo-main/src/native/utils/tasteAlgorithm.js` | Mirror client web changes for native mobile (script detection, Hindi exclusion, genre compatibility, 0-5 pt jitter). |
| `rivo-main/src/native/utils/genreClassifier.js` | Add `BOLLYWOOD_INDIC` genre definition and Indic script detection in `classifyGenre`. |
| `rivo-main/server/utils/genreRules/genreDefinitions.js` | Add `BOLLYWOOD` genre taxonomy (keywords, artists, aliases). |
| `rivo-main/server/utils/genreClassifier.js` | Add Indic script check before generic `Pop` fallback. |
| `rivo-main/server/routes/ai/recommendationService.js` | Enforce language/culture pool filtering, Gemini prompt negative constraint, fallback genre normalization. |
| `rivo-main/server/routes/ai.js` | Forward `req.user` / user language preferences to `getCuratedRecommendations` and `getSmartShuffleTracks`. |
| `rivo-main/src/context/AudioContext.jsx` | Pass user language (`currentUser?.preferences?.language`) to `getSmartTasteAndMoodTracks`. |
| `rivo-main/src/native/context/audio/useAudioQueue.js` | Pass user language and preferences to `getSmartTasteAndMoodTracks`. |

---

## 5. Verification Method

### Automated Reproduction & Verification Strategy

Create a standalone automated verification script `verify_issue6_queue_relevance.js` executed via Node.js:

```javascript
// Test Matrix:
// 1. Script & Language Detection Test:
//    - "Kesariya" by "Arijit Singh" -> detected as Indic/Hindi
//    - "البخت" by "ويجز" -> detected as Arabic
//    - "Tum Hi Ho" -> detected as Indic/Hindi
// 2. Genre Classification Test:
//    - Arijit Singh track -> classified as "Bollywood / Indian", NEVER "Pop"
// 3. Queue Suggestion Simulation (100 Iterations):
//    - Pool: 15 Arabic tracks (Wegz, Cairokee, Marwan Pablo, Amr Diab), 5 Hindi tracks (Arijit Singh, Neha Kakkar)
//    - User profile: Arabic listener (history has 0 Hindi tracks), currentTrack: Wegz - El Bakht
//    - Assert: In 100 queue generations, 0% Hindi songs appear in suggestions
//    - Assert: 100% of suggested songs match Arabic language and compatible genres (Rap / Shaabi / Pop)
// 4. Smart Shuffle Backend Test:
//    - getSmartShuffleTracks with Arabic seed track against mixed pool
//    - Assert: Result contains zero Indic/Bollywood tracks
```

**Commands to Run**:
```bash
node c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\explorer_issue6\verify_issue6_queue_relevance.js
```

**Invalidation Conditions**:
- If any Hindi or Indic track appears in `aiQueue` when user has zero Hindi history and plays an Arabic or Western song.
- If an Indic track is classified as `Pop` instead of `Bollywood / Indian`.
- If exploratory jitter exceeds 5 points and overrides explicit user affinities.
