const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '../../../rivo-main');

const files = [
  'server/routes/ai/recommendationService.js',
  'server/routes/ai.js',
  'src/native/context/UserContext.js',
  'src/native/screens/LibraryScreen.js',
  'src/screens/PlaylistScreen.jsx',
  'src/App.jsx',
  'src/native/context/audio/streamResolverHelper.js',
  'src/utils/quranUtils.js',
  'src/native/screens/OfflineScreen.js',
  'src/native/components/offline/OfflineHeroHeader.js',
  'src/native/components/offline/OfflineTrackItem.js',
  'src/native/screens/OfflineScreen.styles.js',
  'src/native/i18n/translations/en/offline.js',
  'src/native/i18n/translations/ar/offline.js',
  'src/native/i18n/translations/en/nav.js',
  'src/native/i18n/translations/ar/nav.js',
  'src/components/Navigation.jsx',
  'src/context/NavigationContext.jsx',
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
  'server/utils/audioCacheUtils.js',
  'server/utils/streamFallbackProvider.js',
  'server/routes/tracks.js',
  'server/utils/youtubeStreamResolver.js',
  'src/context/AudioContext.jsx',
  'src/utils/tasteAlgorithm.js',
  'src/native/utils/tasteAlgorithm.js',
  'server/utils/genreClassifier.js',
  'server/utils/genreRules/genreDefinitions.js',
  'server/utils/genreRules/textNormalizer.js',
  'src/utils/genreClassifier.js',
  'src/native/utils/genreClassifier.js',
  'server/routes/tracks/tracksImportRouter.js',
  'server/routes/tracks/tracksPersistenceRouter.js',
  'server/routes/tracks/tracksResolutionRouter.js',
  'src/components/settings/ContentPreferencesCard.jsx',
  'src/components/ContentPreferencesModal.jsx',
  'src/components/ScreenRouter.jsx',
  'src/native/i18n/translations/en/settings.js',
  'src/native/i18n/translations/ar/settings.js',
  'src/native/context/audio/audioApiHelpers.js',
  'src/screens/StatsScreen.jsx',
  'src/utils/listeningTracker.js',
  'server/routes/stats.js',
  'server/routes/users/listeningActivityService.js',
  'server/services/listeningActivityService.js'
];

let allPassed = true;
const results = [];

for (const rel of files) {
  const full = path.join(baseDir, rel);
  if (!fs.existsSync(full)) {
    results.push({ file: rel, status: 'MISSING', lines: 0 });
    allPassed = false;
    continue;
  }
  const content = fs.readFileSync(full, 'utf8');
  const lines = content.split('\n').length;
  // Note: AGENTS.md rule 1 applies to files exceeding 400 lines:
  // "Do NOT add new features directly into monolithic files (AudioContext, App.js, downloadManager, FullPlayerModal).
  // Any file exceeding 400 lines must be split into specialized custom hooks, utilities, or sub-components."
  const passed = lines <= 400;
  if (!passed) {
    allPassed = false;
  }
  results.push({ file: rel, status: passed ? 'PASS' : 'EXCEEDS_400', lines });
}

console.log(JSON.stringify(results, null, 2));
console.log('ALL PASSED <= 400:', allPassed);
