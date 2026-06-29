import { Audio, AVPlaybackStatus } from "expo-av";
import { AppState, AppStateStatus } from "react-native";
import { File, Directory, Paths } from "expo-file-system/next"; 
import { useCallback, useEffect, useRef, useState } from "react";

const MAX_CACHE_FILES = 100;    
const PROGRESS_INTERVAL_MS = 250;  
const DOWNLOAD_RETRIES = 3;        
const CACHE_DIR = new Directory(Paths.cache, "voice_cache");
const ensureCacheDir = () => {
  if (!CACHE_DIR.exists) {
    CACHE_DIR.create({ intermediates: true }); 
  }
};
ensureCacheDir();
const cacheKeyFor = (url: string): string => {
  const parts = url.split("/");
  return parts[parts.length - 1] || url.replace(/[^a-zA-Z0-9]/g, "_");
};
const getCachedPath = (url: string): File =>
  new File(CACHE_DIR, cacheKeyFor(url));
const evictCacheIfNeeded = () => {
  try {
    const files = CACHE_DIR.list() as File[];
    if (files.length <= MAX_CACHE_FILES) return;
    const excess = files.slice(0, files.length - MAX_CACHE_FILES);
    for (const f of excess) {
      try { f.delete(); } catch { }
    }
  } catch { }
};
const downloadToCache = async (url: string): Promise<string> => {
  ensureCacheDir();
  const file = getCachedPath(url);
  if (file.exists) return file.uri;
  for (let attempt = 1; attempt <= DOWNLOAD_RETRIES; attempt++) {
        try {
      const downloaded = await File.downloadFileAsync(url, CACHE_DIR);
      evictCacheIfNeeded();
      return downloaded.uri;
    } catch (e) {
      if (attempt === DOWNLOAD_RETRIES) {
        console.warn(
          `[useAudioPlayer] download failed after ${DOWNLOAD_RETRIES} retries, streaming`,
          e
        );
        return url; // stream fallback
      }
    }
  }
  return url;
};

// ─── Singleton state ──────────────────────────────────────────────────────────
type Listener = () => void;

interface PlayerSingleton {
  sound: Audio.Sound | null;
  playingId: string | null;
  isPlaying: boolean;
  isLoading: boolean;   // CHANGE 9
  isLoaded: boolean;    // CHANGE 11
  error: string | null; // CHANGE 10
  positionMs: number;
  durationMs: number;
  speed: number;
  listeners: Set<Listener>;
}

const ps: PlayerSingleton = {
  sound: null,
  playingId: null,
  isPlaying: false,
  isLoading: false,
  isLoaded: false,
  error: null,
  positionMs: 0,
  durationMs: 0,
  speed: 1,
  listeners: new Set(),
};

// CHANGE 13: Global operation counter to cancel stale async chains
let operationId = 0;

// CHANGE 3: Loading guard to prevent duplicate play requests
let loadingGuard = false;

const notifyListeners = () => ps.listeners.forEach((fn) => fn());

const updateState = (patch: Partial<Omit<PlayerSingleton, "sound" | "listeners">>) => {
  Object.assign(ps, patch);
  notifyListeners();
};

// ─── Internal: unload current sound ──────────────────────────────────────────
const unloadSound = async () => {
  if (ps.sound) {
    try {
      await ps.sound.stopAsync();
      await ps.sound.unloadAsync();
    } catch { /* ignore */ }
    ps.sound = null;
  }
  updateState({
    playingId: null,
    isPlaying: false,
    isLoading: false,
    isLoaded: false,
    error: null,
    positionMs: 0,
    durationMs: 0,
  });
};

