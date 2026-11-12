const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Track } = require('../models');
const { uploadsDir } = require('../middleware/upload');
const { getB2Accounts, getTelegramBots } = require('./cloudStorageClient');

const B2_FREE_CAP_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB per B2 bucket
const MONGO_FREE_CAP_BYTES = 512 * 1024 * 1024; // 512 MB Atlas M0
const TELEMETRY_CACHE_MS = 45 * 1000;

let cachedTelemetry = null;
let cachedAt = 0;

function getQuranPrimaryThresholdBytes() {
  const gb = Number(process.env.B2_QURAN_PRIMARY_MAX_GB || 9.2);
  const safeGb = Number.isFinite(gb) && gb >= 1 && gb <= 9.9 ? gb : 9.2;
  return Math.floor(safeGb * 1024 * 1024 * 1024);
}

const QURAN_FILTER = {
  $or: [
    { isQuran: true },
    { contentType: 'quran' },
    { genre: /quran|قرآن/i },
    { artist: /الحصري|العفاسي|المنشاوي|الدوسري|القرآن/i }
  ]
};

/**
 * Picks primary Quran B2 bucket (`rivoquran1`) until it reaches ~9.2 GB, then fails over to `rivoquran2`.
 */
async function resolveQuranB2AccountForUpload() {
  const b2Accounts = getB2Accounts();
  const quranAccounts = b2Accounts.filter((a) => a.category === 'quran');
  const primary = quranAccounts.find((a) => a.slot !== 'alt') || quranAccounts[0] || null;
  const alt = quranAccounts.find((a) => a.slot === 'alt') || quranAccounts[1] || null;
  const thresholdBytes = getQuranPrimaryThresholdBytes();

  if (!primary) {
    return { account: alt, switched: false, primaryBytes: 0, thresholdBytes };
  }

  const agg = await Track.aggregate([
    {
      $match: {
        'cloudStorage.provider': 'b2',
        'cloudStorage.bucketName': primary.bucketName
      }
    },
    { $group: { _id: null, totalBytes: { $sum: { $ifNull: ['$cloudStorage.fileSize', 0] } }, count: { $sum: 1 } } }
  ]);
  const primaryBytes = Number(agg[0]?.totalBytes || 0);
  const primaryCount = Number(agg[0]?.count || 0);

  if (primaryBytes >= thresholdBytes && alt) {
    return {
      account: alt,
      switched: true,
      primaryBytes,
      primaryCount,
      thresholdBytes,
      limitReachedWithoutAlt: false
    };
  }

  return {
    account: primary,
    switched: false,
    primaryBytes,
    primaryCount,
    thresholdBytes,
    limitReachedWithoutAlt: primaryBytes >= thresholdBytes && !alt
  };
}

function getCacheAndDiskStats() {
  const cacheDir = path.join(uploadsDir, 'cloud-cache');
  let cacheBytes = 0;
  let cacheFiles = 0;
  try {
    if (fs.existsSync(cacheDir)) {
      for (const name of fs.readdirSync(cacheDir)) {
        if (name.endsWith('.tmp')) continue;
        try {
          const st = fs.statSync(path.join(cacheDir, name));
          if (st.isFile()) {
            cacheBytes += st.size;
            cacheFiles += 1;
          }
        } catch {}
      }
    }
  } catch {}

  let diskTotalBytes = 0;
  let diskFreeBytes = 0;
  try {
    if (typeof fs.statfsSync === 'function') {
      const sfs = fs.statfsSync(uploadsDir);
      diskTotalBytes = Number(sfs.blocks || 0) * Number(sfs.bsize || 0);
      diskFreeBytes = Number(sfs.bavail || 0) * Number(sfs.bsize || 0);
    }
  } catch {}

  const maxCacheMb = Number(process.env.CLOUD_CACHE_MAX_MB || 3584);
  return {
    cacheFiles,
    cacheBytes,
    maxCacheBytes: (Number.isFinite(maxCacheMb) ? maxCacheMb : 3584) * 1024 * 1024,
    diskTotalBytes,
    diskFreeBytes
  };
}

/**
 * Returns consolidated telemetry for Telegram, Backblaze B2 buckets, Quran migration progress, DB & VPS cache.
 */
