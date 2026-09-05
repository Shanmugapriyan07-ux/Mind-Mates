const { withNativeWind } = require("nativewind/metro");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const config = getSentryExpoConfig(__dirname);
module.exports = withNativeWind(config, {
  input: "./app/global.css",
});
config.projectRoot = __dirname;
config.watchFolders = [__dirname];
module.exports = withNativeWind(config, { input: "./app/global.css" });
