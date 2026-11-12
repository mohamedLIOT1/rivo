/**
 * Vocal Stem Key Resolution & Path Utilities
 * Strictly modularized (< 400 lines).
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { uploadsDir } = require('../middleware/upload');

const stemsDir = path.join(uploadsDir, 'stems');
if (!fs.existsSync(stemsDir)) {
  try { fs.mkdirSync(stemsDir, { recursive: true }); } catch {}
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

function getInstrumentalStemPath(stemKey) {
  const safe = getSafeStemKey(stemKey);
  return path.join(stemsDir, `inst_${safe}.mp3`);
}

function isInstrumentalStemReady(stemKey) {
  const filePath = getInstrumentalStemPath(stemKey);
  return fs.existsSync(filePath) && fs.statSync(filePath).size > 10000;
}

function createStemAlias(primaryKey, aliasKey) {
  if (!primaryKey || !aliasKey || primaryKey === aliasKey) return;
  const primaryVocal = getVocalStemPath(primaryKey);
  const aliasVocal = getVocalStemPath(aliasKey);
  if (fs.existsSync(primaryVocal) && !fs.existsSync(aliasVocal)) {
    try {
      fs.linkSync(primaryVocal, aliasVocal);
    } catch {
      try { fs.copyFileSync(primaryVocal, aliasVocal); } catch {}
    }
  }

  const primaryInst = getInstrumentalStemPath(primaryKey);
  const aliasInst = getInstrumentalStemPath(aliasKey);
  if (fs.existsSync(primaryInst) && !fs.existsSync(aliasInst)) {
    try {
      fs.linkSync(primaryInst, aliasInst);
    } catch {
      try { fs.copyFileSync(primaryInst, aliasInst); } catch {}
    }
  }
}

module.exports = {
  stemsDir,
  getSafeStemKey,
  resolveCanonicalStemKey,
  getVocalStemPath,
  isVocalStemReady,
  getInstrumentalStemPath,
  isInstrumentalStemReady,
  createStemAlias
};
