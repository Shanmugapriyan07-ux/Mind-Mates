// src/utils/logger.js
// ══════════════════════════════════════════════════════════════
//  Production-safe logger.
//  __DEV__ is provided by Expo/Metro globally.
//  Zero console spam in production builds.
// ══════════════════════════════════════════════════════════════

const isDev = typeof __DEV__ !== "undefined" ? __DEV__ : true;

export const logger = {
  info:  (...args) => isDev && console.log  ("[MindMates]", ...args),
  warn:  (...args) => isDev && console.warn ("[MindMates]", ...args),
  error: (...args) => isDev && console.error("[MindMates]", ...args),

  // Always log critical errors even in production (send to Sentry etc.)
  critical: (...args) => {
    console.error("[MindMates:CRITICAL]", ...args);
    // TODO: Sentry.captureException(args[0]);
    // TODO: analytics().logEvent("critical_error", { message: String(args[0]) });
  },
};
