const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { splitArtistNames, getCanonicalArtistName } = require('../utils/artistAlbumUtils');

const STATUS_FILE = process.platform === 'win32'
  ? path.resolve(__dirname, '../../data/discography_pipeline_status.json')
  : path.resolve('/home/ubuntu/rivo/data/discography_pipeline_status.json');

const TARGET_ARTISTS = [
  // Egyptian Rap & Trap
  'Lege-Cy', 'Marwan Pablo', 'Marwan Moussa', 'El Joker', 'Wegz', 'Abyusif', 'Afroto', 'Tul8te', 'Ziad Zaza',
  // Egyptian & Arab Pop Icons
  'Amr Diab', 'Tamer Hosny', 'Mohamed Hamaki', 'Cairokee', 'Tamer Ashour', 'Sherine', 'Ahmed Saad', 'Ramy Sabry', 'Mahmoud El Esseily',
  // Shaabi & Mahraganat
  'Essam Sasa', 'Muslim',
  // Arab Stars
  'Angham', 'Asala', 'Elissa', 'Nancy Ajram', 'Bahaa Sultan', 'Wael Jassar',
  // International Legends
  'The Weeknd', 'Drake', 'Travis Scott', 'Eminem', 'Taylor Swift', 'Billie Eilish', 'Dua Lipa', 'Coldplay'
];

function escapeRegex(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function checkUrl(url) {
  return new Promise((resolve) => {
    if (!url || typeof url !== 'string') return resolve(0);
    try {
      const u = new URL(url);
      const mod = u.protocol === 'https:' ? https : http;
      const req = mod.request(u, { method: 'HEAD', timeout: 5000 }, (res) => {
        resolve(res.statusCode);
      });
      req.on('error', () => resolve(0));
      req.on('timeout', () => { req.destroy(); resolve(408); });
      req.end();
    } catch (e) {
      resolve(0);
    }
  });
}

function fetchItunesAlbums(artist) {
  return new Promise((resolve) => {
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(artist)}&entity=album&country=EG&limit=30`;
      https.get(url, (res) => {
        let raw = '';
        res.on('data', d => raw += d);
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            resolve(data.results || []);
          } catch(e) { resolve([]); }
        });
      }).on('error', () => resolve([]));
    } catch(e) { resolve([]); }
  });
}

function fetchItunesAlbumTracks(collectionId) {
  return new Promise((resolve) => {
    if (!collectionId) return resolve([]);
    try {
      const url = `https://itunes.apple.com/lookup?id=${collectionId}&entity=song&country=EG`;
      https.get(url, (res) => {
        let raw = '';
        res.on('data', d => raw += d);
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            const songs = (data.results || []).filter(r => r.wrapperType === 'track').map(r => ({
              id: `itunes-${r.trackId || r.collectionId}-${r.trackNumber || 1}`,
              title: r.trackName,
              artist: r.artistName,
              duration: Math.round((r.trackTimeMillis || 180000) / 1000),
              trackNumber: r.trackNumber || 1,
              streamUrl: r.previewUrl || ''
            }));
            resolve(songs);
          } catch(e) { resolve([]); }
        });
      }).on('error', () => resolve([]));
    } catch(e) { resolve([]); }
  });
}

function updatePipelineStatus(status) {
  try {
    const dir = path.dirname(STATUS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), 'utf8');
  } catch(e) {}
}

