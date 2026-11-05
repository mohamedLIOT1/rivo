#!/usr/bin/env node
/**
 * Rivo Database Migration & Batch Enrichment Script
 *
 * Problem: Historic tracks were automatically assigned 'Pop' or 'Imported' by default,
 * leaving library tracks without authentic genre classification.
 *
 * This script batch-evaluates and reclassifies existing tracks using the intelligent
 * Rules-Based Genre Classifier (Egyptian Rap, Shaabi/Mahraganat, Indie, Tarab, Arabic Pop, Quran, etc.)
 *
 * Usage:
 *   node scripts/migrateTrackGenres.js [--dry-run] [--force] [--batch-size=200]
 */

const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Track } = require('../server/models');
const { classifyGenre } = require('../server/utils/genreClassifier');

const isDryRun = process.argv.includes('--dry-run');
const isForce = process.argv.includes('--force');
const batchSizeArg = process.argv.find(a => a.startsWith('--batch-size='));
const BATCH_SIZE = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 200;

const GENERIC_SET = new Set(['pop', 'imported', 'other', 'unknown', 'stereo', 'music', 'single', '']);

async function runMigration() {
  const startTime = Date.now();
  console.log('='.repeat(65));
  console.log(`[Rivo Genre Migration] Starting ${isDryRun ? '(DRY RUN - No writes)' : '(LIVE UPDATE)'}`);
  console.log(`Mode: ${isForce ? 'FORCE (Re-classify all tracks)' : 'TARGETED (Only Pop, Imported, or Empty)'}`);
  console.log(`Batch Size: ${BATCH_SIZE}`);
  console.log('='.repeat(65));

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/rivo';
  console.log(`Connecting to database...`);
  
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('MongoDB connected successfully.\n');
  } catch (connErr) {
    console.error('Failed to connect to MongoDB:', connErr.message);
    console.log('Please ensure MONGO_URI in .env is configured and reachable.');
    process.exit(1);
  }

  try {
    // Construct query filter
    const query = isForce
      ? {}
      : {
          $or: [
            { genre: { $exists: false } },
            { genre: null },
            { genre: '' },
            { genre: { $regex: /^(pop|imported|other|unknown|stereo|music|single)$/i } }
          ]
        };

    const totalTracks = await Track.countDocuments(query);
    console.log(`Found ${totalTracks} tracks matching migration criteria.`);

    if (totalTracks === 0) {
      console.log('No tracks require genre reclassification. Database is up-to-date!');
      await mongoose.disconnect();
      return;
    }

    let processed = 0;
    let updated = 0;
    let unchanged = 0;
    const genreDistribution = {};

    let cursor = Track.find(query).cursor({ batchSize: BATCH_SIZE });

    const bulkOps = [];

    for await (const track of cursor) {
      processed++;
      const oldGenre = track.genre || '(empty)';
      const classification = classifyGenre({
        title: track.title,
        artist: track.artist,
        album: track.album,
        genre: isForce ? '' : track.genre
      });

      const newGenre = classification.genre;
      const newIsQuran = Boolean(track.isQuran || classification.isQuran);

      genreDistribution[newGenre] = (genreDistribution[newGenre] || 0) + 1;

      const genreChanged = newGenre.toLowerCase() !== String(oldGenre).toLowerCase();
      const quranChanged = Boolean(track.isQuran) !== newIsQuran;

      if (genreChanged || quranChanged) {
        updated++;
        if (processed <= 25 || updated % 50 === 0) {
          console.log(
            `[UPDATE] "${track.title}" - "${track.artist}" | [${oldGenre}] -> [${newGenre}]${newIsQuran ? ' (Quran)' : ''} [${classification.matchedBy}]`
          );
        }

        if (!isDryRun) {
          bulkOps.push({
            updateOne: {
              filter: { _id: track._id },
              update: {
                $set: {
                  genre: newGenre,
                  isQuran: newIsQuran,
                  ...(newIsQuran ? { contentType: 'quran' } : {})
                }
              }
            }
          });
        }
      } else {
        unchanged++;
      }

      // Execute in chunks
      if (!isDryRun && bulkOps.length >= BATCH_SIZE) {
        await Track.bulkWrite(bulkOps, { ordered: false });
        bulkOps.length = 0;
        process.stdout.write(`Processed ${processed}/${totalTracks} tracks (${updated} reclassified)...\r`);
      }
    }

    // Flush remaining operations
    if (!isDryRun && bulkOps.length > 0) {
      await Track.bulkWrite(bulkOps, { ordered: false });
      bulkOps.length = 0;
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(65));
    console.log('[Rivo Genre Migration] COMPLETE!');
    console.log(`Total Tracks Processed: ${processed}`);
    console.log(`Total Tracks Reclassified: ${updated}`);
    console.log(`Unchanged: ${unchanged}`);
    console.log(`Time Elapsed: ${durationSec}s`);
    console.log('-'.repeat(65));
    console.log('Reclassified Genre Distribution:');
    for (const [g, count] of Object.entries(genreDistribution).sort((a, b) => b[1] - a[1])) {
      console.log(`  - ${g.padEnd(25)} : ${count}`);
    }
    console.log('='.repeat(65));

  } catch (err) {
    console.error('\nMigration encountered an error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed.');
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
