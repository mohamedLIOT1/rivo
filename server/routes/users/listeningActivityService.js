/**
 * User Listening Activity Service
 * Modular service for real-time friend activity & radar.
 * Strictly < 400 lines.
 */

const mongoose = require('mongoose');
const { User } = require('../../models');
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
      const candidateFriends = Array.from(uniqueUsersMap.values())
        .filter(u => String(u._id || u.id) !== currentIdStr);

      // Calculate unread counts from each friend
      const unreadMap = new Map();
      try {
        const { Message } = require('../../models');
        let myObjId = null;
        if (mongoose.isValidObjectId(currentUserId)) {
          myObjId = new mongoose.Types.ObjectId(String(currentUserId));
        }
        const unreadCounts = await Message.aggregate([
          {
            $match: {
              recipient: { $in: [myObjId, String(currentUserId)].filter(Boolean) },
              read: false
            }
          },
          {
            $group: {
              _id: '$sender',
              count: { $sum: 1 }
            }
          }
        ]);
        (unreadCounts || []).forEach(u => unreadMap.set(String(u._id), u.count));
      } catch (err) {
        console.warn('Failed to aggregate unread in listening activity:', err.message);
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
          isLive,
          unreadCount: unreadMap.get(uId) || 0
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
