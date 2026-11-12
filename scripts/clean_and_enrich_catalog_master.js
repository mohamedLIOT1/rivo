const mongoose = require('mongoose');
const https = require('https');
const dotenv = require('dotenv');

dotenv.config({ path: '/home/ubuntu/rivo/.env' });

function itunesSearchAlbum(title, artist) {
  return new Promise(resolve => {
    const term = `${artist} ${title}`.trim();
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=album&country=EG&limit=10`;
    https.get(url, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          const results = data.results || [];
          if (results.length === 0) return resolve(null);
          // Find closest match
          const cleanTitle = title.toLowerCase().replace(/[-–—_]/g, ' ').trim();
          const match = results.find(r => {
            const rName = (r.collectionName || '').toLowerCase().replace(/[-–—_]/g, ' ').trim();
            return rName.includes(cleanTitle) || cleanTitle.includes(rName);
          }) || results[0];
          resolve(match);
        } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function itunesLookupTracks(collectionId) {
  return new Promise(resolve => {
    const url = `https://itunes.apple.com/lookup?id=${collectionId}&entity=song&country=EG`;
    https.get(url, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          const tracks = (data.results || [])
            .filter(r => r.wrapperType === 'track')
            .map(r => ({
              id: `itunes-${r.trackId}`,
              _id: `itunes-${r.trackId}`,
              title: r.trackName,
              artist: r.artistName,
              album: r.collectionName,
              cover: r.artworkUrl100 ? r.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg') : '',
              duration: Math.round((r.trackTimeMillis || 180000) / 1000),
              trackNumber: r.trackNumber || 1,
              streamUrl: r.previewUrl || '',
              genre: r.primaryGenreName || 'Arabic',
              source: 'official_album_tracklist',
              isSystem: true
            }));
          resolve(tracks);
        } catch(e) { resolve([]); }
      });
    }).on('error', () => resolve([]));
  });
}

// Known Singles that must ALWAYS be deleted from albums collection
const KNOWN_SINGLES = new Set([
  'barbary', 'oyouno lama ablony', 'kan 3ala 3eny', 'fark kebir', 'dorak gai', 
  'mesh nadman', 'shoft kalam', 'wala meen', 'el neyya', 'el gemeza', 'free', 
  'racore', 'tag', 'felous baba', 'lelly yah', 'eish\'ha b afia', 'habeitek', 
  'أماكن السهر', 'kan 3ala 3eny (red bull mazzika salonat)', 'fark kebir (feat. nancy ajram)',
  'eish\'ha b afia (feat. hassan shakosh)', 'malyan', 'basha et3amad', 'braveheart',
  'el hafla', 'ghabty', 'balady', 'mish fadel', 'waheshteny', 'khalliny ashofak',
  'el helwa', 'mesh faten', 'mesh shayfak', 'sherine - el metr metro', 'ya layli'
]);

