
import { FETCH_CONFIG, STATIC_LINKS } from "../config/appLinks";
import { isSupabaseAvailable, supabase } from "../config/supabase";
import { log as logger } from "../utils/logger";
async function fetchWithTimeout(queryFn, timeoutMs = FETCH_CONFIG.TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await queryFn(controller.signal);
    return result;
  } finally {
    clearTimeout(timer);
  }
}
async function fetchFromSupabase() {
  if (!isSupabaseAvailable) {
    logger.info("Supabase not configured — using static links");
    return null;
  }
  const { data, error, status } = await fetchWithTimeout((signal) =>
    supabase
      .from("app_links")
      .select("key, url")
      .in("key", FETCH_CONFIG.BATCH_KEYS)
      .eq("is_active", true)
      .abortSignal(signal),
  );
  if (error) {
    if (status === 404 || error.code === "PGRST116") {
      logger.warn("app_links table not found. Run the SQL migration.");
      return null;
    }
    if (error.name === "AbortError" || error.message?.includes("abort")) {
      logger.warn("Supabase fetch timed out");
      return null;
    }
    logger.warn("Supabase fetch error:", error.message);
    return null;
  }
  if (!data || data.length === 0) {
    logger.warn("app_links table exists but is empty. Seed default rows.");
    return null;
  }
  const remoteMap = {};
  for (const row of data) {
    if (row.key && row.url) remoteMap[row.key] = row.url;
  }
  logger.info(`Fetched ${Object.keys(remoteMap).length} links from Supabase`);
  return remoteMap;
}
async function withRetry(fn, retries = FETCH_CONFIG.MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await fn();
      if (result !== null) return result;
    } catch {
    }
    if (attempt < retries) {
      const delay = FETCH_CONFIG.RETRY_DELAY_MS * 2 ** attempt;
      logger.info(`Retry attempt ${attempt + 1} in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return null;
}
export async function fetchAllLinks() {
  try {
    const remote = await withRetry(fetchFromSupabase);
    return { ...STATIC_LINKS, ...(remote ?? {}) };
  } catch (err) {
    logger.critical("fetchAllLinks unexpected error:", err);
    return { ...STATIC_LINKS };
  }
}
