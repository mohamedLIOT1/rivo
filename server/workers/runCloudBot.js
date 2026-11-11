const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); dns.setServers(['8.8.8.8', '1.1.1.1']); } catch {}

const path = require('path');
try { require('dotenv').config({ path: path.join(__dirname, '../../.env') }); } catch {}
process.env.SKIP_STARTUP_USER_RESET = '1';

const mongoose = require('mongoose');
const { runMigrationLoop } = require('./cloudMigrationWorker');
const { getTelegramBots, getTelegramChannelId, getB2Accounts } = require('../utils/cloudStorageClient');

function parseArgs(argv) {
  const args = { limit: 0, watch: false, dryRun: false, trackId: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--watch' || a === '--loop') args.watch = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--limit' && argv[i + 1]) args.limit = Math.max(0, parseInt(argv[++i], 10) || 0);
    else if (a === '--track-id' && argv[i + 1]) args.trackId = argv[++i];
  }
  return args;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const bots = getTelegramBots();
  const channelId = getTelegramChannelId('music');
  const b2Accounts = getB2Accounts();

  console.log('====================================================');
  console.log('🤖 Rivo Cloud Media Migration Bot Starting');
  console.log(`   Phase: ${process.env.CLOUD_MIGRATION_PHASE || 'music'} | Mode: ${opts.watch ? 'WATCH' : 'BATCH'} | DryRun: ${opts.dryRun}`);
  console.log(`   Telegram Bots: ${bots.length} | Channel: ${channelId || 'MISSING'}`);
  console.log(`   Backblaze B2 Accounts: ${b2Accounts.length}`);
  console.log('====================================================');

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing');
  }
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }

  const controller = new AbortController();
  const shutdown = () => {
    console.log('\n🛑 Stopping Cloud Migration Bot gracefully...');
    controller.abort();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    const total = await runMigrationLoop({
      limit: opts.limit,
      watch: opts.watch,
      dryRun: opts.dryRun,
      trackId: opts.trackId,
      signal: controller.signal
    });
    console.log(`✅ Cloud Migration Bot finished. Processed: ${total}`);
  } finally {
    process.off('SIGINT', shutdown);
    process.off('SIGTERM', shutdown);
    await mongoose.disconnect().catch(() => {});
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ CloudBot fatal error:', err.message);
  process.exit(1);
});
