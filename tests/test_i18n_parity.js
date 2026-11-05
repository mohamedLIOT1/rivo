/**
 * Comprehensive Bilingual Parity & i18n Enterprise Architecture Verification
 */

const fs = require('fs');
const path = require('path');

// Recursive key collector
function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (const k of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
      keys = keys.concat(getAllKeys(obj[k], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

async function runTests() {
  console.log('=== STARTING RIVO i18n & BILINGUAL PARITY VERIFICATION ===\n');

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ FAIL: ${testName} - ${details}`);
      failedTests++;
    }
  }

  // 1. Verify existence of modular translation files
  const domains = [
    'common',
    'nav',
    'settings',
    'player',
    'search',
    'library',
    'jam',
    'quran',
    'offline',
    'profile',
    'modals'
  ];

  const i18nDir = path.join(__dirname, '..', 'src', 'native', 'i18n');
  const enDir = path.join(i18nDir, 'translations', 'en');
  const arDir = path.join(i18nDir, 'translations', 'ar');

  assert(fs.existsSync(enDir), 'English translations directory exists');
  assert(fs.existsSync(arDir), 'Arabic translations directory exists');

  for (const domain of domains) {
    const enFile = path.join(enDir, `${domain}.js`);
    const arFile = path.join(arDir, `${domain}.js`);
    assert(fs.existsSync(enFile), `English [${domain}] file exists`);
    assert(fs.existsSync(arFile), `Arabic [${domain}] file exists`);
  }

  // 2. Load and verify key parity
  let allEnKeys = [];
  let allArKeys = [];

  for (const domain of domains) {
    // Dynamic import for ES modules
    const enMod = await import(`../src/native/i18n/translations/en/${domain}.js`);
    const arMod = await import(`../src/native/i18n/translations/ar/${domain}.js`);

    const enDict = enMod.default || enMod;
    const arDict = arMod.default || arMod;

    const enKeys = Object.keys(enDict);
    const arKeys = Object.keys(arDict);

    allEnKeys = allEnKeys.concat(enKeys.map(k => `${domain}.${k}`));
    allArKeys = allArKeys.concat(arKeys.map(k => `${domain}.${k}`));

    // Check missing in Arabic
    const missingInAr = enKeys.filter(k => !arDict.hasOwnProperty(k));
    assert(
      missingInAr.length === 0,
      `Domain [${domain}] 100% Arabic coverage`,
      `Missing in Arabic: ${missingInAr.join(', ')}`
    );

    // Check missing in English
    const missingInEn = arKeys.filter(k => !enDict.hasOwnProperty(k));
    assert(
      missingInEn.length === 0,
      `Domain [${domain}] 100% English coverage`,
      `Missing in English: ${missingInEn.join(', ')}`
    );

    // Verify non-empty strings
    for (const k of enKeys) {
      assert(typeof enDict[k] === 'string' && enDict[k].trim().length > 0, `[en.${domain}.${k}] is non-empty string`);
      assert(typeof arDict[k] === 'string' && arDict[k].trim().length > 0, `[ar.${domain}.${k}] is non-empty string`);
    }
  }

  console.log(`\nTotal verified bilingual keys: ${allEnKeys.length} keys in English, ${allArKeys.length} keys in Arabic.`);
  assert(allEnKeys.length === allArKeys.length, 'Total key counts match identically');

  // 3. Test core translation function & parameter interpolation
  const i18nIndex = await import(`../src/native/i18n/index.js`);
  const { translate, interpolate, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } = i18nIndex;

  assert(SUPPORTED_LANGUAGES.length === 2, 'Exactly 2 supported languages (ar, en)');
  assert(DEFAULT_LANGUAGE === 'en', 'Default language is en');

  // Test translation lookups
  assert(translate('en', 'common.ok') === 'OK', 'translate en common.ok');
  assert(translate('ar', 'common.ok') === 'حسناً', 'translate ar common.ok');

  assert(translate('en', 'nav.home') === 'Home', 'translate en nav.home');
  assert(translate('ar', 'nav.home') === 'الرئيسية', 'translate ar nav.home');

  // Test parameter interpolation
  const interpolatedEn = translate('en', 'player.upNext', { count: 5 });
  assert(interpolatedEn === 'UP NEXT (5)', `Parameter interpolation EN: ${interpolatedEn}`);

  const interpolatedAr = translate('ar', 'player.upNext', { count: 5 });
  assert(interpolatedAr === 'التالي في الانتظار (5)', `Parameter interpolation AR: ${interpolatedAr}`);

  // Test fallback on missing key
  const missingKeyRes = translate('ar', 'nonexistent.fakeKey');
  assert(missingKeyRes === 'nonexistent.fakeKey', 'Missing key gracefully returns keyPath string without crashing');

  // 4. Verify AGENTS.md 400-Line Limit on all i18n and newly created files
  const filesToCheck = [
    'src/native/i18n/en.js',
    'src/native/i18n/ar.js',
    'src/native/i18n/index.js',
    'src/native/context/LocalizationContext.js',
    'src/native/components/settings/LanguageSettingCard.js',
    ...domains.map(d => `src/native/i18n/translations/en/${d}.js`),
    ...domains.map(d => `src/native/i18n/translations/ar/${d}.js`),
  ];

  console.log('\n--- AGENTS.md File Size Verification (< 400 lines) ---');
  for (const relPath of filesToCheck) {
    const fullPath = path.join(__dirname, '..', relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    const lineCount = content.split('\n').length;
    assert(
      lineCount < 400,
      `File [${relPath}] has ${lineCount} lines (< 400 lines limit)`,
      `Exceeded limit: ${lineCount} lines`
    );
  }

  // 5. Verify Context provider memoization in LocalizationContext.js
  const locCtxContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'native', 'context', 'LocalizationContext.js'), 'utf8');
  assert(locCtxContent.includes('useMemo('), 'LocalizationContext memoizes value using useMemo()');
  assert(locCtxContent.includes('useCallback('), 'LocalizationContext memoizes setters using useCallback()');

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('======================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
