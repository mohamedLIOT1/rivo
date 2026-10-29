/**
 * Rivo Audio Recognition Route (Song Radar)
 * Identifies songs via Acoustic Fingerprinting (Shazam protocol) and Gemini Audio (Humming / Singing)
 * Automatically matches results to playable Rivo tracks
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { optionalAuth } = require('../middleware/auth');
const { searchTracksInternal, isQuranContent } = require('../utils/helpers');
const { Track } = require('../models');

// Configure rate limiting for recognition to prevent abuse
const recognizeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30, // 30 recognitions per 5 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    success: false, 
    error: 'Too many recognition requests. Please wait a few minutes before trying again.' 
  }
});

// Configure multer memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024 // 12MB max for a 5-10s clip
  }
});

// Lazy-load Shazam engine
let ShazamClass = null;
try {
  ShazamClass = require('node-shazam').Shazam;
} catch (e) {
  console.warn('[SongRadar] node-shazam import failed:', e.message);
}

// Lazy-load FFmpeg
let Ffmpeg = null;
let ffmpegPath = null;
try {
  ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
  Ffmpeg = require('fluent-ffmpeg');
  if (ffmpegPath && Ffmpeg) {
    Ffmpeg.setFfmpegPath(ffmpegPath);
  }
} catch (e) {
  console.warn('[SongRadar] FFmpeg installer failed:', e.message);
}

// Lazy-load Gemini AI for humming / singing fallback
let GoogleGenerativeAI = null;
try {
  GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
} catch (e) {}

const genAI = (process.env.GEMINI_API_KEY && GoogleGenerativeAI) 
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) 
  : null;

function convertAudioToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    if (!Ffmpeg) return reject(new Error('FFmpeg is not available on this server'));
    Ffmpeg(inputPath)
      .toFormat('wav')
      .audioFrequency(16000)
      .audioChannels(1)
      .duration(12)
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}

async function recognizeWithGemini(audioBuffer, mimeType = 'audio/wav') {
  if (!genAI) return null;
  try {
    const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-1.5-flash'];
    let model = null;
    for (const m of candidateModels) {
      try {
        model = genAI.getGenerativeModel({ model: m });
        if (model) break;
      } catch {}
    }
    if (!model) return null;

    const prompt = `You are a professional music recognition system. Listen carefully to this audio recording.
The user is either playing a song, singing lyrics, or humming a melody.
Identify the exact song title and the artist/singer.
Respond ONLY with a JSON object in this exact format (no markdown, no backticks, just the json):
{"title": "Song Title", "artist": "Artist Name", "confidence": 0.88}
If the audio is completely unidentifiable, silence, or noise, return:
{"title": null, "artist": null, "confidence": 0}`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: audioBuffer.toString('base64'),
          mimeType: mimeType.includes('webm') ? 'audio/webm' : 'audio/wav'
        }
      }
    ]);

    const text = (result?.response?.text() || '').trim();
    const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (parsed && parsed.title && parsed.artist) {
      return {
        title: String(parsed.title).trim(),
        artist: String(parsed.artist).trim(),
        confidence: parsed.confidence || 0.85
      };
    }
  } catch (err) {
    console.warn('[SongRadar] Gemini recognition fallback error:', err.message);
  }
  return null;
}

/**
 * POST /api/recognize
 * Upload field: 'audio'
 */
