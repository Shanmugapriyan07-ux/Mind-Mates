export const STATIC_LINKS = {
  PRIVACY_POLICY:   "https://shanmugapriyan07-ux.github.io/skill-up/",
  TERMS_OF_SERVICE: "https://shanmugapriyan07-ux.github.io/terms/",
};
export const REQUIRED_KEYS = [
  "PRIVACY_POLICY",
  "TERMS_OF_SERVICE",
];
export const CACHE_CONFIG = {
  KEY:          "mindmates_app_links_v2",  
  TTL_MS:       5 * 60 * 1000,            
  STALE_TTL_MS: 24 * 60 * 60 * 1000,      };
export const FETCH_CONFIG = {
  TIMEOUT_MS:       4000, 
  MAX_RETRIES:      2,
  RETRY_DELAY_MS:   1000,
  BATCH_KEYS: [           
    "PRIVACY_POLICY",
    "TERMS_OF_SERVICE",
  ],
};
