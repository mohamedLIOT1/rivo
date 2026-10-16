import subprocess
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

KEY = r"C:\Users\mohamed\Downloads\my-bot-key.pem"
HOST = "ubuntu@rivo-m.duckdns.org"

script = """
const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');
  const { Album, Track, Artist } = require('/home/ubuntu/rivo/server/models');

  // 1. Update tracks with generic 'القرآن الكريم' to 'مشاري راشد العفاسي'
  const afasyTracksRes = await Track.updateMany(
    {
      $or: [
        { artist: 'القرآن الكريم' },
        { artist: 'مشاري العفاسي' },
        { album: /مشاري العفاسي/i }
      ]
    },
    { $set: { artist: 'مشاري راشد العفاسي', isQuran: true, genre: 'Quran' } }
  );
  console.log(`Updated ${afasyTracksRes.modifiedCount} tracks to 'مشاري راشد العفاسي'`);

  // 2. Update tracks with 'قرآن كريم ' to 'محمود خليل الحصري'
  const hussaryTracksRes = await Track.updateMany(
    {
      $or: [
        { artist: /قرآن كريم/i },
        { title: /محمود خليل الحصري/i },
        { artist: /محمود خليل الحصري/i }
      ]
    },
    { $set: { artist: 'محمود خليل الحصري', isQuran: true, genre: 'Quran' } }
  );
  console.log(`Updated ${hussaryTracksRes.modifiedCount} tracks to 'محمود خليل الحصري'`);

  // 3. Update Album 'القرآن الكريم كاملاً | مشاري العفاسي (Official)' artist to 'مشاري راشد العفاسي'
  const albRes = await Album.updateMany(
    { name: /مشاري العفاسي/i },
    { $set: { artist: 'مشاري راشد العفاسي' } }
  );
  console.log(`Updated ${albRes.modifiedCount} album(s) artist to 'مشاري راشد العفاسي'`);

  // 4. Ensure reciters exist in Artist collection with valid cover photos
  const recitersToUpsert = [
    {
      name: 'مشاري راشد العفاسي',
      cover: 'https://i.ytimg.com/vi/KWdjhyG9zn8/hqdefault.jpg',
      bio: 'القارئ والمنشد الكويتي مشاري بن راشد العفاسي، إمام المسجد الكبير بدولة الكويت.',
      isVerified: true
    },
    {
      name: 'محمود خليل الحصري',
      cover: 'https://i.ytimg.com/vi/v0X8yFGidOo/hqdefault.jpg',
      bio: 'شيخ عموم المقارئ المصرية وأحد أعلام تلاوة القرآن الكريم البارزين في العالم الإسلامي.',
      isVerified: true
    },
    {
      name: 'محمد صديق المنشاوي',
      cover: 'https://i.ytimg.com/vi/0p_6cR05w_g/hqdefault.jpg',
      bio: 'الشيخ محمد صديق المنشاوي، رائد المدرسة التعبيرية الخاشعة في ترتيل القرآن الكريم.',
      isVerified: true
    },
    {
      name: 'ياسر الدوسري',
      cover: 'https://i.ytimg.com/vi/J5jVf3rQ95w/hqdefault.jpg',
      bio: 'الشيخ الدكتور ياسر بن راشد الدوسري، إمام وخطيب المسجد الحرام بمكة المكرمة.',
      isVerified: true
    }
  ];

  for (const r of recitersToUpsert) {
    const existing = await Artist.findOne({ name: r.name });
    if (!existing) {
      await Artist.create({
        id: `artist-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        name: r.name,
        cover: r.cover,
        bio: r.bio,
        isVerified: r.isVerified,
        genres: ['Quran']
      });
      console.log(`Created Artist profile for ${r.name}`);
    } else if (!existing.cover || existing.cover.length < 5) {
      existing.cover = r.cover;
      await existing.save();
      console.log(`Updated cover for existing Artist ${r.name}`);
    }
  }

  process.exit(0);
})();
"""

local_tmp = os.path.join(os.path.dirname(__file__), 'temp_fix_artists.js')
with open(local_tmp, 'w', encoding='utf-8') as f:
    f.write(script)

subprocess.run(["scp", "-i", KEY, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", local_tmp, f"{HOST}:/home/ubuntu/rivo/temp_fix_artists.js"], check=True)
res = subprocess.run(["ssh", "-i", KEY, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", HOST, "NODE_PATH=/home/ubuntu/rivo/server/node_modules node /home/ubuntu/rivo/temp_fix_artists.js"], capture_output=True, text=True, encoding='utf-8')
print("OUTPUT:\n", res.stdout, flush=True)
if res.stderr:
    print("STDERR:\n", res.stderr, flush=True)

subprocess.run(["ssh", "-i", KEY, "-o", "StrictHostKeyChecking=no", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", HOST, "rm -f /home/ubuntu/rivo/temp_fix_artists.js"])
if os.path.exists(local_tmp):
    os.remove(local_tmp)
