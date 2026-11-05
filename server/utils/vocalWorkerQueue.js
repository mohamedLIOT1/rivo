/**
 * Vocal Separator External GPU Worker Queue Management
 * Strictly modularized (< 400 lines).
 */

const fs = require('fs');

const activeWorkers = new Map();

function registerWorkerHeartbeat(workerId = 'Colab-Worker') {
  activeWorkers.set(workerId, { lastSeen: Date.now(), id: workerId });
}

function hasActiveExternalWorker() {
  const now = Date.now();
  for (const [id, w] of activeWorkers.entries()) {
    if (now - w.lastSeen < 20000) {
      return true;
    }
  }
  return false;
}

function getWorkerStatus(isolationQueue = []) {
  const now = Date.now();
  const list = [];
  for (const [id, w] of activeWorkers.entries()) {
    if (now - w.lastSeen < 30000) {
      list.push({ id, online: true, lastSeenSecondsAgo: Math.round((now - w.lastSeen) / 1000) });
    }
  }
  return {
    hasWorker: list.length > 0,
    workers: list,
    queueLength: isolationQueue.length
  };
}

function getNextWorkerJob(isolationQueue = [], workerId = 'Colab-Worker') {
  registerWorkerHeartbeat(workerId);
  if (isolationQueue.length === 0) return null;

  const task = isolationQueue.find(t => t.status === 'queued' || (t.status === 'processing' && !t.claimedByWorker));
  if (!task) return null;

  task.claimedByWorker = workerId;
  task.claimedAt = Date.now();
  task.status = 'processing';
  task.eta = 'Processing on Google Colab T4 GPU...';
  task.progress = 25;
  task.updatedAt = Date.now();

  return {
    stemKey: task.stemKey,
    aliases: task.aliases || [],
    inputSource: task.inputSource,
    title: task.title || task.stemKey
  };
}

function completeWorkerJob({
  stemKey,
  vocalSourceFilePath,
  aliases = [],
  workerId = 'Colab-Worker',
  getSafeStemKey,
  getVocalStemPath,
  createStemAlias,
  jobMap,
  isolationQueue
}) {
  registerWorkerHeartbeat(workerId);
  const safe = getSafeStemKey(stemKey);
  const targetStemPath = getVocalStemPath(safe);
  const allKeys = [safe, ...aliases.map(getSafeStemKey)].filter(Boolean);

  if (fs.existsSync(vocalSourceFilePath) && fs.statSync(vocalSourceFilePath).size > 10000) {
    fs.copyFileSync(vocalSourceFilePath, targetStemPath);

    for (const alias of allKeys) {
      if (alias !== safe) createStemAlias(safe, alias);
    }

    const job = jobMap.get(safe);
    if (job) {
      job.status = 'ready';
      job.progress = 100;
      job.eta = '00:00';
      job.error = null;
      job.updatedAt = Date.now();
    }

    const idx = isolationQueue.findIndex(t => t.stemKey === safe);
    if (idx !== -1) isolationQueue.splice(idx, 1);

    console.log(`[VocalSeparator] Completed by worker [${workerId}] -> ${targetStemPath}`);
    return true;
  }
  return false;
}

module.exports = {
  registerWorkerHeartbeat,
  hasActiveExternalWorker,
  getWorkerStatus,
  getNextWorkerJob,
  completeWorkerJob
};
