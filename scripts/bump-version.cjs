const fs = require('fs');
const pkgPath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = '2.4.0';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('package.json version bumped to:', pkg.version);
