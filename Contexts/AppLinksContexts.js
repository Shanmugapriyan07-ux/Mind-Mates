import NetInfo from "@react-native-community/netinfo";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import { FETCH_CONFIG, STATIC_LINKS } from "@/config/appLinks";
import { readCache, readStaleCache, writeCache } from "@/services/linkCache";
import { fetchAllLinks } from "@/services/linkFetcher";
import { log as logger } from "@/utils/logger";
const AppLinksContext = createContext({
  links: STATIC_LINKS,
  isLoading: false,
  isStale: false,
  refresh: async () => {},
  getLink: (key) => STATIC_LINKS[key] ?? "",
});
export function AppLinksProvider({ children }) {
  const [links, setLinks] = useState(STATIC_LINKS);
  const [isLoading, setIsLoading] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const isFetching = useRef(false); 
  const lastFetchAt = useRef(0);
  const loadLinks = useCallback(async ({ forceRefresh = false } = {}) => {
    if (isFetching.current) {
      logger.info("Fetch already in progress — skipping");
      return;
    }
    const age = Date.now() - lastFetchAt.current;
    if (!forceRefresh && age < FETCH_CONFIG.TTL_MS) {
      logger.info(`Cache fresh (${Math.round(age / 1000)}s old) — skipping`);
      return;
    }
    isFetching.current = true;
    try {
      const cached = await readCache();
      if (cached) {
        setLinks({ ...STATIC_LINKS, ...cached.data });
        setIsStale(cached.isStale);
        if (!cached.isStale && !forceRefresh) {
          logger.info("Serving fresh cache — no network call needed");
          return;
        }
      }
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        logger.warn("Offline — using static/cached links");
        const stale = await readStaleCache();
        if (stale) setLinks({ ...STATIC_LINKS, ...stale });
        setIsStale(true);
        return;
      }
      setIsLoading(true);
      const fresh = await fetchAllLinks();
      lastFetchAt.current = Date.now();
      setLinks(fresh);
      setIsStale(false);
      await writeCache(fresh);
      logger.info("Links updated from network");
    } catch (err) {
      logger.critical("AppLinksProvider unexpected error:", err);
    } finally {
      setIsLoading(false);
      isFetching.current = false;
    }
  }, []);
  useEffect(() => {
    loadLinks();
  }, [loadLinks]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        logger.info("App foregrounded — checking cache freshness");
        loadLinks();
      }
    });
    return () => sub.remove();
  }, [loadLinks]);
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected && isStale) {
        logger.info("Network restored — refreshing stale links");
        loadLinks({ forceRefresh: true });
      }
    });
    return unsub;
  }, [loadLinks, isStale]);
  const getLink = useCallback(
    (key) => links[key] ?? STATIC_LINKS[key] ?? "",
    [links],
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
export function useAppLinks() {
  return useContext(AppLinksContext);
}
export function useLink(key) {
  const { getLink } = useAppLinks();
  return getLink(key);
}
