const assert = require('assert');
const { classifyGenre, isQuranContent, enrichTrackMetadata } = require('../server/utils/genreClassifier');

console.log('--- Testing Rivo Genre Classifier ---');

const testCases = [
  // Egyptian Rap / Trap / Hip-Hop
  { title: 'البخت', artist: 'ويجز', expected: 'Rap / Hip-Hop' },
  { title: 'El Ghabat', artist: 'Marwan Pablo', expected: 'Rap / Hip-Hop' },
  { title: 'Bet3ady', artist: 'Lege-Cy', expected: 'Rap / Hip-Hop' },
  { title: 'Sheraton', artist: 'Marwan Moussa', expected: 'Rap / Hip-Hop' },
  { title: 'Mish Bel Hazz', artist: 'Abyusif', expected: 'Rap / Hip-Hop' },
  { title: 'فرق خبرة', artist: 'عفروتو', expected: 'Rap / Hip-Hop' },
  { title: 'Khalsana', artist: 'Wingii', expected: 'Rap / Hip-Hop' },
  { title: 'Batistuta Freestyle', artist: 'باتستوتا', expected: 'Rap / Hip-Hop' },

  // Shaabi / Mahraganat
  { title: 'مهرجان مسا مني ليكو', artist: 'عصام صاصا', expected: 'Mahraganat / Shaabi' },
  { title: 'Bint El Geran', artist: 'Hassan Shakosh', expected: 'Mahraganat / Shaabi' },
  { title: 'El Ghalawin', artist: 'عمر كمال', expected: 'Mahraganat / Shaabi' },
  { title: 'Wada3 Ya Donia', artist: 'حمو بيكا', expected: 'Mahraganat / Shaabi' },
  { title: 'El Basha Tedal', artist: 'عنبة', expected: 'Mahraganat / Shaabi' },
  { title: 'Bravo 3alik', artist: 'Shehta Karika', expected: 'Mahraganat / Shaabi' },
  { title: 'مهرجان حارة السقايين', artist: 'Unknown Artist', expected: 'Mahraganat / Shaabi' },

  // Indie / Alternative
  { title: 'Samurai', artist: 'Cairokee', expected: 'Indie / Alternative' },
  { title: 'Five', artist: 'Sharmoofers', expected: 'Indie / Alternative' },
  { title: 'Nehayat El Hekayat', artist: 'Massar Egbari', expected: 'Indie / Alternative' },
  { title: 'Dari Ya Alby', artist: 'حمزة نمرة', expected: 'Indie / Alternative' },
  { title: 'Habibi Da', artist: 'Autostrad', expected: 'Indie / Alternative' },
  { title: 'Mafi Mennik', artist: 'Aziz Maraka', expected: 'Indie / Alternative' },
  { title: 'Salma', artist: 'JadaL', expected: 'Indie / Alternative' },

  // Classical / Tarab
  { title: 'Enta Omri', artist: 'Umm Kulthum', expected: 'Tarab / Classical' },
  { title: 'قارئة الفنجان', artist: 'عبد الحليم حافظ', expected: 'Tarab / Classical' },
  { title: 'Nassam Alayna El Hawa', artist: 'Fairuz', expected: 'Tarab / Classical' },
  { title: 'Batwanes Beek', artist: 'وردة', expected: 'Tarab / Classical' },
  { title: 'Emta Alzaman', artist: 'Mohamed Abdel Wahab', expected: 'Tarab / Classical' },
  { title: 'Zoroni Kol Sana Mara', artist: 'Sayed Darwish', expected: 'Tarab / Classical' },

  // Arabic Pop
  { title: 'Tamally Maak', artist: 'Amr Diab', expected: 'Arabic Pop' },
  { title: 'Enayyah Bethebbak', artist: 'Tamer Hosny', expected: 'Arabic Pop' },
  { title: 'Masha\'er', artist: 'Sherine', expected: 'Arabic Pop' },
  { title: 'Adham', artist: 'Mohamed Hamaki', expected: 'Arabic Pop' },
  { title: 'Ah W Noss', artist: 'Nancy Ajram', expected: 'Arabic Pop' },
  { title: 'Betmoun', artist: 'Elissa', expected: 'Arabic Pop' },
  { title: 'Bent Akaber', artist: 'Assala', expected: 'Arabic Pop' },

  // Holy Quran
  { title: 'سورة يوسف', artist: 'المنشاوي', expected: 'Holy Quran', isQuran: true },
  { title: 'Surah Al-Baqarah', artist: 'Abdulbasit Abdulsamad', expected: 'Holy Quran', isQuran: true },
  { title: 'تلاوة خاشعة', artist: 'مشاري العفاسي', expected: 'Holy Quran', isQuran: true },
  { title: 'Surah Maryam', artist: 'محمود خليل الحصري', expected: 'Holy Quran', isQuran: true },
  { title: 'Surah Rahman', artist: 'Maher Al-Muaiqly', expected: 'Holy Quran', isQuran: true },
  { title: 'Al-Sudais Recitation', artist: 'عبد الرحمن السديس', expected: 'Holy Quran', isQuran: true },

  // International Genres
  { title: 'Smells Like Teen Spirit', artist: 'Nirvana', expected: 'Rock' },
  { title: 'Master of Puppets', artist: 'Metallica', expected: 'Metal' },
  { title: 'Titanium', artist: 'David Guetta', expected: 'EDM / Electronic' },
  { title: 'Blinding Lights', artist: 'The Weeknd', expected: 'R&B / Soul' },
  { title: 'Coffee Chill', artist: 'Lofi Girl', expected: 'Lo-Fi' },
  { title: 'So What', artist: 'Miles Davis', expected: 'Jazz' },
  { title: 'Symphony No. 5', artist: 'Beethoven', expected: 'Classical' },
  { title: 'Blank Space', artist: 'Taylor Swift', expected: 'Pop' }
];

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const result = classifyGenre(tc);
  const matchGenre = result.genre === tc.expected;
  const matchQuran = tc.isQuran ? result.isQuran === true : true;

  if (matchGenre && matchQuran) {
    passed++;
    console.log(`[PASS] "${tc.title}" by "${tc.artist}" -> ${result.genre} (${result.matchedBy})`);
  } else {
    failed++;
    console.error(`[FAIL] "${tc.title}" by "${tc.artist}": expected "${tc.expected}", got "${result.genre}" (isQuran: ${result.isQuran})`);
  }
}

console.log(`\nTests finished: ${passed} passed, ${failed} failed out of ${testCases.length}`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL GENRE CLASSIFICATION TESTS PASSED SUCCESSFULLY!');
}
