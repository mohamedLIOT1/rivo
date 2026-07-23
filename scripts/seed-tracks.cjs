/**
 * Liofy — YouTube Auto Seed Script
 * يجلب الأغاني الأصلية من YouTube ويحفظها في MongoDB
 * الاستخدام: node scripts/seed-tracks.js
 * 
 * المصادر:
 *  - YouTube Music Charts (via Invidious API — مجاني)
 *  - YouTube official "Topic" channels
 *  - يجلب audioUrl من YouTube لكل أغنية ليتم تشغيلها عبر proxy
 */

const mongoose = require('mongoose');
const path = require('path');

try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

const MONGO_URI = process.env.MONGO_URI || '';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';

if (!MONGO_URI) {
  console.error('❌ MONGO_URI not found in .env');
  process.exit(1);
}

// Track Schema
const TrackSchema = new mongoose.Schema({
  title:    { type: String, required: true },
  artist:   { type: String, required: true },
  album:    { type: String, default: 'Single' },
  cover:    { type: String, default: '' },
  audioUrl: { type: String, default: '' },
  duration: { type: Number, default: 210 },
  genre:    { type: String, default: 'Pop' },
  source:   { type: String, default: 'YouTube' },
  addedBy:  { type: String, default: 'auto-seed' },
  lyrics:   [{ time: Number, text: String }],
  color:    { type: String, default: '#FF0000' },
}, { timestamps: true, strict: false });

const Track = mongoose.model('Track', TrackSchema);

const GENRE_COLORS = {
  'Arab Pop':   '#C9A84C',
  'Mahragan':   '#E94560',
  'Sha3bi':     '#F5A623',
  'Pop':        '#1DB954',
  'Hip-Hop':    '#9B59B6',
  'R&B':        '#E74C3C',
  'Rock':       '#E67E22',
  'Electronic': '#3498DB',
  'Latin':      '#2ECC71',
};

