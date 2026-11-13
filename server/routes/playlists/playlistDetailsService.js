const mongoose = require('mongoose');
const { User, Track, Album } = require('../../models');

/**
 * Resolves a playlist (or album, or Liked Songs) by ID with authorization checks
 */
async function resolvePlaylistDetails({ plId, authUserId }) {
  if (!plId) {
    return { status: 400, data: { error: 'Playlist ID is required' } };
  }

  const isLikedReq = plId.toLowerCase().includes('liked');
  const isObjId = mongoose.isValidObjectId(plId);
  let owner;
  if (isLikedReq) {
    owner = await User.findById(authUserId || plId).select('name avatar playlists likedTrackIds');
  } else {
    owner = await User.findOne({
      $or: [
        { 'playlists.id': plId },
        ...(isObjId ? [{ 'playlists._id': new mongoose.Types.ObjectId(plId) }] : [])
      ]
    }).select('name avatar playlists likedTrackIds');
  }

  if (!owner) {
    const cleanName = plId.replace(/^album-/i, '').replace(/[-_]/g, ' ').trim();
    const strippedId = plId.replace(/^album-/i, '');
    const prefixedId = `album-${strippedId}`;
    const album = await Album.findOne({
      $or: [
        ...(isObjId ? [{ _id: new mongoose.Types.ObjectId(plId) }] : []),
        { id: plId },
        { id: strippedId },
        { id: prefixedId },
        { name: new RegExp(`^${plId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        { name: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      ]
    }).lean();

    if (album) {
      const trackIds = Array.isArray(album.trackIds) ? album.trackIds : [];
      const validObjectIds = trackIds.filter(id => mongoose.isValidObjectId(id));
      const orConditions = [];
      if (validObjectIds.length > 0) orConditions.push({ _id: { $in: validObjectIds } });
      if (trackIds.length > 0) orConditions.push({ id: { $in: trackIds } });
      if (album.name && album.name.trim()) {
        orConditions.push({ album: new RegExp(`^${album.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
      }
      let albumTracks = [];
      if (orConditions.length > 0) {
        albumTracks = await Track.find({ $or: orConditions }, { lyrics: 0, fullLyrics: 0 }).lean();
      }
      return {
        status: 200,
        data: {
          success: true,
          playlist: { ...album, isAlbum: true, isPublic: true },
          tracks: albumTracks
        }
      };
    }

    return { status: 404, data: { error: 'Playlist not found' } };
  }

  const pl = (owner.playlists || []).find(p =>
    String(p.id) === plId ||
    String(p._id) === plId ||
    (isLikedReq && (p.isLikedSongs || p.name === 'Liked Songs'))
  );

  if (!pl && !(isLikedReq && owner.likedTrackIds)) {
    return { status: 404, data: { error: 'Playlist not found' } };
  }

  // IDOR / Privacy protection: If private, require playlist owner or admin
  const isOwner = authUserId && (String(owner._id) === String(authUserId));
  if (pl && pl.isPublic === false && !isOwner) {
    return { status: 403, data: { error: 'This playlist is private' } };
  }

  const isLiked = Boolean(
    isLikedReq ||
    pl?.isLikedSongs ||
    pl?.name === 'Liked Songs' ||
    String(pl?.id || '').startsWith('liked')
  );

  let rawList = [];
  if (isLiked) {
    rawList = owner.likedTrackIds || [];
  } else if (pl) {
    rawList = (Array.isArray(pl.tracks) && pl.tracks.length > 0)
      ? pl.tracks
      : (Array.isArray(pl.trackIds) ? pl.trackIds : []);
  }

  let orderedTracks = [];
  if (rawList.length > 0 && typeof rawList[0] === 'object' && rawList[0].title) {
    orderedTracks = rawList;
  } else {
    const rawIds = rawList.map(item => (item && typeof item === 'object') ? String(item._id || item.id) : String(item)).filter(Boolean);
    const validObjectIds = rawIds.filter(id => mongoose.isValidObjectId(id)).map(id => new mongoose.Types.ObjectId(id));

    let populatedTracks = [];
    if (validObjectIds.length > 0) {
      populatedTracks = await Track.find({
        $or: [
          { _id: { $in: validObjectIds } },
          { id: { $in: rawIds } }
        ]
      }, { lyrics: 0, fullLyrics: 0 }).lean();
    } else if (rawIds.length > 0) {
      populatedTracks = await Track.find({ id: { $in: rawIds } }, { lyrics: 0, fullLyrics: 0 }).lean();
    }

    const trackMap = new Map();
    populatedTracks.forEach(t => {
      if (t._id) trackMap.set(String(t._id), t);
      if (t.id) trackMap.set(String(t.id), t);
    });
    orderedTracks = rawIds.map(id => trackMap.get(id)).filter(Boolean);
  }

  return {
    status: 200,
    data: {
      success: true,
      playlist: {
        id: pl?.id || (isLiked ? 'liked' : (pl?._id || plId)),
        _id: pl?._id || pl?.id || plId,
        name: pl?.name || (isLiked ? 'Liked Songs' : 'Playlist'),
        cover: pl?.cover || (orderedTracks[0]?.coverUrl || orderedTracks[0]?.cover || ''),
        ownerName: owner.name,
        ownerAvatar: owner.avatar,
        isPublic: pl ? pl.isPublic !== false : true,
        isQuran: Boolean(pl?.isQuran),
        isLikedSongs: isLiked,
        trackIds: orderedTracks.map(t => String(t._id || t.id)),
        tracks: orderedTracks,
      }
    }
  };
}

/**
 * Saves or toggles saving another user's public playlist or album into user's library
 */
async function savePlaylistToLibrary({ targetId, bodyPlaylist, bodyTracks, action, userId, bodyArtist }) {
  const currentUser = await User.findById(userId);
  if (!currentUser) return { status: 404, data: { error: 'User not found' } };

  const isTargetObjId = mongoose.isValidObjectId(targetId);
  let sourceOwner = await User.findOne(isTargetObjId
    ? { $or: [{ 'playlists.id': targetId }, { 'playlists._id': new mongoose.Types.ObjectId(targetId) }] }
    : { 'playlists.id': targetId }
  ).select('_id name avatar playlists').lean();

  let sourcePlaylist = sourceOwner?.playlists?.find(p => String(p.id || p._id) === targetId);

  if (!sourcePlaylist) {
    const cleanTargetName = targetId.replace(/^album-/i, '').replace(/[-_]/g, ' ').trim();
    const album = await Album.findOne({
      $or: [
        { id: targetId },
        ...(isTargetObjId ? [{ _id: new mongoose.Types.ObjectId(targetId) }] : []),
        { name: new RegExp(`^${targetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        { name: new RegExp(`^${cleanTargetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      ]
    }).lean();
    if (album) {
      sourcePlaylist = {
        id: album.id || String(album._id),
        name: album.name || album.title || 'Saved Album',
        cover: album.cover || '',
        description: album.description || `Album by ${album.artist || 'Various Artists'}`,
        trackIds: album.trackIds || [],
        isPublic: true,
        isAlbum: true
      };
    }
  }

  if (!sourcePlaylist && bodyPlaylist) {
    const altId = String(bodyPlaylist.id || bodyPlaylist._id || '');
    if (altId && altId !== targetId) {
      const isAltObjId = mongoose.isValidObjectId(altId);
      const altOwner = await User.findOne(isAltObjId
        ? { $or: [{ 'playlists.id': altId }, { 'playlists._id': new mongoose.Types.ObjectId(altId) }] }
        : { 'playlists.id': altId }
      ).select('_id name avatar playlists').lean();
      if (altOwner) {
        sourceOwner = altOwner;
        sourcePlaylist = altOwner.playlists?.find(p => String(p.id || p._id) === altId);
      }
    }
    if (!sourcePlaylist) {
      sourcePlaylist = bodyPlaylist;
    }
  }

  if (!sourcePlaylist) {
    return { status: 404, data: { error: 'Playlist not found' } };
  }

  if (sourcePlaylist.isPublic === false && sourceOwner?._id && String(sourceOwner._id) !== String(currentUser._id)) {
    return { status: 403, data: { error: 'Cannot save a private playlist' } };
  }

  const existingIndex = (currentUser.playlists || []).findIndex(p =>
    String(p.sourcePlaylistId || '') === targetId ||
    String(p.id || '') === targetId ||
    (isTargetObjId && String(p._id || '') === targetId) ||
    (bodyPlaylist?.id && String(p.sourcePlaylistId || '') === String(bodyPlaylist.id)) ||
    (bodyPlaylist?._id && String(p.sourcePlaylistId || '') === String(bodyPlaylist._id))
  );

  // Support explicit action: 'save' vs 'unsave'
  if (action === 'unsave') {
    if (existingIndex >= 0) {
      currentUser.playlists.splice(existingIndex, 1);
      currentUser.markModified('playlists');
      await currentUser.save();
    }
    return {
      status: 200,
      data: {
        success: true,
        removed: true,
        saved: false,
        playlists: currentUser.playlists
      }
    };
  }

  if (action === 'save') {
    if (existingIndex >= 0) {
      return {
        status: 200,
        data: {
          success: true,
          alreadySaved: true,
          saved: true,
          playlist: currentUser.playlists[existingIndex],
          playlists: currentUser.playlists
        }
      };
    }
  } else {
    // Toggle behavior if no explicit action
    if (existingIndex >= 0) {
      currentUser.playlists.splice(existingIndex, 1);
      currentUser.markModified('playlists');
      await currentUser.save();
      return {
        status: 200,
        data: {
          success: true,
          removed: true,
          saved: false,
          playlists: currentUser.playlists
        }
      };
    }
  }

  // Determine track IDs
  let trackIds = [];
  if (Array.isArray(bodyTracks) && bodyTracks.length > 0) {
    trackIds = bodyTracks.map(t => (t && typeof t === 'object') ? String(t._id || t.id) : String(t)).filter(Boolean);
  } else if (Array.isArray(sourcePlaylist.trackIds) && sourcePlaylist.trackIds.length > 0) {
    trackIds = sourcePlaylist.trackIds.map(t => (t && typeof t === 'object') ? String(t._id || t.id) : String(t)).filter(Boolean);
  } else if (Array.isArray(sourcePlaylist.tracks) && sourcePlaylist.tracks.length > 0) {
    trackIds = sourcePlaylist.tracks.map(t => (t && typeof t === 'object') ? String(t._id || t.id) : String(t)).filter(Boolean);
  } else if (bodyPlaylist && Array.isArray(bodyPlaylist.trackIds) && bodyPlaylist.trackIds.length > 0) {
    trackIds = bodyPlaylist.trackIds.map(t => (t && typeof t === 'object') ? String(t._id || t.id) : String(t)).filter(Boolean);
  } else if (bodyPlaylist && Array.isArray(bodyPlaylist.tracks) && bodyPlaylist.tracks.length > 0) {
    trackIds = bodyPlaylist.tracks.map(t => (t && typeof t === 'object') ? String(t._id || t.id) : String(t)).filter(Boolean);
  }

  const resolvedOwnerName = sourceOwner?.name || bodyArtist || bodyPlaylist?.ownerName || bodyPlaylist?.artist || 'Listener';
  const newId = `pl-saved-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const savedPlaylist = {
    id: newId,
    name: sourcePlaylist.name || bodyPlaylist?.name || 'Saved Playlist',
    cover: sourcePlaylist.cover || bodyPlaylist?.cover || '',
    description: sourcePlaylist.description || (resolvedOwnerName ? `Saved from ${resolvedOwnerName}` : 'Saved playlist'),
    trackIds: Array.from(new Set(trackIds)),
    isPublic: false,
    isLikedSongs: false,
    isQuran: Boolean(sourcePlaylist.isQuran || bodyPlaylist?.isQuran),
    sourcePlaylistId: targetId,
    sourceOwnerName: resolvedOwnerName,
    sourceOwnerId: sourceOwner?._id ? String(sourceOwner._id) : (bodyPlaylist?.ownerId ? String(bodyPlaylist.ownerId) : ''),
    createdAt: new Date()
  };

  currentUser.playlists.push(savedPlaylist);
  currentUser.markModified('playlists');
  await currentUser.save();

  return {
    status: 200,
    data: {
      success: true,
      saved: true,
      playlist: savedPlaylist,
      playlists: currentUser.playlists
    }
  };
}

module.exports = {
  resolvePlaylistDetails,
  savePlaylistToLibrary
};
