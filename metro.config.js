const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.watchFolders = [
  __dirname,
  'C:\\Users\\mohamed\\Downloads\\rivo',
  path.resolve(__dirname, 'node_modules'),
];

module.exports = config;