async function getDynamicTargetArtists(TrackCollection) {
  const list = [...TARGET_ARTISTS];
  const seen = new Set(list.map(a => (getCanonicalArtistName(a) || a).toLowerCase().trim()));
  try {
    if (TrackCollection) {
      const distinctArtists = await TrackCollection.distinct('artist');
      for (const raw of distinctArtists) {
        if (!raw || typeof raw !== 'string') continue;
        const subArtists = splitArtistNames(raw);
        for (const sa of subArtists) {
          const canonical = getCanonicalArtistName(sa) || sa;
          if (!canonical || canonical.length < 2) continue;
          const l = canonical.toLowerCase().trim();
          if (!seen.has(l) && !l.includes('topic') && !l.includes('unknown')) {
            seen.add(l);
            list.push(canonical);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Pipeline] Auto-discovery notice:', err.message);
  }
  return list;
}

async function runPipeline() {
  const isDirect = require.main === module;
  if (isDirect) {
    const envPath = process.platform === 'win32'
      ? path.resolve(__dirname, '../../.env')
      : '/home/ubuntu/rivo/.env';
    require('dotenv').config({ path: envPath });
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB for 3-Worker Pipeline');
  }

  const Album = mongoose.connection.db.collection('albums');
  const Track = mongoose.connection.db.collection('tracks');
  const Artist = mongoose.connection.db.collection('artists');

  const allArtists = await getDynamicTargetArtists(Track);
  const processedArtists = [];
  const upcomingArtists = [...allArtists];
  let totalAlbumsCreated = 0;
  let totalTracksOrganized = 0;
  let totalCoversVerified = 0;

  for (let i = 0; i < allArtists.length; i++) {
    const artist = allArtists[i];
    upcomingArtists.shift();

    try {
      // WORKER 1: Scout
      updatePipelineStatus({
        running: true,
        currentWorker: 1,
        currentWorkerName: 'Worker 1: Artist & Discography Scout',
        currentArtist: artist,
        currentStage: `Scouting official discography and albums for ${artist}`,
        processedArtists,
        upcomingArtists,
        remainingCount: upcomingArtists.length,
        totalArtists: allArtists.length,
        stats: {
          albumsCreated: totalAlbumsCreated,
          tracksOrganized: totalTracksOrganized,
          coversVerified: totalCoversVerified
        },
        lastUpdated: Date.now()
      });

      console.log(`\n[Worker 1: Scout] Scouting albums for ${artist}...`);
      const rawAlbums = await fetchItunesAlbums(artist);
      console.log(`  Found ${rawAlbums.length} raw releases on Apple Music for ${artist}`);

      // Sort: Real Albums & EPs first, then Singles
      const sortedReleases = [...rawAlbums].sort((a, b) => {
        const aCount = Number(a.trackCount) || 1;
        const bCount = Number(b.trackCount) || 1;
        const aIsSingle = /\bsingle\b/i.test(a.collectionName || '') || aCount === 1;
        const bIsSingle = /\bsingle\b/i.test(b.collectionName || '') || bCount === 1;
        if (!aIsSingle && bIsSingle) return -1;
        if (aIsSingle && !bIsSingle) return 1;
        return bCount - aCount;
      });

      // WORKER 2: Enricher
      updatePipelineStatus({
        running: true,
        currentWorker: 2,
        currentWorkerName: 'Worker 2: Artwork & Track Enricher',
        currentArtist: artist,
        currentStage: `Validating high-res artwork and official tracklists for ${artist}`,
        processedArtists,
        upcomingArtists,
        remainingCount: upcomingArtists.length,
        totalArtists: allArtists.length,
        stats: {
          albumsCreated: totalAlbumsCreated,
          tracksOrganized: totalTracksOrganized,
          coversVerified: totalCoversVerified
        },
        lastUpdated: Date.now()
      });

      const enrichedAlbums = [];
      const seenAlbumKeys = new Set();

      for (const alb of sortedReleases.slice(0, 16)) {
        if (!alb.collectionName) continue;
        const rawCollection = String(alb.collectionName).trim();
        const rawTrackCount = Number(alb.trackCount) || 0;

        // Accurate release classification - NEVER allow singles as albums!
        if (/\b(?:-\s*)?single\b/i.test(rawCollection) || rawTrackCount <= 1) {
          continue;
        }

        let releaseType = 'album';
        if (/\b(?:-\s*)?ep\b/i.test(rawCollection) || (rawTrackCount >= 2 && rawTrackCount <= 6)) {
          releaseType = 'ep';
        } else {
          releaseType = 'album';
        }

        const cleanName = rawCollection
          .replace(/\s*-\s*(?:EP|Single)$/i, '')
          .replace(/\s*\((?:EP|Single)\)$/i, '')
          .trim();

        const dedupeKey = `${cleanName.toLowerCase()}_${releaseType}`;
        if (seenAlbumKeys.has(dedupeKey)) continue;
        seenAlbumKeys.add(dedupeKey);

        let cover = alb.artworkUrl100 ? alb.artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg') : '';
        const status = await checkUrl(cover);
        if (status === 200) {
          totalCoversVerified++;

          // For actual albums and EPs, lookup the official tracklist
          let albumTracks = [];
          if (alb.collectionId) {
            albumTracks = await fetchItunesAlbumTracks(alb.collectionId);
          }

          // If no tracklist could be verified and trackCount is 0, skip to avoid empty albums
          if (!albumTracks.length && rawTrackCount <= 1) {
            continue;
          }

          enrichedAlbums.push({
            name: cleanName,
            artist: alb.artistName || artist,
            cover,
            releaseDate: alb.releaseDate ? new Date(alb.releaseDate).getFullYear().toString() : '',
            genre: alb.primaryGenreName || 'Arabic',
            releaseType,
            trackCount: albumTracks.length || rawTrackCount,
            tracks: albumTracks
          });
        }
      }

      // WORKER 3: Synchronizer
      updatePipelineStatus({
        running: true,
        currentWorker: 3,
        currentWorkerName: 'Worker 3: Database & Site Synchronizer',
        currentArtist: artist,
        currentStage: `Syncing verified albums and organizing tracks into MongoDB for ${artist}`,
        processedArtists,
        upcomingArtists,
        remainingCount: upcomingArtists.length,
        totalArtists: allArtists.length,
        stats: {
          albumsCreated: totalAlbumsCreated,
          tracksOrganized: totalTracksOrganized,
          coversVerified: totalCoversVerified
        },
        lastUpdated: Date.now()
      });

      // Update Artist record (only for real individual artists, never collaboration strings)
      const primaryCover = enrichedAlbums[0]?.cover;
      if (primaryCover && splitArtistNames(artist).length === 1) {
        const slug = artist.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        const artistId = `artist-${slug}-${Date.now().toString(36)}`;
        await Artist.updateOne(
          { name: new RegExp(`^${escapeRegex(artist)}$`, 'i') },
          { 
            $set: { 
              name: artist, 
              avatar: primaryCover, 
              imageUrl: primaryCover, 
              cover: primaryCover, 
              isVerified: true 
            },
            $setOnInsert: {
              id: artistId
            }
          },
          { upsert: true }
        );
      }

      // Upsert Albums in Mongo with proper releaseType, tracks, and trackIds
      for (const ea of enrichedAlbums) {
        const existing = await Album.findOne({
          name: new RegExp(`^${escapeRegex(ea.name)}$`, 'i'),
          artist: new RegExp(`^${escapeRegex(artist)}$`, 'i')
        });

        // Find local tracks that match album name
        const localMatchingTracks = await Track.find({
          $or: [
            { artist: new RegExp(`^${escapeRegex(artist)}$`, 'i'), album: new RegExp(`^${escapeRegex(ea.name)}$`, 'i') },
            { album: new RegExp(`^${escapeRegex(ea.name)}$`, 'i') }
          ]
        }).toArray();
        const matchingIds = localMatchingTracks.map(t => String(t._id || t.id));

        const finalTrackCount = matchingIds.length > 0 ? matchingIds.length : (ea.tracks?.length || ea.trackCount || 0);
        // STRICT GATE: Never insert singles or albums with 0 or 1 track
        if (ea.releaseType === 'single' || finalTrackCount <= 1 || (!ea.tracks?.length && !matchingIds.length)) {
          if (existing) {
            await Album.deleteOne({ _id: existing._id });
          }
          continue;
        }

        const isAlbumReal = true;

        if (!existing) {
          const newId = `album-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
          await Album.insertOne({
            id: newId,
            name: ea.name,
            artist: artist,
            cover: ea.cover,
            releaseDate: ea.releaseDate,
            genre: ea.genre,
            releaseType: ea.releaseType,
            trackCount: finalTrackCount,
            tracks: ea.tracks || [],
            isAlbum: isAlbumReal,
            isSystem: true,
            isPublic: true,
            trackIds: matchingIds,
            source: 'auto_pipeline',
            createdAt: new Date(),
            updatedAt: new Date()
          });
          totalAlbumsCreated++;
        } else {
          const mergedTrackIds = Array.from(new Set([...(existing.trackIds || []), ...matchingIds]));
          await Album.updateOne(
            { _id: existing._id },
            { 
              $set: { 
                cover: ea.cover,
                releaseType: ea.releaseType,
                trackCount: Math.max(finalTrackCount, mergedTrackIds.length),
                isAlbum: isAlbumReal,
                ...(mergedTrackIds.length > 0 ? { trackIds: mergedTrackIds } : {}),
                ...(ea.tracks?.length ? { tracks: ea.tracks } : {}),
                updatedAt: new Date()
              } 
            }
          );
        }

        // Link local tracks that match album name and update their cover
        if (localMatchingTracks.length > 0) {
          const trackRes = await Track.updateMany(
            { 
              $or: [
                { artist: new RegExp(`^${escapeRegex(artist)}$`, 'i'), album: new RegExp(`^${escapeRegex(ea.name)}$`, 'i') },
                { album: new RegExp(`^${escapeRegex(ea.name)}$`, 'i') }
              ]
            },
            { $set: { cover: ea.cover } }
          );
          totalTracksOrganized += trackRes.modifiedCount;
        }
      }

      processedArtists.push(artist);
      console.log(`[Worker 3: Sync] Completed sync for ${artist}.`);
    } catch (err) {
      console.error(`Error processing artist ${artist}:`, err.message);
      processedArtists.push(artist);
    }
  }

  // Final Finished Status
  updatePipelineStatus({
    running: false,
    currentWorker: 0,
    currentWorkerName: 'Pipeline Complete',
    currentArtist: 'All Artists Completed',
    currentStage: 'Completed autonomous discography discovery and album organization',
    processedArtists,
    upcomingArtists: [],
    remainingCount: 0,
    totalArtists: allArtists.length,
    stats: {
      albumsCreated: totalAlbumsCreated,
      tracksOrganized: totalTracksOrganized,
      coversVerified: totalCoversVerified
    },
    lastUpdated: Date.now()
  });

  console.log('\n🎉 3-Worker Pipeline successfully finished all artists!');
  if (isDirect) {
    await mongoose.disconnect();
    process.exit(0);
  }
}

if (require.main === module) {
  runPipeline().catch(err => {
    console.error('Pipeline error:', err);
    process.exit(1);
  });
}

module.exports = { runPipeline, updatePipelineStatus };
