const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const candidateFolders = [
  __dirname,
  path.resolve(__dirname, 'node_modules'),
];

config.watchFolders = candidateFolders.filter(f => {
  try {
    return fs.existsSync(f);
  } catch {
    return false;
  }
});

module.exports = config;
