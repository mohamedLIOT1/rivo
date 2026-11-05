const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');
const { uploadsDir } = require('../middleware/upload');
const {
  stemsDir,
  getSafeStemKey,
  resolveCanonicalStemKey,
  getVocalStemPath,
  isVocalStemReady,
  createStemAlias
} = require('./vocalStemUtils');
const { prepareLocalAudioInput } = require('./vocalAudioHelper');
const {
  registerWorkerHeartbeat,
  hasActiveExternalWorker,
  getWorkerStatus: getWorkerStatusInternal,
  getNextWorkerJob: getNextWorkerJobInternal,
  completeWorkerJob: completeWorkerJobInternal
} = require('./vocalWorkerQueue');

const jobMap = new Map();
const isolationQueue = [];
let isWorkerRunning = false;

function getWorkerStatus() {
  return getWorkerStatusInternal(isolationQueue);
}

function getNextWorkerJob(workerId = 'Colab-Worker') {
  return getNextWorkerJobInternal(isolationQueue, workerId);
}

function completeWorkerJob(stemKey, vocalSourceFilePath, aliases = [], workerId = 'Colab-Worker') {
  return completeWorkerJobInternal({
    stemKey,
    vocalSourceFilePath,
    aliases,
    workerId,
    getSafeStemKey,
    getVocalStemPath,
    createStemAlias,
    jobMap,
    isolationQueue
  });
}

/**
 * Get current progress/status of vocal isolation.
 * NEVER returns a stem URL until file is verified ready on disk.
 */
function getVocalIsolationStatus(stemKey, aliases = []) {
  const allKeys = [stemKey, ...aliases].filter(Boolean).map(getSafeStemKey);

  for (const k of allKeys) {
    if (isVocalStemReady(k)) {
      for (const alias of allKeys) {
        if (alias !== k) createStemAlias(k, alias);
      }
      return {
        status: 'ready',
        progress: 100,
        eta: '00:00',
        url: `/uploads/stems/vocal_${k}.mp3`,
        cached: true
      };
    }
  }

  for (const k of allKeys) {
    if (jobMap.has(k)) {
      const job = jobMap.get(k);
      if (job.status === 'failed') {
        return {
          status: 'failed',
          progress: 0,
          eta: 'Isolation unavailable',
          url: null,
          error: job.error || null,
          cached: false
        };
      }
      return {
        status: job.status,
        progress: job.progress || 0,
        eta: job.eta || '',
        url: job.status === 'ready' ? `/uploads/stems/vocal_${k}.mp3` : null,
        error: job.error || null,
        cached: false
      };
    }
  }

  return { status: 'idle', progress: 0, eta: '', url: null, cached: false };
}

/**
 * Process queue items sequentially (Concurrency = 1)
 */
async function processQueue() {
  if (isWorkerRunning || isolationQueue.length === 0) return;

  isWorkerRunning = true;
  const currentTask = isolationQueue.shift();

  try {
    if (isVocalStemReady(currentTask.stemKey)) {
      currentTask.status = 'ready';
      currentTask.progress = 100;
      currentTask.eta = '00:00';
      currentTask.url = `/uploads/stems/vocal_${currentTask.stemKey}.mp3`;
      for (const alias of currentTask.aliases) {
        if (alias !== currentTask.stemKey) createStemAlias(currentTask.stemKey, alias);
      }
      return;
    }

    currentTask.status = 'processing';
    currentTask.progress = 8;
    currentTask.eta = 'Preparing audio...';
    currentTask.updatedAt = Date.now();

    if (hasActiveExternalWorker() && !currentTask.claimedByWorker) {
      currentTask.eta = 'Dispatching to Colab GPU...';
      currentTask.progress = 15;
      await new Promise(r => setTimeout(r, 4000));
      if (isVocalStemReady(currentTask.stemKey) || currentTask.claimedByWorker) return;
    }

    await executeSeparation(currentTask);
  } catch (err) {
    console.error(`[VocalSeparator] Error isolating vocals for ${currentTask.stemKey}:`, err.message);
    currentTask.status = 'failed';
    currentTask.progress = 0;
    currentTask.eta = 'Isolation unavailable';
    currentTask.url = null;
    currentTask.error = err.message;
    currentTask.failedAt = Date.now();
  } finally {
    isWorkerRunning = false;
    setImmediate(processQueue);
  }
}

/**
 * Executes a single AI vocal separation job
 */
