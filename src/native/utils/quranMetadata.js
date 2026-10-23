// Complete standardized mapping of the 114 Surahs of the Holy Quran
// to their exact Medina Mushaf page ranges (Pages 1 to 604 - Hafs 'an 'Asim)

export const SURAH_METADATA = [
  { id: 1, name: 'الفاتحة', englishName: 'Al-Fatihah', startPage: 1, endPage: 1, verses: 7 },
  { id: 2, name: 'البقرة', englishName: 'Al-Baqarah', startPage: 2, endPage: 49, verses: 286 },
  { id: 3, name: 'آل عمران', englishName: 'Ali \'Imran', startPage: 50, endPage: 76, verses: 200 },
  { id: 4, name: 'النساء', englishName: 'An-Nisa', startPage: 77, endPage: 106, verses: 176 },
  { id: 5, name: 'المائدة', englishName: 'Al-Ma\'idah', startPage: 106, endPage: 127, verses: 120 },
  { id: 6, name: 'الأنعام', englishName: 'Al-An\'am', startPage: 128, endPage: 150, verses: 165 },
  { id: 7, name: 'الأعراف', englishName: 'Al-A\'raf', startPage: 151, endPage: 176, verses: 206 },
  { id: 8, name: 'الأنفال', englishName: 'Al-Anfal', startPage: 177, endPage: 186, verses: 75 },
  { id: 9, name: 'التوبة', englishName: 'At-Tawbah', startPage: 187, endPage: 207, verses: 129 },
  { id: 10, name: 'يونس', englishName: 'Yunus', startPage: 208, endPage: 221, verses: 109 },
  { id: 11, name: 'هود', englishName: 'Hud', startPage: 221, endPage: 235, verses: 123 },
  { id: 12, name: 'يوسف', englishName: 'Yusuf', startPage: 235, endPage: 248, verses: 111 },
  { id: 13, name: 'الرعد', englishName: 'Ar-Ra\'d', startPage: 249, endPage: 255, verses: 43 },
  { id: 14, name: 'إبراهيم', englishName: 'Ibrahim', startPage: 255, endPage: 261, verses: 52 },
  { id: 15, name: 'الحجر', englishName: 'Al-Hijr', startPage: 262, endPage: 267, verses: 99 },
  { id: 16, name: 'النحل', englishName: 'An-Nahl', startPage: 267, endPage: 281, verses: 128 },
  { id: 17, name: 'الإسراء', englishName: 'Al-Isra', startPage: 282, endPage: 293, verses: 111 },
  { id: 18, name: 'الكهف', englishName: 'Al-Kahf', startPage: 293, endPage: 304, verses: 110 },
  { id: 19, name: 'مريم', englishName: 'Maryam', startPage: 305, endPage: 312, verses: 98 },
  { id: 20, name: 'طه', englishName: 'Taha', startPage: 312, endPage: 321, verses: 135 },
  { id: 21, name: 'الأنبياء', englishName: 'Al-Anbiya', startPage: 322, endPage: 331, verses: 112 },
  { id: 22, name: 'الحج', englishName: 'Al-Hajj', startPage: 332, endPage: 341, verses: 78 },
  { id: 23, name: 'المؤمنون', englishName: 'Al-Mu\'minun', startPage: 342, endPage: 349, verses: 118 },
  { id: 24, name: 'النور', englishName: 'An-Nur', startPage: 350, endPage: 359, verses: 64 },
  { id: 25, name: 'الفرقان', englishName: 'Al-Furqan', startPage: 359, endPage: 366, verses: 77 },
  { id: 26, name: 'الشعراء', englishName: 'Ash-Shu\'ara', startPage: 367, endPage: 376, verses: 227 },
  { id: 27, name: 'النمل', englishName: 'An-Naml', startPage: 377, endPage: 385, verses: 93 },
  { id: 28, name: 'القصص', englishName: 'Al-Qasas', startPage: 385, endPage: 396, verses: 88 },
  { id: 29, name: 'العنكبوت', englishName: 'Al-\'Ankabut', startPage: 396, endPage: 404, verses: 69 },
  { id: 30, name: 'الروم', englishName: 'Ar-Rum', startPage: 404, endPage: 410, verses: 60 },
  { id: 31, name: 'لقمان', englishName: 'Luqman', startPage: 411, endPage: 414, verses: 34 },
  { id: 32, name: 'السجدة', englishName: 'As-Sajdah', startPage: 415, endPage: 417, verses: 30 },
  { id: 33, name: 'الأحزاب', englishName: 'Al-Ahzab', startPage: 418, endPage: 427, verses: 73 },
  { id: 34, name: 'سبأ', englishName: 'Saba', startPage: 428, endPage: 434, verses: 54 },
  { id: 35, name: 'فاطر', englishName: 'Fatir', startPage: 434, endPage: 440, verses: 45 },
  { id: 36, name: 'يس', englishName: 'Ya-Sin', startPage: 440, endPage: 445, verses: 83 },
  { id: 37, name: 'الصافات', englishName: 'As-Saffat', startPage: 446, endPage: 452, verses: 182 },
  { id: 38, name: 'ص', englishName: 'Sad', startPage: 453, endPage: 458, verses: 88 },
  { id: 39, name: 'الزمر', englishName: 'Az-Zumar', startPage: 458, endPage: 467, verses: 75 },
  { id: 40, name: 'غافر', englishName: 'Ghafir', startPage: 467, endPage: 476, verses: 85 },
  { id: 41, name: 'فصلت', englishName: 'Fussilat', startPage: 477, endPage: 482, verses: 54 },
  { id: 42, name: 'الشورى', englishName: 'Ash-Shura', startPage: 483, endPage: 489, verses: 53 },
  { id: 43, name: 'الزخرف', englishName: 'Az-Zukhruf', startPage: 489, endPage: 495, verses: 89 },
  { id: 44, name: 'الدخان', englishName: 'Ad-Dukhan', startPage: 496, endPage: 498, verses: 59 },
  { id: 45, name: 'الجاثية', englishName: 'Al-Jathiyah', startPage: 499, endPage: 502, verses: 37 },
  { id: 46, name: 'الأحقاف', englishName: 'Al-Ahqaf', startPage: 502, endPage: 506, verses: 35 },
  { id: 47, name: 'محمد', englishName: 'Muhammad', startPage: 507, endPage: 510, verses: 38 },
  { id: 48, name: 'الفتح', englishName: 'Al-Fath', startPage: 511, endPage: 515, verses: 29 },
  { id: 49, name: 'الحجرات', englishName: 'Al-Hujurat', startPage: 515, endPage: 517, verses: 18 },
  { id: 50, name: 'ق', englishName: 'Qaf', startPage: 518, endPage: 520, verses: 45 },
  { id: 51, name: 'الذاريات', englishName: 'Adh-Dhariyat', startPage: 520, endPage: 523, verses: 60 },
  { id: 52, name: 'الطور', englishName: 'At-Tur', startPage: 523, endPage: 525, verses: 49 },
  { id: 53, name: 'النجم', englishName: 'An-Najm', startPage: 526, endPage: 528, verses: 62 },
  { id: 54, name: 'القمر', englishName: 'Al-Qamar', startPage: 528, endPage: 531, verses: 55 },
  { id: 55, name: 'الرحمن', englishName: 'Ar-Rahman', startPage: 531, endPage: 534, verses: 78 },
  { id: 56, name: 'الواقعة', englishName: 'Al-Waqi\'ah', startPage: 534, endPage: 537, verses: 96 },
  { id: 57, name: 'الحديد', englishName: 'Al-Hadid', startPage: 537, endPage: 541, verses: 29 },
  { id: 58, name: 'المجادلة', englishName: 'Al-Mujadila', startPage: 542, endPage: 545, verses: 22 },
  { id: 59, name: 'الحشر', englishName: 'Al-Hashr', startPage: 545, endPage: 548, verses: 24 },
  { id: 60, name: 'الممتحنة', englishName: 'Al-Mumtahanah', startPage: 549, endPage: 551, verses: 13 },
  { id: 61, name: 'الصف', englishName: 'As-Saff', startPage: 551, endPage: 552, verses: 14 },
  { id: 62, name: 'الجمعة', englishName: 'Al-Jumu\'ah', startPage: 553, endPage: 554, verses: 11 },
  { id: 63, name: 'المنافقون', englishName: 'Al-Munafiqun', startPage: 554, endPage: 555, verses: 11 },
  { id: 64, name: 'التغابن', englishName: 'At-Taghabun', startPage: 556, endPage: 557, verses: 18 },
  { id: 65, name: 'الطلاق', englishName: 'At-Talaq', startPage: 558, endPage: 559, verses: 12 },
  { id: 66, name: 'التحريم', englishName: 'At-Tahrim', startPage: 560, endPage: 561, verses: 12 },
  { id: 67, name: 'الملك', englishName: 'Al-Mulk', startPage: 562, endPage: 564, verses: 30 },
  { id: 68, name: 'القلم', englishName: 'Al-Qalam', startPage: 564, endPage: 566, verses: 52 },
  { id: 69, name: 'الحاقة', englishName: 'Al-Haqqah', startPage: 566, endPage: 568, verses: 52 },
  { id: 70, name: 'المعارج', englishName: 'Al-Ma\'arij', startPage: 568, endPage: 570, verses: 44 },
  { id: 71, name: 'نوح', englishName: 'Nuh', startPage: 570, endPage: 571, verses: 28 },
  { id: 72, name: 'الجن', englishName: 'Al-Jinn', startPage: 572, endPage: 573, verses: 28 },
  { id: 73, name: 'المزمل', englishName: 'Al-Muzzammil', startPage: 574, endPage: 575, verses: 20 },
  { id: 74, name: 'المدثر', englishName: 'Al-Muddaththir', startPage: 575, endPage: 577, verses: 56 },
  { id: 75, name: 'القيامة', englishName: 'Al-Qiyamah', startPage: 577, endPage: 578, verses: 40 },
  { id: 76, name: 'الإنسان', englishName: 'Al-Insan', startPage: 578, endPage: 580, verses: 31 },
  { id: 77, name: 'المرسلات', englishName: 'Al-Mursalat', startPage: 580, endPage: 581, verses: 50 },
  { id: 78, name: 'النبأ', englishName: 'An-Naba', startPage: 582, endPage: 583, verses: 40 },
  { id: 79, name: 'النازعات', englishName: 'An-Nazi\'at', startPage: 583, endPage: 584, verses: 46 },
  { id: 80, name: 'عبس', englishName: '\'Abasa', startPage: 585, endPage: 585, verses: 42 },
  { id: 81, name: 'التكوير', englishName: 'At-Takwir', startPage: 586, endPage: 586, verses: 29 },
  { id: 82, name: 'الانفطار', englishName: 'Al-Infitar', startPage: 587, endPage: 587, verses: 19 },
  { id: 83, name: 'المطففين', englishName: 'Al-Mutaffifin', startPage: 587, endPage: 589, verses: 36 },
  { id: 84, name: 'الانشقاق', englishName: 'Al-Inshiqaq', startPage: 589, endPage: 590, verses: 25 },
  { id: 85, name: 'البروج', englishName: 'Al-Buruj', startPage: 590, endPage: 591, verses: 22 },
  { id: 86, name: 'الطارق', englishName: 'At-Tariq', startPage: 591, endPage: 591, verses: 17 },
  { id: 87, name: 'الأعلى', englishName: 'Al-A\'la', startPage: 591, endPage: 592, verses: 19 },
  { id: 88, name: 'الغاشية', englishName: 'Al-Ghashiyah', startPage: 592, endPage: 593, verses: 26 },
  { id: 89, name: 'الفجر', englishName: 'Al-Fajr', startPage: 593, endPage: 594, verses: 30 },
  { id: 90, name: 'البلد', englishName: 'Al-Balad', startPage: 594, endPage: 595, verses: 20 },
  { id: 91, name: 'الشمس', englishName: 'Ash-Shams', startPage: 595, endPage: 595, verses: 15 },
  { id: 92, name: 'الليل', englishName: 'Al-Layl', startPage: 595, endPage: 596, verses: 21 },
  { id: 93, name: 'الضحى', englishName: 'Ad-Duha', startPage: 596, endPage: 596, verses: 11 },
  { id: 94, name: 'الشرح', englishName: 'Ash-Sharh', startPage: 596, endPage: 596, verses: 8 },
  { id: 95, name: 'التين', englishName: 'At-Tin', startPage: 597, endPage: 597, verses: 8 },
  { id: 96, name: 'العلق', englishName: 'Al-\'Alaq', startPage: 597, endPage: 597, verses: 19 },
  { id: 97, name: 'القدر', englishName: 'Al-Qadr', startPage: 598, endPage: 598, verses: 5 },
  { id: 98, name: 'البينة', englishName: 'Al-Bayyinah', startPage: 598, endPage: 599, verses: 8 },
  { id: 99, name: 'الزلزلة', englishName: 'Az-Zalzalah', startPage: 599, endPage: 599, verses: 8 },
  { id: 100, name: 'العاديات', englishName: 'Al-\'Adiyat', startPage: 599, endPage: 600, verses: 11 },
  { id: 101, name: 'القارعة', englishName: 'Al-Qari\'ah', startPage: 600, endPage: 600, verses: 11 },
  { id: 102, name: 'التكاثر', englishName: 'At-Takathur', startPage: 600, endPage: 600, verses: 8 },
  { id: 103, name: 'العصر', englishName: 'Al-\'Asr', startPage: 601, endPage: 601, verses: 3 },
  { id: 104, name: 'الهمزة', englishName: 'Al-Humazah', startPage: 601, endPage: 601, verses: 9 },
  { id: 105, name: 'الفيل', englishName: 'Al-Fil', startPage: 601, endPage: 601, verses: 5 },
  { id: 106, name: 'قريش', englishName: 'Quraysh', startPage: 602, endPage: 602, verses: 4 },
  { id: 107, name: 'الماعون', englishName: 'Al-Ma\'un', startPage: 602, endPage: 602, verses: 7 },
  { id: 108, name: 'الكوثر', englishName: 'Al-Kawthar', startPage: 602, endPage: 602, verses: 3 },
  { id: 109, name: 'الكافرون', englishName: 'Al-Kafirun', startPage: 603, endPage: 603, verses: 6 },
  { id: 110, name: 'النصر', englishName: 'An-Nasr', startPage: 603, endPage: 603, verses: 3 },
  { id: 111, name: 'المسد', englishName: 'Al-Masad', startPage: 603, endPage: 603, verses: 5 },
  { id: 112, name: 'الإخلاص', englishName: 'Al-Ikhlas', startPage: 604, endPage: 604, verses: 4 },
  { id: 113, name: 'الفلق', englishName: 'Al-Falaq', startPage: 604, endPage: 604, verses: 5 },
  { id: 114, name: 'الناس', englishName: 'An-Nas', startPage: 604, endPage: 604, verses: 6 }
];

