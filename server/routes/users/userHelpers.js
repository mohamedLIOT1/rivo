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

const { fetchListeningActivities } = require('./listeningActivityService');

module.exports = {
  escapeRegex,
  fetchUserProfileData,
  fetchFollowersList,
  fetchFollowingList,
  fetchListeningActivities
};
