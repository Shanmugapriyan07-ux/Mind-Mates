import AsyncStorage from "@react-native-async-storage/async-storage";
import { CACHE_CONFIG } from "../config/appLinks";
import { log as logger } from "../utils/logger";
const memoryCache = {
  data: null,
  fetchedAt: 0,
};
function isExpired(fetchedAt, ttl = CACHE_CONFIG.TTL_MS) {
  return Date.now() - fetchedAt > ttl;
}
export async function readCache() {
  if (memoryCache.data && !isExpired(memoryCache.fetchedAt)) {
    logger.info("Cache hit (L1 memory)");
    return { data: memoryCache.data, isStale: false, source: "memory" };
  }
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
    memoryCache.data = data;
    memoryCache.fetchedAt = fetchedAt;
    return { data, isStale: !fresh, source: "storage" };
  } catch (err) {
    logger.warn("Cache read error:", err.message);
    return null;
  }
}
export async function writeCache(data) {
  const fetchedAt = Date.now();
  memoryCache.data = data;
  memoryCache.fetchedAt = fetchedAt;
  AsyncStorage.setItem(
    CACHE_CONFIG.KEY,
    JSON.stringify({ data, fetchedAt }),
  ).catch((err) => logger.warn("Cache write error:", err.message));
}
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
export async function clearCache() {
  memoryCache.data = null;
  memoryCache.fetchedAt = 0;
  await AsyncStorage.removeItem(CACHE_CONFIG.KEY).catch(() => {});
}
