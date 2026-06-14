import {
  cdnFullUrl,
  cdnVideoStreamUrl,
  cdnVideoThumbUrl,
  cdnVideoUrl,
} from "@/lib/cloudinaryUpload";
import { ms, s, vs } from "@/utils/scale";
import { Ionicons } from "@expo/vector-icons";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import ImageView from "react-native-image-viewing";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── expo-video (new API) ──────────────────────────────────────────────────────
let ExpoVideo: any = null;
try {
  // Using require to prevent top-level import crash if module is missing
  ExpoVideo = require("expo-video");
} catch (e) {
  console.warn(
    "[MediaViewer] expo-video native module not found. Rebuild your app.",
  );
}

// Helper to check if native video is available
const isVideoAvailable = !!(ExpoVideo?.useVideoPlayer && ExpoVideo?.VideoView);
const { useVideoPlayer, VideoView } = ExpoVideo || {};

const { width: SW, height: SH } = Dimensions.get("window");
const CONTROLS_HIDE_MS = 3000;

interface Props {
  uri: string | null;
  type: "image" | "video";
  onClose: () => void;
}

// ─── BufferingDots ────────────────────────────────────────────────────────────
const BufferingDots = () => {
  const d1 = useSharedValue(0.3);
  const d2 = useSharedValue(0.3);
  const d3 = useSharedValue(0.3);

  useEffect(() => {
    const pulse = (sv: any, delay: number) => {
      sv.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 400 }),
            withTiming(0.3, { duration: 400 }),
          ),
          -1,
        ),
      );
    };
    pulse(d1, 0);
    pulse(d2, 150);
    pulse(d3, 300);
  }, []);

  const s1 = useAnimatedStyle(() => ({ opacity: d1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: d2.value }));
  const s3 = useAnimatedStyle(() => ({ opacity: d3.value }));

  return (
    <View style={vw.dotsRow}>
      <Animated.View style={[vw.dot, s1]} />
      <Animated.View style={[vw.dot, s2]} />
      <Animated.View style={[vw.dot, s3]} />
    </View>
  );
};

