/**
 * Rivo Artist Album Organizer & Canonical Discography Deduplication Bot
 * 
 * 1. Curates official albums with verified HD artwork for all database artists.
 * 2. Adds canonical missing tracks (e.g. "3ASH / عايش" for El Joker's TALATINI album).
 * 3. Prunes redundant video-clip duplicates while strictly preserving legitimate
 *    alternate/acoustic/live versions with distinct lyrics (e.g. "تراك النيه من برنامج صاحبة السعادة").
 * 4. Remaps user playlists and liked songs to the canonical studio tracks.
 */

const mongoose = require('mongoose');
const { Track, Album, User } = require('../models');

// Canonical official artist album covers
const CANONICAL_ALBUM_COVERS = {
  'TALATINI': 'https://i.scdn.co/image/ab67616d0000b273fc0d195cbbec7fcf4ce10e11',
  'Supernova': 'https://i.scdn.co/image/ab67616d0000b2739fa45778b0f4ec6f54c256ce',
  'Roma': 'https://i.scdn.co/image/ab67616d0000b27318ecf66556b6be6629ae7067',
  'Noaata Beida': 'https://i.scdn.co/image/ab67616d0000b273b57f00223e7f9ff32a5ff50b',
  'The Ugly Ducklings': 'https://i.scdn.co/image/ab67616d0000b27361a9fc551a31d99fb3ba868b',
  'Nas W Nas': 'https://i.scdn.co/image/ab67616d0000b2733b5c7efbf1b8c2dfa9a3b688',
  'Placebo': 'https://i.scdn.co/image/ab67616d0000b273c3d526fc8f399435b62e49c7',
  'BGD': 'https://i.scdn.co/image/ab67616d0000b2731d1b22301fa32cf42bb95be2',
  'Plan-B': 'https://i.scdn.co/image/ab67616d0000b2732dfc7ea822f3ca56e293a52f',
  'Agzakhana': 'https://i.scdn.co/image/ab67616d0000b273fcf05b38f8fc61474136e053',
  '191-181': 'https://i.scdn.co/image/ab67616d0000b273cb66ae2d42dfb7fec966144e',
  'MATADOR': 'https://i.scdn.co/image/ab67616d0000b27315ffbc3ff487dca16688d5e8',
  'الرجل الذي فقد قلبه': 'https://i.scdn.co/image/ab67616d0000b273297a76e7372bc74332938167',
};

function normalizeTitle(t = '') {
  return String(t)
    .toLowerCase()
    .replace(/\s*[\(\[\{].*?[\)\]\}]\s*/g, ' ') // Strip parentheses content (e.g. feat, official video)
    .replace(/[^\p{L}\p{N}]/gu, '')
    .trim();
}

function isDistinctAlternateTake(title = '') {
  const lower = String(title).toLowerCase();
  const distinctKeywords = [
    'صاحبه السعاده',
    'صاحبة السعادة',
    'من الاستوديو',
    'من الاستديو',
    'acoustic',
    'live',
    'حفلة',
    'حفله',
    'remix',
    'ريمكس',
    'part 2',
    'جزء 2',
    'ii',
    'نسخة مختلفة',
    'توزيع جديد',
    'جلسة',
    'جلسات'
  ];
  return distinctKeywords.some(kw => lower.includes(kw));
}

function isVideoClipRip(track) {
  const title = String(track.title || '').toLowerCase();
  const album = String(track.album || '').toLowerCase();
  const isYoutube = album === 'youtube' || !album || track.source === 'YouTube';
  if (!isYoutube) return false;

  const clipKeywords = [
    'official music video',
    'official video',
    'music video',
    'فيديو كليب',
    'كليب',
    'visualizer',
    'lyric video',
    'فيديو كليب رسمي',
    'الكليب الرسمي',
    'الكليب'
  ];
  return clipKeywords.some(kw => title.includes(kw));
}

