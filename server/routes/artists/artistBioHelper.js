const { Artist } = require('../../models');
const { escapeRegex } = require('../../utils/helpers');
const { genAI } = require('../ai/aiHelpers');

const pendingBioGenerations = new Map();

/**
 * Automatically generate and save an authentic, engaging artist bio via Gemini AI.
 * Handles deduplication for in-flight requests, automated model fallback on spikes/503s,
 * and caches to MongoDB Artist collection.
 */
async function autoGenerateAndSaveArtistBio(artistName, genres = [], isQuran = false) {
  if (!artistName || typeof artistName !== 'string') return '';
  const cleanName = artistName.trim();
  if (!cleanName) return '';
  const normKey = cleanName.toLowerCase();

  if (pendingBioGenerations.has(normKey)) {
    return pendingBioGenerations.get(normKey);
  }

  const bioPromise = (async () => {
    try {
      if (!process.env.GEMINI_API_KEY || !genAI) {
        return '';
      }

      let prompt = '';
      if (isQuran) {
        prompt = `Write an authentic, reverent, and concise biography for the Islamic Quran reciter and Sheikh "${cleanName}".
Highlight their recitation style, background, and spiritual legacy.
Keep it 2-3 sentences, engaging, and dignified. Write in English. Return only the biography text without markdown code blocks.`;
      } else {
        const genreStr = Array.isArray(genres) && genres.length ? ` who creates ${genres.slice(0, 3).join(', ')} music` : '';
        prompt = `Write an authentic, engaging, and professional music artist biography for "${cleanName}"${genreStr}.
Highlight their signature sound, cultural impact, or notable musical elements.
Keep it 2-3 sentences, engaging, and suitable for a modern music streaming platform. Write in English. Return only the biography text without quotes or markdown code blocks.`;
      }

      const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.7-flash', 'gemini-3.8-flash'];
      let generatedBio = '';

      for (const modelName of candidateModels) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent(prompt);
          const text = result?.response?.text()?.trim() || '';
          if (text && text.length > 20) {
            generatedBio = text.replace(/^```[a-z]*\s*|\s*```$/gi, '').trim();
            break;
          }
        } catch (mErr) {
          console.warn(`[Auto Artist Bio] Model ${modelName} failed (${mErr.message}), trying next candidate...`);
        }
      }

      if (generatedBio && generatedBio.length > 20) {
        const artistId = cleanName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        await Artist.findOneAndUpdate(
          { name: { $regex: new RegExp(`^${escapeRegex(cleanName)}$`, 'i') } },
          {
            $set: {
              id: artistId,
              name: cleanName,
              bio: generatedBio,
              updatedBy: 'gemini-ai'
            },
            $setOnInsert: {
              genres: Array.isArray(genres) ? genres : []
            }
          },
          { upsert: true, new: true }
        );
        return generatedBio;
      }
    } catch (err) {
      console.warn(`[Auto Artist Bio] Generation error for "${cleanName}":`, err.message);
    } finally {
      pendingBioGenerations.delete(normKey);
    }
    return '';
  })();

  pendingBioGenerations.set(normKey, bioPromise);
  return bioPromise;
}

module.exports = {
  autoGenerateAndSaveArtistBio
};
