const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withNativeWind } = require('nativewind/metro');

const monorepoRoot = path.resolve(__dirname, '../..');

/** @type {import('@react-native/metro-config').MetroConfig} */
const config = {
  watchFolders: [monorepoRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(monorepoRoot, 'node_modules'),
    ],
  },
};

// The theme lives in the shared ui package; App.tsx imports the same file.
module.exports = withNativeWind(mergeConfig(getDefaultConfig(__dirname), config), {
  input: require.resolve('@offline-app-examples/ui/global.css'),
});
