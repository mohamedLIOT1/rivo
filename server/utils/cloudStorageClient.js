const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TELEGRAM_MAX_BYTES = Math.floor(19.5 * 1024 * 1024); // Safe margin under 20MB getFile cap
const B2_AUTH_TTL_MS = 12 * 3600 * 1000;

let telegramRoundRobin = 0;
const botCooldownUntil = new Map();
const b2AuthCache = new Map();

function sleepWithAbort(ms, signal) {
  if (signal?.aborted) return Promise.reject(new Error('Aborted'));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Aborted'));
    };
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

function buildCombinedSignal(timeoutMs, parentSignal) {
  const controller = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(new Error('Timeout')), timeoutMs) : null;
  const onParentAbort = () => controller.abort(parentSignal.reason || new Error('Aborted'));
  if (parentSignal) {
    if (parentSignal.aborted) {
      if (timer) clearTimeout(timer);
      controller.abort(parentSignal.reason || new Error('Aborted'));
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  }
  const cleanup = () => {
    if (timer) clearTimeout(timer);
    if (parentSignal) parentSignal.removeEventListener('abort', onParentAbort);
  };
  return { signal: controller.signal, cleanup };
}

/**
 * Loads Telegram bot tokens from environment variables.
 */
function getTelegramBots() {
  const raw = process.env.TELEGRAM_BOT_TOKENS || '';
  const list = raw.split(',').map(s => s.trim()).filter(Boolean);
  for (let i = 1; i <= 10; i++) {
    const single = (process.env[`TELEGRAM_BOT_TOKEN_${i}`] || '').trim();
    if (single && !list.includes(single)) list.push(single);
  }
  return list;
}

function getTelegramChannelId(category = 'music') {
  if (category === 'quran' && process.env.TELEGRAM_QURAN_CHANNEL_ID) {
    return process.env.TELEGRAM_QURAN_CHANNEL_ID.trim();
  }
  if (category === 'podcast' && process.env.TELEGRAM_PODCAST_CHANNEL_ID) {
    return process.env.TELEGRAM_PODCAST_CHANNEL_ID.trim();
  }
  return (process.env.TELEGRAM_MUSIC_CHANNEL_ID || '').trim();
}

/**
 * Loads Backblaze B2 accounts dynamically by category (heavy_music, quran, podcast).
 */
function getB2Accounts() {
  if (process.env.B2_ACCOUNTS_JSON) {
    try {
      const parsed = JSON.parse(process.env.B2_ACCOUNTS_JSON);
      if (Array.isArray(parsed)) return parsed.filter(a => a && a.keyId && a.appKey && a.bucketName);
    } catch {}
  }

  const accounts = [];
  const specs = [
    { prefix: 'B2_HEAVY_MUSIC', category: 'heavy_music' },
    { prefix: 'B2_QURAN', category: 'quran' },
    { prefix: 'B2_PODCAST', category: 'podcast' }
  ];
  for (const spec of specs) {
    const keyId = (process.env[`${spec.prefix}_KEY_ID`] || '').trim();
    const appKey = (process.env[`${spec.prefix}_APP_KEY`] || '').trim();
    const bucketName = (process.env[`${spec.prefix}_BUCKET`] || '').trim();
    const bucketId = (process.env[`${spec.prefix}_BUCKET_ID`] || '').trim();
    if (keyId && appKey && bucketName) {
      accounts.push({ index: accounts.length, category: spec.category, keyId, appKey, bucketName, bucketId });
    }
  }
  return accounts;
}

function selectB2Account(category = 'heavy_music', preferredIndex = null) {
  const accounts = getB2Accounts();
  if (accounts.length === 0) return null;
  if (preferredIndex !== null && preferredIndex !== undefined && accounts[preferredIndex]) {
    return { ...accounts[preferredIndex], index: preferredIndex };
  }
  const matching = accounts
    .map((acc, idx) => ({ ...acc, index: idx }))
    .filter(acc => acc.category === category);
  if (matching.length > 0) return matching[0];
  return { ...accounts[0], index: 0 };
}

/**
 * Uploads an audio file (<= 19.5 MB) to Telegram private channel via round-robin bots.
 */
