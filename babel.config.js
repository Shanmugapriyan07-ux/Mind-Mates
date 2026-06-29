module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
    ],
    plugins: [
      // MUST BE LAST
      "react-native-reanimated/plugin",
    ],
  };
};