function executeSeparation(task) {
  return new Promise(async (resolve, reject) => {
    const safe = task.stemKey;
    const targetStemPath = getVocalStemPath(safe);
    const tempDir = path.join(stemsDir, `tmp_${safe}_${Date.now()}`);

    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Step A0: Ensure local, readable audio file without 403 Forbidden
      let localInput = await prepareLocalAudioInput(task.inputSource, safe, task.aliases, tempDir, task);

      const tempWavAudio = path.join(tempDir, 'clean_input.wav');
      task.eta = 'Decoding audio...';
      task.progress = 20;

      // Step A: Convert input audio to 16-bit PCM WAV
      await new Promise((resWav, rejWav) => {
        const args1 = ['-y', '-i', localInput, '-vn', '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', tempWavAudio];
        execFile('ffmpeg', args1, { timeout: 120000 }, (err) => {
          if (!err && fs.existsSync(tempWavAudio) && fs.statSync(tempWavAudio).size > 1000) {
            return resWav();
          }
          const args2 = ['-y', '-i', localInput, '-map', '0:a:0?', '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', tempWavAudio];
          execFile('ffmpeg', args2, { timeout: 120000 }, (err2, stdout2, stderr2) => {
            if (err2 || !fs.existsSync(tempWavAudio) || fs.statSync(tempWavAudio).size < 1000) {
              return rejWav(new Error(`Failed to decode audio: ${stderr2 || err2?.message}`));
            }
            resWav();
          });
        });
      });

      task.progress = 30;
      task.eta = 'Isolating vocals with Cloud GPU (A10G)...';

      // Step B: AI vocal separation
      const cloudScript = path.join(__dirname, 'cloud_separator.py');
      let cloudDone = false;
      if (fs.existsSync(cloudScript)) {
        try {
          await new Promise((resCloud, rejCloud) => {
            const pyBin = process.platform === 'win32' ? 'python' : 'python3';
            const pyProc = spawn(pyBin, [cloudScript, tempWavAudio, targetStemPath], { env: { ...process.env } });

            pyProc.stdout.on('data', (chunk) => {
              const text = chunk.toString();
              for (const line of text.split('\n')) {
                const match = line.match(/\[PROGRESS\]\s+(\d+)%\s+(.+)/);
                if (match) {
                  task.progress = Math.min(99, Math.max(task.progress, parseInt(match[1])));
                  task.eta = match[2].trim();
                  task.updatedAt = Date.now();
                }
              }
            });

            const progressTimer = setInterval(() => {
              if (task.progress < 96) {
                task.progress = Math.min(96, task.progress + 1);
                task.updatedAt = Date.now();
              }
            }, 1000);
            const timeoutTimer = setTimeout(() => {
              clearInterval(progressTimer);
              try { pyProc.kill('SIGKILL'); } catch {}
              rejCloud(new Error('Cloud separator timeout after 120s'));
            }, 120000);

            pyProc.on('close', (code) => {
              clearInterval(progressTimer);
              clearTimeout(timeoutTimer);
              if (code === 0 && fs.existsSync(targetStemPath) && fs.statSync(targetStemPath).size > 10000) {
                cloudDone = true;
                resCloud();
              } else {
                rejCloud(new Error(`Cloud separator failed with exit code ${code}`));
              }
            });
            pyProc.on('error', (err) => {
              clearInterval(progressTimer);
              clearTimeout(timeoutTimer);
              rejCloud(err);
            });
          });
        } catch (cloudErr) {
          console.warn(`[VocalSeparator] AI isolation notice: ${cloudErr.message}`);
        }
      }

      if (cloudDone) {
        for (const alias of task.aliases) {
          if (alias !== safe) createStemAlias(safe, alias);
        }
        task.status = 'ready';
        task.progress = 100;
        task.eta = '00:00';
        task.url = `/uploads/stems/vocal_${safe}.mp3`;
        task.error = null;
        return resolve();
      }

      throw new Error('AI vocal isolation failed across all cloud and local models');
    } catch (err) {
      reject(err);
    } finally {
      try {
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  });
}

/**
 * Start asynchronous AI vocal isolation
 */
function startVocalIsolation(inputSource, stemKey, aliases = [], isPriority = false) {
  const safe = getSafeStemKey(stemKey);
  const allKeys = [safe, ...aliases.map(getSafeStemKey)].filter(Boolean);
  const relativeUrl = `/uploads/stems/vocal_${safe}.mp3`;

  if (isVocalStemReady(safe)) {
    for (const alias of allKeys) {
      if (alias !== safe) createStemAlias(safe, alias);
    }
    return { status: 'ready', progress: 100, eta: '00:00', url: relativeUrl, cached: true };
  }

  for (const k of allKeys) {
    if (jobMap.has(k)) {
      const existing = jobMap.get(k);
      if (existing.status === 'processing') return existing;
      if (existing.status === 'queued') {
        if (isPriority) {
          const idx = isolationQueue.indexOf(existing);
          if (idx > 0) {
            isolationQueue.splice(idx, 1);
            isolationQueue.unshift(existing);
          }
        }
        return existing;
      }
      if (existing.status === 'failed' && (Date.now() - (existing.failedAt || 0) < 15000)) {
        return existing;
      }
    }
  }

  const job = {
    stemKey: safe,
    aliases: allKeys,
    inputSource,
    status: 'queued',
    progress: 5,
    eta: isWorkerRunning ? 'Queued behind active isolation...' : 'Preparing audio...',
    url: null,
    error: null,
    startedAt: Date.now(),
    updatedAt: Date.now()
  };

  for (const k of allKeys) jobMap.set(k, job);
  if (isPriority) isolationQueue.unshift(job);
  else isolationQueue.push(job);

  setImmediate(processQueue);
  return job;
}

function getJobInputSource(stemKey) {
  const safe = getSafeStemKey(stemKey);
  const job = jobMap.get(safe);
  return (job && job.inputSource && fs.existsSync(job.inputSource)) ? job.inputSource : null;
}

module.exports = {
  stemsDir,
  getSafeStemKey,
  resolveCanonicalStemKey,
  getVocalStemPath,
  isVocalStemReady,
  getVocalIsolationStatus,
  startVocalIsolation,
  createStemAlias,
  getNextWorkerJob,
  completeWorkerJob,
  getWorkerStatus,
  registerWorkerHeartbeat,
  getJobInputSource
};