router.post('/', recognizeLimiter, optionalAuth, upload.single('audio'), async (req, res) => {
  if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'No audio data was provided for recognition' 
    });
  }

  const uniqueId = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const tempInputPath = path.join(os.tmpdir(), `rivo_in_${uniqueId}.tmp`);
  const tempWavPath = path.join(os.tmpdir(), `rivo_proc_${uniqueId}.wav`);

  let identifiedTitle = null;
  let identifiedArtist = null;
  let identifiedCover = null;
  let identifiedAlbum = null;
  let recognitionSource = null;
  let confidence = 0.95;

  try {
    // 1. Write the raw upload buffer to a temporary file
    fs.writeFileSync(tempInputPath, req.file.buffer);

    // 2. Transcode to 16kHz mono WAV for high-accuracy acoustic analysis
    let audioToRecognize = tempInputPath;
    let wavConverted = false;
    try {
      await convertAudioToWav(tempInputPath, tempWavPath);
      audioToRecognize = tempWavPath;
      wavConverted = true;
    } catch (ffmpegErr) {
      console.warn('[SongRadar] FFmpeg conversion skipped or failed:', ffmpegErr.message);
    }

    // 3. Step 1: Acoustic Landmark Fingerprinting
    if (ShazamClass) {
      try {
        const shazam = new ShazamClass();
        const shazamResult = await shazam.recognise(audioToRecognize, 'en-US');

        if (shazamResult && shazamResult.track && shazamResult.track.title) {
          identifiedTitle = shazamResult.track.title;
          identifiedArtist = shazamResult.track.subtitle || '';
          identifiedCover = shazamResult.track.images?.coverarthq 
            || shazamResult.track.images?.coverart 
            || null;
          
          if (Array.isArray(shazamResult.track.sections)) {
            const songSec = shazamResult.track.sections.find(s => s.type === 'SONG');
            if (songSec && Array.isArray(songSec.metadata)) {
              const albumMeta = songSec.metadata.find(m => m.title === 'Album');
              if (albumMeta) identifiedAlbum = albumMeta.text;
            }
          }
          recognitionSource = 'acoustic_radar';
          confidence = 0.98;
        }
      } catch (shazamErr) {
        console.warn('[SongRadar] Acoustic fingerprinting match error:', shazamErr.message);
      }
    }

    // 4. Step 2: AI Voice/Melody & Lyrics analysis (Fallback for singing / humming)
    if (!identifiedTitle && genAI) {
      const bufferToSend = wavConverted && fs.existsSync(tempWavPath) 
        ? fs.readFileSync(tempWavPath) 
        : req.file.buffer;
      const mimeToSend = wavConverted ? 'audio/wav' : (req.file.mimetype || 'audio/webm');
      
      const aiResult = await recognizeWithGemini(bufferToSend, mimeToSend);
      if (aiResult && aiResult.title) {
        identifiedTitle = aiResult.title;
        identifiedArtist = aiResult.artist;
        recognitionSource = 'melody_humming_ai';
        confidence = aiResult.confidence || 0.86;
      }
    }

    // 5. If no match was found by any engine
    if (!identifiedTitle) {
      return res.json({
        success: true,
        matched: false,
        message: 'Could not identify track. Please try moving closer to the audio source or singing clearer.'
      });
    }

    // 6. Step 3: Match with Rivo's Database or Stream Resolver for immediate playback
    let playableTrack = null;
    const query = `${identifiedTitle} ${identifiedArtist}`.trim();

    try {
      // Check Rivo internal DB
      const dbMatch = await Track.findOne({
        $or: [
          { title: new RegExp(`^${identifiedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          { 
            title: new RegExp(identifiedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), 
            artist: new RegExp(identifiedArtist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') 
          }
        ]
      }).lean();

      if (dbMatch) {
        playableTrack = {
          id: String(dbMatch._id),
          _id: String(dbMatch._id),
          title: dbMatch.title,
          artist: dbMatch.artist,
          album: dbMatch.album || identifiedAlbum || 'Single',
          cover: dbMatch.cover || identifiedCover,
          audioUrl: dbMatch.audioUrl,
          duration: dbMatch.duration || 180,
          genre: dbMatch.genre || 'Music',
          source: dbMatch.source || 'Database',
          liked: false
        };
      } else {
        // Query Rivo's stream search engine (YouTube stream resolver)
        const onlineTracks = await searchTracksInternal(query);
        if (onlineTracks && onlineTracks.length > 0) {
          const topHit = onlineTracks[0];
          playableTrack = {
            ...topHit,
            title: identifiedTitle || topHit.title,
            artist: identifiedArtist || topHit.artist,
            cover: identifiedCover || topHit.cover,
            album: identifiedAlbum || topHit.album || 'Single'
          };
        }
      }
    } catch (matchErr) {
      console.warn('[SongRadar] Error resolving playable stream:', matchErr.message);
    }

    // If still no playable track, construct a ready-to-play placeholder
    if (!playableTrack) {
      playableTrack = {
        id: `radar-${Date.now()}`,
        title: identifiedTitle,
        artist: identifiedArtist || 'Unknown Artist',
        album: identifiedAlbum || 'Identified Track',
        cover: identifiedCover,
        audioUrl: '',
        duration: 210,
        source: 'SongRadar'
      };
    }

    return res.json({
      success: true,
      matched: true,
      title: identifiedTitle,
      artist: identifiedArtist,
      album: identifiedAlbum,
      cover: identifiedCover || playableTrack?.cover,
      confidence: confidence,
      source: recognitionSource,
      track: playableTrack
    });

  } catch (error) {
    console.error('[SongRadar] Unexpected error processing recognition:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred while analyzing the audio.'
    });
  } finally {
    // Clean up temporary files safely
    try {
      if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      if (fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);
    } catch {}
  }
});

module.exports = router;