async function uploadAudioToTelegram(filePath, { title = 'Track', artist = 'Artist', duration = 0, category = 'music', signal } = {}) {
  const bots = getTelegramBots();
  const chatId = getTelegramChannelId(category);
  if (bots.length === 0 || !chatId) {
    throw new Error('Telegram bots or channel ID not configured');
  }

  const stats = fs.statSync(filePath);
  if (stats.size > TELEGRAM_MAX_BYTES) {
    throw new Error(`File size ${stats.size} exceeds Telegram 19.5MB limit`);
  }

  const ext = path.extname(filePath).toLowerCase() || '.m4a';
  const mimeType = ext === '.mp3' ? 'audio/mpeg' : 'audio/mp4';
  const fileBuffer = await fs.promises.readFile(filePath);
  const safeName = `${String(artist || 'Artist').slice(0, 40)} - ${String(title || 'Track').slice(0, 60)}${ext}`
    .replace(/[/\\?%*:|"<>]/g, '');

  const startOffset = telegramRoundRobin % bots.length;
  telegramRoundRobin = (telegramRoundRobin + 1) % bots.length;
  let lastErr = null;

  for (let attempt = 0; attempt < bots.length; attempt++) {
    if (signal?.aborted) throw new Error('Aborted');
    const botIndex = (startOffset + attempt) % bots.length;
    const cooldown = botCooldownUntil.get(botIndex) || 0;
    if (cooldown > Date.now()) continue;

    const token = bots[botIndex];
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('audio', new Blob([fileBuffer], { type: mimeType }), safeName);
    form.append('title', String(title || 'Track').slice(0, 120));
    form.append('performer', String(artist || 'Artist').slice(0, 120));
    if (duration > 0) form.append('duration', String(Math.round(duration)));
    form.append('caption', `${artist} - ${title}`.slice(0, 240));

    const { signal: reqSignal, cleanup } = buildCombinedSignal(120000, signal);
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendAudio`, {
        method: 'POST',
        body: form,
        signal: reqSignal
      });
      const data = await res.json();
      if (data.ok && data.result) {
        const media = data.result.audio || data.result.document || data.result.voice;
        if (!media?.file_id) throw new Error('Telegram upload succeeded without file_id');
        return {
          provider: 'telegram',
          botIndex,
          chatId: String(data.result.chat?.id || chatId),
          messageId: data.result.message_id,
          fileId: media.file_id,
          fileUniqueId: media.file_unique_id || '',
          fileSize: media.file_size || stats.size,
          ext: ext.replace('.', '')
        };
      }
      if (res.status === 429 && data.parameters?.retry_after) {
        botCooldownUntil.set(botIndex, Date.now() + (Number(data.parameters.retry_after) + 1) * 1000);
      }
      lastErr = new Error(data.description || `Telegram HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    } finally {
      cleanup();
    }
  }

  // All bots might be cooling down: wait briefly if shortest cooldown <= 15s
  const soonest = Math.min(...bots.map((_, idx) => botCooldownUntil.get(idx) || 0));
  const waitMs = soonest - Date.now();
  if (waitMs > 0 && waitMs <= 15000) {
    await sleepWithAbort(waitMs + 250, signal);
    return uploadAudioToTelegram(filePath, { title, artist, duration, category, signal });
  }
  throw lastErr || new Error('All Telegram bots failed upload');
}

/**
 * Resolves a fresh temporary download URL from Telegram Bot API getFile.
 */
async function fetchTelegramFileDownloadUrl(botIndex, fileId, signal) {
  const bots = getTelegramBots();
  const idx = Number.isInteger(botIndex) && bots[botIndex] ? botIndex : 0;
  const token = bots[idx];
  if (!token || !fileId) throw new Error('Missing Telegram bot token or fileId');

  const { signal: reqSignal, cleanup } = buildCombinedSignal(15000, signal);
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
      { signal: reqSignal }
    );
    const data = await res.json();
    if (!data.ok || !data.result?.file_path) {
      throw new Error(data.description || `Telegram getFile failed (${res.status})`);
    }
    return `https://api.telegram.org/file/bot${token}/${data.result.file_path}`;
  } finally {
    cleanup();
  }
}

/**
 * Authorizes a Backblaze B2 account and caches session credentials.
 */
