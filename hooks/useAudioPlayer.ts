import {
  AudioPlayer,
  AudioStatus,
  createAudioPlayer,
  setAudioModeAsync,
} from "expo-audio";
import { Directory, File, Paths } from "expo-file-system/next";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
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
    const withTimes = files
      .map((f) => {
        try {
          return { file: f, mtime: f.modificationTime ?? 0 };
        } catch {
          return { file: f, mtime: 0 };
        }
      })
      .sort((a, b) => a.mtime - b.mtime);

    const excess = withTimes.slice(0, withTimes.length - MAX_CACHE_FILES);
    for (const { file } of excess) {
      try { file.delete(); } catch {}
    }
  } catch {}
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
        return url; 
      }
    }
  }
  return url;
};
type Listener = () => void;

interface PlayerSingleton {
  player: AudioPlayer | null;
  playerToken: number;  // ← new: identifies which play() call "owns" the current player
  playingId: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  positionMs: number;
  durationMs: number;
  speed: number;
  listeners: Set<Listener>;
}

const ps: PlayerSingleton = {
  player: null,
  playerToken: 0,
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


let operationId = 0;
let playerSubscription: { remove: () => void } | null = null;
let loadingGuard = false;

const notifyListeners = () => ps.listeners.forEach((fn) => fn());

const updateState = (patch: Partial<Omit<PlayerSingleton, "sound" | "listeners">>) => {
  Object.assign(ps, patch);
  notifyListeners();
};
const unloadSound = async () => {
  if (playerSubscription) {
    playerSubscription.remove();
    playerSubscription = null;
  }
  if (ps.player) {
    ps.player.pause();
    ps.player.remove();
    ps.player = null;
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

const makeOnPlaybackStatus = (token: number) => (status: AudioStatus) => {
  if (token !== ps.playerToken) return; // this event belongs to a player we've already replaced
  if (!status.isLoaded) return;
  updateState({
    isPlaying: status.playing,
    isLoaded: true,
    isLoading: false,
    error: null,
    positionMs: status.currentTime * 1000,
    durationMs: status.duration * 1000,
  });
  if (status.didJustFinish) {
    unloadSound();
  }
};

// const onPlaybackStatus = (status: AudioStatus) => {
//   if (!status.isLoaded) return;
//   updateState({
//     isPlaying: status.playing,
//     isLoaded: true,
//     isLoading: false,
//     error: null,
//     positionMs: status.currentTime * 1000,
//     durationMs: status.duration * 1000,
//   });
//   if (status.didJustFinish) {
//     unloadSound();
//   }
// };

let lastAppState: AppStateStatus = "active";
AppState.addEventListener("change", async (nextState: AppStateStatus) => {
  if (nextState === "background" || nextState === "inactive") {
    if (ps.player && ps.isPlaying) {
      ps.player.pause();
    }
  }
  if (nextState === "active" && lastAppState !== "active") {
    if (ps.player && !ps.player.isLoaded) {
      await unloadSound();
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
export const useAudioPlayer = (messageId?: string) => {
  const [, forceUpdate] = useState(0);
  const mountedRef = useRef(true);
  const lastSnapshotRef = useRef<string>('');

  useEffect(() => {
    mountedRef.current = true;
    const computeSnapshot = (): string => {
      if (messageId === undefined) return String(Date.now());
      if (ps.playingId !== messageId) {
        return `idle`;
      }
      return `${ps.isPlaying}|${ps.positionMs}|${ps.durationMs}|${ps.speed}|${ps.isLoading}|${ps.error}`;
    };

    lastSnapshotRef.current = computeSnapshot();

    const listener: Listener = () => {
      if (!mountedRef.current) return;
      const next = computeSnapshot();
      if (next !== lastSnapshotRef.current) {
        lastSnapshotRef.current = next;
        forceUpdate((n) => n + 1);
      }
    };
    ps.listeners.add(listener);
    return () => {
      mountedRef.current = false;
      ps.listeners.delete(listener);
    };
  }, [messageId]);
  const play = useCallback(async (messageId: string, url: string) => {
    if (ps.playingId === messageId && ps.player) {
      if (ps.isPlaying) {
        ps.player.pause();
      } else {
        ps.player.play();
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
      isLoading: true,  
      isLoaded: false,
      error: null,
      positionMs: 0,
      durationMs: 0,
    });
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });

      let resolvedUri = url;
      if (url.startsWith("http")) {
        resolvedUri = await downloadToCache(url);
      }
      if (myOp !== operationId) return;

      const player = createAudioPlayer({ uri: resolvedUri }, { updateInterval: PROGRESS_INTERVAL_MS });

if (myOp !== operationId) {
  player.remove();
  return;
}

ps.player = player;
ps.playerToken = myOp;
playerSubscription = player.addListener("playbackStatusUpdate", makeOnPlaybackStatus(myOp));
player.volume = 1;
player.setPlaybackRate(ps.speed, "high");
player.play();
updateState({ isPlaying: true, isLoading: false, isLoaded: true });
    } catch (e) {
      console.warn("[useAudioPlayer] play failed:", e);
      updateState({
        error: e instanceof Error ? e.message : "Playback failed",
        isLoading: false,
      });
      await unloadSound();
    } finally {
      loadingGuard = false;
    }
  }, []);
  const pause = useCallback(async () => {
    if (ps.player && ps.isPlaying) {
      ps.player.pause();
    }
  }, []);
  const resume = useCallback(async () => {
    if (ps.player && !ps.isPlaying) {
      ps.player.play();
    }
  }, []);
  const stop = useCallback(async () => {
    await unloadSound();
  }, []);
  const seek = useCallback(async (positionMs: number) => {
    if (ps.player) {
      await ps.player.seekTo(positionMs / 1000);
      updateState({ positionMs });
    }
  }, []);
  const setSpeed = useCallback(async (rate: number) => {
    updateState({ speed: rate });
    if (ps.player) {
      ps.player.setPlaybackRate(rate, "high");
    }
  }, []);
    const progress = ps.durationMs > 0 ? ps.positionMs / ps.durationMs : 0;
  return {
    playingId: ps.playingId,
    positionMs: ps.positionMs,
    durationMs: ps.durationMs,
    progress,
    isPlaying: ps.isPlaying,
    isLoading: ps.isLoading,
    isLoaded: ps.isLoaded,
    error: ps.error,
    speed: ps.speed,
    play, pause, resume, stop, seek, setSpeed,
  };
};