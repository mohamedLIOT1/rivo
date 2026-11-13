/**
 * Ingestion Script for Partition A Artists (MongoDB Atlas)
 * YouTube Music Official Discography Processing (< 400 lines)
 */

const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch {}

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const { Album, Track, Artist } = require('../server/models');
const { getCanonicalArtistName } = require('../server/utils/artistAlbumUtils');
const { scrapeYtMusicAlbum, getArtistOfficialDiscography } = require('../server/utils/ytMusicAlbumScraper');

const PARTITION_A_ROSTER = [
  { name: 'Cairokee', browseId: 'UCfh4CPgJ9vgO60P6GKDDBzw' },
  { name: 'Amir Eid', browseId: 'UCK36AgGlhJCAp9YvWG0Dt3Q' },
  { name: 'Wegz', browseId: 'UCNshhQRW5gF0Hoo7zvxqhEg' },
  { name: 'Marwan Pablo', browseId: 'UC9esEWExqSEo8CeQdvrQDCw' },
  { name: 'Marwan Moussa', browseId: 'UC3foXd7OMbut1i4zKDmLS5Q' },
  { name: 'Afroto', browseId: 'UC1P-58PAX5clcuCCiwsGSmg' },
  { name: 'Batistuta', browseId: 'UCtumCmghGrpKgd7wMaqLZsw' },
  { name: 'Abyusif', browseId: 'UCbgUx6M1oxh36CIOQGCsfhg' },
  { name: 'Lege-Cy', browseId: 'UCGTuxZOzwCa3Tbqqx0Qn8_w' },
  { name: 'El Joker', browseId: 'UCZlLDtmfYJW9Zw260CnpiSg' },
  { name: 'Arsenik', browseId: 'UCsHhfVjgLDch5-W6mbyihNQ' },
  { name: 'Mousv', browseId: 'UCA_xXKaKucH-FZzDLZSZF5w' },
  { name: 'Karim Osama', browseId: 'UCcsYMuELQo7Qe4mxCUb7gWA' },
  { name: 'Ziad Zaza', browseId: 'UCNOa21LJG0-mc9tARtrSS8g' },
  { name: 'FL EX', browseId: 'UCWHCnglCaAmtJsAjm6zoRxQ' },
  { name: 'Wingii', browseId: 'UCMnqX0PasDOYOv018jI-5FA' },
  { name: 'Husayn', browseId: 'UCWN7MXPtuDZD0vgI9WiROFg' },
  { name: 'DizzyTooSkinny', browseId: 'UCsiLoFlU-gRPiRD-9E35L6w' },
  { name: 'Santa', browseId: 'UCpZbh83WOpJbYhm39w-VlHw' },
  { name: 'Abo El Anwar', browseId: 'UCjlFBiSB9doKvIXUcttj0ZA' }
];

const QURAN_KEYWORDS = ['سورة', 'تلاوة', 'قران', 'قرآن', 'مصحف', 'تجويد', 'quran', 'surah', 'alafasy', 'الشيخ'];
const isQuran = (t) => t && QURAN_KEYWORDS.some(k => t.toLowerCase().includes(k));
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeName = (s) => !s ? '' : s.toLowerCase().replace(/^album\s*[-–—:]\s*/i, '').replace(/\s*[\(\[\{].*?[\)\]\}]\s*/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, '').trim().replace(/\s+/g, ' ');

