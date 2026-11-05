const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default || require('@babel/traverse');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');

const SCAN_DIRS = [
  path.join(ROOT_DIR, 'src'),
  path.join(ROOT_DIR, 'server'),
  path.join(ROOT_DIR, 'scripts')
];
const APP_JS = path.join(ROOT_DIR, 'App.js');

const IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  '.gradle',
  'android',
  'ios',
  '__pycache__',
  'coverage',
  '.artifacts'
]);

function getAllJsFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (IGNORE_DIRS.has(file)) continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getAllJsFiles(fullPath));
    } else if (/\.(js|jsx|mjs|cjs)$/.test(file)) {
      results.push(fullPath);
    }
  }
  return results;
}

let allFiles = [];
for (const dir of SCAN_DIRS) {
  allFiles = allFiles.concat(getAllJsFiles(dir));
}
if (fs.existsSync(APP_JS)) {
  allFiles.push(APP_JS);
}

// Remove duplicates
allFiles = Array.from(new Set(allFiles));

console.log(`[Supervisor Audit] Discovered ${allFiles.length} JS/JSX files to inspect.`);

// 1. Git status check: Get list of newly created / untracked files
let gitStatusOutput = '';
try {
  gitStatusOutput = execSync('git status --porcelain', { cwd: ROOT_DIR, encoding: 'utf8' });
} catch (e) {
  console.warn('[Supervisor Audit] Warning: Unable to run git status');
}

const newlyCreatedFiles = new Set();
const modifiedFiles = new Set();

gitStatusOutput.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed) return;
  const status = trimmed.substring(0, 2);
  const filePath = path.resolve(ROOT_DIR, trimmed.substring(3).trim());
  if (status.includes('?') || status.includes('A')) {
    newlyCreatedFiles.add(filePath);
  } else if (status.includes('M')) {
    modifiedFiles.add(filePath);
  }
});

const report = {
  timestamp: new Date().toISOString(),
  totalFilesScanned: allFiles.length,
  syntaxErrors: [],
  brokenImports: [],
  contextMemoizationIssues: [],
  newLineLimitViolations: [],
  audioProgressIsolationPassed: true,
  audioProgressChecks: []
};

// Babel parse helper
function parseCode(filePath, code) {
  return parser.parse(code, {
    sourceType: 'module',
    allowImportExportEverywhere: true,
    allowReturnOutsideFunction: true,
    plugins: [
      'jsx',
      'classProperties',
      'classPrivateProperties',
      'classPrivateMethods',
      'objectRestSpread',
      'optionalChaining',
      'nullishCoalescingOperator',
      'dynamicImport',
      'exportDefaultFrom',
      'exportNamespaceFrom',
      'topLevelAwait'
    ]
  });
}

