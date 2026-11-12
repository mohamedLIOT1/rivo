const mongoose = require('mongoose');
const https = require('https');
const dotenv = require('dotenv');

dotenv.config({ path: '/home/ubuntu/rivo/.env' });

function fetchJson(url) {
  return new Promise(resolve => {
    https.get(url, { headers: { 'User-Agent': 'RivoServer/2.4' }, timeout: 10000 }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function searchItunes(term) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=album&country=EG&limit=5`;
  const json = await fetchJson(url);
  return json?.results || [];
}

async function lookupItunesTracks(collectionId) {
  const url = `https://itunes.apple.com/lookup?id=${collectionId}&entity=song&country=EG`;
  const json = await fetchJson(url);
  if (!json?.results) return [];
  return json.results
    .filter(r => r.wrapperType === 'track')
    .map(r => ({
      id: `itunes-${r.trackId}`,
      _id: `itunes-${r.trackId}`,
      title: r.trackName,
      artist: r.artistName,
      album: r.collectionName,
      cover: r.artworkUrl100 ? r.artworkUrl100.replace(/\/\d+x\d+bb\./, '/1200x1200bb.') : '',
      duration: Math.round((r.trackTimeMillis || 180000) / 1000),
      trackNumber: r.trackNumber || 1,
      genre: r.primaryGenreName || 'Arabic',
      source: 'official_itunes'
    }));
}

const KNOWN_ENGLISH_MAPPINGS = {
  'معدي الناس': 'Meaddy El Nas',
  'معدى الناس': 'Meaddy El Nas',
  'أحلى و أحلى': 'Ahla W Ahla',
  'أحلى واحلى': 'Ahla W Ahla',
  'علم قلبي': 'Allem Alby',
  'قمرين': 'Amarain',
  'تملي معاك': 'Tamally Maak',
  'سهران': 'Sahran',
  'كل حياتي': 'Kol Hayaty',
  'يا أنا يا لأ': 'Ya Ana Ya La',
  'مكانك': 'Makanak',
  'بناديك تعالى': 'Banadeek Taala',
  'وياه': 'Wayah',
  'الليلة': 'El Leila',
  'شفت الأيام': 'Shoft El Ayam',
  'روما': 'Roma',
  'نقطة بيضا': 'Noaata Beida',
  'أبناء البطة السوداء': 'Abnaa El Batta El Soda',
  'ديناصور': 'Dinosaur',
  'مطلوب زعيم': 'Matloob Zaeem',
  'ناس وناس': 'Nas W Nas',
  'عقارب': 'Aqareb',
  'سوبرنوفا': 'Supernova',
  'بلاسيبو': 'Placebo',
  'ماتادور': 'MATADOR',
  'ثلاثيني': 'TALATINI',
  'فلوريدا': 'Florida'
};

async function findItunesAlbum(name, artist) {
  const cleanName = (name || '').trim();
  const cleanArtist = (artist || '').trim();

  // Try Arabic / Original name
  let results = await searchItunes(`${cleanArtist} ${cleanName}`);
  if (!results || results.length === 0) {
    // Try English mapped name if present
    const engName = KNOWN_ENGLISH_MAPPINGS[cleanName] || KNOWN_ENGLISH_MAPPINGS[cleanName.replace(/ى/g, 'ي')];
    if (engName) {
      results = await searchItunes(`${cleanArtist} ${engName}`);
    }
  }

  if (!results || results.length === 0) {
    // Try just album name
    results = await searchItunes(cleanName);
  }

  if (!results || results.length === 0) return null;

  // Find best match
  const nLow = cleanName.toLowerCase();
  for (const r of results) {
    const colName = (r.collectionName || '').toLowerCase();
    if (colName.includes(nLow) || nLow.includes(colName)) return r;
  }
  return results[0];
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const Album = mongoose.connection.db.collection('albums');
  const Track = mongoose.connection.db.collection('tracks');

  const allAlbums = await Album.find({}).toArray();
  console.log(`Analyzing ${allAlbums.length} total albums in database...`);

  const singlesToDelete = [];
  const albumsToKeep = [];

  for (let i = 0; i < allAlbums.length; i++) {
    const alb = allAlbums[i];
    const name = String(alb.name || alb.title || '').trim();
    const artist = String(alb.artist || '').trim();
    const nameLower = name.toLowerCase();

    // 1. Quran collections: KEEP ALWAYS
    const isQuran = Boolean(
      alb.isQuran ||
      nameLower.includes('القرآن') ||
      nameLower.includes('قرآن') ||
      nameLower.includes('quran') ||
      artist.includes('العفاسي') ||
      artist.includes('عبد الباسط') ||
      artist.includes('الحصري') ||
      artist.includes('المنشاوي')
    );

    if (isQuran) {
      albumsToKeep.push({ alb, releaseType: 'album', isQuran: true });
      continue;
    }

    // 2. Check iTunes for official catalog classification
    const itunesMatch = await findItunesAlbum(name, artist);

    if (itunesMatch) {
      const colName = (itunesMatch.collectionName || '').toLowerCase();
      const tCount = Number(itunesMatch.trackCount || 0);

      // Definite Single from Apple Music
      if (tCount === 1 || colName.endsWith('- single') || colName.endsWith('(single)') || colName.includes(' - single')) {
        singlesToDelete.push({ alb, reason: `iTunes single (${tCount} track, ${itunesMatch.collectionName})` });
        continue;
      }

      // Real Multi-track Album or EP from Apple Music
      if (tCount >= 2) {
        console.log(`[${i+1}/${allAlbums.length}] Found real album on iTunes: "${name}" by "${artist}" (${tCount} tracks)`);
        const officialTracks = await lookupItunesTracks(itunesMatch.collectionId);
        const cover = itunesMatch.artworkUrl100 ? itunesMatch.artworkUrl100.replace(/\/\d+x\d+bb\./, '/1200x1200bb.') : alb.cover;
        const releaseType = (officialTracks.length <= 6 || colName.includes('- ep')) ? 'ep' : 'album';

        albumsToKeep.push({
          alb,
          releaseType,
          trackCount: officialTracks.length || tCount,
          tracks: officialTracks,
          cover,
          releaseDate: itunesMatch.releaseDate ? itunesMatch.releaseDate.slice(0, 4) : alb.releaseDate
        });
        continue;
      }
    }

    // 3. Fallback when not found on iTunes: Check MongoDB tracks
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const localTracks = await Track.find({
      $or: [
        { album: new RegExp(`^${escaped}$`, 'i') },
        { _id: { $in: (alb.trackIds || []).filter(id => mongoose.isValidObjectId(id)).map(id => new mongoose.Types.ObjectId(id)) } }
      ]
    }).toArray();

    const localCount = localTracks.length;
    if (localCount <= 1 || nameLower.includes('single')) {
      singlesToDelete.push({ alb, reason: `No iTunes match & local count <= 1 (${localCount} tracks)` });
    } else {
      const releaseType = localCount <= 6 ? 'ep' : 'album';
      albumsToKeep.push({
        alb,
        releaseType,
        trackCount: localCount,
        tracks: alb.tracks || localTracks,
        cover: alb.cover
      });
    }

    // Small rate-limit pause for iTunes
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n========================================`);
  console.log(`Singles identified for deletion: ${singlesToDelete.length}`);
  console.log(`Genuine multi-track albums/EPs to keep: ${albumsToKeep.length}`);
  console.log(`========================================\n`);

  // Delete singles from albums collection
  if (singlesToDelete.length > 0) {
    const deleteIds = singlesToDelete.map(s => s.alb._id);
    const delRes = await Album.deleteMany({ _id: { $in: deleteIds } });
    console.log(`✅ Permanently deleted ${delRes.deletedCount} single albums from MongoDB.`);

    // Reset track.album to 'Single'
    let tracksCleaned = 0;
    for (const item of singlesToDelete) {
      const sName = String(item.alb.name || '').trim();
      if (!sName) continue;
      const upd = await Track.updateMany(
        { album: new RegExp(`^${sName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        { $set: { album: 'Single' } }
      );
      tracksCleaned += upd.modifiedCount;
    }
    console.log(`✅ Reset ${tracksCleaned} tracks' album field to 'Single'.`);
  }

  // Update and enrich kept albums
  console.log(`\nEnriching and saving ${albumsToKeep.length} kept albums...`);
  for (const item of albumsToKeep) {
    const { alb, releaseType, trackCount, tracks, cover, releaseDate, isQuran } = item;
    const updates = {
      releaseType: releaseType || 'album',
      isAlbum: true,
      trackCount: trackCount || (Array.isArray(tracks) ? tracks.length : (alb.trackIds?.length || 0))
    };

    if (cover) updates.cover = cover;
    if (releaseDate) updates.releaseDate = releaseDate;
    if (Array.isArray(tracks) && tracks.length > 0) {
      updates.tracks = tracks;
    }
    if (isQuran) updates.isQuran = true;

    // Special fix for Amarain
    const nLow = String(alb.name || '').toLowerCase();
    if (nLow.includes('amarain') || nLow.includes('قمرين')) {
      updates.cover = 'https://is1-ssl.mzstatic.com/image/thumb/Music6/v4/b9/56/14/b956146c-ca00-7619-d521-d002b61ad1a6/dj.vlndmiyw.jpg/600x600bb.jpg';
    }

    await Album.updateOne({ _id: alb._id }, { $set: updates });
  }

  console.log(`\n🎉 MASTER DISCOGRAPHY RESTRUCTURING COMPLETE!`);
  await mongoose.disconnect();
}

main().catch(console.error);
