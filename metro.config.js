const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const config = getDefaultConfig(__dirname);

let realDir = __dirname;
try {
  realDir = fs.realpathSync(__dirname);
} catch {}

const candidateFolders = [
  __dirname,
  realDir,
  path.resolve(__dirname, 'node_modules'),
  path.resolve(realDir, 'node_modules'),
  ...(config.watchFolders || []),
];

config.watchFolders = Array.from(new Set(candidateFolders.filter(f => {
  try {
    return fs.existsSync(f);
  } catch {
    return false;
  }
})));

config.resolver = config.resolver || {};
config.resolver.nodeModulesPaths = Array.from(new Set([
  path.resolve(__dirname, 'node_modules'),
  path.resolve(realDir, 'node_modules'),
  ...(config.resolver.nodeModulesPaths || []),
]));

module.exports = config;
