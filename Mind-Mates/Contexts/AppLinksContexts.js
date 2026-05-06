// src/context/AppLinksContext.js
// ══════════════════════════════════════════════════════════════
//  Global link state — fetched ONCE at startup, shared everywhere.
//  Implements the "stale-while-revalidate" pattern used by
//  Instagram's config service:
//    1. Serve stale cached data immediately (zero latency)
//    2. Refresh in background
//    3. Update UI silently when fresh data arrives
// ══════════════════════════════════════════════════════════════

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import NetInfo from "@react-native-community/netinfo";
import { AppState } from "react-native";

import { STATIC_LINKS, FETCH_CONFIG } from "@/config/appLinks";
import { fetchAllLinks } from "@/services/linkFetcher";
import { readCache, writeCache, readStaleCache } from "@/services/linkCache";
import { logger } from "@/utils/logger";

// ── Context ────────────────────────────────────────────────────

const AppLinksContext = createContext({
  links:     STATIC_LINKS,
  isLoading: false,
  isStale:   false,
  refresh:   async () => {},
  getLink:   (key) => STATIC_LINKS[key] ?? "",
});

// ── Provider ───────────────────────────────────────────────────

export function AppLinksProvider({ children }) {
  const [links,     setLinks]     = useState(STATIC_LINKS); // instant render
  const [isLoading, setIsLoading] = useState(false);
  const [isStale,   setIsStale]   = useState(false);

  const isFetching  = useRef(false); // prevent concurrent fetches
  const lastFetchAt = useRef(0);

  // ── Core fetch-and-update ──────────────────────────────────────

  const loadLinks = useCallback(async ({ forceRefresh = false } = {}) => {
    // Guard: don't fetch concurrently
    if (isFetching.current) {
      logger.info("Fetch already in progress — skipping");
      return;
    }

    // Guard: don't re-fetch if cache is still fresh
    const age = Date.now() - lastFetchAt.current;
    if (!forceRefresh && age < FETCH_CONFIG.TTL_MS) {
      logger.info(`Cache fresh (${Math.round(age / 1000)}s old) — skipping`);
      return;
    }

    isFetching.current = true;

    try {
      // ── Step 1: serve stale cache immediately ─────────────────
      const cached = await readCache();
      if (cached) {
        setLinks({ ...STATIC_LINKS, ...cached.data });
        setIsStale(cached.isStale);
        if (!cached.isStale && !forceRefresh) {
          logger.info("Serving fresh cache — no network call needed");
          return;
        }
      }

      // ── Step 2: check network ─────────────────────────────────
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        logger.warn("Offline — using static/cached links");
        const stale = await readStaleCache();
        if (stale) setLinks({ ...STATIC_LINKS, ...stale });
        setIsStale(true);
        return;
      }

      // ── Step 3: fetch from Supabase ───────────────────────────
      setIsLoading(true);
      const fresh = await fetchAllLinks();
      lastFetchAt.current = Date.now();

      setLinks(fresh);
      setIsStale(false);
      await writeCache(fresh);
      logger.info("Links updated from network");
    } catch (err) {
      // This should never happen (fetchAllLinks is internally safe)
      // but we guard anyway
      logger.critical("AppLinksProvider unexpected error:", err);
    } finally {
      setIsLoading(false);
      isFetching.current = false;
    }
  }, []);

  // ── Initial load on mount ──────────────────────────────────────

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  // ── Background refresh when app foregrounds ───────────────────

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        logger.info("App foregrounded — checking cache freshness");
        loadLinks(); // no-ops if cache is still fresh
      }
    });
    return () => sub.remove();
  }, [loadLinks]);

  // ── Listen for network reconnection ───────────────────────────

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected && isStale) {
        logger.info("Network restored — refreshing stale links");
        loadLinks({ forceRefresh: true });
      }
    });
    return unsub;
  }, [loadLinks, isStale]);

  // ── Safe getter with static fallback ──────────────────────────

  const getLink = useCallback(
    (key) => links[key] ?? STATIC_LINKS[key] ?? "",
    [links]
  );

  const value = {
    links,
    isLoading,
    isStale,
    refresh: () => loadLinks({ forceRefresh: true }),
    getLink,
  };

  return (
    <AppLinksContext.Provider value={value}>
      {children}
    </AppLinksContext.Provider>
  );
}

// ── Consumer hook ──────────────────────────────────────────────

export function useAppLinks() {
  return useContext(AppLinksContext);
}

/**
 * Convenience hook for a single link key.
 * Always returns a string — never undefined/null.
 *
 * Usage:
 *   const privacyUrl = useLink("PRIVACY_POLICY");
 */
export function useLink(key) {
  const { getLink } = useAppLinks();
  return getLink(key);
}