async function findExistingAlbum(artistName, albumTitle) {
  const normTitle = normalizeName(albumTitle);
  const candidateAlbums = await Album.find({ artist: { $regex: new RegExp(`^${escapeRegex(artistName)}$`, 'i') } });
  const matches = candidateAlbums.filter(alb => normalizeName(alb.name) === normTitle);
  if (matches.length > 0) {
    matches.sort((a, b) => ((b.tracks?.length || 0) + (b.trackIds?.length || 0)) - ((a.tracks?.length || 0) + (a.trackIds?.length || 0)));
    for (let i = 1; i < matches.length; i++) await Album.deleteOne({ _id: matches[i]._id });
    return matches[0];
  }
  const allMatches = await Album.find({ name: { $regex: new RegExp(escapeRegex(albumTitle), 'i') } });
  const fallback = allMatches.filter(alb => normalizeName(alb.name) === normTitle);
  if (fallback.length > 0) {
    fallback.sort((a, b) => ((b.tracks?.length || 0) + (b.trackIds?.length || 0)) - ((a.tracks?.length || 0) + (a.trackIds?.length || 0)));
    return fallback[0];
  }
  return null;
}

async function ingestSingle(singleData, canonicalArtist) {
  if (isQuran(singleData.title)) return null;
  let trackDoc = await Track.findOne({
    $or: [{ youtubeId: singleData.videoId }, { audioUrl: `https://www.youtube.com/watch?v=${singleData.videoId}` }, { title: singleData.title, artist: canonicalArtist }]
  });
  if (!trackDoc) {
    trackDoc = await Track.create({
      title: singleData.title, artist: canonicalArtist, album: 'Single', cover: singleData.cover,
      audioUrl: `https://www.youtube.com/watch?v=${singleData.videoId}`, youtubeId: singleData.videoId,
      duration: singleData.duration || 200, genre: 'Arabic', source: 'YouTube Music',
      contentType: 'music', isQuran: false, releaseType: 'single'
    });
  } else {
    trackDoc.album = 'Single';
    trackDoc.releaseType = 'single';
    if (!trackDoc.cover || trackDoc.cover.includes('hqdefault')) trackDoc.cover = singleData.cover || trackDoc.cover;
    await trackDoc.save();
  }
  return trackDoc;
}

