/**
 * User Profile, Social Relations & Activity Helpers
 * Strictly modularized (< 400 lines).
 */

const mongoose = require('mongoose');
const { User, Track } = require('../../models');
const { isVerifiedUser } = require('../../middleware/auth');

function escapeRegex(s) {
  return (s || '').replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

async function fetchUserProfileData(rawId, currentUserId) {
  let target = null;
  if (mongoose.isValidObjectId(rawId)) {
    target = await User.findById(rawId)
      .select('_id name avatar bio playlists followers following createdAt')
      .lean();
  }
  if (!target) {
    target = await User.findOne({ $or: [{ id: rawId }, { name: rawId }] })
      .select('_id name avatar bio playlists followers following createdAt')
      .lean();
  }
  if (!target) return null;

  const isFollowing = currentUserId ? (target.followers || []).map(String).includes(String(currentUserId)) : false;
  const rawPublicPlaylists = (target.playlists || []).filter(p => p.isPublic !== false && !p.isLikedSongs);

  const allTrackIds = [];
  rawPublicPlaylists.forEach(p => {
    (p.trackIds || []).forEach(tid => {
      if (tid && !allTrackIds.includes(String(tid))) allTrackIds.push(String(tid));
    });
  });

  const trackMap = new Map();
  if (allTrackIds.length > 0) {
    const validObjIds = allTrackIds.filter(id => mongoose.isValidObjectId(id));
    const dbTracks = await Track.find({
      $or: [
        ...(validObjIds.length > 0 ? [{ _id: { $in: validObjIds } }] : []),
        { id: { $in: allTrackIds } }
      ]
    }).lean();
    dbTracks.forEach(t => {
      const tId = String(t._id || t.id);
      const formatted = { id: tId, _id: tId, ...t };
      trackMap.set(tId, formatted);
      if (t.id) trackMap.set(String(t.id), formatted);
    });
  }

  const publicPlaylists = rawPublicPlaylists.map(p => {
    const pTracks = (p.trackIds || []).map(tid => trackMap.get(String(tid))).filter(Boolean);
    return {
      ...p,
      ownerId: String(target._id),
      ownerName: target.name,
      trackCount: (p.trackIds || []).length,
      tracks: pTracks
    };
  });

  return {
    id: String(target._id),
    _id: String(target._id),
    name: target.name,
    avatar: target.avatar,
    bio: target.bio || '',
    createdAt: target.createdAt,
    publicPlaylists,
    playlistCount: publicPlaylists.length,
    followersCount: (target.followers || []).length,
    followingCount: (target.following || []).length,
    isFollowing,
    isVerified: isVerifiedUser(target.name)
  };
}

async function fetchFollowersList(rawId) {
  let target = null;
  if (mongoose.isValidObjectId(rawId)) {
    target = await User.findById(rawId).select('_id followers').lean();
  }
  if (!target) {
    target = await User.findOne({ $or: [{ id: rawId }, { name: rawId }] }).select('_id followers').lean();
  }
  if (!target) return null;

  const rawIds = (target.followers || []).map(f => {
    if (!f) return null;
    if (typeof f === 'object' && f._id) return String(f._id);
    return String(f);
  }).filter(Boolean);

  const validObjectIds = rawIds.filter(id => mongoose.isValidObjectId(id));
  const objectIdList = validObjectIds.map(id => {
    try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
  }).filter(Boolean);

  const followerUsers = await User.find({
    $or: [
      { _id: { $in: objectIdList } },
      { _id: { $in: validObjectIds } },
      { id: { $in: rawIds } },
      { name: { $in: rawIds } }
    ]
  }).select('_id name avatar bio').lean();

  if (target._id && followerUsers.length !== (target.followers || []).length) {
    await User.findByIdAndUpdate(target._id, { $set: { followers: followerUsers.map(u => u._id) } }).catch(() => {});
  }

  return followerUsers.map(f => ({
    id: String(f._id),
    _id: String(f._id),
    name: f.name,
    avatar: f.avatar || '',
    bio: f.bio || '',
    isVerified: isVerifiedUser(f.name)
  }));
}

async function fetchFollowingList(rawId) {
  let target = null;
  if (mongoose.isValidObjectId(rawId)) {
    target = await User.findById(rawId).select('_id following').lean();
  }
  if (!target) {
    target = await User.findOne({ $or: [{ id: rawId }, { name: rawId }] }).select('_id following').lean();
  }
  if (!target) return null;

  const rawIds = (target.following || []).map(f => {
    if (!f) return null;
    if (typeof f === 'object' && f._id) return String(f._id);
    return String(f);
  }).filter(Boolean);

  const validObjectIds = rawIds.filter(id => mongoose.isValidObjectId(id));
  const objectIdList = validObjectIds.map(id => {
    try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
  }).filter(Boolean);

  const followingUsers = await User.find({
    $or: [
      { _id: { $in: objectIdList } },
      { _id: { $in: validObjectIds } },
      { id: { $in: rawIds } },
      { name: { $in: rawIds } }
    ]
  }).select('_id name avatar bio').lean();

  if (target._id && followingUsers.length !== (target.following || []).length) {
    await User.findByIdAndUpdate(target._id, { $set: { following: followingUsers.map(u => u._id) } }).catch(() => {});
  }

  return followingUsers.map(f => ({
    id: String(f._id),
    _id: String(f._id),
    name: f.name,
    avatar: f.avatar || '',
    bio: f.bio || '',
    isVerified: isVerifiedUser(f.name)
  }));
}

async function fetchListeningActivities(currentUserId, userSocketMap) {
  let friends = [];

  if (currentUserId) {
    let me = null;
    if (mongoose.isValidObjectId(currentUserId)) {
      me = await User.findById(currentUserId).select('_id following').lean();
    }
    if (!me) {
      me = await User.findOne({ $or: [{ id: currentUserId }, { name: currentUserId }] }).select('_id following').lean();
    }

    if (me && me.following && me.following.length > 0) {
      const rawIds = (me.following || []).map(f => {
        if (!f) return null;
        if (typeof f === 'object' && f._id) return String(f._id);
        return String(f);
      }).filter(Boolean);

      const validObjectIds = rawIds.filter(id => mongoose.isValidObjectId(id));
      const objectIdList = validObjectIds.map(id => {
        try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
      }).filter(Boolean);

      const orConditions = [
        ...(objectIdList.length > 0 ? [{ _id: { $in: objectIdList } }] : []),
        ...(validObjectIds.length > 0 ? [{ _id: { $in: validObjectIds } }] : []),
        ...(rawIds.length > 0 ? [{ id: { $in: rawIds } }, { name: { $in: rawIds } }] : [])
      ];

      const followedUsers = orConditions.length > 0
        ? await User.find({ $or: orConditions })
            .select('_id name avatar bio currentListening lastActiveAt updatedAt createdAt isVerified')
            .lean()
        : [];

      // Deduplicate in case a user matches multiple OR clauses
      const uniqueUsersMap = new Map();
      followedUsers.forEach(u => {
        const uId = String(u._id || u.id);
        if (!uniqueUsersMap.has(uId)) {
          uniqueUsersMap.set(uId, u);
        }
      });

      const currentIdStr = String(currentUserId || '');
      friends = Array.from(uniqueUsersMap.values())
        .filter(u => String(u._id || u.id) !== currentIdStr)
        .map(u => {
        const uId = String(u._id || u.id);
        const isOnline = Boolean(userSocketMap?.has(uId) && userSocketMap.get(uId).size > 0);
        const fallbackLastActive = u.lastActiveAt || u.updatedAt || u.createdAt || null;
        const lastActivityTime = new Date(u.currentListening?.updatedAt || fallbackLastActive || 0).getTime();
        const isRecent = (Date.now() - lastActivityTime) < 300000;
        const isLive = Boolean(isOnline && u.currentListening?.isPlaying && isRecent);

        return {
          id: uId,
          _id: uId,
          name: u.name,
          avatar: u.avatar || '',
          bio: u.bio || '',
          isVerified: Boolean(u.isVerified || isVerifiedUser(u.name)),
          currentListening: u.currentListening || null,
          lastActiveAt: fallbackLastActive,
          isOnline,
          isLive
        };
      });

      // Sort friends:
      // 1) Live listeners (isLive: true) first
      // 2) Online users (isOnline: true) second
      // 3) Offline users with recent activity (lastActiveAt) sorted newest first
      // 4) Other friends last (stable alphabetical tie-breaker)
      friends.sort((a, b) => {
        if (a.isLive !== b.isLive) {
          return a.isLive ? -1 : 1;
        }
        if (a.isOnline !== b.isOnline) {
          return a.isOnline ? -1 : 1;
        }
        const timeA = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
        const timeB = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
        if (timeA !== timeB) {
          return timeB - timeA;
        }
        return (a.name || '').localeCompare(b.name || '');
      });
    }
  }

  if (friends.length === 0) {
    const onlineUserIds = [];
    if (userSocketMap) {
      for (const [uid, sockets] of userSocketMap.entries()) {
        if (sockets && sockets.size > 0 && String(uid) !== String(currentUserId || '')) {
          try {
            if (mongoose.isValidObjectId(uid)) {
              onlineUserIds.push(new mongoose.Types.ObjectId(String(uid)));
            }
          } catch {}
        }
      }
    }

    if (onlineUserIds.length > 0) {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const activeCommunity = await User.find({
        _id: { $in: onlineUserIds },
        'currentListening.isPlaying': true,
        $or: [
          { 'currentListening.updatedAt': { $gte: fiveMinAgo } },
          { lastActiveAt: { $gte: fiveMinAgo } }
        ]
      })
      .sort({ 'currentListening.updatedAt': -1, lastActiveAt: -1 })
      .limit(8)
      .select('_id name avatar bio currentListening lastActiveAt isVerified')
      .lean();

      if (activeCommunity.length > 0) {
        friends = activeCommunity.map(u => {
          const uId = String(u._id);
          const isOnline = Boolean(userSocketMap?.has(uId) && userSocketMap.get(uId).size > 0);
          return {
            id: uId,
            name: u.name,
            avatar: u.avatar || '',
            bio: u.bio || '',
            isVerified: Boolean(u.isVerified || isVerifiedUser(u.name)),
            currentListening: u.currentListening || null,
            lastActiveAt: u.lastActiveAt || null,
            isOnline: true,
            isLive: Boolean(isOnline && u.currentListening?.isPlaying),
            isCommunity: true
          };
        }).filter(u => u.isOnline && u.isLive);
      }
    }
  }

  return friends;
}

module.exports = {
  escapeRegex,
  fetchUserProfileData,
  fetchFollowersList,
  fetchFollowingList,
  fetchListeningActivities
};
