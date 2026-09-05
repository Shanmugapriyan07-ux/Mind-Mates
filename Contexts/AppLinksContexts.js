import NetInfo from "@react-native-community/netinfo";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
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
      return;
    }
    const age = Date.now() - lastFetchAt.current;
    if (!forceRefresh && age < FETCH_CONFIG.TTL_MS) {
      return;
    }
    isFetching.current = true;
    try {
      const cached = await readCache();
      if (cached) {
        setLinks({ ...STATIC_LINKS, ...cached.data });
        setIsStale(cached.isStale);
        if (!cached.isStale && !forceRefresh) {
          return;
        }
      }
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
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
    } catch (err) {
      logger.warn("Error loading links:", err.message);
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
        loadLinks();
      }
    });
    return () => sub.remove();
  }, [loadLinks]);
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected && isStale) {
        loadLinks({ forceRefresh: true });
      }
    });
    return unsub;
  }, [loadLinks, isStale]);
  const getLink = useCallback(
    (key) => links[key] ?? STATIC_LINKS[key] ?? "",
    [links],
  );
  const refresh = useCallback(() => loadLinks({ forceRefresh: true }), [loadLinks]);

const value = useMemo(
  () => ({ links, isLoading, isStale, refresh, getLink }),
  [links, isLoading, isStale, refresh, getLink],
);

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
