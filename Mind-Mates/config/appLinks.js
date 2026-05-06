
export const STATIC_LINKS = {
  PRIVACY_POLICY:   "https://skill-up-sepia-six.vercel.app/",
  TERMS_OF_SERVICE: "https://terms-8m6au0247-shanmugapriyancse582-1598s-projects.vercel.app/",
 
};

// Keys we must have — validated on startup
export const REQUIRED_KEYS = [
  "PRIVACY_POLICY",
  "TERMS_OF_SERVICE",
];

// Cache config
export const CACHE_CONFIG = {
  KEY:          "mindmates_app_links_v2",   // bump version to invalidate old cache
  TTL_MS:       5 * 60 * 1000,              // 5 minutes — refresh in background
  STALE_TTL_MS: 24 * 60 * 60 * 1000,       // 24 hours — use stale cache if offline
};

// Fetch config
export const FETCH_CONFIG = {
  TIMEOUT_MS:       4000,   // abort after 4 s — don't block app launch
  MAX_RETRIES:      2,
  RETRY_DELAY_MS:   1000,
  BATCH_KEYS: [             // fetch all needed keys in ONE query at startup
    "PRIVACY_POLICY",
    "TERMS_OF_SERVICE",
  
  ],
};
