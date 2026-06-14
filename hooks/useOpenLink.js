import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useRef, useState } from "react";
import { Alert, Linking, Platform } from "react-native";
import { useAppLinks } from "@/Contexts/AppLinksContexts";
import { STATIC_LINKS } from "@/config/appLinks";
import { log as logger } from "../utils/logger";
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
export async function openUrl(url, options = {}) {
  if (!url || typeof url !== "string") {
    logger.warn("openUrl: invalid URL", url);
    return;
  }
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    logger.warn("openUrl: URL must start with http(s)://", url);
    return;
  }
  if (Platform.OS === "android") {
    WebBrowser.warmUpAsync().catch(() => {});
  }
  try {
    await WebBrowser.openBrowserAsync(url, { ...BROWSER_OPTIONS, ...options });
  } catch (err) {
    logger.warn("In-app browser failed, trying system browser:", err.message);
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
export function useOpenLink() {
  const [isLoading, setIsLoading] = useState(false);
  const { getLink } = useAppLinks();
  const isMounted = useRef(true);
  const safeSetLoading = useCallback((val) => {
    if (isMounted.current) setIsLoading(val);
  }, []);
  const openByKey = useCallback(
    async (key, _name = key, options = {}) => {
      safeSetLoading(true);
      await Haptics.selectionAsync().catch(() => {});
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
      await openUrl(url, options);
      safeSetLoading(false);
    },
    [getLink, safeSetLoading],
  );
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
