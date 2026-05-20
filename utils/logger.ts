// // utils/logger.ts
// // Structured logger for auth flow debugging.
// // Logs only in development — silent in production builds.
// // Import: import { log } from '@/utils/logger';

// const isDev = __DEV__;

// type LogLevel = 'auth' | 'nav' | 'error' | 'info';

// function createLogger(level: LogLevel) {
//   return (...args: any[]) => {
//     if (!isDev) return;

//     const prefix: Record<LogLevel, string> = {
//       auth:  '🔐 [Auth]',
//       nav:   '🧭 [Nav]',
//       error: '❌ [Error]',
//       info:  'ℹ️  [Info]',
//     };

//     console.log(prefix[level], ...args);
//   };
// }

// export const log = {
//   auth:  createLogger('auth'),
//   nav:   createLogger('nav'),
//   error: createLogger('error'),
//   info:  createLogger('info'),
// };


// utils/logger.ts
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : true;

type Level = 'auth' | 'nav' | 'error' | 'info';

const prefix: Record<Level, string> = {
  auth:  '🔐 [Auth]',
  nav:   '🧭 [Nav]',
  error: '❌ [Error]',
  info:  'ℹ️  [Info]',
};

function make(level: Level) {
  return (...args: any[]) => {
    if (isDev) console.log(prefix[level], ...args);
  };
}

export const log = {
  auth:  make('auth'),
  nav:   make('nav'),
  error: make('error'),
  info:  make('info'),
};