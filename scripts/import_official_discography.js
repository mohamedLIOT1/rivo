const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const { Album, Track, Artist } = require('../server/models');
const { getCanonicalArtistName } = require('../server/utils/artistAlbumUtils');
const {
  scrapeYtMusicAlbum,
  getArtistOfficialDiscography
} = require('../server/utils/ytMusicAlbumScraper');

function normalizeName(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/^album\s*[-–—:]\s*/i, '')
    .replace(/\s*[\(\[\{].*?[\)\]\}]\s*/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findExistingAlbum(artistName, albumTitle) {
  const normTitle = normalizeName(albumTitle);
  const escapedArtist = escapeRegex(artistName);

  const candidateAlbums = await Album.find({
    artist: { $regex: new RegExp(`^${escapedArtist}$`, 'i') }
  });

  for (const alb of candidateAlbums) {
    if (normalizeName(alb.name) === normTitle) {
      return alb;
    }
  }

  // Fallback: search across all albums if artist might be slightly varied
  const allMatches = await Album.find({
    name: { $regex: new RegExp(escapeRegex(albumTitle), 'i') }
  });
  for (const alb of allMatches) {
    if (normalizeName(alb.name) === normTitle) {
      return alb;
    }
  }

  return null;
}

async function ingestAlbum(scrapedAlbum, targetArtist = null, options = {}) {
  const canonicalArtist = getCanonicalArtistName(targetArtist || scrapedAlbum.artist);
  const albumTitle = scrapedAlbum.title;
  console.log(`\n💿 [Album Ingestion] Processing "${albumTitle}" by "${canonicalArtist}" (${scrapedAlbum.tracks.length} tracks, type: ${scrapedAlbum.releaseType})...`);

  // Standalone single protection: never create fake 1-track albums in Album collection
  if (scrapedAlbum.tracks.length === 1 || scrapedAlbum.releaseType === 'single') {
    console.log(`ℹ️ [Single Detected] "${albumTitle}" is a 1-track single. Ingesting as standalone single track.`);
    const singleTrack = scrapedAlbum.tracks[0];
    return await ingestSingle({
      title: singleTrack.title,
      videoId: singleTrack.videoId,
      duration: singleTrack.duration,
      cover: scrapedAlbum.cover || singleTrack.cover
    }, canonicalArtist);
  }

  let albumDoc = await findExistingAlbum(canonicalArtist, albumTitle);
  let isNew = false;

  if (!albumDoc) {
    isNew = true;
    const albumId = `album-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    albumDoc = new Album({
      id: albumId,
      name: albumTitle,
      artist: canonicalArtist,
      cover: scrapedAlbum.cover,
      linkUrl: `https://music.youtube.com/playlist?list=${scrapedAlbum.browseId}`,
      trackIds: [],
      releaseDate: scrapedAlbum.releaseDate || scrapedAlbum.year,
      genre: 'Arabic',
      releaseType: scrapedAlbum.releaseType || 'album',
      trackCount: 0,
      tracks: [],
      isAlbum: true,
      isSystem: true,
      isPublic: true,
      source: 'ytmusic_official'
    });
    console.log(`✨ [New Album] Created Album container for "${albumTitle}" (ID: ${albumId})`);
  } else {
    console.log(`🔍 [Existing Album] Found existing album "${albumDoc.name}" with ${albumDoc.tracks?.length || 0} tracks.`);
    if (scrapedAlbum.cover && (!albumDoc.cover || albumDoc.cover.includes('images.unsplash.com') || albumDoc.cover.includes('hqdefault.jpg'))) {
      albumDoc.cover = scrapedAlbum.cover;
    }
    if (scrapedAlbum.releaseType && albumDoc.releaseType !== scrapedAlbum.releaseType) {
      albumDoc.releaseType = scrapedAlbum.releaseType;
    }
  }

  const existingTrackIds = new Set((albumDoc.trackIds || []).map(String));
  const existingTracks = albumDoc.tracks || [];
  const existingYtIds = new Set();
  const existingTitles = new Set();

  for (const t of existingTracks) {
    if (t.streamUrl) {
      const m = t.streamUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      if (m) existingYtIds.add(m[1]);
    }
    existingTitles.add(normalizeName(t.title));
  }

  let addedCount = 0;
  for (const track of scrapedAlbum.tracks) {
    const normTrackTitle = normalizeName(track.title);
    if (existingYtIds.has(track.videoId) || existingTitles.has(normTrackTitle)) {
      continue;
    }

    // Check if Track document already exists in DB
    let trackDoc = await Track.findOne({
      $or: [
        { youtubeId: track.videoId },
        { audioUrl: track.audioUrl },
        { title: track.title, artist: canonicalArtist }
      ]
    });

    if (!trackDoc) {
      trackDoc = await Track.create({
        title: track.title,
        artist: track.artist || canonicalArtist,
        album: albumDoc.name,
        cover: track.cover || albumDoc.cover,
        audioUrl: track.audioUrl,
        youtubeId: track.videoId,
        duration: track.duration,
        genre: albumDoc.genre || 'Arabic',
        source: 'YouTube Music',
        contentType: 'music',
        isQuran: false,
        isPodcast: false,
        isAudiobook: false,
        trackNumber: track.trackNumber,
        releaseType: albumDoc.releaseType
      });
      console.log(`  ➕ [Track Created] Track ${track.trackNumber}: "${track.title}" (${track.duration}s, ID: ${track.videoId})`);
    } else {
      if (trackDoc.album !== albumDoc.name) {
        trackDoc.album = albumDoc.name;
        trackDoc.cover = trackDoc.cover || albumDoc.cover;
        await trackDoc.save();
      }
      console.log(`  🔗 [Track Linked] Track ${track.trackNumber}: "${track.title}" (existing ID: ${trackDoc._id})`);
    }

    const trackIdStr = String(trackDoc._id);
    if (!existingTrackIds.has(trackIdStr)) {
      albumDoc.trackIds.push(trackIdStr);
      existingTrackIds.add(trackIdStr);
    }

    albumDoc.tracks.push({
      id: trackIdStr,
      title: track.title,
      artist: track.artist || canonicalArtist,
      album: albumDoc.name,
      cover: track.cover || albumDoc.cover,
      duration: track.duration,
      trackNumber: track.trackNumber,
      streamUrl: track.audioUrl
    });

    existingYtIds.add(track.videoId);
    existingTitles.add(normTrackTitle);
    addedCount++;
  }

  // Sort tracks by trackNumber
  albumDoc.tracks.sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0));
  albumDoc.trackCount = albumDoc.tracks.length;

  await albumDoc.save();
  console.log(`✅ [Album Complete] "${albumDoc.name}" is 100% full with ${albumDoc.trackCount} tracks (added ${addedCount} new tracks).`);

  return albumDoc;
}