// File exports cache
const exportsCache = new Map();
function getExports(targetFile) {
  if (exportsCache.has(targetFile)) return exportsCache.get(targetFile);
  if (!fs.existsSync(targetFile)) return null;
  const content = fs.readFileSync(targetFile, 'utf8');
  let ast;
  try {
    ast = parseCode(targetFile, content);
  } catch (err) {
    return { hasDefault: true, named: new Set(), error: err.message };
  }
  const named = new Set();
  let hasDefault = false;
  let hasStarExport = false;
  let isCommonJS = false;

  traverse(ast, {
    ExportNamedDeclaration(p) {
      if (p.node.declaration) {
        if (p.node.declaration.declarations) {
          p.node.declaration.declarations.forEach(d => {
            if (d.id && d.id.name) named.add(d.id.name);
          });
        } else if (p.node.declaration.id && p.node.declaration.id.name) {
          named.add(p.node.declaration.id.name);
        }
      }
      if (p.node.specifiers) {
        p.node.specifiers.forEach(s => {
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
    AssignmentExpression(p) {
      const left = p.node.left;
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
  exportsCache.set(targetFile, res);
  return res;
}

// Audit files
for (const file of allFiles) {
  const relPath = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const code = fs.readFileSync(file, 'utf8');
  const lineCount = code.split('\n').length;

  // Check 400-line limit for newly created files
  if (newlyCreatedFiles.has(file)) {
    if (lineCount > 400) {
      report.newLineLimitViolations.push({
        file: relPath,
        lines: lineCount,
        rule: 'Newly created file exceeds 400 lines limit mandated in AGENTS.md'
      });
    }
  }

  // Syntax and AST check
  let ast;
  try {
    ast = parseCode(file, code);
  } catch (err) {
    report.syntaxErrors.push({
      file: relPath,
      line: err.loc ? err.loc.line : 0,
      column: err.loc ? err.loc.column : 0,
      error: err.message
    });
    continue;
  }

  // AST traverse
  traverse(ast, {
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
          if (expr.type === 'ObjectExpression' || expr.type === 'ArrayExpression') {
            const line = opening.loc ? opening.loc.start.line : 0;
            report.contextMemoizationIssues.push({
              file: relPath,
              line,
              component: name,
              issue: `Provider value uses unmemoized inline ${expr.type}`
            });
          }
        }
      }
    },

    // 3. Check Imports
    ImportDeclaration(impPath) {
      const source = impPath.node.source.value;
      if (source.startsWith('.')) {
        const targetDir = path.dirname(file);
        let resolvedPath = path.resolve(targetDir, source);
        let resolvedFile = null;

        const candidates = [
          resolvedPath,
          resolvedPath + '.js',
          resolvedPath + '.jsx',
          resolvedPath + '.json',
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
          report.brokenImports.push({
            file: relPath,
            line,
            source,
            issue: 'Referenced file does not exist'
          });
        } else if (/\.(js|jsx)$/.test(resolvedFile)) {
          const targetExports = getExports(resolvedFile);
          if (targetExports && !targetExports.hasStarExport && !targetExports.isCommonJS) {
            for (const spec of impPath.node.specifiers) {
              if (spec.type === 'ImportDefaultSpecifier') {
                if (!targetExports.hasDefault && targetExports.named.size > 0) {
                  report.brokenImports.push({
                    file: relPath,
                    line,
                    source,
                    imported: 'default',
                    issue: `Default import not exported by target (available: ${Array.from(targetExports.named).join(', ')})`
                  });
                }
              } else if (spec.type === 'ImportSpecifier') {
                const importedName = spec.imported.name;
                if (!targetExports.named.has(importedName) && !targetExports.hasDefault) {
                  report.brokenImports.push({
                    file: relPath,
                    line,
                    source,
                    imported: importedName,
                    issue: `Named export "${importedName}" not found in target`
                  });
                }
              }
            }
          }
        }
      }
    }
  });
}

// 4. Verify AudioProgressContext isolation
const audioProgressContextPath = path.join(ROOT_DIR, 'src', 'native', 'context', 'AudioProgressContext.js');
if (fs.existsSync(audioProgressContextPath)) {
  const content = fs.readFileSync(audioProgressContextPath, 'utf8');
  const hasProgress = content.includes('progress') || content.includes('currentTime') || content.includes('position');
  report.audioProgressChecks.push({
    file: 'src/native/context/AudioProgressContext.js',
    exists: true,
    hasProgressHandling: hasProgress
  });
} else {
  report.audioProgressIsolationPassed = false;
  report.audioProgressChecks.push({
    file: 'src/native/context/AudioProgressContext.js',
    exists: false,
    issue: 'AudioProgressContext.js does not exist'
  });
}

console.log('=== SUPERVISOR AUDIT RESULTS ===');
console.log(`Total Files Checked: ${report.totalFilesScanned}`);
console.log(`Syntax Errors: ${report.syntaxErrors.length}`);
console.log(`Broken Imports: ${report.brokenImports.length}`);
console.log(`Context Memoization Issues: ${report.contextMemoizationIssues.length}`);
console.log(`New Files > 400 Lines Violations: ${report.newLineLimitViolations.length}`);
console.log(`Audio Progress Isolation: ${report.audioProgressIsolationPassed ? 'PASSED' : 'FAILED'}`);

if (report.syntaxErrors.length > 0) {
  console.log('Syntax Errors Details:', JSON.stringify(report.syntaxErrors, null, 2));
}
if (report.brokenImports.length > 0) {
  console.log('Broken Imports Details:', JSON.stringify(report.brokenImports, null, 2));
}
if (report.contextMemoizationIssues.length > 0) {
  console.log('Context Memoization Issues Details:', JSON.stringify(report.contextMemoizationIssues, null, 2));
}
if (report.newLineLimitViolations.length > 0) {
  console.log('New Line Limit Violations Details:', JSON.stringify(report.newLineLimitViolations, null, 2));
}

fs.writeFileSync(path.join(ROOT_DIR, 'scripts', 'supervisor_audit_report.json'), JSON.stringify(report, null, 2));
process.exit((report.syntaxErrors.length + report.brokenImports.length + report.newLineLimitViolations.length) > 0 ? 1 : 0);
