// src/hooks/useOpenLink.js
// ══════════════════════════════════════════════════════════════
//  Opens URLs in the in-app browser (expo-web-browser).
//  Integrates with AppLinksContext for link resolution.
//  Features: loading state, haptics, fallback, analytics hooks.
// ══════════════════════════════════════════════════════════════

import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useRef, useState } from "react";
import { Alert, Linking, Platform } from "react-native";

import { useAppLinks } from "@/Contexts/AppLinksContexts";
import { STATIC_LINKS } from "@/config/appLinks";
import { log as logger } from "../utils/logger";

// Branded browser options
const BROWSER_OPTIONS = {
  dismissButtonStyle: "close",
  preferredBarTintColor: "#6D4AFF",
  preferredControlTintColor: "#FFFFFF",
  readerMode: false,
  enableBarCollapsing: true,
  toolbarColor: "#6D4AFF",
  secondaryToolbarColor: "#FFFFFF",
  showTitle: true,
  enableDefaultShare: true,
  forceCloseOnRedirection: false,
};

/**
 * Core open function — not a hook, safe to call from anywhere.
 */
export async function openUrl(url, options = {}) {
  if (!url || typeof url !== "string") {
    logger.warn("openUrl: invalid URL", url);
    return;
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    logger.warn("openUrl: URL must start with http(s)://", url);
    return;
  }

  // Warm up browser on Android for faster open
  if (Platform.OS === "android") {
    WebBrowser.warmUpAsync().catch(() => {});
  }

  try {
    await WebBrowser.openBrowserAsync(url, { ...BROWSER_OPTIONS, ...options });
  } catch (err) {
    logger.warn("In-app browser failed, trying system browser:", err.message);

    // Fallback to system browser
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return;
      }
    } catch (fallbackErr) {
      logger.error("System browser also failed:", fallbackErr.message);
    }

    Alert.alert(
      "Unable to Open Link",
      "Please check your internet connection and try again.",
      [{ text: "OK" }],
    );
  } finally {
    if (Platform.OS === "android") {
      WebBrowser.coolDownAsync().catch(() => {});
    }
  }
}

// ── Hook ───────────────────────────────────────────────────────

/**
 * Hook that resolves link keys from context, then opens them.
 *
 * const { openByKey, openRawUrl, isLoading } = useOpenLink();
 *
 * openByKey("PRIVACY_POLICY");           // resolved from context / fallback
 * openRawUrl("https://example.com");     // direct URL
 */
export function useOpenLink() {
  const [isLoading, setIsLoading] = useState(false);
  const { getLink } = useAppLinks();
  const isMounted = useRef(true);

  const safeSetLoading = useCallback((val) => {
    if (isMounted.current) setIsLoading(val);
  }, []);

  /**
   * Open a link by its config key (e.g. "PRIVACY_POLICY").
   * Falls back to STATIC_LINKS if context hasn't loaded yet.
   */
  const openByKey = useCallback(
    async (key, name = key, options = {}) => {
      safeSetLoading(true);
      await Haptics.selectionAsync().catch(() => {});

      // Resolve: context → static → empty string
      const url = getLink(key) || STATIC_LINKS[key] || "";

      if (!url) {
        logger.warn(`No URL found for key: ${key}`);
        Alert.alert(
          "Link Unavailable",
          "This link is not available right now.",
        );
        safeSetLoading(false);
        return;
      }

      logger.info(`Opening [${key}]: ${url}`);
      // 🔌 Analytics hook: analytics().logEvent("link_opened", { key, name });

      await openUrl(url, options);
      safeSetLoading(false);
    },
    [getLink, safeSetLoading],
  );

  /**
   * Open any raw URL directly.
   */
  const openRawUrl = useCallback(
    async (url, options = {}) => {
      safeSetLoading(true);
      await Haptics.selectionAsync().catch(() => {});
      await openUrl(url, options);
      safeSetLoading(false);
    },
    [safeSetLoading],
  );

  return { openByKey, openRawUrl, isLoading };
}
