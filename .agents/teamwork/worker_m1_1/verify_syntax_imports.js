const fs = require('fs');
const path = require('path');
const babel = require('c:/Users/mohamed/Downloads/rivo-main/rivo-main/node_modules/@babel/core');

const rootDir = 'c:/Users/mohamed/Downloads/rivo-main/rivo-main';
const dirsToCheck = ['src', 'server'];
let totalChecked = 0;
let errors = [];

function checkFile(filePath) {
  totalChecked++;
  const content = fs.readFileSync(filePath, 'utf8');
  const dir = path.dirname(filePath);

  // 1. Check syntax with babel
  try {
    babel.parseSync(content, {
      filename: filePath,
      presets: [
        require.resolve('c:/Users/mohamed/Downloads/rivo-main/rivo-main/node_modules/@babel/preset-react')
      ],
      configFile: false,
      babelrc: false
    });
  } catch (e) {
    errors.push('SYNTAX ERROR in ' + path.relative(rootDir, filePath) + ': ' + e.message);
  }

  // 2. Check local relative imports/requires
  const importRegex = /(?:import\s+(?:[\s\S]*?from\s+)?['"](\.[^'"]+)['"]|require\(['"](\.[^'"]+)['"]\))/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1] || match[2];
    const resolvedBase = path.resolve(dir, importPath);
    const candidateExtensions = ['', '.js', '.jsx', '.json', '.ts', '.tsx', '/index.js', '/index.jsx'];
    const exists = candidateExtensions.some(ext => {
      try {
        return fs.existsSync(resolvedBase + ext) && fs.statSync(resolvedBase + ext).isFile();
      } catch (err) {
        return false;
      }
    });
    if (!exists) {
      errors.push('BROKEN IMPORT in ' + path.relative(rootDir, filePath) + ' -> ' + importPath);
    }
  }
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.artifacts') {
        walk(fullPath);
      }
    } else if (/\.(jsx?|tsx?)$/.test(entry.name)) {
      checkFile(fullPath);
    }
  }
}

// Also check App.js and index.js in root of rivo-main
checkFile(path.join(rootDir, 'App.js'));
checkFile(path.join(rootDir, 'index.js'));

for (const d of dirsToCheck) {
  walk(path.join(rootDir, d));
}

console.log('Checked files:', totalChecked);
if (errors.length > 0) {
  console.error('Found errors:', errors.length);
  errors.forEach(e => console.error(' -', e));
  process.exit(1);
} else {
  console.log('ALL SYNTAX AND LOCAL IMPORT CHECKS PASSED PERFECTLY!');
}
