import * as ImagePicker from "expo-image-picker";

interface CachedPermission {
  granted: boolean;
  timestamp: number;
  expiresIn: number;
}

const CACHE_DURATION = 60 * 60 * 1000;
const permissionCache = new Map<string, CachedPermission>();
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
export const requestCameraPermissionCached = async (): Promise<boolean> => {
  const cached = getCached("camera");
  if (cached !== null) return cached;
  try {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    setCache("camera", granted);
    return granted;
  } catch (e) {
    console.warn("❌ Camera permission request failed:", e);
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
    console.warn("❌ Media library permission request failed:", e);
    return false;
  }
};

export const warmUpMediaPermissions = (): void => {
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
export const isCameraGranted = (): boolean => getCached("camera") === true;
export const isLibraryGranted = (): boolean => getCached("mediaLibrary") === true;

export const clearPermissionCache = () => permissionCache.clear();