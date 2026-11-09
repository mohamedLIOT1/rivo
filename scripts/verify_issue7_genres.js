/**
 * Comprehensive verification suite for Issue 7 (Requirement R8):
 * Genre and Tag Classification Accuracy.
 */

const assert = require('assert');
const path = require('path');

// 1. Load Server Classifier and Normalizer
const { classifyGenre: serverClassify, isQuranContent, isPodcastContent, getAllGenres, GENRES, GENERIC_GENRES } = require('../server/utils/genreClassifier');
const { matchesPattern, normalizeSearchText } = require('../server/utils/genreRules/textNormalizer');

// 2. Load Native Client Classifier (ESM/CJS bridge or dynamic eval if needed)
// In Node, native utils might use export syntax, let's load or check
let nativeClassify = null;
try {
  // Test if native can be imported or transpiled
  const nativeCode = require('fs').readFileSync(path.join(__dirname, '../src/native/utils/genreClassifier.js'), 'utf8');
  // Simple check
  assert(nativeCode.includes('matchesPattern'), 'Native classifier must define matchesPattern');
} catch (e) {
  console.warn('Native classifier inspect note:', e.message);
}

console.log('=== TEST SUITE 1: textNormalizer Word Boundary & Needle Safety ===');
// Arabic needles
assert.strictEqual(matchesPattern('اقتراب الوعد الحق', 'تراب'), false, 'اقتراب must not match تراب');
assert.strictEqual(matchesPattern('أغنية عن الاغتراب', 'تراب'), false, 'اغتراب must not match تراب');
assert.strictEqual(matchesPattern('أغنية تراب مصري', 'تراب'), true, 'تراب must match standalone تراب');

// English needles
assert.strictEqual(matchesPattern('trapped in a room', 'trap'), false, 'trapped must not match trap');
assert.strictEqual(matchesPattern('trap beat 2024', 'trap'), true, 'trap beat must match trap');
assert.strictEqual(matchesPattern('dissolve in water', 'diss'), false, 'dissolve must not match diss');
assert.strictEqual(matchesPattern('new diss track', 'diss'), true, 'diss track must match diss');
assert.strictEqual(matchesPattern('carlos santana', 'santa'), false, 'santana must not match santa');
assert.strictEqual(matchesPattern('mandrill monkey', 'drill'), false, 'mandrill must not match drill');
assert.strictEqual(matchesPattern('flexible schedule', 'flex'), false, 'flexible must not match flex');
assert.strictEqual(matchesPattern('barstool sports', 'bars'), false, 'barstool must not match bars');
console.log('✔ All needle word-boundary tests passed.');

console.log('\n=== TEST SUITE 2: Server Genre Classification Accuracy ===');
const testCases = [
  // 1. Root-collision checks (MUST NOT be Rap)
  { input: { title: "اقتراب الوعد الحق", artist: "أحمد النجار" }, expected: "Arabic Pop", notExpected: "Rap / Hip-Hop" },
  { input: { title: "أغنية عن الاغتراب", artist: "كايروكي" }, expected: "Indie / Alternative", notExpected: "Rap / Hip-Hop" },
  { input: { title: "Future Days", artist: "Pearl Jam" }, expected: "Rock", notExpected: "Rap / Hip-Hop" },
  { input: { title: "Future Nostalgia", artist: "Dua Lipa" }, expected: "Pop", notExpected: "Rap / Hip-Hop" },
  { input: { title: "Dancing Queen", artist: "ABBA" }, expected: "Pop", notExpected: "Rock" },
  { input: { title: "Smooth", artist: "Carlos Santana" }, expected: "Rock", notExpected: "Rap / Hip-Hop" },
  { input: { title: "Dissonance & Dissolve", artist: "The Cure" }, expected: "Indie / Alternative", notExpected: "Rap / Hip-Hop" },

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
  { input: { title: "Interstellar Main Theme OST", artist: "Hans Zimmer" }, expected: "Soundtrack / Instrumental" },
  { input: { title: "Summer", artist: "Calvin Harris" }, expected: "EDM / Electronic" },
  { input: { title: "Thinkin Bout You", artist: "Frank Ocean" }, expected: "R&B / Soul" },
  { input: { title: "الأماكن", artist: "محمد عبده" }, expected: "Khaleeji" },
  { input: { title: "إنت عمري", artist: "أم كلثوم" }, expected: "Tarab" },
  { input: { title: "تملي معاك", artist: "عمرو دياب" }, expected: "Arabic Pop" },
  { input: { title: "Lofi Study Session", artist: "Lofi Girl" }, expected: "Lo-Fi" },
  { input: { title: "سورة الكهف", artist: "مشاري العفاسي" }, expected: "Holy Quran" },
  { input: { title: "بودكاست فنجان", artist: "ثمانية" }, expected: "Podcast" },
  { input: { title: "Tum Hi Ho", artist: "Arijit Singh" }, expected: "Bollywood / Indic" }
];

