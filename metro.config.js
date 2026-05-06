const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.transformer.minifierConfig = {
  compress: false,
  mangle: false,
};

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

config.projectRoot = __dirname;
config.watchFolders = [__dirname];

const defaultSourceExts = config.resolver.sourceExts;
config.resolver.sourceExts = [
  ...defaultSourceExts,
];

// To ensure correct platform resolution, especially for web vs. native,
// it's often beneficial to explicitly order source extensions.
// We'll filter out existing platform-specific extensions and re-add them in a desired order.
// This helps prevent issues where web-specific modules might be inadvertently loaded on native platforms.
const { resolver } = config;
const existingSourceExts = resolver.sourceExts;
const platformSpecificExts = ['ios', 'android', 'native', 'web'];

resolver.sourceExts = [
  // Keep generic extensions first
  ...existingSourceExts.filter((ext) => !platformSpecificExts.some(p => ext.includes(p + '.'))),
  // Prioritize native-specific extensions
  'native.ts', 'native.tsx', 'native.js', 'native.jsx',
  'ios.ts', 'ios.tsx', 'ios.js', 'ios.jsx',
  'android.ts', 'android.tsx', 'android.js', 'android.jsx',
  // Finally, web-specific extensions
  'web.ts', 'web.tsx', 'web.js', 'web.jsx',
];

module.exports = withNativeWind(config, { input: "./app/global.css" });
