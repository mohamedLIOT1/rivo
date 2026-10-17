require('./server/node_modules/dotenv').config({ path: '/home/ubuntu/rivo/.env' });
const mongoose = require('./server/node_modules/mongoose');

const Track = mongoose.model('Track', new mongoose.Schema({}, { strict: false }));
const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
const Album = mongoose.model('Album', new mongoose.Schema({}, { strict: false }));
const SongLyrics = mongoose.model('SongLyrics', new mongoose.Schema({}, { strict: false }));

function normalizeArtist(artist) {
  if (!artist) return '';
  let a = artist.trim().toLowerCase();
  a = a.replace(/\s*-\s*topic$/i, '').trim();
  a = a.replace(/official$/i, '').trim();
  if (a === 'release') return '';
  const parts = a.split(/,|\s+feat\.?\s+|\s+ft\.?\s+|\s+&\s+|\s+x\s+|\s+مع\s+|[|│]\s*|\s+[iIl]\s+(?=[\u0600-\u06FF])/i);
  let primary = (parts[0] || '').trim();
  if (primary.includes(' - ')) {
    primary = primary.split(' - ')[0].trim();
  }
  primary = primary.replace(/\s+[\u0600-\u06FF].*$/g, '').trim();
  return primary.replace(/\s+/g, ' ');
}

function normalizeTitle(title) {
  if (!title) return '';
  let t = title.trim().toLowerCase();
  t = t.replace(/\s*[\(\[](official\s*(audio|video|music\s*video|visualizer)?|audio|video)[\)\]]/gi, '').trim();
  t = t.replace(/\s+/g, ' ');
  return t;
}

function areArtistsSame(artA, artB) {
  if (!artA || !artB) return false;
  const aRaw = artA.trim().toLowerCase();
  const bRaw = artB.trim().toLowerCase();
  if (aRaw === bRaw) return true;
  if (aRaw.includes('release - topic') || bRaw.includes('release - topic')) return true;
  if (aRaw.includes(bRaw) || bRaw.includes(aRaw)) return true;
  const normA = normalizeArtist(artA);
  const normB = normalizeArtist(artB);
  if (normA && normB && (normA === normB || normA.includes(normB) || normB.includes(normA))) return true;
  return false;
}

function scoreTrack(t) {
  let score = 0;
  if (t.album && t.album.trim() && t.album.trim().toLowerCase() !== 'single') {
    score += 100;
  }
  if (t.audioUrl && (t.audioUrl.includes('youtube.com') || t.audioUrl.includes('youtu.be') || t.audioUrl.startsWith('http'))) {
    score += 50;
  }
  if (t.cover && !t.cover.includes('unsplash')) {
    score += 20;
  }
  if (Array.isArray(t.lyrics) && t.lyrics.length > 0) {
    score += 30;
  }
  score += (Number(t.plays) || 0) * 2;
  return score;
}

