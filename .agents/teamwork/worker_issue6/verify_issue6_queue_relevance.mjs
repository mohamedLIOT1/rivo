import assert from 'node:assert';

// Polyfill browser globals for clean Node simulation
globalThis.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

// Dynamic imports after polyfills
const webTaste = await import('../../../rivo-main/src/utils/tasteAlgorithm.js');
const nativeTaste = await import('../../../rivo-main/src/native/utils/tasteAlgorithm.js');

console.log('=== VERIFYING ISSUE 6 (R7): QUEUE AI SUGGESTIONS RELEVANCE ===\n');

// -------------------------------------------------------------
// Test 1: Script & Language Detectors
// -------------------------------------------------------------
console.log('Test 1: Script and Indic Content Detection');
for (const [engineName, engine] of [['Web', webTaste], ['Native', nativeTaste]]) {
  // Devanagari detection
  assert.strictEqual(engine.hasIndicScript('तुम ही हो'), true, `${engineName}: Devanagari detected`);
  assert.strictEqual(engine.hasIndicScript('कबीर सिंह'), true, `${engineName}: Devanagari detected`);
  // Gurmukhi / Punjabi detection
  assert.strictEqual(engine.hasIndicScript('ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ'), true, `${engineName}: Gurmukhi detected`);
  // Arabic detection
  assert.strictEqual(engine.hasArabicScript('البخت - ويجز'), true, `${engineName}: Arabic detected`);
  assert.strictEqual(engine.hasIndicScript('البخت - ويجز'), false, `${engineName}: Arabic should not be Indic`);
  // English detection
  assert.strictEqual(engine.hasIndicScript('Blinding Lights - The Weeknd'), false, `${engineName}: Latin should not be Indic`);
  assert.strictEqual(engine.hasArabicScript('Blinding Lights - The Weeknd'), false, `${engineName}: Latin should not be Arabic`);

  // isIndicTrack checks
  assert.strictEqual(engine.isIndicTrack({ title: 'Kesariya', artist: 'Arijit Singh' }), true, `${engineName}: Arijit Singh track detected as Indic`);
  assert.strictEqual(engine.isIndicTrack({ title: 'Tum Hi Ho', artist: 'Mithoon, Arijit Singh' }), true, `${engineName}: Arijit Singh collab detected as Indic`);
  assert.strictEqual(engine.isIndicTrack({ title: 'Garmi', artist: 'Badshah, Neha Kakkar' }), true, `${engineName}: Badshah/Neha Kakkar detected as Indic`);
  assert.strictEqual(engine.isIndicTrack({ title: 'Lover', artist: 'Diljit Dosanjh' }), true, `${engineName}: Diljit Dosanjh detected as Indic`);
  assert.strictEqual(engine.isIndicTrack({ title: 'Chaleya', artist: 'Anirudh Ravichander, Arijit Singh' }), true, `${engineName}: Anirudh detected as Indic`);
  assert.strictEqual(engine.isIndicTrack({ title: 'البخت', artist: 'ويجز' }), false, `${engineName}: Wegz is NOT Indic`);
  assert.strictEqual(engine.isIndicTrack({ title: 'تملي معاك', artist: 'عمرو دياب' }), false, `${engineName}: Amr Diab is NOT Indic`);
  assert.strictEqual(engine.isIndicTrack({ title: 'God\'s Plan', artist: 'Drake' }), false, `${engineName}: Drake is NOT Indic`);

  // detectTrackGenre check
  assert.strictEqual(engine.detectTrackGenre({ title: 'Kesariya', artist: 'Arijit Singh' }), 'Bollywood / Indian', `${engineName}: Indic tracks classified as Bollywood / Indian`);
  console.log(`  ✓ ${engineName} script and track detectors passed.`);
}

