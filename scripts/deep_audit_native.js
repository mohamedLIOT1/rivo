const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default || require('@babel/traverse');

const ROOT_DIR = path.resolve(__dirname, '..');
const NATIVE_DIR = path.join(ROOT_DIR, 'src', 'native');
const APP_JS = path.join(ROOT_DIR, 'App.js');

const STANDARD_GLOBALS = new Set([
  'Object', 'Function', 'Array', 'Number', 'parseFloat', 'parseInt', 'Boolean', 'String',
  'Symbol', 'Date', 'Promise', 'RegExp', 'Error', 'EvalError', 'RangeError', 'ReferenceError',
  'SyntaxError', 'TypeError', 'URIError', 'JSON', 'Math', 'Intl', 'ArrayBuffer', 'Uint8Array',
  'Int8Array', 'Uint16Array', 'Int16Array', 'Uint32Array', 'Int32Array', 'Float32Array',
  'Float64Array', 'Uint8ClampedArray', 'BigInt64Array', 'BigUint64Array', 'DataView',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Proxy', 'Reflect', 'BigInt', 'isNaN', 'isFinite',
  'encodeURI', 'encodeURIComponent', 'decodeURI', 'decodeURIComponent', 'escape', 'unescape',
  'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate',
  'clearImmediate', 'requestAnimationFrame', 'cancelAnimationFrame', 'fetch', 'Headers',
  'Request', 'Response', 'FormData', 'Blob', 'File', 'FileReader', 'URL', 'URLSearchParams',
  'AbortController', 'AbortSignal', 'window', 'global', 'globalThis', 'self', 'document',
  'navigator', 'location', '__DEV__', 'process', 'require', 'module', 'exports',
  'alert', 'prompt', 'confirm', 'atob', 'btoa', 'performance', 'Event', 'CustomEvent',
  'WebSocket', 'EventSource', 'undefined', 'NaN', 'Infinity'
]);

function getAllJsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === 'node_modules' || file === 'dist' || file === 'build' || file === '.git') continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getAllJsFiles(fullPath));
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

const allFiles = getAllJsFiles(NATIVE_DIR);
if (fs.existsSync(APP_JS)) {
  allFiles.push(APP_JS);
}

console.log(`Found ${allFiles.length} files to scan in src/native/ and App.js`);

const fileExportsCache = new Map();

function parseAst(filePath, code) {
  return parser.parse(code, {
    sourceType: 'module',
    plugins: [
      'jsx',
      'classProperties',
      'objectRestSpread',
      'optionalChaining',
      'nullishCoalescingOperator',
      'dynamicImport',
      'exportDefaultFrom',
      'exportNamespaceFrom'
    ]
  });
}

function getExports(filePath) {
  if (fileExportsCache.has(filePath)) {
    return fileExportsCache.get(filePath);
  }
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const code = fs.readFileSync(filePath, 'utf8');
  let ast;
  try {
    ast = parseAst(filePath, code);
  } catch (err) {
    return { hasDefault: true, named: new Set(), parseError: err.message };
  }

  const named = new Set();
  let hasDefault = false;
  let hasStarExport = false;
  let isCommonJS = false;

  traverse(ast, {
    ExportNamedDeclaration(path) {
      if (path.node.declaration) {
        if (path.node.declaration.declarations) {
          path.node.declaration.declarations.forEach(d => {
            if (d.id && d.id.name) named.add(d.id.name);
          });
        } else if (path.node.declaration.id && path.node.declaration.id.name) {
          named.add(path.node.declaration.id.name);
        }
      }
      if (path.node.specifiers) {
        path.node.specifiers.forEach(s => {
          if (s.exported && s.exported.name) {
            named.add(s.exported.name);
          }
        });
      }
    },
    ExportDefaultDeclaration() {
      hasDefault = true;
    },
    ExportAllDeclaration() {
      hasStarExport = true;
    },
    AssignmentExpression(path) {
      const left = path.node.left;
      if (left.type === 'MemberExpression') {
        if (left.object.name === 'module' && left.property.name === 'exports') {
          isCommonJS = true;
        } else if (left.object.name === 'exports') {
          isCommonJS = true;
          if (left.property.name) named.add(left.property.name);
        }
      }
    }
  });

  const res = { hasDefault, named, hasStarExport, isCommonJS };
  fileExportsCache.set(filePath, res);
  return res;
}

const auditReport = {
  undeclaredVars: [],
  brokenImports: [],
  contextMemoizationIssues: [],
  fileLineLimitIssues: []
};