async function deduplicateAll() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log('=== STARTING TRACK DEDUPLICATION ===');

  const allTracks = await Track.find({}).lean();
  console.log(`Initial total tracks in DB: ${allTracks.length}`);

  const titleGroups = new Map();
  for (const t of allTracks) {
    const nt = normalizeTitle(t.title);
    if (!titleGroups.has(nt)) titleGroups.set(nt, []);
    titleGroups.get(nt).push(t);
  }

  let totalRemoved = 0;
  const idMap = new Map(); // redundantId -> canonicalId
  const tracksToDelete = [];
  let dupeClustersCount = 0;

  for (const [title, list] of titleGroups.entries()) {
    if (list.length <= 1) continue;

    // Cluster tracks with matching artist
    const clusters = [];
    for (const track of list) {
      let added = false;
      for (const cluster of clusters) {
        if (cluster.some(member => areArtistsSame(member.artist, track.artist))) {
          cluster.push(track);
          added = true;
          break;
        }
      }
      if (!added) {
        clusters.push([track]);
      }
    }

    for (const cluster of clusters) {
      if (cluster.length <= 1) continue;
      dupeClustersCount++;

      // Sort cluster by score descending
      cluster.sort((a, b) => scoreTrack(b) - scoreTrack(a));

      const canonical = cluster[0];
      const canonicalId = String(canonical._id);

      let totalPlays = Number(canonical.plays) || 0;
      let bestLyrics = (Array.isArray(canonical.lyrics) && canonical.lyrics.length > 0) ? canonical.lyrics : null;
      let bestAlbum = canonical.album || '';
      let bestCover = canonical.cover || canonical.coverUrl || '';
      let bestArtist = canonical.artist || '';

      for (let i = 1; i < cluster.length; i++) {
        const red = cluster[i];
        const redId = String(red._id);
        idMap.set(redId, canonicalId);
        tracksToDelete.push(red._id);
        totalRemoved++;

        console.log(`[Dedupe] Keeping "${canonical.title}" [${canonical.artist}] (${canonicalId}) -> Deleting redundant [${red.artist}] (${redId})`);

        totalPlays += (Number(red.plays) || 0);
        if (!bestLyrics && Array.isArray(red.lyrics) && red.lyrics.length > 0) {
          bestLyrics = red.lyrics;
        }
        if ((!bestAlbum || bestAlbum.toLowerCase() === 'single') && red.album && red.album.toLowerCase() !== 'single') {
          bestAlbum = red.album;
        }
        if ((!bestCover || bestCover.includes('unsplash')) && red.cover && !red.cover.includes('unsplash')) {
          bestCover = red.cover;
        }
        if (red.artist && red.artist.length > bestArtist.length && !red.artist.toLowerCase().includes('topic')) {
          bestArtist = red.artist;
        }
      }

      // Update canonical track with merged attributes
      const updatePayload = { plays: totalPlays };
      if (bestLyrics && (!canonical.lyrics || canonical.lyrics.length === 0)) {
        updatePayload.lyrics = bestLyrics;
      }
      if (bestAlbum && (!canonical.album || canonical.album.toLowerCase() === 'single')) {
        updatePayload.album = bestAlbum;
      }
      if (bestCover && (!canonical.cover || canonical.cover.includes('unsplash'))) {
        updatePayload.cover = bestCover;
      }
      if (bestArtist && bestArtist !== canonical.artist) {
        updatePayload.artist = bestArtist;
      }

      await Track.updateOne({ _id: canonical._id }, { $set: updatePayload });
    }
  }

  console.log(`Found ${idMap.size} redundant tracks across ${dupeClustersCount} clusters.`);

  if (tracksToDelete.length > 0) {
    console.log(`Deleting ${tracksToDelete.length} redundant tracks from MongoDB...`);
    const delRes = await Track.deleteMany({ _id: { $in: tracksToDelete } });
    console.log(`Deleted ${delRes.deletedCount} tracks.`);
  }

  // Remap references in Users: likedTrackIds, playlists
  console.log('Remapping user liked tracks and playlists...');
  const users = await User.find({}).lean();
  let usersUpdated = 0;

  for (const u of users) {
    let modified = false;

    let newLiked = (u.likedTrackIds || []).map(id => idMap.get(String(id)) || String(id));
    const likedSet = new Set(newLiked);
    if (likedSet.size !== (u.likedTrackIds || []).length || newLiked.some((id, idx) => id !== u.likedTrackIds[idx])) {
      newLiked = Array.from(likedSet);
      modified = true;
    }

    const newPlaylists = (u.playlists || []).map(pl => {
      let tIds = (pl.trackIds || []).map(id => idMap.get(String(id)) || String(id));
      const tSet = new Set(tIds);
      if (tSet.size !== (pl.trackIds || []).length || tIds.some((id, idx) => id !== pl.trackIds[idx])) {
        modified = true;
        return { ...pl, trackIds: Array.from(tSet) };
      }
      return pl;
    });

    if (modified) {
      await User.updateOne(
        { _id: u._id },
        { $set: { likedTrackIds: newLiked, playlists: newPlaylists } }
      );
      usersUpdated++;
    }
  }
  console.log(`Updated references in ${usersUpdated} users.`);

  // Remap references in Albums
  console.log('Remapping album track references...');
  const albums = await Album.find({}).lean();
  let albumsUpdated = 0;
  for (const alb of albums) {
    let modified = false;
    let tIds = (alb.trackIds || []).map(id => idMap.get(String(id)) || String(id));
    const tSet = new Set(tIds);
    if (tSet.size !== (alb.trackIds || []).length || tIds.some((id, idx) => id !== alb.trackIds[idx])) {
      modified = true;
      tIds = Array.from(tSet);
    }
    if (modified) {
      await Album.updateOne({ _id: alb._id }, { $set: { trackIds: tIds } });
      albumsUpdated++;
    }
  }
  console.log(`Updated references in ${albumsUpdated} albums.`);

  const remainingCount = await Track.countDocuments({});
  console.log(`\n=== DEDUPLICATION COMPLETED ===`);
  console.log(`Purged: ${totalRemoved} tracks | Remaining in DB: ${remainingCount}`);

  process.exit(0);
}

deduplicateAll().catch(err => {
  console.error('Deduplication failed:', err);
  process.exit(1);
});