async function ingestAlbumOrEP(scrapedAlbum, canonicalArtist, stats) {
  const albumTitle = scrapedAlbum.title;
  if (isQuran(albumTitle)) return null;

  if (scrapedAlbum.tracks.length <= 1 || scrapedAlbum.releaseType === 'single') {
    const singleTrack = scrapedAlbum.tracks[0] || { title: albumTitle, videoId: scrapedAlbum.browseId, duration: 200, cover: scrapedAlbum.cover };
    await ingestSingle(singleTrack, canonicalArtist);
    stats.singlesProcessed++;
    return null;
  }

  let albumDoc = await findExistingAlbum(canonicalArtist, albumTitle);
  let isNew = false;
  let tracksAddedToAlbum = 0;

  if (!albumDoc) {
    isNew = true;
    const albumId = `album-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    albumDoc = new Album({
      id: albumId, name: albumTitle, artist: canonicalArtist, cover: scrapedAlbum.cover,
      linkUrl: `https://music.youtube.com/playlist?list=${scrapedAlbum.browseId}`,
      trackIds: [], releaseDate: scrapedAlbum.releaseDate || scrapedAlbum.year,
      genre: 'Arabic', releaseType: scrapedAlbum.releaseType || 'album',
      trackCount: 0, tracks: [], isAlbum: true, isSystem: true, isPublic: true, isQuran: false, source: 'ytmusic_official'
    });
  } else {
    if (/^Album\s*[-–—:]\s*/i.test(albumDoc.name)) albumDoc.name = albumTitle;
    if (albumDoc.artist !== canonicalArtist) albumDoc.artist = canonicalArtist;
    if (scrapedAlbum.cover && (!albumDoc.cover || albumDoc.cover.includes('unsplash') || albumDoc.cover.includes('hqdefault'))) albumDoc.cover = scrapedAlbum.cover;
    if (scrapedAlbum.releaseType) albumDoc.releaseType = scrapedAlbum.releaseType;
  }

  const existingTrackIds = new Set((albumDoc.trackIds || []).map(String));
  const existingTracksMap = new Map();
  for (const t of (albumDoc.tracks || [])) {
    const norm = normalizeName(t.title);
    if (norm) existingTracksMap.set(norm, t);
    const m = t.streamUrl?.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (m) existingTracksMap.set(m[1], t);
  }

  for (const track of scrapedAlbum.tracks) {
    if (isQuran(track.title)) continue;
    const normTrackTitle = normalizeName(track.title);

    let trackDoc = await Track.findOne({
      $or: [{ youtubeId: track.videoId }, { audioUrl: track.audioUrl }, { title: track.title, artist: canonicalArtist }]
    });

    if (!trackDoc) {
      trackDoc = await Track.create({
        title: track.title, artist: track.artist || canonicalArtist, album: albumDoc.name,
        cover: track.cover || albumDoc.cover, audioUrl: track.audioUrl, youtubeId: track.videoId,
        duration: track.duration, genre: albumDoc.genre || 'Arabic', source: 'YouTube Music',
        contentType: 'music', isQuran: false, trackNumber: track.trackNumber, releaseType: albumDoc.releaseType
      });
      tracksAddedToAlbum++;
      stats.totalTracksAdded++;
    } else {
      let changed = false;
      if (trackDoc.album !== albumDoc.name) { trackDoc.album = albumDoc.name; changed = true; }
      if (track.trackNumber && trackDoc.trackNumber !== track.trackNumber) { trackDoc.trackNumber = track.trackNumber; changed = true; }
      if (track.duration && !trackDoc.duration) { trackDoc.duration = track.duration; changed = true; }
      if (track.cover && (!trackDoc.cover || trackDoc.cover.includes('hqdefault'))) { trackDoc.cover = track.cover; changed = true; }
      if (changed) await trackDoc.save();
    }

    const trackIdStr = String(trackDoc._id);
    if (!existingTrackIds.has(trackIdStr)) {
      albumDoc.trackIds.push(trackIdStr);
      existingTrackIds.add(trackIdStr);
    }

    const existingSnap = existingTracksMap.get(normTrackTitle) || existingTracksMap.get(track.videoId);
    if (!existingSnap) {
      albumDoc.tracks.push({
        id: trackIdStr, title: track.title, artist: track.artist || canonicalArtist,
        album: albumDoc.name, cover: track.cover || albumDoc.cover, duration: track.duration,
        trackNumber: track.trackNumber, streamUrl: track.audioUrl
      });
      existingTracksMap.set(normTrackTitle, albumDoc.tracks[albumDoc.tracks.length - 1]);
      existingTracksMap.set(track.videoId, albumDoc.tracks[albumDoc.tracks.length - 1]);
      if (!isNew) { tracksAddedToAlbum++; stats.totalTracksAdded++; }
    } else {
      existingSnap.id = trackIdStr;
      existingSnap.trackNumber = track.trackNumber;
      if (track.duration) existingSnap.duration = track.duration;
      if (track.audioUrl) existingSnap.streamUrl = track.audioUrl;
      if (track.cover && (!existingSnap.cover || existingSnap.cover.includes('hqdefault'))) existingSnap.cover = track.cover;
    }
  }

  albumDoc.tracks.sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0));
  albumDoc.trackIds = albumDoc.tracks.map(t => t.id).filter(Boolean);
  albumDoc.trackCount = albumDoc.tracks.length;
  await albumDoc.save();

  if (isNew) {
    stats.newAlbumsAdded.push({ artist: canonicalArtist, title: albumDoc.name, tracksCount: albumDoc.trackCount });
    console.log(`✨ [New Album] "${albumDoc.name}" by ${canonicalArtist} (${albumDoc.trackCount} tracks)`);
  } else {
    stats.albumsUpdated.push({ artist: canonicalArtist, title: albumDoc.name, tracksTotal: albumDoc.trackCount, missingTracksAdded: tracksAddedToAlbum });
    console.log(`🔄 [Updated Album] "${albumDoc.name}" by ${canonicalArtist} (Total: ${albumDoc.trackCount}, Added: ${tracksAddedToAlbum})`);
  }
  return albumDoc;
}