async function authorizeB2(account, { forceRefresh = false, signal } = {}) {
  if (!account) throw new Error('No B2 account configured');
  const cached = b2AuthCache.get(account.keyId);
  if (!forceRefresh && cached && (Date.now() - cached.fetchedAt < B2_AUTH_TTL_MS)) {
    return cached;
  }

  const basic = Buffer.from(`${account.keyId}:${account.appKey}`).toString('base64');
  const { signal: reqSignal, cleanup } = buildCombinedSignal(15000, signal);
  try {
    const res = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      headers: { Authorization: `Basic ${basic}` },
      signal: reqSignal
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `B2 auth failed (${res.status})`);

    let bucketId = account.bucketId;
    if (!bucketId) {
      const bRes = await fetch(`${data.apiUrl}/b2api/v2/b2_list_buckets`, {
        method: 'POST',
        headers: { Authorization: data.authorizationToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: data.accountId, bucketName: account.bucketName }),
        signal: reqSignal
      });
      const bData = await bRes.json();
      const found = bData?.buckets?.find(b => b.bucketName === account.bucketName);
      if (!found) throw new Error(`B2 bucket ${account.bucketName} not found`);
      bucketId = found.bucketId;
    }

    const session = {
      accountId: data.accountId,
      authorizationToken: data.authorizationToken,
      apiUrl: data.apiUrl,
      downloadUrl: data.downloadUrl,
      bucketId,
      bucketName: account.bucketName,
      fetchedAt: Date.now()
    };
    b2AuthCache.set(account.keyId, session);
    return session;
  } finally {
    cleanup();
  }
}

async function computeFileSha1(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Uploads an audio file to Backblaze B2 private bucket.
 */
async function uploadAudioToB2(filePath, remoteFileName, { category = 'heavy_music', contentType = 'audio/mp4', signal } = {}) {
  const account = selectB2Account(category);
  if (!account) throw new Error(`No B2 account configured for ${category}`);

  const stats = fs.statSync(filePath);
  const sha1 = await computeFileSha1(filePath);
  const session = await authorizeB2(account, { signal });

  const { signal: urlSig, cleanup: cleanUrl } = buildCombinedSignal(15000, signal);
  let uploadTarget;
  try {
    const uRes = await fetch(`${session.apiUrl}/b2api/v2/b2_get_upload_url`, {
      method: 'POST',
      headers: { Authorization: session.authorizationToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucketId: session.bucketId }),
      signal: urlSig
    });
    uploadTarget = await uRes.json();
    if (!uRes.ok) throw new Error(uploadTarget.message || `b2_get_upload_url failed (${uRes.status})`);
  } finally {
    cleanUrl();
  }

  const bodyStream = fs.createReadStream(filePath);
  const { signal: upSig, cleanup: cleanUp } = buildCombinedSignal(600000, signal);
  try {
    const encodedName = remoteFileName.split('/').map(encodeURIComponent).join('/');
    const upRes = await fetch(uploadTarget.uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: uploadTarget.authorizationToken,
        'X-Bz-File-Name': encodedName,
        'Content-Type': contentType,
        'Content-Length': String(stats.size),
        'X-Bz-Content-Sha1': sha1
      },
      body: bodyStream,
      duplex: 'half',
      signal: upSig
    });
    const upData = await upRes.json();
    if (!upRes.ok) throw new Error(upData.message || `b2_upload_file failed (${upRes.status})`);

    const ext = path.extname(remoteFileName).replace('.', '').toLowerCase() || 'm4a';
    return {
      provider: 'b2',
      category,
      accountIndex: account.index,
      bucketId: session.bucketId,
      bucketName: session.bucketName,
      fileName: upData.fileName || remoteFileName,
      b2FileId: upData.fileId,
      fileSize: upData.contentLength || stats.size,
      ext
    };
  } finally {
    cleanUp();
  }
}

/**
 * Fetches an authenticated Backblaze B2 file download Response (supports Range header).
 */
async function fetchB2DownloadResponse(cloudStorage, rangeHeader, signal) {
  const account = selectB2Account(cloudStorage?.category || 'heavy_music', cloudStorage?.accountIndex);
  if (!account) throw new Error('No B2 account found for playback');

  const attemptFetch = async (forceRefresh) => {
    const session = await authorizeB2(account, { forceRefresh, signal });
    const bucket = cloudStorage.bucketName || session.bucketName;
    const encodedPath = String(cloudStorage.fileName || '').split('/').map(encodeURIComponent).join('/');
    const headers = { Authorization: session.authorizationToken };
    if (rangeHeader) headers.Range = rangeHeader;
    return fetch(`${session.downloadUrl}/file/${encodeURIComponent(bucket)}/${encodedPath}`, {
      headers,
      signal
    });
  };

  let res = await attemptFetch(false);
  if (res.status === 401) {
    res = await attemptFetch(true);
  }
  return res;
}

module.exports = {
  TELEGRAM_MAX_BYTES,
  getTelegramBots,
  getTelegramChannelId,
  getB2Accounts,
  selectB2Account,
  uploadAudioToTelegram,
  fetchTelegramFileDownloadUrl,
  authorizeB2,
  uploadAudioToB2,
  fetchB2DownloadResponse,
  buildCombinedSignal,
  sleepWithAbort
};
