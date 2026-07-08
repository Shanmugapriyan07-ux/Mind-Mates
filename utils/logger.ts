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