// -------------------------------------------------------------
// Test 2: Genre Compatibility Matrix
// -------------------------------------------------------------
console.log('\nTest 2: Genre Compatibility Matrix');
for (const [engineName, engine] of [['Web', webTaste], ['Native', nativeTaste]]) {
  const compat = engine.GENRE_COMPATIBILITY;
  assert.ok(compat['Arabic Pop'], `${engineName}: Arabic Pop in compatibility matrix`);
  assert.ok(compat['Rap / Hip-Hop'], `${engineName}: Rap / Hip-Hop in compatibility matrix`);
  assert.ok(compat['Classic / Tarab'], `${engineName}: Classic / Tarab in compatibility matrix`);
  assert.ok(compat['Bollywood / Indian'], `${engineName}: Bollywood / Indian in compatibility matrix`);

  // Arabic Pop compatible with Indie / Alternative & Khaleeji
  assert.ok(compat['Arabic Pop'].compatible.includes('Indie / Alternative'), `${engineName}: Arabic Pop compatible with Indie`);
  // Arabic Pop incompatible with Bollywood / Indian & Metal
  assert.ok(compat['Arabic Pop'].incompatible.includes('Bollywood / Indian'), `${engineName}: Arabic Pop incompatible with Bollywood`);
  assert.ok(compat['Arabic Pop'].incompatible.includes('Metal'), `${engineName}: Arabic Pop incompatible with Metal`);

  // Rap incompatible with Classic / Tarab & Bollywood / Indian
  assert.ok(compat['Rap / Hip-Hop'].incompatible.includes('Classic / Tarab'), `${engineName}: Rap incompatible with Tarab`);
  assert.ok(compat['Rap / Hip-Hop'].incompatible.includes('Bollywood / Indian'), `${engineName}: Rap incompatible with Bollywood`);

  console.log(`  ✓ ${engineName} genre compatibility matrix validated.`);
}

// -------------------------------------------------------------
// Test 3: Simulation - Arabic Listener Playing Arabic Pop
// Must have ZERO unsolicited Hindi tracks in 100 generations
// -------------------------------------------------------------
console.log('\nTest 3: Arabic Listener Queue Simulation (100 Iterations)');

const candidatePool = [
  // Arabic Pop / Mainstream
  { id: 'ar1', title: 'تملي معاك', artist: 'عمرو دياب', genre: 'Arabic Pop', plays: 1200 },
  { id: 'ar2', title: 'يا طبطب', artist: 'نانسي عجرم', genre: 'Arabic Pop', plays: 900 },
  { id: 'ar3', title: 'صبري قليل', artist: 'شيرين', genre: 'Arabic Pop', plays: 1100 },
  { id: 'ar4', title: 'سي لا في', artist: 'الشاب خالد', genre: 'Arabic Pop', plays: 800 },
  { id: 'ar5', title: 'كل القصايد', artist: 'مروان خوري', genre: 'Arabic Pop', plays: 600 },
  // Arabic Indie / Alternative (Compatible)
  { id: 'ar6', title: 'ماتخفش', artist: 'كايروكي', genre: 'Indie / Alternative', plays: 1500 },
  { id: 'ar7', title: 'نهايات الحكاوي', artist: 'مسار إجباري', genre: 'Indie / Alternative', plays: 700 },
  { id: 'ar8', title: 'فاضي شوية', artist: 'حمزة نمرة', genre: 'Indie / Alternative', plays: 1800 },
  // Arabic Rap / Shaabi
  { id: 'ar9', title: 'البخت', artist: 'ويجز', genre: 'Rap / Hip-Hop', plays: 2500 },
  { id: 'ar10', title: 'غابات', artist: 'مروان بابلو', genre: 'Rap / Hip-Hop', plays: 1400 },
  // Western Tracks
  { id: 'w1', title: 'Blinding Lights', artist: 'The Weeknd', genre: 'R&B / Soul', plays: 3000 },
  { id: 'w2', title: 'Shape of You', artist: 'Ed Sheeran', genre: 'Pop', plays: 3500 },
  { id: 'w3', title: 'God\'s Plan', artist: 'Drake', genre: 'Rap / Hip-Hop', plays: 2800 },
  // Unsolicited Hindi / Bollywood Tracks (High play counts to tempt uncalibrated jitter)
  { id: 'in1', title: 'Kesariya', artist: 'Arijit Singh', genre: 'Bollywood / Indian', plays: 5000 },
  { id: 'in2', title: 'Tum Hi Ho', artist: 'Arijit Singh', genre: 'Pop', plays: 6000 },
  { id: 'in3', title: 'Garmi', artist: 'Badshah', genre: 'Pop', plays: 4500 },
  { id: 'in4', title: 'Lover', artist: 'Diljit Dosanjh', genre: 'Pop', plays: 4000 },
  { id: 'in5', title: 'Chaleya', artist: 'Arijit Singh, Shilpa Rao', genre: 'Pop', plays: 5200 },
  { id: 'in6', title: 'काला चश्मा', artist: 'Badshah, Neha Kakkar', genre: 'Pop', plays: 4800 },
];