/**
 * Get the standardized high-definition Medina Mushaf page image URL
 * @param {number|string} pageNum 1 to 604
 * @returns {string} CDN URL
 */
export const getMushafPageUrl = (pageNum) => {
  const p = Math.max(1, Math.min(604, parseInt(pageNum, 10) || 1));
  const pageStr = String(p).padStart(3, '0');
  return `https://android.quran.com/data/width_1260/page${pageStr}.png`;
};

/**
 * Detects the Surah and resolves its page range from track metadata
 * @param {string} title Track title or Surah name
 * @param {string} [artist] Reciter or artist name
 * @returns {Object|null} Surah page range details or default fallback
 */
export const getSurahPageRange = (title = '', artist = '') => {
  if (!title) return null;
  const cleanTitle = String(title).trim().toLowerCase();

  // Try direct number match e.g. "017" or "17" or "Surah 17"
  const numMatch = cleanTitle.match(/(?:surah|سورة|سوره)?\s*#?\s*(\d{1,3})\b/i);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    if (num >= 1 && num <= 114) {
      const match = SURAH_METADATA.find(s => s.id === num);
      if (match) return match;
    }
  }

  // Normalize Arabic text for searching
  const norm = (str) => String(str)
    .replace(/[إأآا]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '') // remove tashkeel
    .replace(/[-_.]/g, ' ')
    .trim();

  const normTitle = norm(cleanTitle);

  // Exact or contains match on Surah names
  for (const s of SURAH_METADATA) {
    const normSurah = norm(s.name);
    if (normTitle.includes(normSurah) || cleanTitle.includes(s.englishName.toLowerCase())) {
      return s;
    }
  }

  // Fallback if Quran track but exact Surah not isolated
  return {
    id: 1,
    name: 'القرآن الكريم',
    englishName: 'Holy Quran',
    startPage: 1,
    endPage: 604,
    verses: 6236
  };
};