async function ingestSingle(singleData, canonicalArtist) {
  let trackDoc = await Track.findOne({
    $or: [
      { youtubeId: singleData.videoId },
      { audioUrl: `https://www.youtube.com/watch?v=${singleData.videoId}` },
      { title: singleData.title, artist: canonicalArtist }
    ]
  });

  if (!trackDoc) {
    trackDoc = await Track.create({
      title: singleData.title,
      artist: canonicalArtist,
      album: 'Single',
      cover: singleData.cover,
      audioUrl: `https://www.youtube.com/watch?v=${singleData.videoId}`,
      youtubeId: singleData.videoId,
      duration: singleData.duration || 200,
      genre: 'Arabic',
      source: 'YouTube Music',
      contentType: 'music',
      isQuran: false,
      isPodcast: false,
      isAudiobook: false,
      releaseType: 'single'
    });
    console.log(`  🎵 [Single Created] "${singleData.title}" by ${canonicalArtist} (YouTube ID: ${singleData.videoId})`);
  } else {
    console.log(`  ✓ [Single Exists] "${singleData.title}" by ${canonicalArtist} already exists.`);
  }

  return trackDoc;
}

async function ingestArtistDiscography(artistName, options = {}) {
  const canonicalArtist = getCanonicalArtistName(artistName);
  console.log(`\n======================================================`);
  console.log(`🚀 [Discography Ingestion] Artist: "${canonicalArtist}" (input: "${artistName}")`);
  console.log(`======================================================`);

  // Ensure Artist in DB
  let artistDoc = await Artist.findOne({ name: canonicalArtist });
  if (!artistDoc) {
    artistDoc = await Artist.create({
      id: `artist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: canonicalArtist,
      isVerified: true
    });
    console.log(`👤 [Artist Profile] Created Artist entry for "${canonicalArtist}".`);
  }

  const disco = await getArtistOfficialDiscography(canonicalArtist);
  console.log(`📋 Found on YouTube Music: ${disco.albums.length} Albums, ${disco.eps.length} EPs, ${disco.singles.length} Singles.`);

  const allCollections = [
    ...disco.albums.map(a => ({ ...a, releaseType: 'album' })),
    ...disco.eps.map(e => ({ ...e, releaseType: 'ep' }))
  ];

  const processedAlbums = [];

  for (const item of allCollections) {
    try {
      console.log(`\n⏳ Fetching full tracklist for ${item.releaseType.toUpperCase()}: "${item.title}" (${item.year || 'N/A'})...`);
      const fullAlbumData = await scrapeYtMusicAlbum(item.browseId);
      const saved = await ingestAlbum(fullAlbumData, canonicalArtist, options);
      processedAlbums.push(saved);
    } catch (err) {
      console.error(`❌ Failed to ingest album "${item.title}":`, err.message);
    }
  }

  // Standalone singles (optional or if requested)
  if (options.includeSingles && disco.singles.length > 0) {
    console.log(`\n🎶 Ingesting ${disco.singles.length} standalone singles...`);
    for (const s of disco.singles) {
      try {
        const fullSingleData = await scrapeYtMusicAlbum(s.browseId);
        await ingestAlbum(fullSingleData, canonicalArtist, options);
      } catch (err) {
        console.warn(`⚠️ Failed single "${s.title}":`, err.message);
      }
    }
  }

  console.log(`\n🏁 [Finished] Artist "${canonicalArtist}" discography ingestion completed. ${processedAlbums.length} albums/EPs processed.`);
  return { artist: canonicalArtist, albums: processedAlbums };
}

async function main() {
  const args = process.argv.slice(2);
  let targetUrl = null;
  let targetArtist = null;
  let includeSingles = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' || args[i] === '-u' || args[i] === '--album') {
      targetUrl = args[++i];
    } else if (args[i] === '--artist' || args[i] === '-a') {
      targetArtist = args[++i];
    } else if (args[i] === '--include-singles') {
      includeSingles = true;
    } else if (!targetArtist && !targetUrl && !args[i].startsWith('-')) {
      targetArtist = args[i];
    }
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB Atlas.');

  try {
    if (targetUrl) {
      console.log(`🎯 Ingesting specific YouTube Music album URL/ID: "${targetUrl}"`);
      const scraped = await scrapeYtMusicAlbum(targetUrl);
      await ingestAlbum(scraped, targetArtist);
    } else if (targetArtist) {
      await ingestArtistDiscography(targetArtist, { includeSingles });
    } else {
      console.log('ℹ️ No artist or URL specified. Querying top artists from MongoDB...');
      const artistsInDb = await Artist.find().sort({ createdAt: -1 }).limit(10);
      const defaultList = artistsInDb.length > 0
        ? artistsInDb.map(a => a.name)
        : ['Cairokee', 'El Joker', 'Shehab'];

      console.log(`Processing artists: ${defaultList.join(', ')}`);
      for (const aName of defaultList) {
        await ingestArtistDiscography(aName, { includeSingles });
      }
    }
  } catch (err) {
    console.error('💥 Fatal ingestion error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  ingestAlbum,
  ingestSingle,
  ingestArtistDiscography,
  findExistingAlbum
};
