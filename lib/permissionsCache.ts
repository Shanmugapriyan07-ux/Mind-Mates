import * as ImagePicker from "expo-image-picker";

interface CachedPermission {
  granted: boolean;
  timestamp: number;
  expiresIn: number;
}

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const permissionCache = new Map<string, CachedPermission>();

// ─── Internal getter ───────────────────────────────────────────────────────────
const getCached = (key: string): boolean | null => {
  const cached = permissionCache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.expiresIn) {
    return cached.granted;
  }
  return null;
};

const setCache = (key: string, granted: boolean) => {
  permissionCache.set(key, {
    granted,
    timestamp: Date.now(),
    expiresIn: CACHE_DURATION,
  });
};

// ─── Public API ────────────────────────────────────────────────────────────────
export const requestCameraPermissionCached = async (): Promise<boolean> => {
  const cached = getCached("camera");
  if (cached !== null) return cached;

  try {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    setCache("camera", granted);
    return granted;
  } catch (e) {
    console.error("❌ Camera permission request failed:", e);
    return false;
  }
};

export const requestMediaLibraryPermissionCached = async (): Promise<boolean> => {
  const cached = getCached("mediaLibrary");
  if (cached !== null) return cached;

  try {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    setCache("mediaLibrary", granted);
    return granted;
  } catch (e) {
    console.error("❌ Media library permission request failed:", e);
    return false;
  }
};

/**
 * Call this on ChatScreen mount (or app boot) to eagerly resolve permissions.
 * When the user taps Camera, the permission is already cached — zero wait.
 * This is the WhatsApp/Instagram strategy: warm up before the user needs it.
 */
export const warmUpMediaPermissions = (): void => {
  // Fire-and-forget — don't await, don't block UI
  // Only prompts the OS dialog if permission was never granted
  const cameraAlreadyCached = getCached("camera") !== null;
  const libraryAlreadyCached = getCached("mediaLibrary") !== null;

  if (!cameraAlreadyCached) {
    ImagePicker.getCameraPermissionsAsync()
      .then(({ granted }) => setCache("camera", granted))
      .catch(() => {});
  }

  if (!libraryAlreadyCached) {
    ImagePicker.getMediaLibraryPermissionsAsync()
      .then(({ granted }) => setCache("mediaLibrary", granted))
      .catch(() => {});
  }
};

/**
 * Pre-flight check: returns cached status without prompting.
 * Use to know if you can skip the permission await entirely.
 */
export const isCameraGranted = (): boolean => getCached("camera") === true;
export const isLibraryGranted = (): boolean => getCached("mediaLibrary") === true;

export const clearPermissionCache = () => permissionCache.clear();