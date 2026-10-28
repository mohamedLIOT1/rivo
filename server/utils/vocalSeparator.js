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

    let inputAudioPath = inputSource;
    let tempWavAudio = path.join(tempDir, 'clean_input.wav');

    try {
      // 1. Convert any input (local .m4a, .mp3, or remote stream) into clean standard 16-bit PCM WAV.
      // This is crucial because libsndfile/librosa on Linux cannot decode m4a/aac natively without WAV conversion.
      console.log(`[VocalSeparator] Pre-processing input audio with ffmpeg to standard WAV for: ${safe}`);
      await new Promise((resolve, reject) => {
        const convertCmd = `ffmpeg -y -i "${inputSource}" -vn -ar 44100 -ac 2 -c:a pcm_s16le "${tempWavAudio}"`;
        exec(convertCmd, { timeout: 180000 }, (err, stdout, stderr) => {
          if (err) return reject(new Error(`Failed to decode audio into WAV for stem separation: ${stderr || err.message}`));
          resolve();
        });
      });

      if (!fs.existsSync(tempWavAudio) || fs.statSync(tempWavAudio).size < 1000) {
        throw new Error('Converted WAV audio file is empty or missing');
      }

      // 2. Execute AI vocal separation using Kim_Vocal_2 model
      // Using --mdx_batch_size 1 and conservative overlap to keep memory low and prevent swap thrashing on CPU
      const cmd = `audio-separator "${tempWavAudio}" --model_filename Kim_Vocal_2.onnx --single_stem Vocals --output_dir "${tempDir}" --output_format MP3 --mdx_batch_size 1 --mdx_overlap 0.2 --model_file_dir "${modelDir}"`;

      console.log(`[VocalSeparator] Starting AI vocal separation for: ${safe}`);
      await new Promise((resolve, reject) => {
        exec(cmd, { timeout: 1800000 }, (err, stdout, stderr) => {
          if (err) {
            console.error('[VocalSeparator] Error executing audio-separator:', stderr || err.message);
            return reject(err);
          }
          resolve(stdout);
        });
      });

      // Find the generated output file
      const files = fs.readdirSync(tempDir);
      const vocalFile = files.find(f => f.toLowerCase().includes('vocals') && f.toLowerCase().endsWith('.mp3'));

      if (!vocalFile) {
        throw new Error('Audio separator finished but vocal stem output file was not found');
      }

      const generatedPath = path.join(tempDir, vocalFile);

      // Move to permanent stems directory
      fs.copyFileSync(generatedPath, targetStemPath);

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
