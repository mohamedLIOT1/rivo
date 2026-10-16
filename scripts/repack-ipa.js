const fs = require('fs');
const cp = require('child_process');
const path = require('path');
const parser = require('bplist-parser');
const creator = require('bplist-creator');

async function repackIpa() {
  console.log('Extracting Payload from public/downloads/Rivo.ipa...');
  if (fs.existsSync('Payload')) {
    fs.rmSync('Payload', { recursive: true, force: true });
  }
  cp.execSync('tar -xf public/downloads/Rivo.ipa Payload');

  console.log('Replacing main.jsbundle...');
  fs.copyFileSync('main.jsbundle', 'Payload/Rivo.app/main.jsbundle');

  console.log('Updating Info.plist...');
  const [plistObj] = await parser.parseFile('Payload/Rivo.app/Info.plist');
  plistObj.CFBundleShortVersionString = '1.7.7';
  plistObj.CFBundleVersion = '46';
  const newPlistBuf = creator(plistObj);
  fs.writeFileSync('Payload/Rivo.app/Info.plist', newPlistBuf);

  console.log('Updating app.config...');
  const appConfigPath = 'Payload/Rivo.app/EXConstants.bundle/app.config';
  if (fs.existsSync(appConfigPath)) {
    const appConfig = JSON.parse(fs.readFileSync(appConfigPath, 'utf8'));
    appConfig.version = '1.7.7';
    if (appConfig.ios) {
      appConfig.ios.buildNumber = '46';
    }
    fs.writeFileSync(appConfigPath, JSON.stringify(appConfig));
  }

  console.log('Repacking into IPA zip archive...');
  if (fs.existsSync('public/downloads/Rivo-v1.7.7.ipa')) {
    fs.unlinkSync('public/downloads/Rivo-v1.7.7.ipa');
  }
  // Use tar -a to create zip
  cp.execSync('tar -a -cf public/downloads/Rivo-v1.7.7.ipa Payload');
  fs.copyFileSync('public/downloads/Rivo-v1.7.7.ipa', 'public/downloads/Rivo.ipa');
  if (fs.existsSync('dist/downloads')) {
    fs.copyFileSync('public/downloads/Rivo-v1.7.7.ipa', 'dist/downloads/Rivo-v1.7.7.ipa');
    fs.copyFileSync('public/downloads/Rivo-v1.7.7.ipa', 'dist/downloads/Rivo.ipa');
  }

  console.log('Cleaning temporary Payload...');
  fs.rmSync('Payload', { recursive: true, force: true });

  console.log('Verifying generated IPA...');
  const stat = fs.statSync('public/downloads/Rivo-v1.7.7.ipa');
  console.log(`Created public/downloads/Rivo-v1.7.7.ipa (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
}

repackIpa().catch(err => {
  console.error('Error repacking IPA:', err);
  process.exit(1);
});
