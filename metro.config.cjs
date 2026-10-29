const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Keep Expo's defaults and include the original font license in native bundles.
if (!config.resolver.assetExts.includes('txt')) {
  config.resolver.assetExts.push('txt');
}

module.exports = config;
