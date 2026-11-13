/**
 * Database Deduplication & Bilingual Artist Profile Merger Script
 * Scans MongoDB collections (artists, tracks, albums) to unify duplicate profiles,
 * merge artist metadata, remove duplicate profiles, and canonicalize all artist fields.
 */

const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}

const path = require('path');
const mongoose = require('mongoose');

// Load environment configuration (.env)
require('dotenv').config();
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

const {
  getCanonicalArtistName,
  splitArtistNames,
  getDirectCanonicalArtist
} = require('../server/utils/artistAlbumUtils');

async function mergeBilingualArtists() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ [Fatal] MONGO_URI is missing from environment variables.');
    process.exit(1);
  }

  console.log('🔄 Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB successfully.\n');

  const db = mongoose.connection.db;
  const artistsCollection = db.collection('artists');
  const tracksCollection = db.collection('tracks');
  const albumsCollection = db.collection('albums');

  // =========================================================================
  // STEP 1: Scan and deduplicate Artist documents
  // =========================================================================
  console.log('===========================================================');
  console.log('--- Step 1: Scanning Artist Documents for Duplicates ---');
  console.log('===========================================================');

  const allArtists = await artistsCollection.find({}).toArray();
  console.log(`Found ${allArtists.length} total Artist documents in DB.`);

  // Group artist documents by their canonical name key
  const canonicalGroups = {};
  for (const doc of allArtists) {
    const rawName = String(doc.name || '').trim();
    if (!rawName) continue;

    const canonicalName = getCanonicalArtistName(rawName) || rawName;
    const groupKey = canonicalName.toLowerCase();

    if (!canonicalGroups[groupKey]) {
      canonicalGroups[groupKey] = {
        canonicalName,
        profiles: []
      };
    }
    canonicalGroups[groupKey].profiles.push(doc);
  }

  let totalMergedProfiles = 0;
  let totalDeletedDuplicates = 0;
  let totalRenamedToCanonical = 0;

  for (const [key, group] of Object.entries(canonicalGroups)) {
    const { canonicalName, profiles } = group;

    // Check if there are multiple profiles OR a single profile with non-canonical name
    if (profiles.length > 1) {
      console.log(`\n🔍 Found ${profiles.length} duplicate profiles for canonical artist: "${canonicalName}"`);
      profiles.forEach(p => {
        console.log(`   - [${p._id}] name: "${p.name}" | verified: ${p.isVerified || false} | hasBio: ${Boolean(p.bio)} | cover: ${Boolean(p.cover || p.avatar || p.imageUrl)}`);
      });

      // Sort to select best primary profile:
      // 1. isVerified = true
      // 2. Has non-empty bio
      // 3. Has cover / avatar
      // 4. Exact canonical name match
      // 5. Oldest creation date
      profiles.sort((a, b) => {
        if (Boolean(a.isVerified) !== Boolean(b.isVerified)) return a.isVerified ? -1 : 1;
        if (Boolean(a.bio && a.bio.trim()) !== Boolean(b.bio && b.bio.trim())) return (a.bio && a.bio.trim()) ? -1 : 1;
        const aHasImg = Boolean(a.cover || a.avatar || a.imageUrl);
        const bHasImg = Boolean(b.cover || b.avatar || b.imageUrl);
        if (aHasImg !== bHasImg) return aHasImg ? -1 : 1;
        if ((a.name === canonicalName) !== (b.name === canonicalName)) return a.name === canonicalName ? -1 : 1;
        return (new Date(a.createdAt || 0)) - (new Date(b.createdAt || 0));
      });

      const primary = profiles[0];
      const duplicates = profiles.slice(1);
      console.log(`   🌟 Selected primary profile: [${primary._id}] "${primary.name}"`);

      // Merge data from duplicates into primary
      const updates = {};
      if (primary.name !== canonicalName) {
        updates.name = canonicalName;
      }
      if (!primary.id || primary.id !== canonicalName.toLowerCase().replace(/[^a-z0-9_-]/g, '-')) {
        updates.id = canonicalName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      }

      for (const dup of duplicates) {
        if (!primary.bio && dup.bio) {
          primary.bio = dup.bio;
          updates.bio = dup.bio;
        }
        if (!primary.cover && (dup.cover || dup.avatar || dup.imageUrl)) {
          const img = dup.cover || dup.avatar || dup.imageUrl;
          primary.cover = img;
          updates.cover = img;
        }
        if (!primary.banner && dup.banner) {
          primary.banner = dup.banner;
          updates.banner = dup.banner;
        }
        if (!primary.isVerified && dup.isVerified) {
          primary.isVerified = true;
          updates.isVerified = true;
        }
        if ((!primary.genres || primary.genres.length === 0) && dup.genres && dup.genres.length > 0) {
          primary.genres = dup.genres;
          updates.genres = dup.genres;
        }
        if ((!primary.customLinks || primary.customLinks.length === 0) && dup.customLinks && dup.customLinks.length > 0) {
          primary.customLinks = dup.customLinks;
          updates.customLinks = dup.customLinks;
        }
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date();
        await artistsCollection.updateOne({ _id: primary._id }, { $set: updates });
        console.log(`   ✅ Enriched primary profile [${primary._id}] with merged metadata:`, Object.keys(updates));
      }

      // Delete all duplicate profiles
      for (const dup of duplicates) {
        await artistsCollection.deleteOne({ _id: dup._id });
        console.log(`   ❌ Deleted duplicate artist profile: [${dup._id}] "${dup.name}"`);
        totalDeletedDuplicates++;
      }
      totalMergedProfiles++;

    } else if (profiles.length === 1) {
      // Single profile, verify if its name needs canonicalization (e.g. "Al Shami - الشامي" -> "Al Shami")
      const single = profiles[0];
      if (single.name !== canonicalName) {
        console.log(`\n✏️ Updating artist profile name from non-canonical "${single.name}" -> "${canonicalName}"`);
        await artistsCollection.updateOne(
          { _id: single._id },
          {
            $set: {
              name: canonicalName,
              id: canonicalName.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
              updatedAt: new Date()
            }
          }
        );
        totalRenamedToCanonical++;
      }
    }
  }

  console.log(`\n✨ Artist Profiles Summary: Merged ${totalMergedProfiles} groups | Deleted ${totalDeletedDuplicates} duplicate docs | Renamed ${totalRenamedToCanonical} docs.`);

  // =========================================================================
  // STEP 2: Normalize Track documents
  // =========================================================================
  console.log('\n===========================================================');
  console.log('--- Step 2: Normalizing Track Documents ---');
  console.log('===========================================================');

  const allTracks = await tracksCollection.find({}, { projection: { _id: 1, artist: 1 } }).toArray();
  console.log(`Scanning ${allTracks.length} Track documents in DB...`);

  let updatedTracksCount = 0;
  const trackUpdatesByArtist = {};

  for (const track of allTracks) {
    const rawArtist = String(track.artist || '').trim();
    if (!rawArtist) continue;

    const canonicalArtist = getCanonicalArtistName(rawArtist);
    if (canonicalArtist && canonicalArtist !== rawArtist) {
      await tracksCollection.updateOne(
        { _id: track._id },
        { $set: { artist: canonicalArtist } }
      );
      updatedTracksCount++;
      const changeKey = `"${rawArtist}" -> "${canonicalArtist}"`;
      trackUpdatesByArtist[changeKey] = (trackUpdatesByArtist[changeKey] || 0) + 1;
    }
  }

  console.log(`✅ Updated ${updatedTracksCount} tracks to canonical artist names.`);
  if (Object.keys(trackUpdatesByArtist).length > 0) {
    console.log('Track updates detail:');
    for (const [k, count] of Object.entries(trackUpdatesByArtist)) {
      console.log(`   - ${k}: ${count} track(s)`);
    }
  }

  // =========================================================================
  // STEP 3: Normalize Album documents
  // =========================================================================
  console.log('\n===========================================================');
  console.log('--- Step 3: Normalizing Album Documents ---');
  console.log('===========================================================');

  const allAlbums = await albumsCollection.find({}, { projection: { _id: 1, name: 1, artist: 1, tracks: 1 } }).toArray();
  console.log(`Scanning ${allAlbums.length} Album documents in DB...`);

  let updatedAlbumsCount = 0;
  const albumUpdatesByArtist = {};

  for (const album of allAlbums) {
    const rawArtist = String(album.artist || '').trim();
    if (!rawArtist) continue;

    const canonicalArtist = getCanonicalArtistName(rawArtist);
    let needsUpdate = false;
    const albumUpdateSet = {};

    if (canonicalArtist && canonicalArtist !== rawArtist) {
      albumUpdateSet.artist = canonicalArtist;
      needsUpdate = true;
      const changeKey = `"${rawArtist}" -> "${canonicalArtist}"`;
      albumUpdatesByArtist[changeKey] = (albumUpdatesByArtist[changeKey] || 0) + 1;
    }

    // Also check embedded tracks within album doc if present
    if (Array.isArray(album.tracks) && album.tracks.length > 0) {
      let tracksModified = false;
      const updatedEmbeddedTracks = album.tracks.map(t => {
        if (!t || !t.artist) return t;
        const trackCanon = getCanonicalArtistName(t.artist);
        if (trackCanon && trackCanon !== t.artist) {
          tracksModified = true;
          return { ...t, artist: trackCanon };
        }
        return t;
      });

      if (tracksModified) {
        albumUpdateSet.tracks = updatedEmbeddedTracks;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      albumUpdateSet.updatedAt = new Date();
      await albumsCollection.updateOne({ _id: album._id }, { $set: albumUpdateSet });
      updatedAlbumsCount++;
    }
  }

  console.log(`✅ Updated ${updatedAlbumsCount} albums to canonical artist names.`);
  if (Object.keys(albumUpdatesByArtist).length > 0) {
    console.log('Album updates detail:');
    for (const [k, count] of Object.entries(albumUpdatesByArtist)) {
      console.log(`   - ${k}: ${count} album(s)`);
    }
  }

  // =========================================================================
  // STEP 4: Final verification and summary
  // =========================================================================
  console.log('\n===========================================================');
  console.log('--- Step 4: Final Database Status ---');
  console.log('===========================================================');

  const remainingArtists = await artistsCollection.find({}).sort({ name: 1 }).toArray();
  console.log(`Total remaining Artist profiles in DB: ${remainingArtists.length}`);

  const distinctTrackArtists = await tracksCollection.distinct('artist');
  console.log(`Total distinct track artists in DB: ${distinctTrackArtists.length}`);

  const distinctAlbumArtists = await albumsCollection.distinct('artist');
  console.log(`Total distinct album artists in DB: ${distinctAlbumArtists.length}`);

  // Check Shehab specifically
  const shehabArtists = await artistsCollection.find({ name: /shehab|شهاب/i }).toArray();
  const shehabTracks = await tracksCollection.find({ artist: /shehab|شهاب/i }).toArray();
  const shehabAlbums = await albumsCollection.find({ artist: /shehab|شهاب/i }).toArray();

  console.log('\n🎯 Shehab Verification:');
  console.log(`   - Artist profiles for Shehab: ${shehabArtists.map(a => `"${a.name}" [${a._id}]`).join(', ')}`);
  console.log(`   - Tracks count for Shehab: ${shehabTracks.length} (Distinct artists: ${[...new Set(shehabTracks.map(t => t.artist))].join(', ')})`);
  console.log(`   - Albums count for Shehab: ${shehabAlbums.length}`);

  await mongoose.disconnect();
  console.log('\n🎉 [Done] Bilingual artist deduplication & merge complete!');
}

if (require.main === module) {
  mergeBilingualArtists()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Script execution error:', err);
      process.exit(1);
    });
}

module.exports = { mergeBilingualArtists };
