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
  "web.tsx",
  "web.ts",
  "web.jsx",
  "web.js",
  ...defaultSourceExts,
];

module.exports = withNativeWind(config, { input: "./app/global.css" });
