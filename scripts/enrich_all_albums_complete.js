const mongoose = require('mongoose');
const https = require('https');
const dotenv = require('dotenv');

dotenv.config({ path: '/home/ubuntu/rivo/.env' });

function itunesSearchAlbum(title, artist) {
  return new Promise(resolve => {
    const term = `${artist} ${title}`.trim();
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=album&country=EG&limit=5`;
    https.get(url, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          const results = data.results || [];
          if (results.length === 0) return resolve(null);
          // Find closest match
          const cleanTitle = title.toLowerCase().replace(/[-–—]/g, ' ').trim();
          const match = results.find(r => {
            const rName = (r.collectionName || '').toLowerCase().replace(/[-–—]/g, ' ').trim();
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
              title: r.trackName,
              artist: r.artistName,
              album: r.collectionName,
              cover: r.artworkUrl100 ? r.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg') : '',
              duration: Math.round((r.trackTimeMillis || 180000) / 1000),
              trackNumber: r.trackNumber || 1,
              streamUrl: r.previewUrl || ''
            }));
          resolve(tracks);
        } catch(e) { resolve([]); }
      });
    }).on('error', () => resolve([]));
  });
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB for album enrichment & classification');

  const Album = mongoose.connection.db.collection('albums');
  const albums = await Album.find({}).toArray();
  console.log(`Processing ${albums.length} albums...`);

  let classifiedSingles = 0;
  let classifiedEps = 0;
  let classifiedAlbums = 0;
  let tracksEnriched = 0;

  for (const alb of albums) {
    const name = String(alb.name || '').trim();
    const artist = String(alb.artist || '').trim();
    const nameLower = name.toLowerCase();

    // Determine releaseType
    let releaseType = 'album';
    if (nameLower.endsWith('- single') || nameLower.endsWith('(single)') || alb.trackCount === 1) {
      releaseType = 'single';
      classifiedSingles++;
    } else if (nameLower.endsWith('- ep') || nameLower.endsWith('(ep)') || (alb.trackCount >= 2 && alb.trackCount <= 6)) {
      releaseType = 'ep';
      classifiedEps++;
    } else {
      releaseType = 'album';
      classifiedAlbums++;
    }

    const updates = { releaseType };

    // Fix Amarain cover specifically
    if (nameLower.includes('amarain') || nameLower.includes('قمرين')) {
      updates.cover = 'https://is1-ssl.mzstatic.com/image/thumb/Music6/v4/b9/56/14/b956146c-ca00-7619-d521-d002b61ad1a6/dj.vlndmiyw.jpg/600x600bb.jpg';
    }

    // For albums and EPs, fetch full official tracklist if empty or incomplete
    if (releaseType !== 'single' && (!alb.tracks || alb.tracks.length < 5)) {
      try {
        const itunesAlb = await itunesSearchAlbum(name, artist);
        if (itunesAlb && itunesAlb.collectionId) {
          const officialTracks = await itunesLookupTracks(itunesAlb.collectionId);
          if (officialTracks.length > 0) {
            updates.tracks = officialTracks;
            updates.trackCount = officialTracks.length;
            if (itunesAlb.artworkUrl100 && (!alb.cover || alb.cover.includes('ui-avatars') || alb.cover.includes('hqdefault'))) {
              updates.cover = itunesAlb.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg');
            }
            tracksEnriched++;
            console.log(`  [Complete Tracklist] ${name} (${artist}): Added ${officialTracks.length} official tracks`);
          }
        }
      } catch (e) {}
    }

    await Album.updateOne({ _id: alb._id }, { $set: updates });
  }

  console.log(`\n🎉 Finished Classification & Enrichment!`);
  console.log(`- Albums: ${classifiedAlbums}`);
  console.log(`- EPs: ${classifiedEps}`);
  console.log(`- Singles: ${classifiedSingles}`);
  console.log(`- Full Official Tracklists Enriched: ${tracksEnriched}`);

  await mongoose.disconnect();
}

main().catch(console.error);
