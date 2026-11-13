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
const { classifyGenre, isQuranContent } = require('../server/utils/genreClassifier');

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

async function findExistingAlbum(canonicalArtist, albumTitle, browseId = null) {
  const normTitle = normalizeName(albumTitle);
  const escapedArtist = escapeRegex(canonicalArtist);

  if (browseId) {
    const byUrl = await Album.findOne({
      artist: { $regex: new RegExp(`^${escapedArtist}$`, 'i') },
      linkUrl: { $regex: new RegExp(escapeRegex(browseId), 'i') }
    });
    if (byUrl) return byUrl;
  }

  const candidateAlbums = await Album.find({
    artist: { $regex: new RegExp(`^${escapedArtist}$`, 'i') }
  });

  for (const alb of candidateAlbums) {
    if (normalizeName(alb.name) === normTitle) return alb;
  }

  // Cross-artist fallback
  const allMatches = await Album.find({
    name: { $regex: new RegExp(`^${escapeRegex(albumTitle)}$`, 'i') }
  });
  for (const alb of allMatches) {
    if (normalizeName(alb.name) === normTitle) return alb;
  }

  return null;
}

async function ingestSingle(singleData, canonicalArtist) {
  if (isQuranContent(singleData.title, canonicalArtist, 'Single')) {
    return null;
  }

  const g = classifyGenre({ artist: canonicalArtist, title: singleData.title }).genre || 'Pop';
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
      genre: g,
      source: 'YouTube Music',
      contentType: 'music',
      isQuran: false,
      isPodcast: false,
      isAudiobook: false,
      releaseType: 'single'
    });
    return { trackDoc, isNew: true };
  } else {
    if (!trackDoc.album) {
      trackDoc.album = 'Single';
      trackDoc.releaseType = 'single';
      await trackDoc.save();
    }
    return { trackDoc, isNew: false };
  }
}