// ─── Playback status callback ─────────────────────────────────────────────────
const onPlaybackStatus = (status: AVPlaybackStatus) => {
  if (!status.isLoaded) {
    if ((status as any).error) {
      updateState({ error: (status as any).error, isLoading: false, isLoaded: false }); // CHANGE 10
    }
    return;
  }
  updateState({
    isPlaying: status.isPlaying,
    isLoaded: true,       // CHANGE 11
    isLoading: false,     // CHANGE 9
    error: null,
    positionMs: status.positionMillis,
    durationMs: status.durationMillis ?? 0,
  });
  if (status.didJustFinish) {
    unloadSound();
  }
};
let lastAppState: AppStateStatus = "active";
AppState.addEventListener("change", async (nextState: AppStateStatus) => {
  if (nextState === "background" || nextState === "inactive") {
    if (ps.sound && ps.isPlaying) {
      try { await ps.sound.pauseAsync(); } catch { /* ignore */ }
    }
  }
  if (nextState === "active" && lastAppState !== "active") {
    if (ps.sound) {
      try {
        const status = await ps.sound.getStatusAsync();
        if (!status.isLoaded) {
          await unloadSound(); // stale — clean up
        }
      } catch {
        await unloadSound();
      }
    }
  }
  lastAppState = nextState;
});
export const preloadAudio = async (url: string): Promise<void> => {
  if (!url.startsWith("http")) return;
  try {
    await downloadToCache(url);
  } catch { }
};
export const useAudioPlayer = () => {
  const [, forceUpdate] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const listener: Listener = () => {
      if (mountedRef.current) forceUpdate((n) => n + 1);
    };
    ps.listeners.add(listener);
    return () => {
      mountedRef.current = false;
      ps.listeners.delete(listener);
    };
  }, []);
  const play = useCallback(async (messageId: string, url: string) => {
    if (ps.playingId === messageId && ps.sound) {
      if (ps.isPlaying) {
        await ps.sound.pauseAsync();
      } else {
        await ps.sound.playAsync();
      }
      return;
    }
    if (loadingGuard) return;
    loadingGuard = true;
    operationId++;
    const myOp = operationId;
    await unloadSound();
    updateState({
      playingId: messageId,
      isLoading: true,  // CHANGE 9
      isLoaded: false,
      error: null,
      positionMs: 0,
      durationMs: 0,
    });

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false, // CHANGE 12: flip to true for WhatsApp-style
      });

      let resolvedUri = url;
      if (url.startsWith("http")) {
        resolvedUri = await downloadToCache(url); // CHANGE 1 + 14
      }

      // CHANGE 13: Bail if a newer play() call started while we were downloading
      if (myOp !== operationId) return;

      const { sound } = await Audio.Sound.createAsync(
        { uri: resolvedUri },
        { shouldPlay: true, rate: ps.speed, volume: 1.0 },
        onPlaybackStatus
      );

      if (myOp !== operationId) {
        // Superseded — clean up silently
        try { await sound.unloadAsync(); } catch { /* ignore */ }
        return;
      }

      // CHANGE 4: Throttle progress updates to 250 ms
      await sound.setProgressUpdateIntervalAsync(PROGRESS_INTERVAL_MS);

      ps.sound = sound;
      updateState({ isPlaying: true, isLoading: false, isLoaded: true });
    } catch (e: any) {
      console.error("[useAudioPlayer] play failed:", e);
      // CHANGE 10: Expose error to UI
      updateState({ error: e?.message ?? "Playback failed", isLoading: false });
      await unloadSound();
    } finally {
      loadingGuard = false; // CHANGE 3
    }
  }, []);

  // ── Pause ─────────────────────────────────────────────────────────────────
  const pause = useCallback(async () => {
    if (ps.sound && ps.isPlaying) {
      await ps.sound.pauseAsync();
    }
  }, []);

  // ── Resume ────────────────────────────────────────────────────────────────
  const resume = useCallback(async () => {
    if (ps.sound && !ps.isPlaying) {
      await ps.sound.playAsync();
    }
  }, []);

  // ── Stop ──────────────────────────────────────────────────────────────────
  const stop = useCallback(async () => {
    await unloadSound();
  }, []);

  // ── Seek ──────────────────────────────────────────────────────────────────
  const seek = useCallback(async (positionMs: number) => {
    if (ps.sound) {
      await ps.sound.setPositionAsync(positionMs);
      updateState({ positionMs });
    }
  }, []);

  // ── Speed ─────────────────────────────────────────────────────────────────
  const setSpeed = useCallback(async (rate: number) => {
    updateState({ speed: rate });
    if (ps.sound) {
      await ps.sound.setRateAsync(rate, true);
    }
  }, []);

  // CHANGE 15: Derived progress (0–1)
  const progress =
    ps.durationMs > 0 ? ps.positionMs / ps.durationMs : 0;

  return {
    playingId:  ps.playingId,
    positionMs: ps.positionMs,
    durationMs: ps.durationMs,
    progress,           // CHANGE 15
    isPlaying:  ps.isPlaying,
    isLoading:  ps.isLoading,  // CHANGE 9
    isLoaded:   ps.isLoaded,   // CHANGE 11
    error:      ps.error,      // CHANGE 10
    speed:      ps.speed,
    play,
    pause,
    resume,
    stop,
    seek,
    setSpeed,
  };
};