const arabicUser = {
  id: 'u_arabic',
  preferences: { language: 'ar' },
  following: ['عمرو دياب', 'كايروكي', 'حمزة نمرة'],
};

const currentArabicTrack = {
  id: 'cur1',
  title: 'يوم تلات',
  artist: 'عمرو دياب',
  genre: 'Arabic Pop',
};

for (const [engineName, engine] of [['Web', webTaste], ['Native', nativeTaste]]) {
  let totalIndicSuggested = 0;
  let totalSuggestions = 0;
  let topRankGenreMatches = 0;

  for (let i = 0; i < 100; i++) {
    const suggestions = engine.getSmartTasteAndMoodTracks({
      allTracks: candidatePool,
      currentUser: arabicUser,
      followedArtists: ['عمرو دياب', 'كايروكي', 'حمزة نمرة'],
      likedTrackIds: ['ar1', 'ar6', 'ar8'],
      currentTrack: currentArabicTrack,
      limit: 8,
      maxPerArtist: 2,
    });

    assert.ok(suggestions.length > 0, `${engineName}: Generated suggestions count > 0`);

    suggestions.forEach((track, idx) => {
      totalSuggestions++;
      if (engine.isIndicTrack(track)) {
        totalIndicSuggested++;
        console.error(`FAILURE in ${engineName} iteration ${i}: Unsolicited Indic track in queue:`, track.title, track.artist);
      }
      if (idx === 0) {
        if (track.genre === 'Arabic Pop' || track.genre === 'Indie / Alternative') {
          topRankGenreMatches++;
        }
      }
    });
  }

  console.log(`  ✓ ${engineName} 100 queue runs (${totalSuggestions} total suggestions evaluated):`);
  console.log(`    - Total unsolicited Hindi tracks suggested: ${totalIndicSuggested} (0.00%)`);
  console.log(`    - Top slot contextual accuracy: ${(topRankGenreMatches / 100 * 100).toFixed(1)}%`);
  assert.strictEqual(totalIndicSuggested, 0, `${engineName} MUST contain ZERO unsolicited Hindi tracks!`);
  assert.ok(topRankGenreMatches >= 95, `${engineName} Top rank contextual accuracy must be >= 95%`);
}

// -------------------------------------------------------------
// Test 4: Indian Listener Legitimacy Check (Adaptive Engine)
// -------------------------------------------------------------
console.log('\nTest 4: Legitimate Indian Listener Queue Generation');

const hindiUser = {
  id: 'u_hindi',
  preferences: { language: 'hi' },
  following: ['Arijit Singh', 'Badshah'],
};

const currentHindiTrack = {
  id: 'cur_hi',
  title: 'Tum Hi Ho',
  artist: 'Arijit Singh',
  genre: 'Bollywood / Indian',
};