async function cleanRogueSingleAlbums(canonicalArtist) {
  const rogueAlbums = await Album.find({
    artist: canonicalArtist,
    $or: [{ releaseType: 'single' }, { trackCount: { $lte: 1 } }, { tracks: { $size: 1 } }]
  });
  for (const r of rogueAlbums) {
    await Track.updateMany(
      { $or: [{ album: r.name }, { _id: { $in: r.trackIds } }] },
      { $set: { album: 'Single', releaseType: 'single' } }
    );
    await Album.deleteOne({ _id: r._id });
  }
}

async function runPartitionA() {
  const startTime = Date.now();
  console.log('🚀 Starting Catalog Ingestion for Partition A (20 Artists)...');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  console.log('✅ Connected to MongoDB Atlas.');

  const stats = { newAlbumsAdded: [], albumsUpdated: [], totalTracksAdded: 0, singlesProcessed: 0 };

  for (const item of PARTITION_A_ROSTER) {
    const canonical = getCanonicalArtistName(item.name);
    console.log(`\n======================================================`);
    console.log(`🎤 Processing: "${canonical}" (Browse ID: ${item.browseId})`);
    console.log(`======================================================`);

    let artistDoc = await Artist.findOne({ name: canonical });
    if (!artistDoc) {
      artistDoc = await Artist.create({
        id: `artist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: canonical, isVerified: true
      });
    }

    try {
      const disco = await getArtistOfficialDiscography(item.browseId);
      console.log(`📋 Found: ${disco.albums.length} Albums, ${disco.eps.length} EPs, ${disco.singles.length} Singles.`);

      const collections = [
        ...disco.albums.map(a => ({ ...a, releaseType: 'album' })),
        ...disco.eps.map(e => ({ ...e, releaseType: 'ep' }))
      ];

      for (const col of collections) {
        try {
          console.log(`⏳ Scraping ${col.releaseType.toUpperCase()}: "${col.title}" (${col.year || 'N/A'})...`);
          const scraped = await scrapeYtMusicAlbum(col.browseId);
          await ingestAlbumOrEP(scraped, canonical, stats);
        } catch (colErr) {
          console.error(`❌ Error scraping "${col.title}":`, colErr.message);
        }
      }

      for (const single of disco.singles) {
        try {
          const existing = await Track.findOne({ artist: canonical, title: { $regex: new RegExp(`^${escapeRegex(single.title)}$`, 'i') } });
          if (existing) {
            if (existing.album !== 'Single') {
              existing.album = 'Single';
              existing.releaseType = 'single';
              await existing.save();
            }
            stats.singlesProcessed++;
          } else {
            const singleData = await scrapeYtMusicAlbum(single.browseId);
            const track = singleData.tracks[0];
            if (track) {
              await ingestSingle({
                title: track.title, videoId: track.videoId, duration: track.duration, cover: singleData.cover || track.cover
              }, canonical);
              stats.singlesProcessed++;
              stats.totalTracksAdded++;
            }
          }
        } catch {}
      }

      await cleanRogueSingleAlbums(canonical);
    } catch (artistErr) {
      console.error(`💥 Failed discography for "${canonical}":`, artistErr.message);
    }
  }

  const durationSec = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n======================================================`);
  console.log(`🎉 Partition A Ingestion Complete in ${durationSec}s!`);
  console.log(`- New Albums/EPs Added: ${stats.newAlbumsAdded.length}`);
  console.log(`- Albums/EPs Updated: ${stats.albumsUpdated.length}`);
  console.log(`- Total Tracks Added: ${stats.totalTracksAdded}`);
  console.log(`- Singles Processed: ${stats.singlesProcessed}`);
  console.log(`======================================================\n`);

  await mongoose.disconnect();
  console.log('🔌 Disconnected cleanly from MongoDB Atlas.');
  return stats;
}

if (require.main === module) {
  runPartitionA().then(() => process.exit(0)).catch(err => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });
}

module.exports = { runPartitionA };