// Known Arabic to English album mappings for Amr Diab and others
const DUPLICATE_PAIRS = [
  { ar: 'أحلى و أحلى', en: 'Ahla W Ahla' },
  { ar: 'معدي الناس', en: 'Meaddy El Nas' },
  { ar: 'معدى الناس', en: 'Meaddy El Nas' },
  { ar: 'سهران', en: 'Sahran' },
  { ar: 'يا أنا يا لأ', en: 'Ya Ana Ya La' },
  { ar: 'كل حياتي', en: 'Kol Hayaty' },
  { ar: 'علم قلبي', en: 'Allem Alby' },
  { ar: 'تملي معاك', en: 'Tamally Maak' },
  { ar: 'قمرين', en: 'Amarain' },
  { ar: 'روما', en: 'Album - Roma' },
  { ar: 'نقطة بيضا', en: 'Album - Noaata Beida' },
  { ar: 'ناس و ناس', en: 'Album - Nas W Nas' },
  { ar: 'ثلاثيني', en: 'TALATINI' }
];

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB for master album cleanup & enrichment');

  const Album = mongoose.connection.db.collection('albums');
  const Track = mongoose.connection.db.collection('tracks');

  const allAlbums = await Album.find({}).toArray();
  console.log(`Starting with ${allAlbums.length} albums in DB.`);

  // 1. DEDUPLICATE ARABIC/ENGLISH DUPLICATES
  for (const pair of DUPLICATE_PAIRS) {
    const arAlbs = await Album.find({ name: new RegExp(`^${pair.ar}$`, 'i') }).toArray();
    const enAlbs = await Album.find({ name: new RegExp(`^${pair.en}$`, 'i') }).toArray();

    if (arAlbs.length > 0 && enAlbs.length > 0) {
      for (const arAlb of arAlbs) {
        const arCount = (arAlb.tracks?.length || 0) + (arAlb.trackIds?.length || 0);
        const enAlb = enAlbs[0];
        const enCount = (enAlb.tracks?.length || 0) + (enAlb.trackIds?.length || 0);
        if (arCount === 0 || arCount < enCount) {
          console.log(`Deleting empty Arabic duplicate: "${arAlb.name}" (id: ${arAlb.id}) in favor of "${enAlb.name}" (${enCount} tracks)`);
          await Album.deleteOne({ _id: arAlb._id });
        }
      }
    }
  }

  // 2. ENRICH REAL ALBUMS (especially those with 0 tracks that are genuine albums)
  const remaining = await Album.find({}).toArray();
  console.log(`Checking ${remaining.length} remaining albums for enrichment...`);

  for (const alb of remaining) {
    const name = String(alb.name || '').trim();
    const artist = String(alb.artist || '').trim();
    const nameLower = name.toLowerCase().replace(/[-–—_]/g, ' ').trim();

    // Skip Quran collections
    const isQuran = Boolean(alb.isQuran || nameLower.includes('القرآن') || nameLower.includes('قرآن') || alb.artist?.includes('العفاسي') || alb.artist?.includes('عبد الباسط') || alb.artist?.includes('الحصري') || alb.artist?.includes('المنشاوي'));
    if (isQuran) continue;

    // Check if known single
    if (KNOWN_SINGLES.has(nameLower)) continue;

    const currentTrackCount = (alb.tracks?.length || 0) + (alb.trackIds?.length || 0);

    // If album has fewer than 5 tracks, try to fetch full official tracklist from iTunes
    if (currentTrackCount < 5) {
      // Lookup iTunes
      let queryName = name.replace(/^album\s*[-–—:]\s*/i, '');
      const itunesAlbum = await itunesSearchAlbum(queryName, artist);
      if (itunesAlbum && itunesAlbum.collectionId) {
        const fullTracks = await itunesLookupTracks(itunesAlbum.collectionId);
        if (fullTracks.length >= 2) {
          const highResCover = itunesAlbum.artworkUrl100 ? itunesAlbum.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg') : alb.cover;
          const releaseType = fullTracks.length >= 7 ? 'album' : 'ep';
          await Album.updateOne(
            { _id: alb._id },
            {
              $set: {
                tracks: fullTracks,
                trackCount: fullTracks.length,
                cover: highResCover,
                releaseType,
                isAlbum: true,
                releaseDate: itunesAlbum.releaseDate ? itunesAlbum.releaseDate.slice(0, 4) : alb.releaseDate
              }
            }
          );
          console.log(`[ENRICHED] "${name}" by "${artist}": ${fullTracks.length} tracks (${releaseType})`);
        }
      }
    }
  }

  // 3. PURGE SINGLES AND ZERO-TRACK SHELLS
  const freshList = await Album.find({}).toArray();
  const toDelete = [];
  const toKeep = [];

  for (const alb of freshList) {
    const name = String(alb.name || '').trim();
    const nameLower = name.toLowerCase();
    const cleanLower = nameLower.replace(/^album\s*[-–—:]\s*/i, '').replace(/[-–—_()]/g, ' ').trim();
    const count = Number(alb.trackCount || (Array.isArray(alb.tracks) ? alb.tracks.length : (Array.isArray(alb.trackIds) ? alb.trackIds.length : 0)));

    const isQuran = Boolean(alb.isQuran || nameLower.includes('القرآن') || nameLower.includes('قرآن') || alb.artist?.includes('العفاسي') || alb.artist?.includes('عبد الباسط') || alb.artist?.includes('الحصري') || alb.artist?.includes('المنشاوي'));
    if (isQuran) {
      toKeep.push(alb);
      continue;
    }

    const isSingleName = nameLower.endsWith('- single') || nameLower.endsWith('(single)') || nameLower.includes(' - single');
    const isKnownSingle = KNOWN_SINGLES.has(cleanLower) || KNOWN_SINGLES.has(nameLower);
    const isSingleCount = count <= 1;

    if (isSingleName || isKnownSingle || isSingleCount) {
      toDelete.push(alb);
    } else {
      toKeep.push(alb);
    }
  }

  console.log(`\nIdentified ${toDelete.length} singles/empty shells to delete.`);
  console.log(`Identified ${toKeep.length} genuine multi-track albums/EPs to keep.`);

  // Perform deletion of singles
  const deleteIds = toDelete.map(a => a._id);
  if (deleteIds.length > 0) {
    const delRes = await Album.deleteMany({ _id: { $in: deleteIds } });
    console.log(`Deleted ${delRes.deletedCount} albums.`);
  }

  // Update track.album = 'Single' for deleted singles
  let resetCount = 0;
  for (const single of toDelete) {
    const clean = String(single.name || '').trim();
    if (!clean) continue;
    const upd = await Track.updateMany(
      { album: new RegExp(`^${clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      { $set: { album: 'Single' } }
    );
    resetCount += upd.modifiedCount;
  }
  console.log(`Reset ${resetCount} tracks' album field to 'Single'.`);

  // Classify all kept albums
  for (const alb of toKeep) {
    const count = Number(alb.trackCount || (Array.isArray(alb.tracks) ? alb.tracks.length : (Array.isArray(alb.trackIds) ? alb.trackIds.length : 0)));
    const nameLower = String(alb.name || '').toLowerCase();
    let releaseType = 'album';
    if (nameLower.endsWith('- ep') || nameLower.endsWith('(ep)') || (count >= 2 && count <= 6)) {
      releaseType = 'ep';
    }
    await Album.updateOne(
      { _id: alb._id },
      {
        $set: {
          releaseType,
          isAlbum: true,
          trackCount: count
        }
      }
    );
  }

  // Final summary
  const finalAlbums = await Album.find({}).toArray();
  console.log(`\nFinal album collection count: ${finalAlbums.length}`);
  const finalSummary = finalAlbums.map(a => ({
    name: a.name,
    artist: a.artist,
    type: a.releaseType,
    tracks: a.trackCount || a.tracks?.length || 0
  }));
  console.log('Sample of final catalog:');
  console.log(finalSummary.slice(0, 20));

  await mongoose.disconnect();
}

main().catch(console.error);