async function ingestAlbum(scrapedAlbum, targetArtist = null, report = null) {
  const canonicalArtist = getCanonicalArtistName(targetArtist || scrapedAlbum.artist);
  const albumTitle = scrapedAlbum.title;

  if (isQuranContent(albumTitle, canonicalArtist, albumTitle)) {
    console.log(`⛔ [Quran Skipped] "${albumTitle}" is Quran content. Strictly skipping.`);
    return null;
  }

  if (scrapedAlbum.tracks.length <= 1 || scrapedAlbum.releaseType === 'single') {
    if (scrapedAlbum.tracks.length === 1) {
      const st = scrapedAlbum.tracks[0];
      const res = await ingestSingle({
        title: st.title,
        videoId: st.videoId,
        duration: st.duration,
        cover: scrapedAlbum.cover || st.cover
      }, canonicalArtist);
      if (res && res.isNew && report) report.totalTracksAdded++;
    }
    return null;
  }

  let albumDoc = await findExistingAlbum(canonicalArtist, albumTitle, scrapedAlbum.browseId);
  let isNew = false;
  const genre = classifyGenre({ artist: canonicalArtist, title: albumTitle }).genre || 'Pop';

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
      genre,
      releaseType: scrapedAlbum.releaseType === 'ep' ? 'ep' : 'album',
      trackCount: 0,
      tracks: [],
      isAlbum: true,
      isSystem: true,
      isPublic: true,
      isQuran: false,
      source: 'ytmusic_official'
    });
  } else {
    if (scrapedAlbum.cover && (!albumDoc.cover || albumDoc.cover.includes('images.unsplash.com') || albumDoc.cover.includes('hqdefault.jpg'))) {
      albumDoc.cover = scrapedAlbum.cover;
    }
    if (scrapedAlbum.releaseType === 'ep' && albumDoc.releaseType !== 'ep') {
      albumDoc.releaseType = 'ep';
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
    if (t.id) existingTrackIds.add(String(t.id));
    existingTitles.add(normalizeName(t.title));
  }

  let addedInAlbum = 0;
  for (const track of scrapedAlbum.tracks) {
    const normTrackTitle = normalizeName(track.title);
    if (existingYtIds.has(track.videoId) || existingTitles.has(normTrackTitle)) {
      // Enrich existing track snapshot if trackNumber was missing
      const existingSnap = existingTracks.find(t => 
        (t.streamUrl && t.streamUrl.includes(track.videoId)) || normalizeName(t.title) === normTrackTitle
      );
      if (existingSnap && (!existingSnap.trackNumber || !existingSnap.duration)) {
        existingSnap.trackNumber = track.trackNumber;
        existingSnap.duration = existingSnap.duration || track.duration;
      }
      continue;
    }

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
        genre: albumDoc.genre || genre,
        source: 'YouTube Music',
        contentType: 'music',
        isQuran: false,
        isPodcast: false,
        isAudiobook: false,
        trackNumber: track.trackNumber,
        releaseType: albumDoc.releaseType
      });
      if (report) report.totalTracksAdded++;
    } else {
      let changed = false;
      if (trackDoc.album !== albumDoc.name) {
        trackDoc.album = albumDoc.name;
        changed = true;
      }
      if (!trackDoc.trackNumber && track.trackNumber) {
        trackDoc.trackNumber = track.trackNumber;
        changed = true;
      }
      if (changed) await trackDoc.save();
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
    addedInAlbum++;
  }

  albumDoc.tracks.sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0));
  albumDoc.trackCount = albumDoc.tracks.length;

  if (albumDoc.tracks.length > 1) {
    await albumDoc.save();
    if (isNew) {
      console.log(`✨ [New Album] Added "${albumDoc.name}" (${albumDoc.trackCount} tracks, ${albumDoc.releaseType}) for ${canonicalArtist}`);
      if (report) report.newAlbumsAdded.push({ artist: canonicalArtist, album: albumDoc.name, trackCount: albumDoc.trackCount, releaseType: albumDoc.releaseType });
    } else if (addedInAlbum > 0) {
      console.log(`🔄 [Updated Album] Completed "${albumDoc.name}" (${albumDoc.trackCount} total, added ${addedInAlbum} tracks) for ${canonicalArtist}`);
      if (report) report.albumsUpdated.push({ artist: canonicalArtist, album: albumDoc.name, addedTracks: addedInAlbum, totalTracks: albumDoc.trackCount });
    }
  }

  return albumDoc;
}

