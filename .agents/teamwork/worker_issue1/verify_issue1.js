/**
 * Verification Script for Issue 1 (Requirement R2): AI Recommendations Refresh and Performance
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

async function testRecommendationExclusionAndRefresh() {
  console.log('--- Test 1: getCuratedRecommendations excludeTrackIds & refresh ---');
  const recServicePath = path.resolve(__dirname, '../../../rivo-main/server/routes/ai/recommendationService.js');
  const { getCuratedRecommendations } = require(recServicePath);

  // Generate a mock pool of 50 tracks
  const mockAvailableTracks = Array.from({ length: 50 }, (_, i) => ({
    _id: `track_${i + 1}`,
    id: `track_${i + 1}`,
    title: `Track Title ${i + 1}`,
    artist: `Artist ${Math.floor(i / 3) + 1}`, // multiple tracks per artist
    plays: (50 - i) * 100,
    isQuran: false
  }));

  const seedTracks = [mockAvailableTracks[0], mockAvailableTracks[1]];
  const seedTrackIds = seedTracks.map(t => t.id);

  // Batch 1: Initial recommendations
  const batch1 = await getCuratedRecommendations({
    seedTracks,
    trackIds: seedTrackIds,
    availableTracks: mockAvailableTracks,
    refresh: false
  });

  assert(Array.isArray(batch1), 'Batch 1 should be an array');
  assert(batch1.length > 0, 'Batch 1 should contain tracks');
  console.log(`✓ Batch 1 returned ${batch1.length} recommendations`);

  const batch1Ids = new Set(batch1.map(t => String(t.id || t._id)));
  // Verify none of the seedTrackIds are in batch1
  for (const seedId of seedTrackIds) {
    assert(!batch1Ids.has(seedId), `Seed track ${seedId} must be excluded from batch 1`);
  }
  console.log('✓ Seed tracks excluded from batch 1');

  // Batch 2: Refresh recommendations with excludeTrackIds = batch1Ids
  const batch2 = await getCuratedRecommendations({
    seedTracks,
    trackIds: seedTrackIds,
    excludeTrackIds: Array.from(batch1Ids),
    availableTracks: mockAvailableTracks,
    refresh: true
  });

  assert(Array.isArray(batch2), 'Batch 2 should be an array');
  assert(batch2.length > 0, 'Batch 2 should contain tracks');
  console.log(`✓ Batch 2 returned ${batch2.length} recommendations`);

  // Calculate overlap between batch 1 and batch 2
  const overlap = batch2.filter(t => batch1Ids.has(String(t.id || t._id)));
  console.log(`✓ Overlap count between Batch 1 and Batch 2: ${overlap.length} (0% overlap expected)`);
  assert.strictEqual(overlap.length, 0, 'There must be 0% overlap when excludeTrackIds is passed');

  // Batch 3: Multiple refresh variations
  const refreshResults = [];
  for (let r = 0; r < 5; r++) {
    const res = await getCuratedRecommendations({
      seedTracks,
      trackIds: seedTrackIds,
      availableTracks: mockAvailableTracks,
      refresh: true
    });
    refreshResults.push(res.map(t => t.id).join(','));
  }
  const uniqueRefreshResults = new Set(refreshResults);
  console.log(`✓ Generated 5 refresh batches with exploration bonus: ${uniqueRefreshResults.size} unique variations`);
  assert(uniqueRefreshResults.size > 1, 'Refresh must produce dynamic, varied candidate orderings');
}

function testStaticCodeAnalysis() {
  console.log('\n--- Test 2: Static Code Audits across target files ---');

  // 1. App.jsx: Verify addToQueue is not called in handleAddTrackToPlaylist
  const appPath = path.resolve(__dirname, '../../../rivo-main/src/App.jsx');
  const appContent = fs.readFileSync(appPath, 'utf8');
  const addTrackBlock = appContent.slice(appContent.indexOf('handleAddTrackToPlaylist ='), appContent.indexOf('handleRemoveTrackFromPlaylist ='));
  assert(!addTrackBlock.includes('addToQueue'), 'App.jsx handleAddTrackToPlaylist must NOT call addToQueue');
  console.log('✓ App.jsx: addToQueue successfully removed from handleAddTrackToPlaylist');

  // 2. PlaylistScreen.jsx: Verify no setCurrentQueue injection in handleFetchAiRecommendations
  const plScreenPath = path.resolve(__dirname, '../../../rivo-main/src/screens/PlaylistScreen.jsx');
  const plScreenContent = fs.readFileSync(plScreenPath, 'utf8');
  const fetchRecsBlock = plScreenContent.slice(plScreenContent.indexOf('handleFetchAiRecommendations ='), plScreenContent.indexOf('handleSaveDetails ='));
  assert(!fetchRecsBlock.includes('setCurrentQueue'), 'PlaylistScreen.jsx handleFetchAiRecommendations must NOT mutate setCurrentQueue');
  assert(fetchRecsBlock.includes('excludeTrackIds'), 'PlaylistScreen.jsx must pass excludeTrackIds');
  assert(fetchRecsBlock.includes('refresh: true'), 'PlaylistScreen.jsx must pass refresh: true');
  console.log('✓ PlaylistScreen.jsx: setCurrentQueue injection removed and excludeTrackIds/refresh passed');

  // 3. PlaylistScreen.jsx: Verify no extraRecs queue appending in handlePlayPlaylistTrack
  const playTrackBlock = plScreenContent.slice(plScreenContent.indexOf('handlePlayPlaylistTrack ='), plScreenContent.indexOf('handleConfirmDownloadAndMix ='));
  assert(!playTrackBlock.includes('extraRecs'), 'PlaylistScreen.jsx handlePlayPlaylistTrack must NOT append extraRecs');
  assert(!playTrackBlock.includes('aiRecommendations'), 'PlaylistScreen.jsx handlePlayPlaylistTrack must NOT append aiRecommendations');
  console.log('✓ PlaylistScreen.jsx: extraRecs/aiRecommendations queue appending removed');

  // 4. LibraryScreen.js: Verify excludeTrackIds and instant UI feedback
  const libScreenPath = path.resolve(__dirname, '../../../rivo-main/src/native/screens/LibraryScreen.js');
  const libScreenContent = fs.readFileSync(libScreenPath, 'utf8');
  assert(libScreenContent.includes('excludeTrackIds: currentRecIds'), 'LibraryScreen.js must pass excludeTrackIds');
  assert(libScreenContent.includes('refresh: true'), 'LibraryScreen.js must pass refresh: true');
  const quickAddBlock = libScreenContent.slice(libScreenContent.indexOf('const handleQuickAddTrack ='), libScreenContent.indexOf('const searchResultsForAdd ='));
  assert(!quickAddBlock.includes('await addToPlaylist'), 'LibraryScreen.js handleQuickAddTrack must not await addToPlaylist (non-blocking instant UI)');
  console.log('✓ LibraryScreen.js: excludeTrackIds passed and handleQuickAddTrack is non-blocking');

  // 5. UserContext.js: Verify optimistic update and debounced AsyncStorage
  const userContextPath = path.resolve(__dirname, '../../../rivo-main/src/native/context/UserContext.js');
  const userContextContent = fs.readFileSync(userContextPath, 'utf8');
  assert(userContextContent.includes('savePlaylistsDebounced'), 'UserContext.js must implement savePlaylistsDebounced');
  const addToPlaylistBlock = userContextContent.slice(userContextContent.indexOf('const addToPlaylist ='), userContextContent.indexOf('const removeTrackFromPlaylist ='));
  assert(!addToPlaylistBlock.includes('await syncUserData()'), 'UserContext.js addToPlaylist must NOT do blocking await syncUserData()');
  console.log('✓ UserContext.js: optimistic update implemented and blocking syncUserData waterfall removed');

  // 6. server/routes/ai.js: Verify excludeTrackIds and refresh passed
  const aiRoutePath = path.resolve(__dirname, '../../../rivo-main/server/routes/ai.js');
  const aiRouteContent = fs.readFileSync(aiRoutePath, 'utf8');
  assert(aiRouteContent.includes('excludeTrackIds = []'), 'server/routes/ai.js must extract excludeTrackIds');
  assert(aiRouteContent.includes('refresh = false'), 'server/routes/ai.js must extract refresh');
  console.log('✓ server/routes/ai.js: correctly extracts and forwards excludeTrackIds and refresh');
}

async function runAll() {
  try {
    await testRecommendationExclusionAndRefresh();
    testStaticCodeAnalysis();
    console.log('\n=========================================');
    console.log('🎉 ALL VERIFICATION CHECKS PASSED (100%)');
    console.log('=========================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ VERIFICATION FAILED:', err);
    process.exit(1);
  }
}

runAll();
