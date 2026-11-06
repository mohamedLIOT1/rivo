/**
 * User Listening Activity Service
 * Modular service for real-time friend activity & radar.
 * Strictly < 400 lines.
 */

const mongoose = require('mongoose');
const { User, Track } = require('../../models');
const { isVerifiedUser } = require('../../middleware/auth');

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
            .select('_id name avatar bio currentListening lastActiveAt updatedAt createdAt isVerified likedTrackIds topTrack playlists')
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
      const candidateFriends = Array.from(uniqueUsersMap.values())
        .filter(u => String(u._id || u.id) !== currentIdStr);

      // Collect IDs of tracks needed for users without currentListening
      const neededTrackIds = [];
      const userTrackTargetMap = new Map();

      candidateFriends.forEach(u => {
        const uId = String(u._id || u.id);
        const hasTrack = Boolean(u.currentListening && (u.currentListening.title || u.currentListening.name));
        if (!hasTrack && (!u.topTrack || !u.topTrack.title)) {
          let tid = null;
          if (Array.isArray(u.likedTrackIds) && u.likedTrackIds.length > 0) {
            tid = String(u.likedTrackIds[u.likedTrackIds.length - 1]);
          } else if (Array.isArray(u.playlists)) {
            for (const pl of u.playlists) {
              if (Array.isArray(pl.trackIds) && pl.trackIds.length > 0) {
                tid = String(pl.trackIds[pl.trackIds.length - 1]);
                break;
              }
            }
          }
          if (tid) {
            userTrackTargetMap.set(uId, tid);
            if (!neededTrackIds.includes(tid)) neededTrackIds.push(tid);
          }
        }
      });

      // Batch load missing tracks
      const resolvedTrackMap = new Map();
      if (neededTrackIds.length > 0) {
        const validObjIds = neededTrackIds.filter(id => mongoose.isValidObjectId(id));
        const dbTracks = await Track.find({
          $or: [
            ...(validObjIds.length > 0 ? [{ _id: { $in: validObjIds } }] : []),
            { id: { $in: neededTrackIds } }
          ]
        }).select('_id id title artist cover audioUrl duration').lean();

        dbTracks.forEach(t => {
          const tId = String(t._id || t.id);
          resolvedTrackMap.set(tId, t);
          if (t.id) resolvedTrackMap.set(String(t.id), t);
        });
      }

      // Fallback track for users completely without history
      let globalFallbackTrack = null;
      const needsGlobalFallback = candidateFriends.some(u => {
        const hasTrack = Boolean(u.currentListening && (u.currentListening.title || u.currentListening.name));
        const hasTop = Boolean(u.topTrack && (u.topTrack.title || u.topTrack.name));
        const hasTarget = userTrackTargetMap.has(String(u._id || u.id));
        return !hasTrack && !hasTop && !hasTarget;
      });

      if (needsGlobalFallback) {
        globalFallbackTrack = await Track.findOne({})
          .sort({ plays: -1, createdAt: -1 })
          .select('_id id title artist cover audioUrl duration')
          .lean();
      }

      friends = candidateFriends.map(u => {
        const uId = String(u._id || u.id);
        const isOnline = Boolean(userSocketMap?.has(uId) && userSocketMap.get(uId).size > 0);
        const fallbackLastActive = u.lastActiveAt || u.updatedAt || u.createdAt || null;
        const lastActivityTime = new Date(u.currentListening?.updatedAt || fallbackLastActive || 0).getTime();
        const isRecent = (Date.now() - lastActivityTime) < 300000;
        const isLive = Boolean(isOnline && u.currentListening?.isPlaying && isRecent);

        let finalListening = null;
        if (u.currentListening && (u.currentListening.title || u.currentListening.name)) {
          finalListening = {
            ...u.currentListening,
            title: u.currentListening.title || u.currentListening.name,
            isPlaying: Boolean(isOnline && u.currentListening.isPlaying)
          };
        } else if (u.topTrack && (u.topTrack.title || u.topTrack.name)) {
          finalListening = {
            id: u.topTrack.id || `track_${uId}`,
            title: u.topTrack.title || u.topTrack.name,
            artist: u.topTrack.artist || '',
            cover: u.topTrack.cover || '',
            isPlaying: false,
            updatedAt: fallbackLastActive
          };
        } else if (userTrackTargetMap.has(uId)) {
          const t = resolvedTrackMap.get(userTrackTargetMap.get(uId));
          if (t) {
            finalListening = {
              id: String(t._id || t.id),
              title: t.title,
              artist: t.artist || '',
              cover: t.cover || '',
              audioUrl: t.audioUrl || '',
              duration: t.duration || 0,
              isPlaying: false,
              updatedAt: fallbackLastActive
            };
          }
        }

        if (!finalListening && globalFallbackTrack) {
          finalListening = {
            id: String(globalFallbackTrack._id || globalFallbackTrack.id),
            title: globalFallbackTrack.title,
            artist: globalFallbackTrack.artist || '',
            cover: globalFallbackTrack.cover || '',
            audioUrl: globalFallbackTrack.audioUrl || '',
            duration: globalFallbackTrack.duration || 0,
            isPlaying: false,
            updatedAt: fallbackLastActive
          };
        }

        return {
          id: uId,
          _id: uId,
          name: u.name,
          avatar: u.avatar || '',
          bio: u.bio || '',
          isVerified: Boolean(u.isVerified || isVerifiedUser(u.name)),
          currentListening: finalListening,
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
  fetchListeningActivities
};