async function processArtist(artistName, report, options = {}) {
  const canonicalArtist = getCanonicalArtistName(artistName);
  console.log(`\n======================================================`);
  console.log(`🎵 Processing Partition B Artist: "${canonicalArtist}" (input: "${artistName}")`);
  console.log(`======================================================`);

  let artistDoc = await Artist.findOne({ name: canonicalArtist });
  if (!artistDoc) {
    artistDoc = await Artist.create({
      id: `artist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: canonicalArtist,
      isVerified: true
    });
  }

  let disco;
  try {
    disco = await getArtistOfficialDiscography(canonicalArtist);
  } catch (err) {
    console.error(`❌ Could not fetch discography for "${canonicalArtist}":`, err.message);
    return;
  }

  console.log(`📋 Found on YTM: ${disco.albums.length} Albums, ${disco.eps.length} EPs, ${disco.singles.length} Singles.`);

  const collections = [
    ...disco.albums.map(a => ({ ...a, releaseType: 'album' })),
    ...disco.eps.map(e => ({ ...e, releaseType: 'ep' }))
  ];

  for (const item of collections) {
    try {
      // Small throttle to be courteous to YTM
      await new Promise(r => setTimeout(r, 120));
      const scraped = await scrapeYtMusicAlbum(item.browseId);
      await ingestAlbum(scraped, canonicalArtist, report);
    } catch (err) {
      console.warn(`⚠️ Error scraping album "${item.title}":`, err.message);
    }
  }

  // Handle singles: for artists with 0 albums (like Al Shami) or when includeSingles is requested
  if (collections.length === 0 || options.includeSingles || canonicalArtist === 'Al Shami') {
    console.log(`🎶 Ingesting official singles for "${canonicalArtist}" (${disco.singles.length} singles)...`);
    for (const s of disco.singles) {
      try {
        await new Promise(r => setTimeout(r, 100));
        const scrapedSingle = await scrapeYtMusicAlbum(s.browseId);
        await ingestAlbum(scrapedSingle, canonicalArtist, report);
      } catch (err) {
        console.warn(`⚠️ Error scraping single "${s.title}":`, err.message);
      }
    }
  }
}

async function main() {
  const startTime = Date.now();
  console.log('🚀 Partition B Ingestion starting...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB Atlas.');

  const report = {
    albumsUpdated: [],
    newAlbumsAdded: [],
    totalTracksAdded: 0
  };

  const partitionBRoster = [
    'Amr Diab',
    'Mohamed Mounir',
    'Sherine',
    'Mohamed Hamaki',
    'Angham',
    'Tamer Hosny',
    'Bahaa Sultan',
    'Al Shami',
    'Tul8te',
    'Tame Impala',
    'The Weeknd',
    'Travis Scott',
    'Drake',
    'Kendrick Lamar'
  ];

  const processedArtists = new Set();

  try {
    for (const artistName of partitionBRoster) {
      await processArtist(artistName, report);
      processedArtists.add(getCanonicalArtistName(artistName).toLowerCase());
    }

    // Inspect remaining distinct non-Quran artists in Atlas
    console.log('\n🔍 Checking for remaining non-Quran artists in Atlas...');
    const allDbArtists = await Artist.find({}, 'name').lean();
    const partitionAArtists = new Set([
      'fairuz', 'abdel halim hafez', 'umm kulthum', 'warda', 'asmahan',
      'farid al-atrash', 'farid al atrash', 'sayed darwish', 'sabah',
      'mohammed abdel wahab', 'abdel wahab', 'talal maddah', 'mohammed abdu',
      'majid al mohandis', 'kazem el saher', 'george wassouf', 'assala nasri',
      'asala', 'nancy ajram', 'elissa', 'ragheb alama', 'saber rebai'
    ]);

    const quranReciters = new Set([
      'مشاري راشد العفاسي', 'محمود خليل الحصري', 'محمد صديق المنشاوي',
      'ياسر الدوسري', 'عبدالباسط عبدالصمد', 'ماهر المعيقلي', 'سعد الغامدي',
      'أحمد العجمي', 'عبد الرحمن مسعد'
    ]);

    for (const aDoc of allDbArtists) {
      const rawName = aDoc.name;
      const lower = rawName.toLowerCase();
      if (processedArtists.has(lower) || partitionAArtists.has(lower) || quranReciters.has(rawName)) {
        continue;
      }
      if (isQuranContent('', rawName, '')) continue;

      // Check if artist has 0 or 1 album in Atlas
      const albCount = await Album.countDocuments({ artist: new RegExp(`^${escapeRegex(rawName)}$`, 'i') });
      if (albCount <= 1) {
        console.log(`\n✨ Ingesting remaining non-Quran artist from Atlas: "${rawName}" (current albums in DB: ${albCount})`);
        await processArtist(rawName, report);
        processedArtists.add(lower);
      }
    }

    const fs = require('fs');
    fs.writeFileSync(
      path.join(__dirname, 'partition_b_report.json'),
      JSON.stringify(report, null, 2),
      'utf-8'
    );
    console.log('📄 Detailed report saved to scripts/partition_b_report.json');

    console.log('\n======================================================');
    console.log('🎉 PARTITION B INGESTION COMPLETE');
    console.log(`⏱️ Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log(`💿 New Albums Added: ${report.newAlbumsAdded.length}`);
    console.log(`🔄 Existing Albums Updated: ${report.albumsUpdated.length}`);
    console.log(`🎵 Total New/Enriched Tracks: ${report.totalTracksAdded}`);
    console.log('======================================================');

  } catch (err) {
    console.error('💥 Partition B Ingestion Error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB Atlas.');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, processArtist, ingestAlbum, ingestSingle };
