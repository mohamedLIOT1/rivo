const path = require('path');
const fs = require('fs');
const multer = require('multer');

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_AUDIO_EXTS = ['.mp3', '.m4a', '.wav', '.ogg', '.flac', '.aac'];
const ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.jfif', '.avif', '.gif', '.bmp', '.heic', '.heif'];
const FORBIDDEN_EXTS = [
  '.html', '.htm', '.xhtml', '.svg', '.xml', '.js', '.mjs', '.cjs',
  '.exe', '.sh', '.bat', '.cmd', '.ps1', '.vbs', '.php', '.phtml',
  '.py', '.pl', '.rb', '.jar', '.apk', '.com', '.scr', '.msi', '.dll'
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  // 1. Strict Forbidden Blacklist
  if (FORBIDDEN_EXTS.includes(ext) || mime.includes('svg') || mime.includes('html') || mime.includes('xml') || mime.includes('javascript') || mime.includes('x-executable')) {
    return cb(new Error('File type is disallowed for security reasons'), false);
  }

  // 2. Audio upload field
  if (file.fieldname === 'audio') {
    if (ALLOWED_AUDIO_EXTS.includes(ext) && (mime.startsWith('audio/') || mime === 'application/octet-stream')) {
      return cb(null, true);
    }
    return cb(new Error('Invalid audio file type. Allowed: MP3, M4A, WAV, OGG, FLAC, AAC'), false);
  }

  // 3. Cover image upload field
  if (file.fieldname === 'cover') {
    if (ALLOWED_IMAGE_EXTS.includes(ext) && mime.startsWith('image/')) {
      return cb(null, true);
    }
    return cb(new Error('Invalid image file type. Allowed: JPG, PNG, WEBP, JFIF, AVIF, GIF, BMP, HEIC'), false);
  }

  return cb(new Error('Unexpected file upload field'), false);
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    let ext = path.extname(file.originalname).toLowerCase();
    if (!ext && file.mimetype) {
      if (file.mimetype.includes('jpeg') || file.mimetype.includes('jpg')) ext = '.jpg';
      else if (file.mimetype.includes('png')) ext = '.png';
      else if (file.mimetype.includes('webp')) ext = '.webp';
      else ext = '.png';
    }
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'file';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${baseName}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter
});

/**
 * Middleware: Verify Magic Bytes of uploaded audio files to prevent file spoofing.
 */
const verifyUploadedAudioMagicBytes = async (req, res, next) => {
  const audioFile = req.file || (req.files && req.files.audio && req.files.audio[0]);
  if (!audioFile) return next();

  try {
    const filePath = audioFile.path;
    const fd = await fs.promises.open(filePath, 'r');
    const buffer = Buffer.alloc(32);
    await fd.read(buffer, 0, 32, 0);
    await fd.close();

    // Check magic bytes:
    // MP3 with ID3: 0x49 0x44 0x33 ("ID3")
    // MP3 sync frame: 0xFF 0xFB, 0xFF 0xF3, 0xFF 0xF2
    // WAV: "RIFF" .... "WAVE"
    // FLAC: "fLaC"
    // OGG: "OggS"
    // M4A/AAC: "ftyp" at offset 4
    const isId3 = buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33;
    const isMp3Sync = buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0;
    const isWav = buffer.toString('utf8', 0, 4) === 'RIFF' && buffer.toString('utf8', 8, 12) === 'WAVE';
    const isFlac = buffer.toString('utf8', 0, 4) === 'fLaC';
    const isOgg = buffer.toString('utf8', 0, 4) === 'OggS';
    const isM4a = buffer.toString('utf8', 4, 8) === 'ftyp';

    const isValidAudio = isId3 || isMp3Sync || isWav || isFlac || isOgg || isM4a;
    if (!isValidAudio) {
      await fs.promises.unlink(filePath).catch(() => {});
      return res.status(400).json({ error: 'Uploaded file failed binary verification. Not a valid audio stream.' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Audio verification error' });
  }

  next();
};

module.exports = {
  upload,
  uploadsDir,
  fileFilter,
  ALLOWED_AUDIO_EXTS,
  ALLOWED_IMAGE_EXTS,
  FORBIDDEN_EXTS,
  verifyUploadedAudioMagicBytes
};