async function getCloudStorageTelemetry({ bypassCache = false } = {}) {
  if (!bypassCache && cachedTelemetry && Date.now() - cachedAt < TELEMETRY_CACHE_MS) {
    return cachedTelemetry;
  }

  const thresholdBytes = getQuranPrimaryThresholdBytes();
  const b2Accounts = getB2Accounts();
  const [
    providerAgg,
    b2Agg,
    quranArtistAgg,
    migrationStatusAgg,
    recentMigrated,
    dbStats
  ] = await Promise.all([
    Track.aggregate([
      { $match: { 'cloudStorage.provider': { $exists: true } } },
      {
        $group: {
          _id: '$cloudStorage.provider',
          count: { $sum: 1 },
          totalBytes: { $sum: { $ifNull: ['$cloudStorage.fileSize', 0] } }
        }
      }
    ]),
    Track.aggregate([
      { $match: { 'cloudStorage.provider': 'b2' } },
      {
        $group: {
          _id: '$cloudStorage.bucketName',
          count: { $sum: 1 },
          totalBytes: { $sum: { $ifNull: ['$cloudStorage.fileSize', 0] } }
        }
      }
    ]),
    Track.aggregate([
      { $match: QURAN_FILTER },
      {
        $group: {
          _id: {
            artist: '$artist',
            uploaded: { $cond: [{ $ifNull: ['$cloudStorage.provider', false] }, true, false] }
          },
          count: { $sum: 1 },
          bytes: { $sum: { $ifNull: ['$cloudStorage.fileSize', 0] } }
        }
      }
    ]),
    Track.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$migration.status', 'pending'] },
          count: { $sum: 1 }
        }
      }
    ]),
    Track.find({ 'migration.status': 'migrated' })
      .sort({ 'migration.updatedAt': -1 })
      .limit(8)
      .select('title artist cloudStorage.provider cloudStorage.bucketName cloudStorage.fileSize migration.category migration.updatedAt')
      .lean(),
    mongoose.connection.db.stats().catch(() => ({}))
  ]);

  const telegramRow = providerAgg.find((r) => r._id === 'telegram') || { count: 0, totalBytes: 0 };
  const b2ByBucket = new Map(b2Agg.map((r) => [String(r._id || ''), { count: r.count, totalBytes: r.totalBytes }]));

  const quranPrimary = b2Accounts.find((a) => a.category === 'quran' && a.slot !== 'alt');
  const quranPrimaryBytes = quranPrimary ? (b2ByBucket.get(quranPrimary.bucketName)?.totalBytes || 0) : 0;
  const switchedToAlt = Boolean(quranPrimary && quranPrimaryBytes >= thresholdBytes && b2Accounts.some((a) => a.category === 'quran' && a.slot === 'alt'));

  const buckets = b2Accounts.map((acc) => {
    const stat = b2ByBucket.get(acc.bucketName) || { count: 0, totalBytes: 0 };
    const effectiveThreshold = (acc.category === 'quran' && acc.slot !== 'alt') ? thresholdBytes : B2_FREE_CAP_BYTES;
    const percentOfCap = Math.min(100, Number(((stat.totalBytes / B2_FREE_CAP_BYTES) * 100).toFixed(1)));
    let status = 'active';
    if (acc.category === 'quran' && acc.slot !== 'alt') {
      if (stat.totalBytes >= thresholdBytes) status = switchedToAlt ? 'switched' : 'full';
      else if (stat.totalBytes >= thresholdBytes * 0.9) status = 'near_limit';
    } else if (acc.category === 'quran' && acc.slot === 'alt') {
      status = switchedToAlt ? 'active' : 'standby';
    } else if (stat.totalBytes >= B2_FREE_CAP_BYTES * 0.85) {
      status = 'near_limit';
    }
    return {
      index: acc.index,
      bucketName: acc.bucketName,
      category: acc.category,
      slot: acc.slot,
      count: stat.count,
      totalBytes: stat.totalBytes,
      capBytes: B2_FREE_CAP_BYTES,
      switchThresholdBytes: effectiveThreshold,
      percentOfCap,
      status
    };
  });

  // Roll up Quran reciter progress
  const reciterMap = new Map();
  let qUploaded = 0;
  let qRemaining = 0;
  let qBytes = 0;
  for (const row of quranArtistAgg) {
    const artist = String(row._id?.artist || 'قرآن كريم').trim();
    const isUp = Boolean(row._id?.uploaded);
    if (isUp) {
      qUploaded += row.count;
      qBytes += Number(row.bytes || 0);
    } else {
      qRemaining += row.count;
    }
    const prev = reciterMap.get(artist) || { artist, uploaded: 0, remaining: 0, bytes: 0 };
    if (isUp) {
      prev.uploaded += row.count;
      prev.bytes += Number(row.bytes || 0);
    } else {
      prev.remaining += row.count;
    }
    reciterMap.set(artist, prev);
  }
  const reciters = Array.from(reciterMap.values())
    .sort((a, b) => (b.uploaded + b.remaining) - (a.uploaded + a.remaining))
    .slice(0, 8);

  const migrationCounts = {};
  for (const r of migrationStatusAgg) {
    migrationCounts[String(r._id || 'pending')] = r.count;
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    telegram: {
      botsConfigured: getTelegramBots().length,
      count: telegramRow.count,
      totalBytes: telegramRow.totalBytes
    },
    b2Buckets: buckets,
    quran: {
      total: qUploaded + qRemaining,
      uploaded: qUploaded,
      remaining: qRemaining,
      totalBytes: qBytes,
      primaryThresholdBytes: thresholdBytes,
      switchedToAlt,
      activeBucket: switchedToAlt
        ? (b2Accounts.find((a) => a.category === 'quran' && a.slot === 'alt')?.bucketName || 'rivoquran2')
        : (quranPrimary?.bucketName || 'rivoquran1'),
      reciters
    },
    migration: {
      counts: migrationCounts,
      recentTracks: recentMigrated.map((t) => ({
        id: String(t._id),
        title: t.title,
        artist: t.artist,
        provider: t.cloudStorage?.provider || '',
        bucketName: t.cloudStorage?.bucketName || '',
        fileSize: t.cloudStorage?.fileSize || 0,
        category: t.migration?.category || '',
        updatedAt: t.migration?.updatedAt || null
      }))
    },
    database: {
      dataSize: Number(dbStats?.dataSize || 0),
      storageSize: Number(dbStats?.storageSize || 0),
      indexSize: Number(dbStats?.indexSize || 0),
      objects: Number(dbStats?.objects || 0),
      capBytes: MONGO_FREE_CAP_BYTES
    },
    vps: getCacheAndDiskStats()
  };

  cachedTelemetry = payload;
  cachedAt = Date.now();
  return payload;
}

module.exports = {
  resolveQuranB2AccountForUpload,
  getCloudStorageTelemetry,
  getQuranPrimaryThresholdBytes
};
