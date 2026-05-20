const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

config.projectRoot = __dirname;
config.watchFolders = [__dirname];

const { resolver } = config;
const existingSourceExts = resolver.sourceExts;
const platformSpecificExts = ['ios', 'android', 'native', 'web'];


module.exports = withNativeWind(config, { input: "./app/global.css" });