// ── الأغاني اللي هنبحث عنها على YouTube ─────────────────────────────
// كل أغنية بنبحث عنها بالاسم + "official audio" أو "official video"
const SEED_SONGS = [
  // 🇪🇬 Arab Classics & Modern
  { q: 'عمرو دياب نور العين official', artist: 'عمرو دياب', genre: 'Arab Pop' },
  { q: 'عمرو دياب وأنا عشت official', artist: 'عمرو دياب', genre: 'Arab Pop' },
  { q: 'عمرو دياب كل حياتي official', artist: 'عمرو دياب', genre: 'Arab Pop' },
  { q: 'عمرو دياب تملي معاك official', artist: 'عمرو دياب', genre: 'Arab Pop' },
  { q: 'محمد حماقي بحبك official audio', artist: 'محمد حماقي', genre: 'Arab Pop' },
  { q: 'محمد حماقي أنسى official', artist: 'محمد حماقي', genre: 'Arab Pop' },
  { q: 'تامر حسني اتعلمت official', artist: 'تامر حسني', genre: 'Arab Pop' },
  { q: 'تامر حسني ست الستات official', artist: 'تامر حسني', genre: 'Arab Pop' },
  { q: 'أنغام فارقني official', artist: 'أنغام', genre: 'Arab Pop' },
  { q: 'شيرين عبد الوهاب أهواك official', artist: 'شيرين', genre: 'Arab Pop' },
  { q: 'سعد لمجرد ya nass official', artist: 'سعد لمجرد', genre: 'Arab Pop' },
  { q: 'نانسي عجرم أه ونص official', artist: 'نانسي عجرم', genre: 'Arab Pop' },
  { q: 'نانسي عجرم أكتر واحد official', artist: 'نانسي عجرم', genre: 'Arab Pop' },
  { q: 'اليسا بتحبني ليه official', artist: 'اليسا', genre: 'Arab Pop' },
  { q: 'وائل كفوري ما بعرف official', artist: 'وائل كفوري', genre: 'Arab Pop' },
  { q: 'راغب علامة عمري كله official', artist: 'راغب علامة', genre: 'Arab Pop' },
  { q: 'محمد منير أهواك official', artist: 'محمد منير', genre: 'Arab Pop' },
  { q: 'فيروز كيفك انت official', artist: 'فيروز', genre: 'Arab Pop' },
  { q: 'كاظم الساهر قولي احبك official', artist: 'كاظم الساهر', genre: 'Arab Pop' },
  { q: 'ماجد المهندس ما أبيك official', artist: 'ماجد المهندس', genre: 'Arab Pop' },
  { q: 'حسين الجسمي بشرة خير official', artist: 'حسين الجسمي', genre: 'Arab Pop' },
  { q: 'مروان خوري ما بعرف official', artist: 'مروان خوري', genre: 'Arab Pop' },
  { q: 'نور الزين حنيت official', artist: 'نور الزين', genre: 'Arab Pop' },
  { q: 'أصالة نصري قديش كنت official', artist: 'أصالة', genre: 'Arab Pop' },
  { q: 'عبد الحليم حافظ بتلومني ليه', artist: 'عبد الحليم حافظ', genre: 'Arab Pop' },
  { q: 'أم كلثوم أنت عمري', artist: 'أم كلثوم', genre: 'Arab Pop' },

  // 🔥 Mahragan & Sha3bi
  { q: 'حسن شاكوش روتين official', artist: 'حسن شاكوش', genre: 'Mahragan' },
  { q: 'حسن شاكوش أنا غير official', artist: 'حسن شاكوش', genre: 'Mahragan' },
  { q: 'عمر كمال دلع official', artist: 'عمر كمال', genre: 'Mahragan' },
  { q: 'حكيم والاه زمان official', artist: 'حكيم', genre: 'Sha3bi' },
  { q: 'حكيم عدي النهار official', artist: 'حكيم', genre: 'Sha3bi' },
  { q: 'مصطفى حجاج ليلة حظي official', artist: 'مصطفى حجاج', genre: 'Sha3bi' },

  // 🌍 Pop
  { q: 'The Weeknd Blinding Lights official audio', artist: 'The Weeknd', genre: 'Pop' },
  { q: 'The Weeknd Save Your Tears official audio', artist: 'The Weeknd', genre: 'Pop' },
  { q: 'The Weeknd Starboy official audio', artist: 'The Weeknd', genre: 'Pop' },
  { q: 'Ed Sheeran Shape of You official audio', artist: 'Ed Sheeran', genre: 'Pop' },
  { q: 'Ed Sheeran Perfect official audio', artist: 'Ed Sheeran', genre: 'Pop' },
  { q: 'Taylor Swift Anti-Hero official audio', artist: 'Taylor Swift', genre: 'Pop' },
  { q: 'Taylor Swift Shake It Off official audio', artist: 'Taylor Swift', genre: 'Pop' },
  { q: 'Dua Lipa Levitating official audio', artist: 'Dua Lipa', genre: 'Pop' },
  { q: 'Dua Lipa Don\'t Start Now official audio', artist: 'Dua Lipa', genre: 'Pop' },
  { q: 'Billie Eilish bad guy official audio', artist: 'Billie Eilish', genre: 'Pop' },
  { q: 'Ariana Grande 7 rings official audio', artist: 'Ariana Grande', genre: 'Pop' },
  { q: 'Justin Bieber Love Yourself official audio', artist: 'Justin Bieber', genre: 'Pop' },
  { q: 'Bruno Mars Uptown Funk official audio', artist: 'Bruno Mars', genre: 'Pop' },
  { q: 'Bruno Mars Just The Way You Are official audio', artist: 'Bruno Mars', genre: 'Pop' },
  { q: 'Harry Styles As It Was official audio', artist: 'Harry Styles', genre: 'Pop' },
  { q: 'Olivia Rodrigo drivers license official audio', artist: 'Olivia Rodrigo', genre: 'Pop' },
  { q: 'Sabrina Carpenter Espresso official audio', artist: 'Sabrina Carpenter', genre: 'Pop' },
  { q: 'Coldplay Yellow official audio', artist: 'Coldplay', genre: 'Rock' },
  { q: 'Coldplay The Scientist official audio', artist: 'Coldplay', genre: 'Rock' },
  { q: 'Maroon 5 Sugar official audio', artist: 'Maroon 5', genre: 'Pop' },
  { q: 'Rihanna Diamonds official audio', artist: 'Rihanna', genre: 'R&B' },
  { q: 'Rihanna We Found Love official audio', artist: 'Rihanna', genre: 'R&B' },

  // 🎤 Hip-Hop
  { q: 'Drake One Dance official audio', artist: 'Drake', genre: 'Hip-Hop' },
  { q: 'Drake God\'s Plan official audio', artist: 'Drake', genre: 'Hip-Hop' },
  { q: 'Eminem Lose Yourself official audio', artist: 'Eminem', genre: 'Hip-Hop' },
  { q: 'Post Malone Circles official audio', artist: 'Post Malone', genre: 'Hip-Hop' },
  { q: 'Kendrick Lamar HUMBLE official audio', artist: 'Kendrick Lamar', genre: 'Hip-Hop' },
  { q: 'Travis Scott SICKO MODE official audio', artist: 'Travis Scott', genre: 'Hip-Hop' },

  // 🎵 Electronic
  { q: 'David Guetta Titanium official audio', artist: 'David Guetta', genre: 'Electronic' },
  { q: 'Calvin Harris Summer official audio', artist: 'Calvin Harris', genre: 'Electronic' },
  { q: 'Avicii Wake Me Up official audio', artist: 'Avicii', genre: 'Electronic' },
  { q: 'Martin Garrix Animals official audio', artist: 'Martin Garrix', genre: 'Electronic' },

  // 🎸 Rock
  { q: 'Imagine Dragons Radioactive official audio', artist: 'Imagine Dragons', genre: 'Rock' },
  { q: 'Imagine Dragons Believer official audio', artist: 'Imagine Dragons', genre: 'Rock' },
  { q: 'Linkin Park In The End official audio', artist: 'Linkin Park', genre: 'Rock' },
];

