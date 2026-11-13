/**
 * Canonical Album Key & Artwork Dictionary
 * Rivo Music Platform
 */

const OFFICIAL_ALBUM_COVERS = {
  'roma': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/46/81/82/468182bd-6914-bf7d-2f4a-4cb4bd5175cd/196925215671.jpg/1200x1200bb.jpg',
  'supernova': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/7f/a0/00/7fa00086-e72c-191b-6547-e8992f774a9a/885288056853.jpg/1200x1200bb.jpg',
  'nas w nas': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/64/78/b1/6478b176-8977-c2fb-bacd-761567625b00/196925011204.jpg/1200x1200bb.jpg',
  'noaata beida': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/e9/de/11/e9de11f3-be73-e0df-b4ff-72dd702476e3/196626997326.jpg/1200x1200bb.jpg',
  'the ugly ducklings': 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/17/21/ff/1721ffa2-9895-8c92-43af-eaebd0a31cc6/3615938009819.png/1200x1200bb.jpg',
  'cairokee studio session': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/2b/37/92/2b37929b-6df4-0a3e-24c4-5401eb70b5fe/196626954855.jpg/1200x1200bb.jpg',
  'classics, vol. 1': 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/8a/22/95/8a2295a7-e3ba-5b30-1e07-cf3c372c07cc/cover.jpg/1200x1200bb.jpg',
  'roxi': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/ad/83/7f/ad837f70-04a2-b985-2e0b-dbeaf1f2c5c2/196872351095.jpg/1200x1200bb.jpg',
  'rivo': 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/6a/71/f3/6a71f3e3-b9c0-a08d-a782-4fead92c8ed6/cover.jpg/1200x1200bb.jpg',
  'ctrl': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a4/0a/6d/a40a6d0f-4886-f1bf-6c67-61cbf7c7d425/885288123609.jpg/1200x1200bb.jpg',
  'aqareb': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/33/f0/ec/33f0ece3-d007-4cdd-03b7-de6dfaa1442b/199806680476.jpg/1200x1200bb.jpg',
  'sahran': 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/11/49/a2/1149a2a7-5c55-bfa3-0c46-f94e9f90cf05/859737402638_Cover.jpg/1200x1200bb.jpg',
  'kol hayaty': 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/64/08/df/6408df48-f62f-0d92-29fc-4c4dbb9bcae7/859727400347_Cover.jpg/1200x1200bb.jpg',
  'meaddy el nas': 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d2/e1/97/d2e19759-e749-749a-a439-1e310ac89f14/889502763589.jpg/1200x1200bb.jpg',
  'ahla w ahla': 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/a8/81/9f/a8819f9f-99f8-eb28-6a73-fcae47843bc8/3616842352848.jpg/1200x1200bb.jpg',
  'eish beshoak': 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/15/d5/43/15d54341-26ec-8be5-61be-d7f4be2b8ee3/3615934057869.png/1200x1200bb.jpg',
  'ayam': 'https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/6c/0e/41/6c0e4171-897b-bb68-ea48-fbf5272a2754/859730591025_Cover.jpg/1200x1200bb.jpg'
};

const CANONICAL_ALBUM_KEY_MAP = {
  // Cairokee
  'supernova': 'supernova', 'roma': 'roma', 'nas w nas': 'nas w nas', 'ناس وناس': 'nas w nas',
  'the ugly ducklings': 'the ugly ducklings', 'ابناء البطة السوداء': 'the ugly ducklings',
  'noaata beida': 'noaata beida', 'noqta beda': 'noaata beida', 'نقطة بيضاء': 'noaata beida', 'نقطه بيضاء': 'noaata beida',
  'el sekka shemal': 'el sekka shemal', 'elseka shemal': 'el sekka shemal', 'السكه شمال': 'el sekka shemal', 'السكة شمال': 'el sekka shemal',
  'matloob zaeem': 'matloob zaeem', 'matlob za3em': 'matloob zaeem', 'مطلوب زعيم': 'matloob zaeem',
  'wana maa nafsy aaed': 'wana ma nafsy aed', 'wana ma a nafsy aaed': 'wana ma nafsy aed',
  'wana maa nafsy a3ed': 'wana ma nafsy aed', 'wana ma a nafsy a3ed': 'wana ma nafsy aed',
  'wana maa nafsy aed': 'wana ma nafsy aed', 'وانا مع نفسي قاعد': 'wana ma nafsy aed',
  'cairokee studio session': 'cairokee studio session', 'كايروكي من الاستوديو': 'cairokee studio session',
  'classics, vol. 1': 'classics, vol. 1', 'classics vol 1': 'classics, vol. 1', 'classics': 'classics, vol. 1',
  'roxi': 'roxi', 'rivo': 'rivo', 'ريفو': 'rivo', 'ريڤو': 'rivo', 'لما بنتولد': 'لما بنتولد',
  // Marwan Pablo & Wegz
  'ctrl': 'ctrl', 'aqareb': 'aqareb', 'عقارب': 'aqareb',
  // Amr Diab
  'ahla w ahla': 'ahla w ahla', 'احلى و احلى': 'ahla w ahla', 'أحلى و أحلى': 'ahla w ahla', 'أحلى وأحلى': 'ahla w ahla',
  'meaddy el nas': 'meaddy el nas', 'معدي الناس': 'meaddy el nas', 'sahran': 'sahran', 'سهران': 'sahran',
  'ya ana ya la': 'ya ana ya la', 'يا انا يا لا': 'ya ana ya la', 'يا أنا يا لأ': 'ya ana ya la',
  'kol hayaty': 'kol hayaty', 'كل حياتي': 'kol hayaty',
  // Tamer Ashour & Tamer Hosny
  'tegy ntrahn': 'tegy nrahan', 'tegy nrahan': 'tegy nrahan', 'تيجي نتراهن': 'tegy nrahan',
  'ايام': 'ayam', 'أيام': 'ayam', 'ayam': 'ayam',
  'eish besho ak': 'eish beshoak', 'eish beshoak': 'eish beshoak', 'عيش بشوقك': 'eish beshoak',
  'khallik foulazy': 'khallik foulazy', 'خليك فولاذي': 'khallik foulazy', 'ashamgy': 'ashamgy', 'عشأنجي': 'ashamgy',
  // Marwan Moussa & Lege-Cy
  'matador': 'matador', 'ماتادور': 'matador', 'florida': 'florida',
  'talatini': 'talatini', 'تلاتيني': 'talatini', 'bgd': 'bgd', '191-181': '191-181',
  'placebo': 'placebo', 'plan-b': 'plan-b', 'agzakhana': 'agzakhana',
  // Tul8te
  'كوكتيل غنائي للفنان تووليت حصريا لحبايب قلبي': 'koktel ghenae', 'كوكتيل غنائي': 'koktel ghenae',
  'narein': 'narein', 'sadeek el bernameg': 'sadeek el bernameg'
};

module.exports = {
  OFFICIAL_ALBUM_COVERS,
  CANONICAL_ALBUM_KEY_MAP
};
