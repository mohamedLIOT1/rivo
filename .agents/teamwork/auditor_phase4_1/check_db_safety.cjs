const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rivoDir = path.resolve(__dirname, '../../../rivo-main');

console.log('=== Checking for remote database strings or connection mutations ===');

// Check git diff for mongodb, mongoose, connect, uri
const diff = execSync('git diff -S"mongodb" -S"mongoose.connect" -S"MONGODB_URI" --name-only', { cwd: rivoDir, encoding: 'utf8' });
console.log('Files with db connection diffs:', diff.trim() || 'None');

// Check all .env files or connection strings in server/
const serverDir = path.join(rivoDir, 'server');
function scanDir(dir) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') files = files.concat(scanDir(full));
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.json') || entry.name.startsWith('.env')) {
      files.push(full);
    }
  }
  return files;
}

const serverFiles = scanDir(serverDir);
const suspicious = [];
for (const f of serverFiles) {
  const content = fs.readFileSync(f, 'utf8');
  if (content.includes('mongodb+srv://') || content.includes('.mongodb.net')) {
    suspicious.push({ file: path.relative(rivoDir, f), match: 'remote mongodb atlas URI' });
  }
}

console.log('Remote DB references found in server:', suspicious);
