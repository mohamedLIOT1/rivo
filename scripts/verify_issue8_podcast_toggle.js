/**
 * Verification Script for Issue 8 (Requirement R9)
 * Web Content Preferences Podcast Toggle
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const babel = require('@babel/core');

const ROOT_DIR = path.resolve(__dirname, '..');

console.log('=== Verifying Issue 8 (Requirement R9) ===\n');

// 1. Verify ContentPreferencesCard.jsx
console.log('1. Checking ContentPreferencesCard.jsx...');
const cardPath = path.join(ROOT_DIR, 'src/components/settings/ContentPreferencesCard.jsx');
assert(fs.existsSync(cardPath), 'ContentPreferencesCard.jsx must exist');
const cardContent = fs.readFileSync(cardPath, 'utf8');

assert(cardContent.includes("import { Music, BookOpen, Podcast } from 'lucide-react';"), 'Must import Podcast from lucide-react');
assert(cardContent.includes('data-testid="toggle-podcasts"'), 'Must have data-testid="toggle-podcasts"');
assert(cardContent.includes("toggleContentMode('podcasts', contentModes.podcasts === false)"), 'Must toggle podcasts content mode');
assert(cardContent.includes('contentModes.podcasts !== false'), 'Must check contentModes.podcasts !== false');
assert(cardContent.includes("t('settings.podcasts')"), 'Must use localized podcasts title');
assert(cardContent.includes("t('settings.podcastsEnabledDesc')"), 'Must use localized podcastsEnabledDesc');
assert(cardContent.includes("t('settings.podcastsHiddenDesc')"), 'Must use localized podcastsHiddenDesc');
console.log('   ✓ ContentPreferencesCard contains Podcast import, toggle row, test-id, and correct handlers');

// 2. Verify ContentPreferencesModal.jsx
console.log('2. Checking ContentPreferencesModal.jsx...');
const modalPath = path.join(ROOT_DIR, 'src/components/ContentPreferencesModal.jsx');
assert(fs.existsSync(modalPath), 'ContentPreferencesModal.jsx must exist');
const modalContent = fs.readFileSync(modalPath, 'utf8');

assert(modalContent.includes('export { ContentPreferencesCard }'), 'Must re-export ContentPreferencesCard');
assert(modalContent.includes('export default function ContentPreferencesModal'), 'Must export ContentPreferencesModal as default');
assert(modalContent.includes('<ContentPreferencesCard'), 'Must render ContentPreferencesCard inside modal');
assert(modalContent.includes('onClose'), 'Must handle onClose');
assert(modalContent.includes('globalTheme'), 'Must support globalTheme');
console.log('   ✓ ContentPreferencesModal exists, re-exports ContentPreferencesCard, and renders properly');

// 3. Verify ScreenRouter.jsx
console.log('3. Checking ScreenRouter.jsx...');
const routerPath = path.join(ROOT_DIR, 'src/components/ScreenRouter.jsx');
assert(fs.existsSync(routerPath), 'ScreenRouter.jsx must exist');
const routerContent = fs.readFileSync(routerPath, 'utf8');

assert(routerContent.includes('showPodcasts'), 'Must destructure showPodcasts from usePreferences()');
assert(routerContent.includes("currentScreen === 'podcasts' && showPodcasts && ("), 'Must guard podcasts screen with showPodcasts');
assert(routerContent.includes("currentScreen === 'podcasts' && !showPodcasts"), 'Must check if currentScreen is podcasts when showPodcasts is false');
assert(routerContent.includes("goToScreen(showMusic ? 'home' : 'quran')"), 'Must redirect to home/quran when podcasts disabled');
console.log('   ✓ ScreenRouter guards podcasts route and redirects when showPodcasts is false');

// 4. Verify Localization
console.log('4. Checking localization dictionaries...');
const enPath = path.join(ROOT_DIR, 'src/native/i18n/translations/en/settings.js');
const arPath = path.join(ROOT_DIR, 'src/native/i18n/translations/ar/settings.js');
const enContent = fs.readFileSync(enPath, 'utf8');
const arContent = fs.readFileSync(arPath, 'utf8');

assert(enContent.includes("podcasts: 'Podcasts & Shows'"), 'en/settings.js must have podcasts');
assert(enContent.includes("podcastsEnabledDesc:"), 'en/settings.js must have podcastsEnabledDesc');
assert(enContent.includes("podcastsHiddenDesc:"), 'en/settings.js must have podcastsHiddenDesc');

assert(arContent.includes("podcasts: 'البودكاست والبرامج'"), 'ar/settings.js must have podcasts in Arabic');
assert(arContent.includes("podcastsEnabledDesc:"), 'ar/settings.js must have podcastsEnabledDesc in Arabic');
assert(arContent.includes("podcastsHiddenDesc:"), 'ar/settings.js must have podcastsHiddenDesc in Arabic');
console.log('   ✓ English and Arabic settings translations contain all podcast keys');

// 5. JSX and JS Syntax Verification
console.log('5. Validating syntax across all touched files...');
const filesToValidate = [
  cardPath,
  modalPath,
  routerPath
];

for (const f of filesToValidate) {
  const code = fs.readFileSync(f, 'utf8');
  babel.parseSync(code, {
    filename: f,
    presets: [require.resolve('@babel/preset-react')],
    configFile: false,
    babelrc: false
  });
  console.log(`   ✓ Syntax OK: ${path.relative(ROOT_DIR, f)}`);
}

console.log('\n=== All Issue 8 (Requirement R9) Verifications PASSED! ===');
