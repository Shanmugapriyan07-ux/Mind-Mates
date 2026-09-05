const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : true;
type Level = 'auth' | 'nav' | 'info';
const prefix: Record<Level, string> = {
  auth:  '🔐 [Auth]',
  nav:   '🧭 [Nav]',
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
  info:  make('info'),
};