for (const [engineName, engine] of [['Web', webTaste], ['Native', nativeTaste]]) {
  const suggestions = engine.getSmartTasteAndMoodTracks({
    allTracks: candidatePool,
    currentUser: hindiUser,
    followedArtists: ['Arijit Singh', 'Badshah'],
    likedTrackIds: ['in1', 'in2'],
    currentTrack: currentHindiTrack,
    limit: 6,
    maxPerArtist: 2,
  });

  const indicCount = suggestions.filter(t => engine.isIndicTrack(t)).length;
  console.log(`  ✓ ${engineName}: Indian listener suggestions contain ${indicCount} Indic tracks`);
  assert.ok(indicCount >= 3, `${engineName}: Indian music listener legitimately receives Indic tracks`);
}

// -------------------------------------------------------------
// Test 5: Classic / Tarab Isolation from Conflicting Genres
// -------------------------------------------------------------
console.log('\nTest 5: Classic / Tarab Context & Incompatibility Guard');

const tarabPool = [
  { id: 't1', title: 'أنت عمري', artist: 'أم كلثوم', genre: 'Classic / Tarab', plays: 1500 },
  { id: 't2', title: 'قارئة الفنجان', artist: 'عبد الحليم حافظ', genre: 'Classic / Tarab', plays: 1400 },
  { id: 't3', title: 'نسم علينا الهوى', artist: 'فيروز', genre: 'Classic / Tarab', plays: 1200 },
  { id: 't4', title: 'بتونس بيك', artist: 'وردة', genre: 'Classic / Tarab', plays: 1100 },
  { id: 'r1', title: 'البخت', artist: 'ويجز', genre: 'Rap / Hip-Hop', plays: 3000 },
  { id: 'm1', title: 'حبيبي يا وصلي', artist: 'عصام صاصا', genre: 'Mahraganat', plays: 2500 },
  { id: 'in1', title: 'Kesariya', artist: 'Arijit Singh', genre: 'Bollywood / Indian', plays: 5000 },
];

const currentTarabTrack = {
  id: 't_seed',
  title: 'الأطلال',
  artist: 'أم كلثوم',
  genre: 'Classic / Tarab',
};

for (const [engineName, engine] of [['Web', webTaste], ['Native', nativeTaste]]) {
  const suggestions = engine.getSmartTasteAndMoodTracks({
    allTracks: tarabPool,
    currentTrack: currentTarabTrack,
    limit: 4,
  });

  assert.strictEqual(suggestions.length, 4, `${engineName}: Returned 4 suggestions`);
  // All 4 tracks must be Classic / Tarab
  suggestions.forEach(t => {
    assert.strictEqual(t.genre, 'Classic / Tarab', `${engineName}: Expected Tarab, got ${t.genre}`);
  });
  console.log(`  ✓ ${engineName} Classic / Tarab genre isolation validated (100% Tarab suggestions).`);
}

// -------------------------------------------------------------
// Test 6: buildSmartSeedQueue integration
// -------------------------------------------------------------
console.log('\nTest 6: buildSmartSeedQueue Verification');
for (const [engineName, engine] of [['Web', webTaste], ['Native', nativeTaste]]) {
  const seedQueue = engine.buildSmartSeedQueue(currentArabicTrack, candidatePool, {
    currentUser: arabicUser,
    limit: 5,
  });

  assert.strictEqual(seedQueue[0].id, currentArabicTrack.id, `${engineName}: First track is current seed track`);
  assert.strictEqual(seedQueue.length, 6, `${engineName}: Seed track + 5 smart recommendations`);
  const upcoming = seedQueue.slice(1);
  const indicInUpcoming = upcoming.filter(t => engine.isIndicTrack(t)).length;
  assert.strictEqual(indicInUpcoming, 0, `${engineName}: Seed queue contains zero unsolicited Hindi tracks`);
  console.log(`  ✓ ${engineName} buildSmartSeedQueue verified.`);
}

console.log('\n=== ALL ISSUE 6 RELEVANCE VERIFICATIONS PASSED SUCCESSFULLY ===\n');
