// src/services/linkFetcher.js
// ══════════════════════════════════════════════════════════════
//  Fetches ALL required app_links in a SINGLE Supabase query.
//  Features:
//    • AbortController timeout (no dangling requests)
//    • Retry with exponential backoff
//    • Graceful 404 / empty-table handling
//    • Merges Supabase data with static fallbacks
//    • Never throws — always returns a safe URL map
// ══════════════════════════════════════════════════════════════

import { FETCH_CONFIG, STATIC_LINKS } from "../config/appLinks";
import { isSupabaseAvailable, supabase } from "../config/supabase";
import { log as logger } from "../utils/logger";

/**
 * Wraps a Supabase query with an AbortController timeout.
 */
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

/**
 * Fetches all keys in BATCH_KEYS with a single SELECT … IN (…) query.
 * Returns a merged URL map: { PRIVACY_POLICY: "...", … }
 */
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

  // ── Classify errors ──────────────────────────────────────────

  if (error) {
    // 404 = table doesn't exist yet (migration not run)
    if (status === 404 || error.code === "PGRST116") {
      logger.warn("app_links table not found. Run the SQL migration.");
      return null;
    }
    // Network / timeout
    if (error.name === "AbortError" || error.message?.includes("abort")) {
      logger.warn("Supabase fetch timed out");
      return null;
    }
    logger.warn("Supabase fetch error:", error.message);
    return null;
  }

  // Empty table — not an error, just use fallbacks
  if (!data || data.length === 0) {
    logger.warn("app_links table exists but is empty. Seed default rows.");
    return null;
  }

  // Convert row array → key/url map
  const remoteMap = {};
  for (const row of data) {
    if (row.key && row.url) remoteMap[row.key] = row.url;
  }

  logger.info(`Fetched ${Object.keys(remoteMap).length} links from Supabase`);
  return remoteMap;
}

/**
 * Retry wrapper with exponential backoff.
 */
async function withRetry(fn, retries = FETCH_CONFIG.MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await fn();
      if (result !== null) return result;
    } catch {
      // swallowed — fn is already safe
    }

    if (attempt < retries) {
      const delay = FETCH_CONFIG.RETRY_DELAY_MS * 2 ** attempt;
      logger.info(`Retry attempt ${attempt + 1} in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return null;
}

/**
 * PUBLIC: Fetches all links, retrying on failure.
 * Returns merged map (Supabase overrides statics where available).
 * NEVER throws.
 *
 * @returns {Promise<Record<string, string>>}
 */
export async function fetchAllLinks() {
  try {
    const remote = await withRetry(fetchFromSupabase);
    // Merge: static is the base, remote overrides selectively
    return { ...STATIC_LINKS, ...(remote ?? {}) };
  } catch (err) {
    logger.critical("fetchAllLinks unexpected error:", err);
    return { ...STATIC_LINKS };
  }
}
