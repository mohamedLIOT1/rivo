const fs = require('fs');
const path = require('path');
const parser = require('c:/Users/mohamed/Downloads/rivo-main/rivo-main/node_modules/@babel/parser');

const base = 'c:/Users/mohamed/Downloads/rivo-main/rivo-main';
const jsxFiles = [
  'src/native/context/UserContext.js',
  'src/native/screens/LibraryScreen.js',
  'src/native/screens/OfflineScreen.js',
  'src/native/components/offline/OfflineHeroHeader.js',
  'src/native/components/offline/OfflineTrackItem.js',
  'src/native/screens/OfflineScreen.styles.js',
  'src/native/components/MiniMixerModal.js',
  'src/native/components/mixer/miniMixerStyles.js',
  'src/native/components/mixer/TouchSlider.js',
  'src/native/components/mixer/WaveformCueBox.js',
  'src/native/components/mixer/CrossfaderCurveGraph.js',
  'src/native/components/mixer/DeckCard.js',
  'src/native/components/mixer/TransitionStylePicker.js',
  'src/native/components/mixer/useMixerAudition.js'
];

let allPassed = true;

for (const rel of jsxFiles) {
  const fullPath = path.join(base, rel);
  try {
    const code = fs.readFileSync(fullPath, 'utf8');
    parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'flow', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator']
    });
    console.log(`[PASS] ${rel}`);
  } catch (err) {
    console.error(`[FAIL] ${rel}: ${err.message}`);
    allPassed = false;
  }
}

if (!allPassed) {
  process.exit(1);
} else {
  console.log('All JSX files parsed successfully with zero syntax errors.');
}