let serverPassed = 0;
for (const tc of testCases) {
  const res = serverClassify(tc.input);
  if (tc.expected) {
    assert.strictEqual(res.genre, tc.expected, `Classification mismatch for "${tc.input.title}" by "${tc.input.artist}": expected "${tc.expected}", got "${res.genre}"`);
  }
  if (tc.notExpected) {
    assert.notStrictEqual(res.genre, tc.notExpected, `Classification violation for "${tc.input.title}": should NOT be "${tc.notExpected}"`);
  }
  serverPassed++;
}
console.log(`✔ All ${serverPassed} server classification test cases passed!`);

console.log('\n=== TEST SUITE 3: Generic Genre Whitelist Check ===');
assert.strictEqual(GENERIC_GENRES.has('soundtrack'), false, 'soundtrack must NOT be in GENERIC_GENRES');
assert.strictEqual(GENERIC_GENRES.has('pop'), false, 'pop must NOT be in GENERIC_GENRES');
assert.strictEqual(GENERIC_GENRES.has('imported'), true, 'imported should remain in GENERIC_GENRES');
console.log('✔ Generic genres correctly updated to preserve valid explicit genres.');

console.log('\n=== TEST SUITE 4: Quran & Podcast Isolation Checks ===');
// Secular tracks must NEVER be marked as Quran
const secularTracks = [
  { title: "أغنية عن الاغتراب", artist: "كايروكي" },
  { title: "سوق البنات", artist: "محمود الليثي" },
  { title: "عفاريت الأسفلت", artist: "ويجز" },
  { title: "Comfortably Numb", artist: "Pink Floyd" }
];
for (const t of secularTracks) {
  const res = serverClassify(t);
  assert.strictEqual(res.isQuran, false, `Secular track "${t.title}" must have isQuran: false`);
}
// Sacred recitation MUST be marked as Quran
const quranRes = serverClassify({ title: "سورة البقرة كاملة", artist: "مشاري العفاسي" });
assert.strictEqual(quranRes.isQuran, true, 'Holy Quran recitation must have isQuran: true');
assert.strictEqual(quranRes.genre, 'Holy Quran');
console.log('✔ Content separation between Quran and Secular tracks verified.');

async function runNativeChecks() {
  console.log('\n=== TEST SUITE 5: Native Client Classifier Parity ===');
  const nativeUrl = 'file:///' + path.resolve(__dirname, '../src/native/utils/genreClassifier.js').replace(/\\/g, '/');
  const native = await import(nativeUrl);
  assert.strictEqual(typeof native.classifyGenre, 'function', 'native.classifyGenre must be a function');
  assert.strictEqual(typeof native.matchesPattern, 'function', 'native.matchesPattern must be a function');

  let nativePassed = 0;
  for (const tc of testCases) {
    const res = native.classifyGenre(tc.input);
    if (tc.expected) {
      assert.strictEqual(res.genre, tc.expected, `Native mismatch for "${tc.input.title}": expected "${tc.expected}", got "${res.genre}"`);
    }
    if (tc.notExpected) {
      assert.notStrictEqual(res.genre, tc.notExpected, `Native violation for "${tc.input.title}": should NOT be "${tc.notExpected}"`);
    }
    nativePassed++;
  }
  console.log(`✔ All ${nativePassed} native client classification test cases passed in full parity!`);

  console.log('\n=========================================');
  console.log('ALL ISSUE 7 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('=========================================');
}

runNativeChecks().catch(err => {
  console.error('Native test failed:', err);
  process.exit(1);
});