// ─── VideoPlayer (inner component — needed so useVideoPlayer hook is stable) ──
// expo-video requires useVideoPlayer to be called with a stable URI.
// We isolate it in a child so the hook re-mounts cleanly when URI changes.
const VideoPlayerInner = ({
  videoUri,
  videoPoster,
  onClose,
}: {
  videoUri: string;
  videoPoster: string | null;
  onClose: () => void;
}) => {
  const insets = useSafeAreaInsets();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [showControls, setShowControls] = useState(true);

  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoViewRef = useRef<any>(null);

  // ── expo-video player ─────────────────────────────────────────────────────
  const player = useVideoPlayer(videoUri, (p: any) => {
    p.loop = false;
    p.muted = false;
    p.volume = 1.0;
    // Don't autoplay — wait for user tap
  });

  // ── Subscribe to player events ────────────────────────────────────────────
  useEffect(() => {
    if (!player) return;

    const statusSub = player.addListener("statusChange", (status: any) => {
      if (status.status === "readyToPlay") {
        setVideoReady(true);
        setIsBuffering(false);
        setVideoError(false);
        setDurationMs((player.duration ?? 0) * 1000);
      }
      if (status.status === "error") {
        setVideoError(true);
        setIsBuffering(false);
      }
      if (status.status === "loading") {
        setIsBuffering(true);
      }
    });

    const playingSub = player.addListener("playingChange", (payload: any) => {
      setIsPlaying(payload.isPlaying);
      if (isPlaying) {
        resetControlsTimer();
      }
    });

    // Poll position for scrubber (expo-video doesn't have onProgress callback)
    const poller = setInterval(() => {
      if (!player) return;
      const pos = (player.currentTime ?? 0) * 1000;
      const dur = (player.duration ?? 0) * 1000;
      setPositionMs(pos);
      setDurationMs(dur);
      setProgress(dur > 0 ? pos / dur : 0);
    }, 250);

    return () => {
      statusSub.remove();
      playingSub.remove();
      clearInterval(poller);
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, [player]);

  const resetControlsTimer = useCallback(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    setShowControls(true);
    controlsTimer.current = setTimeout(() => {
      setShowControls(false);
    }, CONTROLS_HIDE_MS);
  }, []);

  const handleTapMedia = useCallback(() => {
    if (showControls) {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      setShowControls(false);
    } else {
      resetControlsTimer();
    }
  }, [showControls, resetControlsTimer]);

  const handlePlayPause = useCallback(() => {
    if (!player || !videoReady) return;
    resetControlsTimer();

    try {
      if (progress >= 0.99) {
        player.currentTime = 0;
        player.play();
      } else if (isPlaying) {
        player.pause();
      } else {
        player.play();
      }
    } catch (e) {
      console.warn("[MediaViewer] playPause error:", e);
    }
  }, [player, isPlaying, videoReady, progress, resetControlsTimer]);

  const handleSeek = useCallback(
    (ratio: number) => {
      if (!player || !durationMs) return;
      try {
        player.currentTime = Math.max(0, ratio) * (durationMs / 1000);
        resetControlsTimer();
      } catch {}
    },
    [player, durationMs, resetControlsTimer],
  );

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const progressBarWidth = SW - 48;

  const handleRetry = useCallback(() => {
    setVideoError(false);
    setVideoReady(false);
    setIsBuffering(true);
    try {
      player.replace(videoUri);
    } catch {}
  }, [player, videoUri]);

  return (
    <>
      {/* Video view */}
      <TouchableWithoutFeedback onPress={handleTapMedia}>
        <View style={vw.media}>
          <VideoView
            ref={videoViewRef}
            player={player}
            style={vw.media}
            contentFit="contain"
            nativeControls={false} // ← we build our own controls
            allowsFullscreen={false}
            allowsPictureInPicture={false}
          />

          {/* Poster while loading */}
          {!videoReady && videoPoster && !videoError && (
            <Image
              source={{ uri: videoPoster }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          )}

          {/* Buffering dots */}
          {isBuffering && !videoError && (
            <View style={vw.bufferingOverlay}>
              <BufferingDots />
            </View>
          )}

          {/* Error state */}
          {videoError && (
            <View style={vw.errorOverlay}>
              <Ionicons
                name="alert-circle-outline"
                size={44}
                color="rgba(255,255,255,0.5)"
              />
              <Text style={vw.errorTxt}>Could not play video</Text>
              <TouchableOpacity
                style={vw.retryBtn}
                onPress={handleRetry}
                activeOpacity={0.8}
              >
                <Text style={vw.retryTxt}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Centre play button when paused */}
          {!isPlaying && !videoError && showControls && (
            <TouchableOpacity
              style={vw.playCenter}
              onPress={handlePlayPause}
              activeOpacity={0.8}
            >
              <View style={vw.playBtn}>
                {isBuffering ? (
                  // ActivityIndicator from RN (no expo-av needed)
                  <View style={vw.spinnerWrap}>
                    <BufferingDots />
                  </View>
                ) : (
                  <Ionicons
                    name={progress >= 0.99 ? "refresh" : "play"}
                    size={32}
                    color="#fff"
                    style={{ paddingLeft: progress >= 0.99 ? 0 : 4 }}
                  />
                )}
              </View>
            </TouchableOpacity>
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* Controls overlay */}
      {showControls && (
        <Animated.View
          style={StyleSheet.absoluteFill}
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(220)}
          pointerEvents="box-none"
        >
          {/* Top bar */}
          <View style={[vw.topBar, { paddingTop: insets.top + 6 }]}>
            <TouchableOpacity
              style={vw.closeBtn}
              onPress={onClose}
              activeOpacity={0.8}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Bottom scrubber */}
          {videoReady && !videoError && (
            <View style={[vw.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
              <Text style={vw.timeTxt}>{fmt(positionMs)}</Text>

              <TouchableOpacity
                style={vw.progressTrack}
                activeOpacity={1}
                onPress={(e) =>
                  handleSeek(e.nativeEvent.locationX / progressBarWidth)
                }
              >
                <View
                  style={[
                    vw.progressFill,
                    { width: `${Math.min(progress * 100, 100)}%` as any },
                  ]}
                />
                <View
                  style={[
                    vw.progressThumb,
                    { left: `${Math.min(progress * 100, 98)}%` as any },
                  ]}
                />
              </TouchableOpacity>

              <Text style={vw.timeTxt}>{fmt(durationMs)}</Text>

              <TouchableOpacity onPress={handlePlayPause} style={vw.controlBtn}>
                <Ionicons
                  name={
                    isPlaying ? "pause" : progress >= 0.99 ? "refresh" : "play"
                  }
                  size={22}
                  color="#fff"
                />
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      )}
    </>
  );
};

// ─── MediaViewer ──────────────────────────────────────────────────────────────
export const MediaViewer = ({ uri, type, onClose }: Props) => {
  const backdropOpacity = useSharedValue(0);
  const mediaScale = useSharedValue(0.96);

  // ── Clean URI ─────────────────────────────────────────────────────────────
  const cleanUri = useMemo(() => {
    if (!uri) return null;
    return uri
      .replace("__VID__", "")
      .replace("__IMG__", "")
      .split("\n")[0]
      .trim();
  }, [uri]);

  const isCloudinary = !!cleanUri?.includes("cloudinary.com");

  // ── Fallback for missing native module ────────────────────────────────────
  const Fallback = () => (
    <View style={[vw.media, vw.fallback]}>
      <Ionicons
        name="videocam-outline"
        size={64}
        color="rgba(255,255,255,0.2)"
      />
      <Text style={vw.fallbackTxt}>Video Player not available</Text>
      <Text style={vw.fallbackTxtSub}>Please run: npx expo run:android</Text>
    </View>
  );

  // ── Video URLs ────────────────────────────────────────────────────────────
  const videoUri = useMemo(() => {
    if (!cleanUri || type !== "video") return null;
    if (Platform.OS === "web") {
      return isCloudinary ? cdnVideoUrl(cleanUri) : cleanUri;
    }
    // Try HLS stream first, fallback to progressive MP4
    return isCloudinary
      ? (cdnVideoStreamUrl(cleanUri) ?? cdnVideoUrl(cleanUri) ?? cleanUri)
      : cleanUri;
  }, [cleanUri, type, isCloudinary]);

  const videoPoster = useMemo(() => {
    if (!cleanUri || type !== "video" || !isCloudinary) return null;
    return cdnVideoThumbUrl(cleanUri, Math.round(SW), Math.round(SH));
  }, [cleanUri, type, isCloudinary]);

  const imageUri = useMemo(() => {
    if (!cleanUri || type !== "image") return null;
    return isCloudinary ? cdnFullUrl(cleanUri) : cleanUri;
  }, [cleanUri, type, isCloudinary]);

  // ── Entrance animation ────────────────────────────────────────────────────
  useEffect(() => {
    if (cleanUri) {
      backdropOpacity.value = withTiming(1, { duration: 150 });
      mediaScale.value = withSpring(1, { damping: 200, stiffness: 350 });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [cleanUri]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));
  const mediaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: mediaScale.value }],
  }));

  if (!cleanUri) return null;

  // ── Image ─────────────────────────────────────────────────────────────────
  if (type === "image") {
    return (
      <ImageView
        images={[{ uri: imageUri ?? cleanUri }]}
        imageIndex={0}
        visible={!!cleanUri}
        onRequestClose={onClose}
        swipeToCloseEnabled
        doubleTapToZoomEnabled
        presentationStyle="overFullScreen"
        backgroundColor="#000"
      />
    );
  }

  // ── Video ─────────────────────────────────────────────────────────────────
  if (!videoUri) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      hardwareAccelerated
    >
      <Animated.View style={[vw.backdrop, backdropStyle]}>
        <Animated.View
          style={[vw.mediaWrap, mediaStyle]}
          pointerEvents="box-none"
        >
          {Platform.OS === "web" ? (
            // Web: use native <video> element
            <View style={vw.media}>
              {React.createElement("video", {
                src: videoUri,
                controls: true,
                playsInline: true,
                autoPlay: false,
                preload: "auto",
                style: {
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  backgroundColor: "#000",
                },
              })}
              <View style={[vw.topBar, { paddingTop: 16 }]}>
                <TouchableOpacity style={vw.closeBtn} onPress={onClose}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          ) : isVideoAvailable ? (
            // Native: expo-video
            // Key prop forces remount when URI changes — critical for expo-video
            <VideoPlayerInner
              key={videoUri}
              videoUri={videoUri}
              videoPoster={videoPoster}
              onClose={onClose}
            />
          ) : (
            <Fallback />
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default MediaViewer;

// ─── Styles ───────────────────────────────────────────────────────────────────
const vw = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaWrap: {
    width: SW,
    height: SH,
    alignItems: "center",
    justifyContent: "center",
  },
  media: { width: SW, height: SH },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  dotsRow: { flexDirection: "row", alignItems: "center", gap: s(8)},
  dot: { width: s(10), height: s(10), borderRadius: s(5), backgroundColor: "#fff" },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: s(12),
  },
  errorTxt: { color: "rgba(255,255,255,0.6)", fontSize: ms(15), fontWeight: "600" },
  retryBtn: {
    marginTop: vs(8),
    paddingHorizontal: vs(24),
    paddingVertical: vs(10),
    borderRadius: s(20),
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  retryTxt: { color: "#fff", fontSize: ms(14), fontWeight: "600" },
  playCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtn: {
    width: s(70),
    height: s(70),
    borderRadius: s(35),
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  spinnerWrap: { alignItems: "center", justifyContent: "center" },
  fallback: { alignItems: "center", justifyContent: "center", gap: s(14) },
  fallbackTxt: {
    color: "rgba(255,255,255,0.5)",
    fontSize: ms(16),
    fontWeight: "600",
  },
  fallbackTxtSub: { color: "rgba(255,255,255,0.3)", fontSize: ms(12) },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: vs(16),
    paddingBottom: vs(16),
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  closeBtn: {
    width: s(40),
    height: s(40),
    borderRadius: s(20),
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: s(10),
    paddingHorizontal: vs(16),
    paddingTop: vs(16),
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  timeTxt: {
    color: "#fff",
    fontSize: ms(12),
    fontWeight: "500",
    minWidth: vs(38),
    textAlign: "center",
  },
  progressTrack: {
    flex: 1,
    height: s(4),
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: s(2),
    justifyContent: "center",
  },
  progressFill: { height: "100%", backgroundColor: "#6D4AFF", borderRadius: s(2) },
  progressThumb: {
    position: "absolute",
    width: s(13),
    height: s(13),
    borderRadius: s(7),
    backgroundColor: "#fff",
    top: vs(-5),
    transform: [{ translateX: -6 }],
  },
  controlBtn: { padding: 4 },
});
