const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rivoDir = path.resolve(__dirname, '../../../rivo-main');

const patterns = [
  'test-',
  'test_',
  'mock',
  'fake',
  'fixture',
  'isTest',
  'is_test',
  'testMode',
  'testTrack',
  'process.env.NODE_ENV === \'test\'',
  '__test__'
];

console.log('=== Checking git diff for suspicious test triggers / cheats ===');

const results = {};

for (const pattern of patterns) {
  try {
    const diff = execSync(`git diff -S"${pattern}" --`, { cwd: rivoDir, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    if (diff.trim().length > 0) {
      // Find which files changed with this pattern
      const files = execSync(`git diff -S"${pattern}" --name-only`, { cwd: rivoDir, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
      results[pattern] = files;
    }
  } catch (err) {
    console.error(`Error searching for ${pattern}:`, err.message);
  }
}

console.log('Patterns found in git diff:');
console.log(JSON.stringify(results, null, 2));
