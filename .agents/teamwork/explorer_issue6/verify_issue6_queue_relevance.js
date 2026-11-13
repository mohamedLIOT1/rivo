/**
 * Automated Reproduction & Verification Script for Issue 6 (R7): Queue AI Suggestions Relevance
 * Demonstrates the bug (unsolicited Hindi track injection due to jitter + missing script filter + Pop fallback)
 * and verifies the proposed algorithmic fix.
 */

const assert = require('assert');

// 1. Script & Language Detector
const INDIC_SCRIPT_REGEX = /[\u0900-\u097F\u0A00-\u0A7F\u0980-\u09FF\u0A80-\u0D7F]/;
const ARABIC_SCRIPT_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

const INDIC_ARTISTS = new Set([
  'arijit singh', 'neha kakkar', 'badshah', 'shreya ghoshal', 'diljit dosanjh',
  'sidhu moose wala', 'lata mangeshkar', 'kishore kumar', 'alka yagnik', 'sonu nigam',
  'kumar sanu', 'udit narayan', 'a.r. rahman', 'ar rahman', 'jubin nautiyal',
  'atif aslam', 'yo yo honey singh', 'guru randhawa', 'anirudh ravichander', 'pritam'
]);

function isIndicTrack(track) {
  if (!track) return false;
  const text = `${track.title || ''} ${track.artist || ''} ${track.genre || ''}`.toLowerCase();
  if (INDIC_SCRIPT_REGEX.test(text)) return true;
  if (/bollywood|hindi|punjabi|desi|bhangra|filmi/i.test(text)) return true;
  for (const art of INDIC_ARTISTS) {
    if (text.includes(art)) return true;
  }
  return false;
}

function isArabicTrack(track) {
  if (!track) return false;
  const text = `${track.title || ''} ${track.artist || ''} ${track.genre || ''}`;
  return ARABIC_SCRIPT_REGEX.test(text);
}

// 2. Genre Compatibility Matrix
const GENRE_COMPATIBILITY = {
  'Holy Quran': ['Holy Quran'],
  'Podcast': ['Podcast'],
  'Rap / Hip-Hop': ['Rap / Hip-Hop', 'Mahraganat / Shaabi', 'R&B / Soul', 'Electronic'],
  'Mahraganat / Shaabi': ['Mahraganat / Shaabi', 'Rap / Hip-Hop', 'Arabic Pop'],
  'Arabic Pop': ['Arabic Pop', 'Indie / Alternative', 'Classic / Tarab', 'Khaleeji'],
  'Classic / Tarab': ['Classic / Tarab', 'Arabic Pop'],
  'Indie / Alternative': ['Indie / Alternative', 'Arabic Pop', 'Rock', 'Lo-Fi'],
  'Khaleeji': ['Khaleeji', 'Arabic Pop', 'Classic / Tarab'],
  'R&B / Soul': ['R&B / Soul', 'Rap / Hip-Hop', 'Pop', 'Lo-Fi'],
  'EDM / Electronic': ['EDM / Electronic', 'Pop', 'Rap / Hip-Hop'],
  'Rock': ['Rock', 'Indie / Alternative', 'Metal'],
  'Metal': ['Metal', 'Rock'],
  'Bollywood / Indian': ['Bollywood / Indian']
};

console.log('=== Issue 6 (R7) Queue Relevance Test Suite ===\n');

// Test 1: Language & Script Detection
console.log('Test 1: Language & Script Detection...');
const hindiTrack1 = { title: 'Kesariya', artist: 'Arijit Singh', genre: 'Pop' };
const hindiTrack2 = { title: 'तुम ही हो', artist: 'Arijit Singh', genre: 'Pop' };
const arabicTrack1 = { title: 'البخت', artist: 'ويجز', genre: 'Rap / Hip-Hop' };
const arabicTrack2 = { title: 'بسرح واتوه', artist: 'كايروكي', genre: 'Indie / Alternative' };

assert.strictEqual(isIndicTrack(hindiTrack1), true, 'hindiTrack1 should be detected as Indic');
assert.strictEqual(isIndicTrack(hindiTrack2), true, 'hindiTrack2 (Devanagari) should be detected as Indic');
assert.strictEqual(isIndicTrack(arabicTrack1), false, 'arabicTrack1 should not be Indic');
assert.strictEqual(isArabicTrack(arabicTrack1), true, 'arabicTrack1 should be detected as Arabic');
console.log('✓ Script and Language Detection passed!\n');

// Test 2: Simulated Scoring Comparison (Bug vs Fix)
console.log('Test 2: Comparing Old Scoring (Bug) vs New Scoring (Fix)...');

// User profile: Arabic listener with Egyptian rap / Indie history
const userListeningHistory = [arabicTrack1, arabicTrack2];
const hasIndicHistory = userListeningHistory.some(isIndicTrack);

function scoreCandidateOld(track, currentTrack) {
  let score = 0;
  // Liked/history: 0 for hindiTrack
  // Novelty bonus for unplayed
  score += 15;
  // Random jitter (+0 to 70)
  const jitter = Math.random() * 55 + (Math.random() * 15);
  score += jitter;
  return score;
}

function scoreCandidateNew(track, currentTrack, userHasIndicHistory) {
  let score = 0;
  const isIndic = isIndicTrack(track);
  const curIsArabic = isArabicTrack(currentTrack);

  // Strict Unsolicited Language Filter
  if (!userHasIndicHistory && isIndic && curIsArabic) {
    return -999; // Excluded!
  }

  // Genre compatibility
  const curGenre = currentTrack.genre || 'Rap / Hip-Hop';
  const tGenre = track.genre || 'Pop';
  const compatible = GENRE_COMPATIBILITY[curGenre] || [];
  if (tGenre === curGenre) {
    score += 35;
  } else if (compatible.includes(tGenre)) {
    score += 20;
  } else {
    score -= 50; // Incompatibility penalty
  }

  // Language match
  if (isArabicTrack(track) && curIsArabic) {
    score += 25;
  }

  // Sane jitter (0 to 5)
  score += Math.random() * 5;

  return score;
}

// Run 100 simulations of Old Scoring:
let hindiBeatArabicCount = 0;
for (let i = 0; i < 100; i++) {
  const arabicScore = 35 + 25 + 15 + (Math.random() * 15); // Genre synergy + Arabic + novelty + low jitter
  const hindiScore = scoreCandidateOld(hindiTrack1, arabicTrack1);
  if (hindiScore > arabicScore) hindiBeatArabicCount++;
}
console.log(`[OLD LOGIC] Unsolicited Hindi song outscored relevant Arabic song in ${hindiBeatArabicCount}/100 runs! (Demonstrating Bug)`);

// Run 100 simulations of New Scoring:
let hindiSelectedCountNew = 0;
for (let i = 0; i < 100; i++) {
  const hindiScore = scoreCandidateNew(hindiTrack1, arabicTrack1, hasIndicHistory);
  const arabicScore = scoreCandidateNew({ title: 'عفروتو - برازيلي', artist: 'Afroto', genre: 'Rap / Hip-Hop' }, arabicTrack1, hasIndicHistory);
  if (hindiScore > arabicScore || hindiScore > 0) hindiSelectedCountNew++;
}
console.log(`[NEW LOGIC] Unsolicited Hindi song selected in ${hindiSelectedCountNew}/100 runs!`);
assert.strictEqual(hindiSelectedCountNew, 0, 'New logic must have 0 unsolicited Hindi selections');
console.log('✓ New scoring strictly prevents unsolicited Hindi music!\n');

console.log('=== All Issue 6 Verification Checks Passed Successfully! ===');