for (const filePath of allFiles) {
  const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
  const code = fs.readFileSync(filePath, 'utf8');
  const lines = code.split('\n');

  // Check file size limit
  if (lines.length > 400) {
    auditReport.fileLineLimitIssues.push({
      file: relPath,
      lines: lines.length
    });
  }

  let ast;
  try {
    ast = parseAst(filePath, code);
  } catch (e) {
    console.error(`PARSE ERROR in ${relPath}: ${e.message}`);
    continue;
  }

  // 1. Check Undeclared Variables
  const undeclaredInFile = new Map();

  traverse(ast, {
    ReferencedIdentifier(idPath) {
      const name = idPath.node.name;
      if (STANDARD_GLOBALS.has(name)) return;
      // Also ignore special Flow/TypeScript or JSX names if any
      if (name === 'React') return;

      const binding = idPath.scope.getBinding(name);
      if (!binding) {
        // Double check if defined in global scope or standard globals
        // Check if it's an undeclared reference
        const line = idPath.node.loc ? idPath.node.loc.start.line : 0;
        const col = idPath.node.loc ? idPath.node.loc.start.column : 0;
        
        if (!undeclaredInFile.has(name)) {
          undeclaredInFile.set(name, []);
        }
        undeclaredInFile.get(name).push({ line, col });
      }
    },

    // 2. Check Context Provider memoization
    JSXElement(jsxPath) {
      const opening = jsxPath.node.openingElement;
      let name = '';
      if (opening.name.type === 'JSXMemberExpression') {
        name = `${opening.name.object.name}.${opening.name.property.name}`;
      } else if (opening.name.type === 'JSXIdentifier') {
        name = opening.name.name;
      }

      if (name.endsWith('Context.Provider') || name.endsWith('Provider')) {
        const valAttr = opening.attributes.find(a => a.type === 'JSXAttribute' && a.name.name === 'value');
        if (valAttr && valAttr.value && valAttr.value.type === 'JSXExpressionContainer') {
          const expr = valAttr.value.expression;
          if (expr.type === 'ObjectExpression') {
            const line = opening.loc ? opening.loc.start.line : 0;
            auditReport.contextMemoizationIssues.push({
              file: relPath,
              line,
              component: name,
              issue: 'Provider value is an unmemoized inline object literal'
            });
          }
        }
      }
    },

    // 3. Check Imports
    ImportDeclaration(impPath) {
      const source = impPath.node.source.value;
      if (source.startsWith('.')) {
        // Relative import
        const targetDir = path.dirname(filePath);
        let resolvedPath = path.resolve(targetDir, source);
        let resolvedFile = null;

        const candidates = [
          resolvedPath,
          resolvedPath + '.js',
          resolvedPath + '.jsx',
          path.join(resolvedPath, 'index.js'),
          path.join(resolvedPath, 'index.jsx')
        ];

        for (const c of candidates) {
          if (fs.existsSync(c) && !fs.statSync(c).isDirectory()) {
            resolvedFile = c;
            break;
          }
        }

        const line = impPath.node.loc ? impPath.node.loc.start.line : 0;

        if (!resolvedFile) {
          auditReport.brokenImports.push({
            file: relPath,
            line,
            source,
            issue: 'File does not exist'
          });
        } else {
          // Check imported specifiers
          const targetExports = getExports(resolvedFile);
          if (targetExports && !targetExports.hasStarExport && !targetExports.isCommonJS) {
            for (const spec of impPath.node.specifiers) {
              if (spec.type === 'ImportDefaultSpecifier') {
                if (!targetExports.hasDefault && targetExports.named.size > 0) {
                  auditReport.brokenImports.push({
                    file: relPath,
                    line,
                    source,
                    imported: 'default',
                    issue: `Default export not found in ${path.relative(ROOT_DIR, resolvedFile).replace(/\\/g, '/')}`
                  });
                }
              } else if (spec.type === 'ImportSpecifier') {
                const importedName = spec.imported.name;
                if (!targetExports.named.has(importedName) && !targetExports.hasStarExport) {
                  auditReport.brokenImports.push({
                    file: relPath,
                    line,
                    source,
                    imported: importedName,
                    issue: `Export '${importedName}' not found in ${path.relative(ROOT_DIR, resolvedFile).replace(/\\/g, '/')}`
                  });
                }
              }
            }
          }
        }
      }
    }
  });

  if (undeclaredInFile.size > 0) {
    for (const [name, occurrences] of undeclaredInFile.entries()) {
      auditReport.undeclaredVars.push({
        file: relPath,
        identifier: name,
        occurrences: occurrences.map(o => `L${o.line}:C${o.col}`)
      });
    }
  }
}

console.log('=== AUDIT RESULTS SUMMARY ===');
console.log(`Undeclared Variables: ${auditReport.undeclaredVars.length}`);
console.log(`Broken Imports: ${auditReport.brokenImports.length}`);
console.log(`Context Memoization Issues: ${auditReport.contextMemoizationIssues.length}`);
console.log(`Files > 400 lines: ${auditReport.fileLineLimitIssues.length}`);

fs.writeFileSync(
  path.join(ROOT_DIR, 'scripts', 'deep_audit_report.json'),
  JSON.stringify(auditReport, null, 2)
);
console.log('Report written to scripts/deep_audit_report.json');
