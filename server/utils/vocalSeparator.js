const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const crypto = require('crypto');
const { uploadsDir } = require('../middleware/upload');

const stemsDir = path.join(uploadsDir, 'stems');
if (!fs.existsSync(stemsDir)) {
  try { fs.mkdirSync(stemsDir, { recursive: true }); } catch {}
}

const modelDir = process.env.AUDIO_SEPARATOR_MODEL_DIR || (process.platform === 'win32' ? 'C:/tmp/audio-separator-models' : '/tmp/audio-separator-models');

// Active in-flight processing jobs to prevent duplicate separation tasks
const activeJobs = new Map();

function getSafeStemKey(identifier) {
  if (!identifier || typeof identifier !== 'string') {
    return 'unknown_' + Date.now();
  }
  // If standard mongo ObjectId or alphanumeric videoId
  const clean = identifier.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  if (clean.length > 64) {
    return crypto.createHash('md5').update(clean).digest('hex');
  }
  return clean;
}

function getVocalStemPath(stemKey) {
  const safe = getSafeStemKey(stemKey);
  return path.join(stemsDir, `vocal_${safe}.mp3`);
}

function isVocalStemReady(stemKey) {
  const filePath = getVocalStemPath(stemKey);
  return fs.existsSync(filePath) && fs.statSync(filePath).size > 10000;
}

/**
 * Separate vocals using AI neural network and return the stem file path
 * @param {string} inputSource local file path or direct HTTP audio stream
 * @param {string} stemKey unique identifier for caching
 * @returns {Promise<string>} relative URL to stream (/uploads/stems/vocal_...mp3)
 */
async function processVocalIsolation(inputSource, stemKey) {
  const safe = getSafeStemKey(stemKey);
  const targetStemPath = getVocalStemPath(safe);
  const relativeUrl = `/uploads/stems/vocal_${safe}.mp3`;

  // 1. If already cached, return immediately
  if (isVocalStemReady(safe)) {
    return { url: relativeUrl, path: targetStemPath, cached: true };
  }

  // 2. If already processing, join the existing promise
  if (activeJobs.has(safe)) {
    return activeJobs.get(safe);
  }

  const jobPromise = (async () => {
    const tempDir = path.join(stemsDir, `tmp_${safe}_${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
      console.log(`[VocalSeparator] Extracting vocal-only stem for: ${safe}`);
      const vocalCmd = `ffmpeg -y -i "${inputSource}" -af "stereotools=mlev=1.6:slev=0.015625,highpass=f=180,lowpass=f=7500,agate=range=0.04:threshold=0.03:ratio=3:attack=10:release=100" -c:a libmp3lame -q:a 2 "${targetStemPath}"`;
      
      await new Promise((resolve, reject) => {
        exec(vocalCmd, { timeout: 45000 }, (err, stdout, stderr) => {
          if (err) {
            console.error('[VocalSeparator] Error executing vocal isolation:', stderr || err.message);
            return reject(new Error(`Vocal isolation failed: ${stderr || err.message}`));
          }
          resolve();
        });
      });

      if (!fs.existsSync(targetStemPath) || fs.statSync(targetStemPath).size < 1000) {
        throw new Error('Vocal stem output file is missing or invalid');
      }

      console.log(`[VocalSeparator] Successfully generated vocal stem: ${targetStemPath}`);
      return { url: relativeUrl, path: targetStemPath, cached: false };
    } finally {
      // Clean up temp directory
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch {}
      activeJobs.delete(safe);
    }
  })();

  activeJobs.set(safe, jobPromise);
  return jobPromise;
}

module.exports = {
  stemsDir,
  getSafeStemKey,
  getVocalStemPath,
  isVocalStemReady,
  processVocalIsolation
};