async function organizeArtistAlbumsBot() {
  const report = {
    fixedMissingTracks: [],
    prunedDuplicates: [],
    updatedAlbums: [],
    remappedReferences: 0
  };

  console.log('[ArtistAlbumBot] Starting full discography audit & album organization...');

  // 1. Ensure "3ASH / عايش" exists and is assigned to El Joker's TALATINI album
  try {
    let ashTrack = await Track.findOne({
      artist: /el joker|الجوكر/i,
      $or: [{ title: /3ash/i }, { title: /عايش/i }]
    });

    if (!ashTrack) {
      console.log('[ArtistAlbumBot] Creating missing track "3ASH (عايش)" for El Joker...');
      ashTrack = await Track.create({
        title: '3ASH',
        artist: 'El Joker',
        album: 'TALATINI',
        duration: 195,
        cover: CANONICAL_ALBUM_COVERS['TALATINI'],
        coverUrl: CANONICAL_ALBUM_COVERS['TALATINI'],
        audioUrl: 'https://www.youtube.com/watch?v=0hW6403tCrs',
        youtubeId: '0hW6403tCrs',
        genre: 'Rap / Hip-Hop',
        source: 'Spotify',
        isExternal: false
      });
      report.fixedMissingTracks.push('El Joker - 3ASH (Created)');
    } else {
      if (ashTrack.album !== 'TALATINI') {
        ashTrack.album = 'TALATINI';
        ashTrack.cover = CANONICAL_ALBUM_COVERS['TALATINI'];
        ashTrack.coverUrl = CANONICAL_ALBUM_COVERS['TALATINI'];
        await ashTrack.save();
        report.fixedMissingTracks.push('El Joker - 3ASH (Assigned to TALATINI)');
      }
    }

    // Attach 3ASH to TALATINI Album document
    const talatiniAlbum = await Album.findOne({ name: /talatini/i });
    if (talatiniAlbum) {
      const ashIdStr = String(ashTrack._id);
      if (!talatiniAlbum.trackIds.map(String).includes(ashIdStr)) {
        talatiniAlbum.trackIds.push(ashIdStr);
        talatiniAlbum.cover = CANONICAL_ALBUM_COVERS['TALATINI'];
        await talatiniAlbum.save();
        report.updatedAlbums.push('TALATINI (Added 3ASH, now 8 tracks)');
      }
    }
  } catch (err) {
    console.error('[ArtistAlbumBot] Error checking 3ASH for El Joker:', err.message);
  }

  // 2. Audit and Deduplicate Tracks Artist by Artist
  const allTracks = await Track.find({}).lean();
  const byArtistMap = new Map();

  for (const t of allTracks) {
    const rawArtist = (t.artist || 'Unknown').trim();
    // Normalize artist name (e.g. Cairokee vs CairokeeOfficial -> Cairokee)
    let normArtist = rawArtist;
    if (/cairokee/i.test(normArtist)) normArtist = 'Cairokee';
    if (/el joker|الجوكر/i.test(normArtist)) normArtist = 'El Joker';
    if (/lege-?cy/i.test(normArtist)) normArtist = 'Lege-Cy';
    if (/marwan moussa/i.test(normArtist)) normArtist = 'Marwan Moussa';
    if (/marwan pablo/i.test(normArtist)) normArtist = 'Marwan Pablo';
    if (/wegz/i.test(normArtist)) normArtist = 'Wegz';

    if (!byArtistMap.has(normArtist)) byArtistMap.set(normArtist, []);
    byArtistMap.get(normArtist).push(t);
  }

  const idsToDelete = new Set();
  const remapping = new Map(); // oldId -> canonicalId

  for (const [artistName, tracks] of byArtistMap.entries()) {
    // Group tracks by normalized title core
    const titleGroups = new Map();

    for (const t of tracks) {
      if (isDistinctAlternateTake(t.title)) {
        // Distinct versions like "صاحبة السعادة" must NEVER be deduplicated!
        continue;
      }

      const coreTitle = normalizeTitle(t.title);
      if (!coreTitle) continue;

      if (!titleGroups.has(coreTitle)) titleGroups.set(coreTitle, []);
      titleGroups.get(coreTitle).push(t);
    }

    for (const [coreTitle, group] of titleGroups.entries()) {
      if (group.length <= 1) continue;

      // We have multiple candidates for the same base song
      // Prioritize: Official Album Track > High bitrate / Cloud storage > Video Clip Rip
      const sorted = [...group].sort((a, b) => {
        const aIsAlbum = a.album && a.album !== 'YouTube' && a.album !== 'Single' && !a.album.toLowerCase().includes('youtube');
        const bIsAlbum = b.album && b.album !== 'YouTube' && b.album !== 'Single' && !b.album.toLowerCase().includes('youtube');
        if (aIsAlbum && !bIsAlbum) return -1;
        if (!aIsAlbum && bIsAlbum) return 1;

        const aIsClip = isVideoClipRip(a);
        const bIsClip = isVideoClipRip(b);
        if (!aIsClip && bIsClip) return -1;
        if (aIsClip && !bIsClip) return 1;

        const aCloud = Boolean(a.cloudStorage?.provider);
        const bCloud = Boolean(b.cloudStorage?.provider);
        if (aCloud && !bCloud) return -1;
        if (!aCloud && bCloud) return 1;

        return (b.plays || 0) - (a.plays || 0);
      });

      const canonical = sorted[0];
      const duplicates = sorted.slice(1);

      for (const dup of duplicates) {
        // Only prune if it is truly a redundant clip/stream clone and NOT a live or distinct version
        if (isVideoClipRip(dup) || (!dup.album || dup.album === 'YouTube' || dup.album.toLowerCase().includes('youtube'))) {
          const dupId = String(dup._id);
          const canId = String(canonical._id);
          if (dupId !== canId) {
            idsToDelete.add(dupId);
            remapping.set(dupId, canId);
            report.prunedDuplicates.push(`${artistName}: Removed duplicate "${dup.title}" (Kept studio version "${canonical.title}" [${canonical.album || 'Official'}])`);
          }
        }
      }
    }
  }

  // 3. Remap playlists and users' liked songs so no broken references exist
  if (remapping.size > 0) {
    console.log(`[ArtistAlbumBot] Remapping references for ${remapping.size} pruned duplicates...`);
    const allUsers = await User.find({ $or: [{ 'playlists.0': { $exists: true } }, { 'likedTrackIds.0': { $exists: true } }] });
    for (const u of allUsers) {
      let userModified = false;

      // Remap liked tracks
      if (Array.isArray(u.likedTrackIds) && u.likedTrackIds.length > 0) {
        const remappedLikes = u.likedTrackIds.map(id => {
          const idStr = String(id);
          if (remapping.has(idStr)) {
            userModified = true;
            return remapping.get(idStr);
          }
          return idStr;
        });
        if (userModified) {
          u.likedTrackIds = [...new Set(remappedLikes)];
        }
      }

      // Remap user playlists
      if (Array.isArray(u.playlists)) {
        for (const pl of u.playlists) {
          let plModified = false;
          const newTrackIds = (pl.trackIds || []).map(id => {
            const idStr = String(id);
            if (remapping.has(idStr)) {
              plModified = true;
              return remapping.get(idStr);
            }
            return idStr;
          });

          if (plModified) {
            pl.trackIds = [...new Set(newTrackIds)];
            userModified = true;
            report.remappedReferences++;
          }
        }
      }

      if (userModified) {
        await u.save();
      }
    }

    const allAlbums = await Album.find({});
    for (const alb of allAlbums) {
      let modified = false;
      const newTrackIds = (alb.trackIds || []).map(id => {
        const idStr = String(id);
        if (remapping.has(idStr)) {
          modified = true;
          return remapping.get(idStr);
        }
        return idStr;
      });

      if (modified) {
        alb.trackIds = [...new Set(newTrackIds)];
        await alb.save();
      }
    }

    // Delete redundant duplicates from Track collection
    if (idsToDelete.size > 0) {
      const deleteArray = Array.from(idsToDelete).map(id => new mongoose.Types.ObjectId(id));
      await Track.deleteMany({ _id: { $in: deleteArray } });
      console.log(`[ArtistAlbumBot] Deleted ${deleteArray.length} redundant clip rip duplicates from database.`);
    }
  }

  // 4. Update Official Album Documents with canonical HD artwork and sorted tracklists
  const albums = await Album.find({});
  for (const alb of albums) {
    const cleanAlbName = alb.name.replace(/^Album\s*-\s*/i, '').trim();
    if (CANONICAL_ALBUM_COVERS[cleanAlbName]) {
      alb.cover = CANONICAL_ALBUM_COVERS[cleanAlbName];
    }

    // Ensure tracks assigned to this album in Track collection are registered in alb.trackIds
    const albumTracks = await Track.find({
      $or: [
        { album: alb.name },
        { album: cleanAlbName },
        { album: `Album - ${cleanAlbName}` }
      ]
    }).select('_id title').lean();

    if (albumTracks.length > 0) {
      const existingIds = new Set((alb.trackIds || []).map(String));
      let added = false;
      for (const at of albumTracks) {
        const atId = String(at._id);
        if (!existingIds.has(atId) && !idsToDelete.has(atId)) {
          alb.trackIds.push(atId);
          existingIds.add(atId);
          added = true;
        }
      }
      if (added || alb.isModified('cover')) {
        await alb.save();
        report.updatedAlbums.push(`${alb.name} (${alb.trackIds.length} tracks, HD cover synced)`);
      }
    }
  }

  console.log('[ArtistAlbumBot] Discography audit and organization complete!');
  return report;
}

module.exports = {
  organizeArtistAlbumsBot,
  CANONICAL_ALBUM_COVERS
};
