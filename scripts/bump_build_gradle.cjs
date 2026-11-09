const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '../android/app/build.gradle');
let content = fs.readFileSync(p, 'utf8');
content = content.replace('versionCode 132', 'versionCode 133').replace('versionName "2.4.1"', 'versionName "2.4.2"');
fs.writeFileSync(p, content, 'utf8');
console.log('build.gradle successfully updated to 133 / 2.4.2');
