const fs = require('fs');
const path = require('path');

const base = 'c:/Users/mohamed/Downloads/rivo-main/rivo-main';
const files = [
  'src/native/context/UserContext.js',
  'src/native/screens/LibraryScreen.js',
  'src/native/context/audio/streamResolverHelper.js',
  'src/native/screens/OfflineScreen.js',
  'src/native/components/offline/OfflineHeroHeader.js',
  'src/native/components/offline/OfflineTrackItem.js',
  'src/native/screens/OfflineScreen.styles.js',
  'src/native/i18n/translations/en/offline.js',
  'src/native/i18n/translations/ar/offline.js',
  'src/utils/quranUtils.js',
  'src/native/components/MiniMixerModal.js',
  'src/native/components/mixer/miniMixerStyles.js',
  'src/native/components/mixer/TouchSlider.js',
  'src/native/components/mixer/WaveformCueBox.js',
  'src/native/components/mixer/CrossfaderCurveGraph.js',
  'src/native/components/mixer/DeckCard.js',
  'src/native/components/mixer/TransitionStylePicker.js',
  'src/native/components/mixer/useMixerAudition.js',
  'src/native/context/audio/playbackEngine.js',
  'src/native/utils/musicAnalysis.js',
  'src/native/utils/tasteAlgorithm.js',
  'src/native/utils/genreClassifier.js',
  'src/native/context/audio/audioApiHelpers.js'
];

console.log('--- LINE COUNTS & EXISTENCE ---');
let allUnder400 = true;
for (const rel of files) {
  const p = path.join(base, rel);
  if (!fs.existsSync(p)) {
    console.error('MISSING:', rel);
    allUnder400 = false;
    continue;
  }
  const lines = fs.readFileSync(p, 'utf8').split('\n').length;
  const status = lines <= 400 ? 'OK' : 'EXCEEDED';
  if (lines > 400) allUnder400 = false;
  console.log(`[${status}] ${rel}: ${lines} lines`);
}
console.log('All files <= 400 lines:', allUnder400);
