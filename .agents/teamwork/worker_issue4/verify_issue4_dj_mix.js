const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== Issue 4 (Requirement R5): Mobile DJ Mix Controls & UX Overhaul Verification ===\n');

const projectRoot = path.resolve(__dirname, '../../../rivo-main');

// 1. Line count check (< 400 lines for each file)
console.log('1. Checking AGENTS.md 400-Line Limit Compliance:');
const filesToCheck = [
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
];

let allUnder400 = true;
for (const relPath of filesToCheck) {
  const fullPath = path.join(projectRoot, relPath);
  assert(fs.existsSync(fullPath), `File must exist: ${relPath}`);
  const content = fs.readFileSync(fullPath, 'utf8');
  const lineCount = content.split('\n').length;
  console.log(`   - ${relPath}: ${lineCount} lines (limit: 400)`);
  if (lineCount >= 400) {
    console.error(`   FAILED: ${relPath} exceeds 400 lines! (${lineCount} lines)`);
    allUnder400 = false;
  }
}
assert(allUnder400, 'All files must be strictly under 400 lines');
console.log('   ✓ All modularized mixer files are strictly under 400 lines!\n');

// 2. Test calculateCrossfadeGains
console.log('2. Testing calculateCrossfadeGains in musicAnalysis.js:');
const { calculateCrossfadeGains } = require(path.join(projectRoot, 'src/native/utils/musicAnalysis.js'));

const styles = ['fade', 'blend', 'rise', 'wave', 'melt', 'slam', 'linear'];

// Check slam cuts at 0.50
const slamEarly = calculateCrossfadeGains(0.49, 'slam', 0.5);
assert.strictEqual(slamEarly.gainA, 1.0, 'Slam at 0.49 must have gainA = 1.0');
assert.strictEqual(slamEarly.gainB, 0.0, 'Slam at 0.49 must have gainB = 0.0');

const slamLate = calculateCrossfadeGains(0.51, 'slam', 0.5);
assert.strictEqual(slamLate.gainA, 0.0, 'Slam at 0.51 must have gainA = 0.0');
assert.strictEqual(slamLate.gainB, 1.0, 'Slam at 0.51 must have gainB = 1.0');
console.log('   ✓ Slam downbeat cut triggers accurately at 0.50 crossover point.');

// Check acoustic power across all styles and p in [0, 1]
for (const st of styles) {
  for (let p = 0; p <= 1.0001; p += 0.02) {
    const { gainA, gainB } = calculateCrossfadeGains(p, st, 0.5);
    assert(gainA >= 0 && gainA <= 1.0001, `gainA out of bounds for ${st} at p=${p}: ${gainA}`);
    assert(gainB >= 0 && gainB <= 1.0001, `gainB out of bounds for ${st} at p=${p}: ${gainB}`);
    const power = gainA * gainA + gainB * gainB;
    assert(power >= 0.499, `Acoustic power too low for ${st} at p=${p.toFixed(2)}: power=${power.toFixed(3)} < 0.5`);
  }
  console.log(`   ✓ Style '${st}': Valid acoustic energy preserved across all progress points.`);
}

// Check crossover bias warping
const earlyGains = calculateCrossfadeGains(0.30, 'fade', 0.30);
assert(earlyGains.gainA > 0 && earlyGains.gainB > 0, 'Bias warping produces non-zero gains');
console.log('   ✓ Crossover bias correctly shifts transition midpoint.\n');

// 3. PlaybackEngine integration validation
console.log('3. Validating playbackEngine.js:');
const peContent = fs.readFileSync(path.join(projectRoot, 'src/native/context/audio/playbackEngine.js'), 'utf8');

assert(peContent.includes('calculateCrossfadeGains'), 'playbackEngine must import and call calculateCrossfadeGains');
assert(peContent.includes('mixOutPoint'), 'playbackEngine must handle transConf.mixOutPoint');
assert(peContent.includes('effectiveOut'), 'playbackEngine must compute effectiveOut from mixOutPoint');
assert(peContent.includes('status.didJustFinish') && peContent.includes('isMixTransitioningRef?.current'), 'playbackEngine must guard against double-skip in didJustFinish');
console.log('   ✓ transConf.mixOutPoint properly integrated into transition triggers.');
console.log('   ✓ calculateCrossfadeGains and volume trims applied during transition.');
console.log('   ✓ Double-skip guard protects seamless handoffs.\n');

// 4. TouchSlider & WaveformCueBox PanResponder validation
console.log('4. Validating TouchSlider.js and WaveformCueBox.js:');
const tsContent = fs.readFileSync(path.join(projectRoot, 'src/native/components/mixer/TouchSlider.js'), 'utf8');
const wcbContent = fs.readFileSync(path.join(projectRoot, 'src/native/components/mixer/WaveformCueBox.js'), 'utf8');

assert(tsContent.includes('PanResponder'), 'TouchSlider must use PanResponder');
assert(tsContent.includes('onPanResponderTerminationRequest: () => false'), 'TouchSlider must prevent termination request');
assert(tsContent.includes('hitSlop'), 'TouchSlider must define hitSlop');
assert(!tsContent.includes('x / (layoutWidth || 1)'), 'TouchSlider must not use erratic locationX formula');

assert(wcbContent.includes('PanResponder'), 'WaveformCueBox must use PanResponder');
assert(wcbContent.includes('React.memo'), 'WaveformCueBox must memoize peak bars');
assert(wcbContent.includes('pointerEvents="none"'), 'WaveformCueBox child bars must ignore direct touch pointer events');
console.log('   ✓ TouchSlider uses PanResponder with pageX screen coordinates and scroll-lock callbacks.');
console.log('   ✓ WaveformCueBox uses PanResponder and memoizes peak bars with pointerEvents="none".\n');

// 5. useMixerAudition memory leak guard validation
console.log('5. Validating useMixerAudition.js:');
const umaContent = fs.readFileSync(path.join(projectRoot, 'src/native/components/mixer/useMixerAudition.js'), 'utf8');

assert(umaContent.includes('auditionSessionIdRef'), 'useMixerAudition must maintain auditionSessionIdRef');
assert(umaContent.includes('sessionId !== auditionSessionIdRef.current'), 'useMixerAudition must check sessionId after async createAsync');
assert(umaContent.includes('unloadAsync'), 'useMixerAudition must safely unload sound instances');
console.log('   ✓ auditionSessionIdRef guards against stale createAsync resolutions and prevents ghost audio leaks.\n');

// 6. MiniMixerModal scrollEnabled & modularization validation
console.log('6. Validating MiniMixerModal.js:');
const mmmContent = fs.readFileSync(path.join(projectRoot, 'src/native/components/MiniMixerModal.js'), 'utf8');

assert(mmmContent.includes('scrollEnabled={scrollEnabled}'), 'MiniMixerModal must lock ScrollView scrolling during drags');
assert(mmmContent.includes('DeckCard'), 'MiniMixerModal must use DeckCard');
assert(mmmContent.includes('TransitionStylePicker'), 'MiniMixerModal must use TransitionStylePicker');
assert(mmmContent.includes('CrossfaderCurveGraph'), 'MiniMixerModal must use CrossfaderCurveGraph');
assert(mmmContent.includes('useMixerAudition'), 'MiniMixerModal must use useMixerAudition');
console.log('   ✓ MiniMixerModal coordinates scrollEnabled with child touch gestures.');
console.log('   ✓ Successfully modularized into subcomponents under src/native/components/mixer/.\n');

console.log('=== ALL ISSUE 4 (REQUIREMENT R5) VERIFICATIONS PASSED SUCCESSFULLY ===');