// ── Invidious instances (alternative YouTube API, no key needed) ────
const INVIDIOUS_INSTANCES = [
  'https://inv.zoomerville.com',
  'https://invidious.slipfox.xyz',
  'https://yt.artemislena.eu',
];

async function searchYouTubeInvidious(query, limit = 3) {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&sort_by=relevance&page=1`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) continue;

      // Filter: prefer official channels, music videos
      const videos = data
        .filter(v => v.type === 'video' && v.lengthSeconds > 60 && v.lengthSeconds < 600)
        .slice(0, limit);

      if (videos.length > 0) {
        return { videos, instance };
      }
    } catch {}
  }
  return null;
}

async function searchYouTubeOfficialAPI(query, limit = 3) {
  if (!YOUTUBE_API_KEY) return null;
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&maxResults=${limit}&key=${YOUTUBE_API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.items?.length) return null;

    // Get durations
    const ids = data.items.map(i => i.id.videoId).join(',');
    const detailsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids}&key=${YOUTUBE_API_KEY}`
    );
    const details = await detailsRes.json();
    const durationMap = {};
    (details.items || []).forEach(v => {
      const match = v.contentDetails.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (match) {
        const h = parseInt(match[1] || 0);
        const m = parseInt(match[2] || 0);
        const s = parseInt(match[3] || 0);
        durationMap[v.id] = h * 3600 + m * 60 + s;
      }
    });

    return data.items
      .filter(item => {
        const dur = durationMap[item.id.videoId] || 999;
        return dur > 60 && dur < 600;
      })
      .map(item => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.high?.url || `https://i.ytimg.com/vi/${item.id.videoId}/hqdefault.jpg`,
        duration: durationMap[item.id.videoId] || 210,
      }));
  } catch {
    return null;
  }
}

async function main() {
  console.log('\n🎵 Liofy — YouTube Auto-Seed');
  console.log('═══════════════════════════════════════');
  console.log(`📊 Will process ${SEED_SONGS.length} songs`);
  if (YOUTUBE_API_KEY) {
    console.log('🔑 YouTube API Key: found (official search)');
  } else {
    console.log('⚠️  No YouTube API Key — using Invidious (fallback)');
  }
  console.log('');

  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 20000,
  });
  console.log('✅ MongoDB connected!\n');

  const existingCount = await Track.countDocuments();
  console.log(`📦 Existing tracks in DB: ${existingCount}\n`);

  let totalAdded = 0;
  let totalFailed = 0;

  for (const { q, artist, genre } of SEED_SONGS) {
    process.stdout.write(`🔍 "${q.substring(0, 45)}"... `);

    let videoId = null;
    let title = null;
    let cover = null;
    let duration = 210;

    // Try YouTube official API first
    if (YOUTUBE_API_KEY) {
      const ytResults = await searchYouTubeOfficialAPI(q, 3);
      if (ytResults && ytResults.length > 0) {
        const best = ytResults[0];
        videoId = best.videoId;
        title = best.title;
        cover = best.thumbnail;
        duration = best.duration;
      }
    }

    // Fallback: Invidious
    if (!videoId) {
      const inv = await searchYouTubeInvidious(q, 3);
      if (inv) {
        const v = inv.videos[0];
        videoId = v.videoId;
        title = v.title;
        cover = v.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        duration = v.lengthSeconds || 210;
      }
    }

    if (!videoId) {
      console.log('❌ Not found');
      totalFailed++;
      continue;
    }

    // Clean up title (remove "Official Audio", "Official Video", etc.)
    const cleanTitle = title
      .replace(/\s*[\(\[](official\s*)?(audio|video|music video|lyric video|visualizer|4k)[\)\]]/gi, '')
      .replace(/\s*-\s*(official\s*)?(audio|video|music video)/gi, '')
      .trim();

    // Ensure cover is using YouTube CDN
    if (!cover || !cover.startsWith('http')) {
      cover = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    }

    // Check duplicate
    try {
      const exists = await Track.findOne({
        audioUrl: { $regex: videoId }
      });

      if (exists) {
        console.log('⏭️  Duplicate');
        continue;
      }

      await new Track({
        title: cleanTitle || q,
        artist,
        album: 'Single',
        cover,
        audioUrl: `https://www.youtube.com/watch?v=${videoId}`,
        duration,
        genre,
        source: 'YouTube',
        addedBy: 'auto-seed',
        color: GENRE_COLORS[genre] || '#FF0000',
      }).save();

      console.log(`✅ Added (${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')})`);
      totalAdded++;
    } catch (e) {
      console.log(`❌ DB Error: ${e.message}`);
      totalFailed++;
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`🎉 Seeding complete!`);
  console.log(`✅ Added: ${totalAdded} tracks`);
  console.log(`❌ Failed/Skipped: ${totalFailed} tracks`);
  const finalCount = await Track.countDocuments();
  console.log(`📦 Total in DB: ${finalCount} tracks`);
  console.log('═══════════════════════════════════════\n');
  console.log('💡 Now restart your server and open the app!');
  console.log('   The tracks will appear automatically in the Home screen.\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(e => {
  console.error('\n❌ Fatal error:', e.message);
  process.exit(1);
});
