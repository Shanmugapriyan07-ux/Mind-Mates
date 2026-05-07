
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CACHE_CONFIG } from "../config/appLinks";
import { log as logger } from "../utils/logger";

// ── L1: in-memory cache ────────────────────────────────────────
const memoryCache = {
  data: null, // { [key]: url }
  fetchedAt: 0,
};

// ── Helpers ────────────────────────────────────────────────────

function isExpired(fetchedAt, ttl = CACHE_CONFIG.TTL_MS) {
  return Date.now() - fetchedAt > ttl;
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Read from L1 (memory) then L2 (AsyncStorage).
 * Returns { data, isStale, source } or null.
 */
export async function readCache() {
  // L1 hit
  if (memoryCache.data && !isExpired(memoryCache.fetchedAt)) {
    logger.info("Cache hit (L1 memory)");
    return { data: memoryCache.data, isStale: false, source: "memory" };
  }

  // L2 hit
  try {
    const raw = await AsyncStorage.getItem(CACHE_CONFIG.KEY);
    if (!raw) return null;

    const { data, fetchedAt } = JSON.parse(raw);
    const stale = isExpired(fetchedAt, CACHE_CONFIG.STALE_TTL_MS);

    if (stale) {
      logger.info("Cache expired (L2 AsyncStorage)");
      return null;
    }

    const fresh = !isExpired(fetchedAt, CACHE_CONFIG.TTL_MS);
    logger.info(`Cache hit (L2 AsyncStorage) — ${fresh ? "fresh" : "stale"}`);

    // Populate L1
    memoryCache.data = data;
    memoryCache.fetchedAt = fetchedAt;

    return { data, isStale: !fresh, source: "storage" };
  } catch (err) {
    logger.warn("Cache read error:", err.message);
    return null;
  }
}

/**
 * Write to both L1 and L2.
 */
export async function writeCache(data) {
  const fetchedAt = Date.now();

  // L1
  memoryCache.data = data;
  memoryCache.fetchedAt = fetchedAt;

  // L2 (non-blocking — don't await in hot path)
  AsyncStorage.setItem(
    CACHE_CONFIG.KEY,
    JSON.stringify({ data, fetchedAt }),
  ).catch((err) => logger.warn("Cache write error:", err.message));
}

/**
 * Read stale L2 cache — used as last-resort when network is offline.
 * Accepts data up to STALE_TTL_MS old.
 */
export async function readStaleCache() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_CONFIG.KEY);
    if (!raw) return null;
    const { data, fetchedAt } = JSON.parse(raw);
    if (isExpired(fetchedAt, CACHE_CONFIG.STALE_TTL_MS)) return null;
    logger.info("Stale cache used (offline mode)");
    return data;
  } catch {
    return null;
  }
}

/**
 * Invalidate all layers — useful after logout or version bump.
 */
export async function clearCache() {
  memoryCache.data = null;
  memoryCache.fetchedAt = 0;
  await AsyncStorage.removeItem(CACHE_CONFIG.KEY).catch(() => {});
}
