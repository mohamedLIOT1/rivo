شغل ساب ايجينت بالتوازي لكل مشكله. Run parallel specialized sub-agents for each of the 9 reported issues to diagnose, fix, and verify problems across AI recommendations, offline vault playback and separation, podcasts isolation and preferences toggle, DJ mix mobile controls, playback startup latency, queue AI suggestions, genre classification, and listening stats.

Working directory: c:\Users\mohamed\Downloads\rivo-main\rivo-main
Integrity mode: demo
The team must NOT: read test source code to understand expected behaviour before implementing.

## Requirements

### R1. Parallel Subagent Execution Structure
The team must run parallel sub-agents allocated to investigate, fix, and test each of the 9 reported issues independently and concurrently.

### R2. AI Recommendations Refresh and Performance
Fix playlist AI recommendations so that recommended tracks properly refresh and change rather than remaining static. Optimize the track addition flow so adding recommended songs is fast and responsive, without UI freezes, blocking, or application hangs.

### R3. Offline Vault Playback, Filtering, and Dedicated Podcasts Tab
Resolve the offline playback error ("Playback error: Offline song file is missing or damaged, and device is offline") ensuring cached/downloaded files play reliably without internet. Correct category filtering so secular artists (e.g. Cairokee, Lege-Cy) never appear in the Quran tab. Add a dedicated, isolated Podcasts section within the Offline Vault.

### R4. Complete Podcasts Isolation and Navigation
Ensure Podcasts are strictly isolated from Music and Quran across both mobile and web. Opening podcast playlists must never display music or Quran playlists. Fix missing translation key `nav.podcastsLibrary` in the web navigation sidebar.

### R5. Mobile DJ Mix Controls & Professional UX Overhaul
Conduct a comprehensive review of the mobile DJ Mix interface to identify all usability bottlenecks and potential failure modes. Refactor mobile controls to ensure smooth, responsive, and professional DJ mixing interactions on phone screens.

### R6. Playback Startup Latency & Stream Optimization
Investigate and resolve severe startup latency across all playback streams. Optimize stream resolution, proxy caching, and token renewal. If a fresh cookies file is required for external stream access, pause and request the file from the user rather than assuming mock credentials.

### R7. Queue AI Suggestions Relevance
Fix the AI queue suggestion algorithm to ensure recommended next tracks strictly adhere to user listening history, language, and preferences, preventing out-of-context or irrelevant genres (such as unsolicited Hindi music).

### R8. Genre and Tag Classification Accuracy
Correct the music classification and tagging pipeline so songs are accurately categorized into their proper genres, preventing over-generalization where diverse tracks are erroneously labeled solely as rap or pop.

### R9. Web Content Preferences Podcast Toggle
Add a dedicated toggle in the web application's Content Preferences modal to allow users to enable or disable Podcasts visibility across the interface.

### R10. Listening Activity and Real-Time Stats Calculation
Fix the listening activity and statistics engine across mobile and web so listening time, top tracks, and engagement stats are calculated from actual, verifiable listening sessions in real time rather than inaccurate or static placeholders.

### R11. Infrastructure & Environment Safety
All development, testing, and verification must operate within the local environment without mutating remote production databases.

## Verification Resources
- Automated reproduction tests, test suites, and validation scripts designed and executed by the team for each of the 9 issues.

## Acceptance Criteria

### AI Recommendations & Performance
- [ ] Playlist AI recommendations update and refresh with new relevant tracks.
- [ ] Adding a recommended song to a playlist executes smoothly without freezing or blocking the UI.

### Offline Vault & Content Separation
- [ ] Downloaded offline tracks play successfully without network connectivity and without "file missing or damaged" errors.
- [ ] Quran offline tab displays only Quranic recitations and reciters, strictly excluding secular artists.
- [ ] Offline Vault includes a dedicated Podcasts section showing downloaded podcast episodes.

### Podcasts Isolation & Web Preferences
- [ ] Podcast playlists and library views are strictly separated from music and Quran playlists.
- [ ] Web sidebar renders `nav.podcastsLibrary` with the proper localized label without raw translation keys.
- [ ] Web Content Preferences modal contains a functional toggle to show or hide Podcasts across the app.

### Mobile DJ Mix
- [ ] Mobile DJ mix controls respond immediately to touch interactions without lag or erratic behavior.
- [ ] Identified mix control bugs and potential audio/transition failure points are fixed.

### Playback Startup & Streaming
- [ ] Playback startup delay is significantly reduced across mobile and web playback.
- [ ] If external stream cookies are required, the process prompts the user for the cookies file instead of failing silently.

### Queue AI & Classification
- [ ] Queue AI suggestions match the active user's listening profile and current queue context without irrelevant out-of-genre tracks.
- [ ] Song genre classification assigns appropriate tags according to actual musical genre rather than default rap/pop labels.

### Listening Activity
- [ ] Listening Activity & Stats reflect real listening duration and history accurately across both mobile and web.

### Verification & Safety
- [ ] Automated verification scripts for all 9 issues execute successfully.
- [ ] No remote production databases or external production infrastructure are modified.
