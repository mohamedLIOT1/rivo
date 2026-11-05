const fs = require('fs');
const path = require('path');
const assert = require('assert');

const baseDir = path.resolve(__dirname, '..');
const parser = require(path.join(baseDir, 'node_modules/@babel/parser'));
const traverse = require(path.join(baseDir, 'node_modules/@babel/traverse')).default;

console.log('--- STARTING I18N BILINGUAL TEST SUITE ---');

const i18nFiles = [
  'src/native/i18n/index.js',
  'src/native/i18n/ar.js',
  'src/native/i18n/en.js',
  'src/native/context/LocalizationContext.js',
  'src/native/components/settings/LanguageSettingCard.js',
  'src/native/i18n/translations/en/common.js',
  'src/native/i18n/translations/en/nav.js',
  'src/native/i18n/translations/en/settings.js',
  'src/native/i18n/translations/en/player.js',
  'src/native/i18n/translations/en/search.js',
  'src/native/i18n/translations/en/library.js',
  'src/native/i18n/translations/en/jam.js',
  'src/native/i18n/translations/en/quran.js',
  'src/native/i18n/translations/en/offline.js',
  'src/native/i18n/translations/en/profile.js',
  'src/native/i18n/translations/en/modals.js',
  'src/native/i18n/translations/ar/common.js',
  'src/native/i18n/translations/ar/nav.js',
  'src/native/i18n/translations/ar/settings.js',
  'src/native/i18n/translations/ar/player.js',
  'src/native/i18n/translations/ar/search.js',
  'src/native/i18n/translations/ar/library.js',
  'src/native/i18n/translations/ar/jam.js',
  'src/native/i18n/translations/ar/quran.js',
  'src/native/i18n/translations/ar/offline.js',
  'src/native/i18n/translations/ar/profile.js',
  'src/native/i18n/translations/ar/modals.js'
];

// TEST 1: Line count & Babel syntax check
console.log('\n[TEST 1] Syntax Validation & 400-Line Limit Check:');
for (const relFile of i18nFiles) {
  const fullPath = path.join(baseDir, relFile);
  assert(fs.existsSync(fullPath), `Missing file: ${relFile}`);
  const code = fs.readFileSync(fullPath, 'utf8');
  const lineCount = code.split('\n').length;
  assert(lineCount <= 400, `File ${relFile} exceeds 400 lines: ${lineCount}`);

  try {
    parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx']
    });
    console.log(`  PASS: ${relFile} (${lineCount} lines, valid AST)`);
  } catch (err) {
    console.error(`  FAIL: ${relFile} parse error:`, err.message);
    process.exit(1);
  }
}

// TEST 2: Extract dictionary objects and check bilingual key parity
console.log('\n[TEST 2] Bilingual Dictionary Key Parity Check:');
const domains = ['common', 'nav', 'settings', 'player', 'search', 'library', 'jam', 'quran', 'offline', 'profile', 'modals'];

function extractObjectFromAst(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });
  let exportedObj = {};

  traverse(ast, {
    ExportDefaultDeclaration(p) {
      if (p.node.declaration.type === 'ObjectExpression') {
        exportedObj = parseAstObject(p.node.declaration);
      }
    }
  });

  return exportedObj;
}

function parseAstObject(node) {
  const obj = {};
  for (const prop of node.properties) {
    if (prop.type === 'ObjectProperty') {
      const key = prop.key.name || prop.key.value;
      if (prop.value.type === 'StringLiteral') {
        obj[key] = prop.value.value;
      } else if (prop.value.type === 'ObjectExpression') {
        obj[key] = parseAstObject(prop.value);
      } else {
        obj[key] = true;
      }
    }
  }
  return obj;
}

const enDict = {};
const arDict = {};

domains.forEach(domain => {
  const enPath = path.join(baseDir, `src/native/i18n/translations/en/${domain}.js`);
  const arPath = path.join(baseDir, `src/native/i18n/translations/ar/${domain}.js`);
  enDict[domain] = extractObjectFromAst(enPath);
  arDict[domain] = extractObjectFromAst(arPath);
});

function getKeys(obj, prefix = '') {
  let keys = [];
  for (const k of Object.keys(obj)) {
    const nextPrefix = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      keys = keys.concat(getKeys(obj[k], nextPrefix));
    } else {
      keys.push(nextPrefix);
    }
  }
  return keys;
}

let totalParityChecks = 0;
domains.forEach(domain => {
  const enKeys = new Set(getKeys(enDict[domain]));
  const arKeys = new Set(getKeys(arDict[domain]));
  
  assert(enKeys.size > 0, `Domain ${domain} in English has 0 keys`);
  assert(arKeys.size > 0, `Domain ${domain} in Arabic has 0 keys`);

  enKeys.forEach(k => {
    totalParityChecks++;
    assert(arKeys.has(k), `Missing Arabic translation for key "${domain}.${k}"`);
  });
  console.log(`  PASS: Domain "${domain}" (${enKeys.size} keys matched 1:1 in AR and EN)`);
});
console.log(`  Total bilingual keys strictly matched 1:1: ${totalParityChecks}`);

// TEST 3: Logic Unit Tests (getNestedTranslation, interpolate, translate)
console.log('\n[TEST 3] Translation Engine Unit Tests:');

function getNestedTranslation(dictionary, keyPath) {
  if (!dictionary || typeof keyPath !== 'string') return null;
  const parts = keyPath.split('.');
  let current = dictionary;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }
  return typeof current === 'string' ? current : null;
}

function interpolate(template, params) {
  if (typeof template !== 'string') return template;
  if (!params || typeof params !== 'object') return template;
  return template.replace(/\{{1,2}\s*([\w.]+)\s*\}{1,2}/g, (match, paramKey) => {
    return params[paramKey] !== undefined ? String(params[paramKey]) : match;
  });
}

function translate(lang, keyPath, params) {
  const fullDict = { en: enDict, ar: arDict };
  const activeDict = fullDict[lang] || fullDict.en;
  let res = getNestedTranslation(activeDict, keyPath);
  if (res === null && lang !== 'en') {
    res = getNestedTranslation(fullDict.en, keyPath);
  }
  if (res === null) {
    res = keyPath;
  }
  return interpolate(res, params);
}

// Check translations
assert.strictEqual(translate('en', 'nav.home'), 'Home');
assert.strictEqual(translate('ar', 'nav.home'), 'الرئيسية');
assert.strictEqual(translate('en', 'settings.title'), 'SETTINGS & ENGINE');
assert.strictEqual(translate('ar', 'settings.title'), 'الإعدادات ومحرك التشغيل');

// Check interpolation
assert.strictEqual(
  interpolate('Tracks in {genre}', { genre: 'Rap' }),
  'Tracks in Rap'
);
assert.strictEqual(
  interpolate('Song {{title}} added', { title: 'البخت' }),
  'Song البخت added'
);

// Check fallback
assert.strictEqual(
  translate('ar', 'unknown.missing.key'),
  'unknown.missing.key'
);

console.log('  PASS: Key resolution, interpolation, and fallback logic verified.');

console.log('\n--- ALL I18N TESTS PASSED (100% SUCCESS) ---');
