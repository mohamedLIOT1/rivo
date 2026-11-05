/**
 * Targeted Unit & Integration Test for Friend Activity & Social Graph
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_activity_unit_tests';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/rivo_test';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

console.log('====================================================');
console.log('🚀 RUNNING FRIEND ACTIVITY & SOCIAL GRAPH TEST SUITE');
console.log('====================================================');

const baseDir = path.resolve(__dirname, '..');

// 1. Check AGENTS.md 400-Line Rule & File Existence
const filesToCheck = [
  'server/routes/users/userHelpers.js',
  'src/components/ListeningActivityPanel.jsx',
  'src/components/activity/ActivityListItem.jsx'
];

console.log('\n[TEST 1] AGENTS.md Line Count & Integrity Check:');
for (const rel of filesToCheck) {
  const full = path.join(baseDir, rel);
  assert(fs.existsSync(full), `File must exist: ${rel}`);
  const lines = fs.readFileSync(full, 'utf8').split('\n').length;
  console.log(`  ✓ ${rel}: ${lines} lines (< 400 lines compliant)`);
  assert(lines <= 400, `File ${rel} exceeds 400-line limit: ${lines}`);
}

// 2. Load models & userHelpers
const { User } = require('../server/models');
const { fetchListeningActivities } = require('../server/routes/users/userHelpers');

// Prepare mock data
const myUserId = new mongoose.Types.ObjectId();
const friendLiveId = new mongoose.Types.ObjectId();
const friendOnlineIdleId = new mongoose.Types.ObjectId();
const friendOffline2dId = new mongoose.Types.ObjectId();
const friendOfflineNoActiveId = new mongoose.Types.ObjectId();
const friendOfflineBrandNewId = new mongoose.Types.ObjectId();

const now = Date.now();
const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000);
const fiveDaysAgo = new Date(now - 5 * 24 * 60 * 60 * 1000);
const oneMinuteAgo = new Date(now - 60 * 1000);

const mockFollowedDbUsers = [
  {
    _id: friendLiveId,
    id: String(friendLiveId),
    name: 'LiveUser',
    avatar: 'https://example.com/live.jpg',
    bio: 'Jamming right now',
    currentListening: {
      id: 'song1',
      title: 'Active Jam',
      artist: 'Artist A',
      isPlaying: true,
      updatedAt: oneMinuteAgo
    },
    lastActiveAt: oneMinuteAgo,
    updatedAt: oneMinuteAgo,
    createdAt: fiveDaysAgo,
    isVerified: true
  },
  {
    _id: friendOnlineIdleId,
    id: String(friendOnlineIdleId),
    name: 'OnlineIdleUser',
    avatar: 'https://example.com/idle.jpg',
    bio: 'Idle online',
    currentListening: null,
    lastActiveAt: oneMinuteAgo,
    updatedAt: oneMinuteAgo,
    createdAt: fiveDaysAgo,
    isVerified: false
  },
  {
    _id: friendOffline2dId,
    id: String(friendOffline2dId),
    name: 'Offline2dUser',
    avatar: 'https://example.com/offline2d.jpg',
    bio: 'Inactive for 2 days',
    currentListening: {
      id: 'song2',
      title: 'Old Jam',
      artist: 'Artist B',
      isPlaying: false,
      updatedAt: twoDaysAgo
    },
    lastActiveAt: twoDaysAgo,
    updatedAt: twoDaysAgo,
    createdAt: fiveDaysAgo,
    isVerified: false
  },
  {
    _id: friendOfflineNoActiveId,
    id: String(friendOfflineNoActiveId),
    name: 'NoActiveUser',
    avatar: 'https://example.com/noactive.jpg',
    bio: 'No lastActiveAt set',
    currentListening: null,
    lastActiveAt: null,
    updatedAt: null,
    createdAt: fiveDaysAgo,
    isVerified: false
  },
  {
    _id: friendOfflineBrandNewId,
    id: String(friendOfflineBrandNewId),
    name: 'BrandNewUser',
    avatar: 'https://example.com/brandnew.jpg',
    bio: 'Never active at all',
    currentListening: null,
    lastActiveAt: null,
    updatedAt: null,
    createdAt: null,
    isVerified: false
  }
];

const mockUserSockets = new Map();
// Live user has active socket
mockUserSockets.set(String(friendLiveId), new Set(['socket_1']));
// Online idle user has active socket
mockUserSockets.set(String(friendOnlineIdleId), new Set(['socket_2']));
// Others have no sockets (offline)

async function runTests() {
  console.log('\n[TEST 2] Testing fetchListeningActivities with Followed Users:');

  // Stub User.findById for current user
  const originalFindById = User.findById;
  const originalFindOne = User.findOne;
  const originalFind = User.find;

  try {
    User.findById = function (id) {
      return {
        select: function () {
          return {
            lean: async function () {
              if (String(id) === String(myUserId)) {
                return {
                  _id: myUserId,
                  // Following mix of ObjectId, string id, and username
                  following: [
                    friendLiveId,
                    String(friendOnlineIdleId),
                    friendOffline2dId,
                    'NoActiveUser', // String name matching
                    String(friendOfflineBrandNewId)
                  ]
                };
              }
              return null;
            }
          };
        },
        lean: async function () {
          if (String(id) === String(myUserId)) {
            return {
              _id: myUserId,
              following: [
                friendLiveId,
                String(friendOnlineIdleId),
                friendOffline2dId,
                'NoActiveUser',
                String(friendOfflineBrandNewId)
              ]
            };
          }
          return null;
        }
      };
    };

    User.findOne = function () {
      return {
        select: function () {
          return {
            lean: async function () { return null; }
          };
        },
        lean: async function () { return null; }
      };
    };

    User.find = function (query) {
      return {
        select: function () {
          return {
            lean: async function () {
              // Return all mock followed users
              return mockFollowedDbUsers;
            }
          };
        },
        sort: function () {
          return {
            limit: function () {
              return {
                select: function () {
                  return {
                    lean: async function () { return []; }
                  };
                }
              };
            }
          };
        }
      };
    };

    const activities = await fetchListeningActivities(String(myUserId), mockUserSockets);

    console.log(`  Total activities returned: ${activities.length}`);
    assert.strictEqual(activities.length, 5, 'MUST return ALL 5 followed users without dropping any offline/inactive users!');
    console.log('  ✓ Verified: Zero followed users were dropped!');

    // Verify ordering
    console.log('\n[TEST 3] Verification of Intelligent Sorting:');
    activities.forEach((act, idx) => {
      console.log(`    #${idx + 1}: ${act.name} | isLive=${act.isLive} | isOnline=${act.isOnline} | lastActiveAt=${act.lastActiveAt}`);
    });

    // 1st: Live listener
    assert.strictEqual(activities[0].name, 'LiveUser');
    assert.strictEqual(activities[0].isLive, true);
    assert.strictEqual(activities[0].isOnline, true);
    console.log('  ✓ #1 is Live listener (isLive=true)');

    // 2nd: Online idle user
    assert.strictEqual(activities[1].name, 'OnlineIdleUser');
    assert.strictEqual(activities[1].isLive, false);
    assert.strictEqual(activities[1].isOnline, true);
    console.log('  ✓ #2 is Online user (isOnline=true)');

    // 3rd: Offline user with recent activity (2 days ago)
    assert.strictEqual(activities[2].name, 'Offline2dUser');
    assert.strictEqual(activities[2].isOnline, false);
    console.log('  ✓ #3 is Offline user with activity (2 days ago)');

    // 4th: Offline user with fallback createdAt (5 days ago)
    assert.strictEqual(activities[3].name, 'NoActiveUser');
    assert.strictEqual(activities[3].isOnline, false);
    assert.strictEqual(activities[3].lastActiveAt, fiveDaysAgo);
    console.log('  ✓ #4 is Offline user with createdAt fallback');

    // 5th: Brand new user with null activity
    assert.strictEqual(activities[4].name, 'BrandNewUser');
    assert.strictEqual(activities[4].isOnline, false);
    assert.strictEqual(activities[4].lastActiveAt, null);
    console.log('  ✓ #5 is Other friend with null lastActiveAt');

    console.log('\n[TEST 4] Fallback to Active Community Discovery when following 0 users:');
    // Stub user with 0 following
    User.findById = function () {
      return {
        select: function () {
          return {
            lean: async function () {
              return { _id: myUserId, following: [] };
            }
          };
        }
      };
    };

    const communityUserId = new mongoose.Types.ObjectId();
    const communitySockets = new Map();
    communitySockets.set(String(communityUserId), new Set(['socket_comm']));

    User.find = function () {
      return {
        sort: function () {
          return {
            limit: function () {
              return {
                select: function () {
                  return {
                    lean: async function () {
                      return [
                        {
                          _id: communityUserId,
                          name: 'CommunityDJ',
                          avatar: '',
                          bio: 'Broadcasting live',
                          currentListening: {
                            id: 'comm_track',
                            title: 'Community Hit',
                            artist: 'DJ Global',
                            isPlaying: true
                          },
                          isVerified: true
                        }
                      ];
                    }
                  };
                }
              };
            }
          };
        }
      };
    };

    const communityActs = await fetchListeningActivities(String(myUserId), communitySockets);
    assert.strictEqual(communityActs.length, 1);
    assert.strictEqual(communityActs[0].name, 'CommunityDJ');
    assert.strictEqual(communityActs[0].isCommunity, true);
    assert.strictEqual(communityActs[0].isLive, true);
    console.log('  ✓ Active community fallback works perfectly when user follows no one');

    console.log('\n====================================================');
    console.log('🎉 ALL FRIEND ACTIVITY TESTS PASSED WITH 100% SUCCESS!');
    console.log('====================================================\n');
    process.exit(0);
  } finally {
    User.findById = originalFindById;
    User.findOne = originalFindOne;
    User.find = originalFind;
  }
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
