/**
 * Centralized Canonical Artist Aliases & Deduplication Registry
 * Unifies Arabic, Latin, and transliterated artist spellings across Rivo backend.
 * Strictly modularized (< 400 lines).
 */

const CANONICAL_ARTIST_GROUPS = [
  {
    canonical: 'Shehab',
    aliases: [
      'shehab', 'شهاب', 'shehab - شهاب', 'شهاب - shehab', 'shehab / شهاب', 'شهاب / shehab',
      'shehab (شهاب)', 'شهاب (shehab)', 'shehab شهاب', 'شهاب shehab', 'shehab-شهاب', 'شهاب-shehab'
    ]
  },
  {
    canonical: 'Wegz',
    aliases: [
      'wegz', 'ويجز', 'wegzz', 'wegz - ويجز', 'ويجز - wegz', 'wegz / ويجز', 'ويجز / wegz',
      'wegz (ويجز)', 'ويجز (wegz)', 'wegz ويجز', 'ويجز wegz', 'wegz-ويجز', 'ويجز-wegz'
    ]
  },
  {
    canonical: 'Amr Diab',
    aliases: [
      'amr diab', 'عمرو دياب', 'elhadaba', 'el hadaba', 'الهضبة',
      'amr diab - عمرو دياب', 'عمرو دياب - amr diab', 'amr diab / عمرو دياب', 'عمرو دياب / amr diab',
      'amr diab (عمرو دياب)', 'عمرو دياب (amr diab)', 'amr diab عمرو دياب', 'عمرو دياب amr diab'
    ]
  },
  {
    canonical: 'Marwan Pablo',
    aliases: [
      'marwan pablo', 'pablo', 'مروان بابلو', 'بابلو',
      'marwan pablo - مروان بابلو', 'مروان بابلو - marwan pablo', 'marwan pablo / مروان بابلو',
      'مروان بابلو / marwan pablo', 'marwan pablo (مروان بابلو)', 'مروان بابلو (marwan pablo)',
      'marwan pablo مروان بابلو', 'مروان بابلو marwan pablo'
    ]
  },
  {
    canonical: 'Tul8te',
    aliases: [
      'tul8te', 'toolete', 'tulet', 'تو ليت', 'توليت', 'توو ليت', 'تووليت',
      'tul8te - تووليت', 'تووليت - tul8te', 'tul8te - توليت', 'توليت - tul8te',
      'tul8te / تووليت', 'تووليت / tul8te', 'tul8te (تووليت)', 'تووليت (tul8te)',
      'tul8te (توليت)', 'توليت (tul8te)', 'tul8te توليت', 'توليت tul8te',
      'tul8te تووليت', 'تووليت tul8te'
    ]
  },
  {
    canonical: 'Batistuta',
    aliases: [
      'batistuta', 'باتستوتا', 'باتيستوتا',
      'batistuta - باتستوتا', 'باتستوتا - batistuta', 'batistuta / باتستوتا', 'باتستوتا / batistuta',
      'batistuta (باتستوتا)', 'باتستوتا (batistuta)', 'batistuta باتستوتا', 'باتستوتا batistuta'
    ]
  },
  {
    canonical: 'Lege-Cy',
    aliases: [
      'lege-cy', 'lege cy', 'legecy', 'legi c', 'legi-c', 'legic',
      'ليجيسي', 'ليجي', 'ليجسي', 'ليجي سي', 'ليجي-سي',
      'lege-cy - ليجيسي', 'lege-cy - ليجي سي', 'ليجيسي - lege-cy', 'lege-cy ليجيسي', 'ليجيسي lege-cy'
    ]
  },
  {
    canonical: 'El Joker',
    aliases: [
      'el joker', 'eljoker', 'joker', 'الجوكر', 'جوكر',
      'el joker - الجوكر', 'الجوكر - el joker', 'el joker / الجوكر',
      'el joker (الجوكر)', 'الجوكر (el joker)', 'el joker الجوكر', 'الجوكر el joker'
    ]
  },
  {
    canonical: 'Amir Eid',
    aliases: ['amir eid', 'amireid', 'أمير عيد', 'امير عيد', 'amir eid - أمير عيد', 'أمير عيد - amir eid']
  },
  {
    canonical: 'Cairokee',
    aliases: [
      'cairokee', 'cairokeeoffical', 'cairokeeofficial', 'cairokee official', 'كايروكي',
      'cairokee - كايروكي', 'كايروكي - cairokee', 'cairokee / كايروكي', 'cairokee (كايروكي)',
      'كايروكي (cairokee)', 'cairokee كايروكي', 'كايروكي cairokee'
    ]
  },
  {
    canonical: 'Mohamed Hamaki',
    aliases: [
      'hamaki', 'mohamed hamaki', 'محمد حماقي', 'حماقي',
      'mohamed hamaki - محمد حماقي', 'محمد حماقي - mohamed hamaki',
      'mohamed hamaki / محمد حماقي', 'mohamed hamaki (محمد حماقي)',
      'mohamed hamaki محمد حماقي', 'محمد حماقي mohamed hamaki'
    ]
  },
  {
    canonical: 'Tamer Hosny',
    aliases: [
      'tamer hosny', 'tamer hosni', 'تامر حسني',
      'tamer hosny - تامر حسني', 'تامر حسني - tamer hosny', 'tamer hosny / تامر حسني',
      'tamer hosny (تامر حسني)', 'تامر حسني (tamer hosny)', 'tamer hosny تامر حسني', 'تامر حسني tamer hosny'
    ]
  },
  {
    canonical: 'Tamer Ashour',
    aliases: [
      'tamer ashour', 'ashour', 'تامر عاشور', 'عاشور',
      'tamer ashour - تامر عاشور', 'تامر عاشور - tamer ashour', 'تامر عاشور tamer ashour'
    ]
  },
  {
    canonical: 'Essam Sasa',
    aliases: [
      'essam sasa', 'sasa', 'عصام صاصا', 'صاصا',
      'essam sasa - عصام صاصا', 'عصام صاصا - essam sasa', 'عصام صاصا essam sasa'
    ]
  },
  {
    canonical: 'Muslim',
    aliases: [
      'muslim', 'مسلم', 'مُسلِم',
      'muslim - مسلم', 'مسلم - muslim', 'muslim - مُسلِم', 'مُسلِم - muslim',
      'muslim / مسلم', 'muslim (مسلم)', 'مسلم (muslim)', 'مسلم muslim'
    ]
  },
  {
    canonical: 'Abyusif',
    aliases: [
      'abyusif', 'أبيوسف', 'ابيوسف', 'ابو يوسف', 'أبو يوسف',
      'abyusif - أبيوسف', 'أبيوسف - abyusif', 'abyusif / أبيوسف',
      'abyusif (أبيوسف)', 'أبيوسف (abyusif)', 'abyusif أبيوسف', 'أبيوسف abyusif'
    ]
  },
  {
    canonical: 'Marwan Moussa',
    aliases: [
      'marwan moussa', 'marwan mousa', 'مروان موسى', 'مروان موسي',
      'marwan moussa - مروان موسى', 'مروان موسى - marwan moussa',
      'marwan moussa / مروان موسى', 'marwan moussa (مروان موسى)', 'مروان موسى marwan moussa'
    ]
  },
  {
    canonical: 'Mousa Sam',
    aliases: [
      'mousa sam', 'موسى سام', 'موسي سام', 'mousa sam - موسى سام'
    ]
  },
  {
    canonical: 'Afroto',
    aliases: [
      'afroto', 'عفروتو',
      'afroto - عفروتو', 'عفروتو - afroto', 'afroto / عفروتو',
      'afroto (عفروتو)', 'عفروتو (afroto)', 'afroto عفروتو'
    ]
  },
  {
    canonical: 'Sharmoofers',
    aliases: [
      'sharmoofers', 'شارموفرز',
      'sharmoofers - شارموفرز', 'شارموفرز - sharmoofers', 'شارموفرز sharmoofers'
    ]
  },
  {
    canonical: 'Massar Egbari',
    aliases: [
      'massar egbari', 'مسار إجباري', 'مسار اجباري',
      'massar egbari - مسار إجباري', 'مسار إجباري - massar egbari'
    ]
  },
  {
    canonical: 'Ahmed Saad',
    aliases: [
      'ahmed saad', 'أحمد سعد', 'احمد سعد',
      'ahmed saad - أحمد سعد', 'أحمد سعد - ahmed saad', 'ahmed saad - احمد سعد',
      'ahmed saad / أحمد سعد', 'ahmed saad (أحمد سعد)', 'ahmed saad أحمد سعد'
    ]
  },
  {
    canonical: 'Bahaa Sultan',
    aliases: [
      'bahaa sultan', 'بهاء سلطان', 'bahaa sultan - بهاء سلطان'
    ]
  },
  {
    canonical: 'Sherine',
    aliases: [
      'sherine', 'sherine abdel-wahab', 'sherine abdel wahab', 'شيرين',
      'شيرين عبد الوهاب', 'شيرين عبدالوهاب', 'sherine - شيرين', 'شيرين - sherine'
    ]
  },
  {
    canonical: 'Ziad Zaza',
    aliases: [
      'ziad zaza', 'زياد ظاظا', 'ظاظا', 'ziad zaza - زياد ظاظا', 'زياد ظاظا - ziad zaza'
    ]
  },
  {
    canonical: 'FL EX',
    aliases: ['fl ex', 'flx', 'flex', 'فليكس', 'flx - فليكس', 'فليكس - flx']
  },
  {
    canonical: 'Karim Osama',
    aliases: ['karim osama', 'كريم اسامة', 'كريم اسامه', 'كريم أسامة', 'karim osama - كريم أسامة']
  },
  {
    canonical: 'Arsenik',
    aliases: ['arsenic', 'arsenik', 'ارسينك', 'أرسينك', 'أرسينِك', 'arsenik - أرسينِك']
  },
  {
    canonical: 'Mousv',
    aliases: ['mousv', 'موسڤ', 'موسف', 'mousv - موسڤ']
  },
  {
    canonical: 'Abo El Anwar',
    aliases: ['abo el anwar', 'ابو الانوار', 'أبو الأنوار', 'abo el anwar - أبو الأنوار']
  },
  {
    canonical: 'Double Zuksh',
    aliases: ['double zuksh', 'دبل زوكش', 'double zuksh - دبل زوكش']
  },
  {
    canonical: '3enba',
    aliases: ['3enba', 'enba', 'enaba', 'عنبة', 'عنبه']
  },
  {
    canonical: 'Hamza Namira',
    aliases: ['hamza namira', 'حمزة نمرة', 'حمزه نمره', 'حمزة نمره']
  },
  {
    canonical: 'Santa',
    aliases: ['santa', 'ahmed santa', 'احمد سانتا', 'أحمد سانتا', 'سانتا', 'santa - سانتا']
  },
  {
    canonical: 'Wingii',
    aliases: ['wingii', 'wingi', 'وينجي', 'ونجي', 'wingii - وينجي']
  },
  {
    canonical: 'Husayn',
    aliases: ['husayn', 'حسين', 'husayn - حسين']
  },
  {
    canonical: 'DizzyTooSkinny',
    aliases: ['dizzytooskinny', 'dizzy too skinny', 'ديزي تو سكيني', 'ديزي']
  },
  {
    canonical: 'Al Shami',
    aliases: [
      'al shami', 'alshami', 'الشامي',
      'al shami - الشامي', 'الشامي - al shami', 'al shami / الشامي',
      'al shami (الشامي)', 'الشامي (al shami)'
    ]
  },
  {
    canonical: 'Mohammed Saeed',
    aliases: [
      'mohammed saeed', 'mohamed saeed', 'محمد سعيد',
      'mohammed saeed - محمد سعيد', 'محمد سعيد - mohammed saeed'
    ]
  },
  {
    canonical: 'Hussain Al Jassmi',
    aliases: [
      'hussain al jassmi', 'hussein al jassmi', 'حسين الجسمي',
      'hussain al jassmi | حسين الجسمي', 'hussain al jassmi - حسين الجسمي'
    ]
  },
  {
    canonical: 'Abdulrahman Mohammed',
    aliases: [
      'abdulrahman mohammed', 'عبدالرحمن محمد', 'عبد الرحمن محمد',
      'abdulrahman mohammed i عبدالرحمن محمد', 'abdulrahman mohammed | عبدالرحمن محمد',
      'abdulrahman mohammed - عبدالرحمن محمد'
    ]
  },
  {
    canonical: 'Teefo',
    aliases: [
      'teefo', 'تيفو', 'teefo - تيفو'
    ]
  },
  {
    canonical: 'Mahmoud El Esseily',
    aliases: [
      'mahmoud el esseily', 'محمود العسيلي', 'العسيلي', 'el esseily'
    ]
  },
  {
    canonical: 'Ramy Sabry',
    aliases: [
      'ramy sabry', 'رامي صبري'
    ]
  },
  {
    canonical: 'Red Bull Sika',
    aliases: [
      'red bull sika', 'ريد بل سيكا', 'ريد بُل سيكا', 'red bull sika - ريد بُل سيكا'
    ]
  },
  {
    canonical: 'Hamo Bika',
    aliases: [
      'hamo bika', 'حمو بيكا', 'hamo bika - حمو بيكا'
    ]
  },
  {
    canonical: 'Hassan Shakosh',
    aliases: [
      'hassan shakosh', 'حسن شاكوش', 'hassan shakosh - حسن شاكوش'
    ]
  },
  {
    canonical: 'Angham',
    aliases: [
      'angham', 'أنغام', 'انغام'
    ]
  },
  {
    canonical: 'Asala',
    aliases: [
      'asala', 'assala', 'أصالة', 'اصالة'
    ]
  },
  {
    canonical: 'Elissa',
    aliases: [
      'elissa', 'إليسا', 'اليسا'
    ]
  },
  {
    canonical: 'Nancy Ajram',
    aliases: [
      'nancy ajram', 'نانسي عجرم'
    ]
  },
  {
    canonical: 'Wael Jassar',
    aliases: [
      'wael jassar', 'وائل جسار'
    ]
  },
  {
    canonical: 'مشاري راشد العفاسي',
    aliases: [
      'مشاري راشد العفاسي', 'alafasy', 'mishary alafasy', 'مشاري العفاسي', 'العفاسي'
    ]
  },
  {
    canonical: 'محمود خليل الحصري',
    aliases: [
      'محمود خليل الحصري', 'الحصري', 'al hussary', 'alhussary', 'al-hussary'
    ]
  },
  {
    canonical: 'محمد صديق المنشاوي',
    aliases: [
      'محمد صديق المنشاوي', 'المنشاوي', 'el minshawi', 'al-minshawi', 'elminshawi'
    ]
  },
  {
    canonical: 'ياسر الدوسري',
    aliases: [
      'ياسر الدوسري', 'الدوسري', 'yasser al dosari', 'al-dosari'
    ]
  }
];

// Flat lowercase dictionary for fast O(1) alias lookups
const FLAT_ALIAS_MAP = {};
for (const group of CANONICAL_ARTIST_GROUPS) {
  const cLower = group.canonical.toLowerCase();
  FLAT_ALIAS_MAP[cLower] = cLower;
  for (const alias of group.aliases) {
    FLAT_ALIAS_MAP[alias.toLowerCase()] = cLower;
  }
}

module.exports = {
  CANONICAL_ARTIST_GROUPS,
  FLAT_ALIAS_MAP
};
