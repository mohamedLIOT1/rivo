const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const crypto = require('crypto');
const { uploadsDir } = require('../middleware/upload');

const stemsDir = path.join(uploadsDir, 'stems');
if (!fs.existsSync(stemsDir)) {
  try { fs.mkdirSync(stemsDir, { recursive: true }); } catch {}
}

const modelDir = process.env.AUDIO_SEPARATOR_MODEL_DIR || (process.platform === 'win32' ? 'C:/tmp/audio-separator-models' : '/tmp/audio-separator-models');

// In-memory status map of active & recent jobs: safeKey -> jobObject
const jobMap = new Map();

// Strict FIFO isolation queue with Concurrency = 1
const isolationQueue = [];
let isWorkerRunning = false;

// Active connected external GPU workers (e.g. Google Colab)
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

function getWorkerStatus() {
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

function getNextWorkerJob(workerId = 'Colab-Worker') {
  registerWorkerHeartbeat(workerId);
  if (isolationQueue.length === 0) return null;

  // Find first task not already being processed by external worker
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

function completeWorkerJob(stemKey, vocalSourceFilePath, aliases = [], workerId = 'Colab-Worker') {
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

    // Remove from queue if still present
    const idx = isolationQueue.findIndex(t => t.stemKey === safe);
    if (idx !== -1) isolationQueue.splice(idx, 1);

    console.log(`[VocalSeparator] Completed by worker [${workerId}] -> ${targetStemPath}`);
    return true;
  }
  return false;
}

function getSafeStemKey(identifier) {
  if (!identifier || typeof identifier !== 'string') {
    return 'unknown_' + Date.now();
  }
  const clean = identifier.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  if (clean.length > 64) {
    return crypto.createHash('md5').update(clean).digest('hex');
  }
  return clean;
}

function resolveCanonicalStemKey({ trackId, url, title, artist }) {
  if (url) {
    const vidMatch = url.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
    if (vidMatch && vidMatch[1]) return `yt_${vidMatch[1]}`;
  }
  if (trackId) {
    if (trackId.startsWith('yt_')) return trackId;
    if (/^[a-zA-Z0-9_-]{11}$/.test(trackId)) return `yt_${trackId}`;
  }
  if (title) {
    const cleanT = String(title).toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const cleanA = String(artist || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (cleanT) {
      return `ta_${crypto.createHash('md5').update(`${cleanT}_${cleanA}`).digest('hex')}`;
    }
  }
  if (trackId) return `tr_${getSafeStemKey(trackId)}`;
  if (url) return `url_${crypto.createHash('md5').update(url).digest('hex')}`;
  return 'unknown_' + Date.now();
}

function getVocalStemPath(stemKey) {
  const safe = getSafeStemKey(stemKey);
  return path.join(stemsDir, `vocal_${safe}.mp3`);
}

function isVocalStemReady(stemKey) {
  const filePath = getVocalStemPath(stemKey);
  return fs.existsSync(filePath) && fs.statSync(filePath).size > 10000;
}

function createStemAlias(primaryKey, aliasKey) {
  if (!primaryKey || !aliasKey || primaryKey === aliasKey) return;
  const primaryFile = getVocalStemPath(primaryKey);
  const aliasFile = getVocalStemPath(aliasKey);
  if (!fs.existsSync(primaryFile)) return;
  if (fs.existsSync(aliasFile)) return;
  try {
    fs.linkSync(primaryFile, aliasFile);
  } catch {
    try { fs.copyFileSync(primaryFile, aliasFile); } catch {}
  }
}

/**
 * Get the current progress/status of vocal isolation for a key
 */
function getVocalIsolationStatus(stemKey, aliases = []) {
  const allKeys = [stemKey, ...aliases].filter(Boolean).map(getSafeStemKey);

  // 1. Check if any key is ready on disk
  for (const k of allKeys) {
    if (isVocalStemReady(k)) {
      // Ensure other aliases link to this ready stem
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

  // 2. Check if any key is in-flight or queued
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
        url: `/uploads/stems/vocal_${k}.mp3`,
        error: job.error || null,
        cached: false
      };
    }
  }

  return {
    status: 'idle',
    progress: 0,
    eta: '',
    url: null,
    cached: false
  };
}

/**
 * Process the queue items sequentially (Concurrency = 1)
 */
async function processQueue() {
  if (isWorkerRunning) return;
  if (isolationQueue.length === 0) return;

  isWorkerRunning = true;
  const currentTask = isolationQueue.shift();

  try {
    // If stem was prepared in the meantime
    if (isVocalStemReady(currentTask.stemKey)) {
      currentTask.status = 'ready';
      currentTask.progress = 100;
      currentTask.eta = '00:00';
      for (const alias of currentTask.aliases) {
        if (alias !== currentTask.stemKey) createStemAlias(currentTask.stemKey, alias);
      }
      return;
    }

    currentTask.status = 'processing';
    currentTask.progress = 8;
    currentTask.eta = 'Preparing audio...';
    currentTask.updatedAt = Date.now();

    // If Google Colab T4 is active, wait briefly for it to pull
    if (hasActiveExternalWorker() && !currentTask.claimedByWorker) {
      currentTask.eta = 'Dispatching to Colab GPU...';
      currentTask.progress = 15;
      await new Promise(r => setTimeout(r, 4000));
      if (isVocalStemReady(currentTask.stemKey) || currentTask.claimedByWorker) {
        return;
      }
    }

    await executeSeparation(currentTask);
  } catch (err) {
    console.error(`[VocalSeparator] Error isolating vocals for ${currentTask.stemKey}:`, err.message);
    currentTask.status = 'failed';
    currentTask.progress = 0;
    currentTask.eta = 'Isolation unavailable';
    currentTask.error = err.message;
    currentTask.failedAt = Date.now();
  } finally {
    isWorkerRunning = false;
    setImmediate(processQueue);
  }
}

/**
 * Executes a single AI / High-Precision vocal separation job
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

      let localInput = task.inputSource;

      // Step A0: If inputSource is a remote HTTP stream (e.g. googlevideo or proxy), download it locally first
      if (typeof localInput === 'string' && (localInput.startsWith('http://') || localInput.startsWith('https://'))) {
        console.log(`[VocalSeparator] Pre-downloading remote audio stream to local buffer for: ${safe}`);
        task.eta = 'Buffering stream...';
        task.progress = 10;
        const downloadedRaw = path.join(tempDir, 'raw_input.m4a');

        const axios = require('axios');
        const dlRes = await axios({
          method: 'get',
          url: localInput,
          responseType: 'stream',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Range': 'bytes=0-'
          },
          timeout: 45000
        });

        const writer = fs.createWriteStream(downloadedRaw);
        await new Promise((resDl, rejDl) => {
          dlRes.data.pipe(writer);
          writer.on('finish', resDl);
          writer.on('error', rejDl);
        });

        if (fs.existsSync(downloadedRaw) && fs.statSync(downloadedRaw).size > 10000) {
          localInput = downloadedRaw;
        }
      }

      const tempWavAudio = path.join(tempDir, 'clean_input.wav');

      // Step A: Convert input audio to standard 16-bit PCM WAV
      console.log(`[VocalSeparator] Converting input to WAV: ${safe}`);
      task.eta = 'Decoding audio...';
      task.progress = 20;

      await new Promise((resWav, rejWav) => {
        const convertCmd = `ffmpeg -y -i "${localInput}" -vn -ar 44100 -ac 2 -c:a pcm_s16le "${tempWavAudio}"`;
        exec(convertCmd, { timeout: 120000 }, (err, stdout, stderr) => {
          if (!err && fs.existsSync(tempWavAudio) && fs.statSync(tempWavAudio).size > 1000) {
            return resWav();
          }
          const fbCmd = `ffmpeg -y -i "${localInput}" -map 0:a:0? -ar 44100 -ac 2 -c:a pcm_s16le "${tempWavAudio}"`;
          exec(fbCmd, { timeout: 120000 }, (err2, stdout2, stderr2) => {
            if (err2 || !fs.existsSync(tempWavAudio) || fs.statSync(tempWavAudio).size < 1000) {
              return rejWav(new Error(`Failed to decode audio: ${stderr2 || stderr || err2?.message}`));
            }
            resWav();
          });
        });
      });

      if (!fs.existsSync(tempWavAudio) || fs.statSync(tempWavAudio).size < 1000) {
        throw new Error('Converted WAV audio file is empty or missing');
      }

      task.progress = 30;
      task.eta = 'Isolating vocals with Cloud GPU (A10G)...';

      // Step B1: Try Cloud ZeroGPU (NVIDIA A10G) first
      const cloudScript = path.join(__dirname, 'cloud_separator.py');
      let cloudDone = false;
      if (fs.existsSync(cloudScript)) {
        try {
          console.log(`[VocalSeparator] Attempting AI cloud vocal separation for: ${safe}`);
          task.progress = 35;
          task.eta = 'Isolating vocals with AI Neural Net...';
          await new Promise((resCloud, rejCloud) => {
            const pyBin = process.platform === 'win32' ? 'python' : 'python3';
            const pyProc = spawn(pyBin, [cloudScript, tempWavAudio, targetStemPath], {
              env: { ...process.env }
            });
            const progressTimer = setInterval(() => {
              if (task.progress < 92) {
                task.progress = Math.min(92, task.progress + Math.floor(Math.random() * 6) + 4);
                task.updatedAt = Date.now();
              }
            }, 1200);
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
          console.warn(`[VocalSeparator] Cloud/Local AI isolation error: ${cloudErr.message}`);
        }
      }

      if (cloudDone) {
        // Create links for all known aliases
        for (const alias of task.aliases) {
          if (alias !== safe) createStemAlias(safe, alias);
        }
        task.status = 'ready';
        task.progress = 100;
        task.eta = '00:00';
        task.error = null;
        console.log(`[VocalSeparator] Successfully isolated pure vocal stem via AI model: ${targetStemPath}`);
        return resolve();
      }

      // If AI isolation failed, mark task failed instead of returning audio with music
      throw new Error('AI vocal isolation failed across all cloud and local models');
    } catch (err) {
      reject(err);
    } finally {
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch {}
    }
  });
}

/**
 * Start asynchronous AI vocal isolation with Kim_Vocal_2 / High-Precision DSP (Queue Concurrency = 1)
 */
function startVocalIsolation(inputSource, stemKey, aliases = [], isPriority = false) {
  const safe = getSafeStemKey(stemKey);
  const allKeys = [safe, ...aliases.map(getSafeStemKey)].filter(Boolean);
  const targetStemPath = getVocalStemPath(safe);
  const relativeUrl = `/uploads/stems/vocal_${safe}.mp3`;

  // 1. If already on disk
  if (isVocalStemReady(safe)) {
    for (const alias of allKeys) {
      if (alias !== safe) createStemAlias(safe, alias);
    }
    return { status: 'ready', progress: 100, eta: '00:00', url: relativeUrl, cached: true };
  }

  // 2. Check if already active or queued
  for (const k of allKeys) {
    if (jobMap.has(k)) {
      const existing = jobMap.get(k);
      if (existing.status === 'processing') {
        return existing;
      }
      if (existing.status === 'queued') {
        // If prioritized, promote to front of queue
        if (isPriority) {
          const idx = isolationQueue.indexOf(existing);
          if (idx > 0) {
            isolationQueue.splice(idx, 1);
            isolationQueue.unshift(existing);
          }
        }
        return existing;
      }
      // If failed recently (< 15 seconds), don't immediately retry
      if (existing.status === 'failed' && (Date.now() - (existing.failedAt || 0) < 15000)) {
        return existing;
      }
    }
  }

  // 3. Register new job
  const job = {
    stemKey: safe,
    aliases: allKeys,
    inputSource,
    status: 'queued',
    progress: 5,
    eta: isWorkerRunning ? 'Queued behind active isolation...' : 'Preparing audio...',
    url: relativeUrl,
    error: null,
    startedAt: Date.now(),
    updatedAt: Date.now()
  };

  for (const k of allKeys) {
    jobMap.set(k, job);
  }

  if (isPriority) {
    isolationQueue.unshift(job);
  } else {
    isolationQueue.push(job);
  }

  // Trigger worker
  setImmediate(processQueue);

  return job;
}

function getJobInputSource(stemKey) {
  const safe = getSafeStemKey(stemKey);
  const job = jobMap.get(safe);
  if (job && job.inputSource && fs.existsSync(job.inputSource)) {
    return job.inputSource;
  }
  return null;
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
