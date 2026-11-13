const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../../rivo-main');

const forbiddenNames = ['.log', 'result', 'output', 'attestation'];

function scan(dir) {
  let found = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (['node_modules', '.git', 'dist', 'build', '.gradle', 'target'].includes(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        found = found.concat(scan(full));
      } else {
        const lower = ent.name.toLowerCase();
        if (forbiddenNames.some(p => lower.includes(p))) {
          found.push({
            path: path.relative(rootDir, full),
            size: fs.statSync(full).size,
            mtime: fs.statSync(full).mtime
          });
        }
      }
    }
  } catch (err) {}
  return found;
}

const artifacts = scan(rootDir);
console.log('Artifacts found in rivo-main:');
console.log(JSON.stringify(artifacts, null, 2));
