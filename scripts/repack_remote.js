const fs = require('fs');
const cp = require('child_process');
const parser = require('/home/ubuntu/rivo/server/node_modules/bplist-parser');
const creator = require('/home/ubuntu/rivo/server/node_modules/bplist-creator');

async function run() {
  const workDir = '/tmp/rivo_ipa_work';
  if (fs.existsSync(workDir)) fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  console.log('1. Unzipping original valid IPA...');
  cp.execSync('unzip -q /home/ubuntu/rivo/public/downloads/Rivo-v1.7.5.ipa -d ' + workDir);

  console.log('2. Injecting v1.7.7 main.jsbundle...');
  fs.copyFileSync('/home/ubuntu/rivo/main.jsbundle', workDir + '/Payload/Rivo.app/main.jsbundle');

  console.log('3. Updating Info.plist to 1.7.7 (Build 46)...');
  const plistPath = workDir + '/Payload/Rivo.app/Info.plist';
  const [plist] = await parser.parseFile(plistPath);
  plist.CFBundleShortVersionString = '1.7.7';
  plist.CFBundleVersion = '46';
  fs.writeFileSync(plistPath, creator(plist));

  console.log('4. Updating app.config...');
  const cfgPath = workDir + '/Payload/Rivo.app/EXConstants.bundle/app.config';
  if (fs.existsSync(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    cfg.version = '1.7.7';
    if (cfg.ios) cfg.ios.buildNumber = '46';
    fs.writeFileSync(cfgPath, JSON.stringify(cfg));
  }

  console.log('5. Compressing into proper Apple ZIP format...');
  const outIpa = '/home/ubuntu/rivo/public/downloads/Rivo-v1.7.7.ipa';
  if (fs.existsSync(outIpa)) fs.unlinkSync(outIpa);
  cp.execSync('cd ' + workDir + ' && zip -qr ' + outIpa + ' Payload');
  fs.copyFileSync(outIpa, '/home/ubuntu/rivo/public/downloads/Rivo.ipa');

  console.log('6. Cleaning up...');
  fs.rmSync(workDir, { recursive: true, force: true });

  console.log('7. Verification:');
  console.log(cp.execSync('file ' + outIpa).toString());
  console.log(cp.execSync('unzip -t ' + outIpa + ' | tail -n 2').toString());
}

run().catch(e => { console.error(e); process.exit(1); });
