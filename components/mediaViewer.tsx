import { cdnFullUrl, cdnVideoUrl } from "@/lib/cloudinaryUpload";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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

const { width: SW, height: SH } = Dimensions.get("window");
const CONTROLS_HIDE_MS = 3000; // auto-hide controls after 3s

// Lazy-load native-only packages (not available on web)
let Video: any = null;
if (Platform.OS !== "web") {
  try {
    Video = require("expo-av").Video;
  } catch {}
}

interface Props {
  uri: string | null;
  type: "image" | "video";
  onClose: () => void;
}

// ── Animated dots component ───────────────────────────────────────
// Reused here as a buffering indicator
const BufferingDots = () => {
  const d1 = useSharedValue(0.3);
  const d2 = useSharedValue(0.3);
  const d3 = useSharedValue(0.3);

  useEffect(() => {
    const startPulse = (sv: any, delay: number) => {
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
    startPulse(d1, 0);
    startPulse(d2, 150);
    startPulse(d3, 300);
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

// ── Main component ────────────────────────────────────────────────
export const MediaViewer = ({ uri, type, onClose }: Props) => {
  const insets = useSafeAreaInsets();

  // Video state
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [progress, setProgress] = useState(0); // 0–1
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [showControls, setShowControls] = useState(true);

  const videoRef = useRef<any>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPlay = useRef(false);

  // Animated values for fade in/out
  const backdropOpacity = useSharedValue(0);
  const mediaScale = useSharedValue(0.96);

  // ── Reset on open ─────────────────────────────────────────────
  useEffect(() => {
    if (uri) {
      backdropOpacity.value = withTiming(1, { duration: 50 });
      mediaScale.value = withSpring(1, { damping: 200, stiffness: 350 });
      setIsPlaying(false);
      setProgress(0);
      setPositionMs(0);
      setDurationMs(0);
      setVideoReady(false);
      setVideoError(false);
      setIsBuffering(false);
      setShowControls(true);
      pendingPlay.current = false;
    } else {
      backdropOpacity.value = withTiming(0, { duration: 50 });
      mediaScale.value = withTiming(1, { duration: 50 });
    }
  }, [uri]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));
  const mediaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: mediaScale.value }],
  }));

  // Build correct Cloudinary URLs
  // VIDEO: must be /video/upload/q_auto,f_auto,vc_auto/ for streaming
  // IMAGE: standard CDN URL
  const videoUri = uri && type === "video" ? cdnVideoUrl(uri) : null;
  const imageUri = uri && type === "image" ? cdnFullUrl(uri) : uri;

  // ── Controls auto-hide ────────────────────────────────────────
  const resetControlsTimer = useCallback(() => {
    clearTimeout(controlsTimer.current!);
    setShowControls(true);
    controlsTimer.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, CONTROLS_HIDE_MS);
  }, [isPlaying]);

  const handleTapMedia = useCallback(() => {
    if (showControls) {
      clearTimeout(controlsTimer.current!);
      setShowControls(false);
    } else {
      resetControlsTimer();
    }
  }, [showControls, resetControlsTimer]);

  // ── Play / Pause ──────────────────────────────────────────────
  const handlePlayPause = useCallback(async () => {
    resetControlsTimer();
    if (!videoRef.current) return;

    if (!videoReady) {
      // Mark pending — will auto-play when onReadyForDisplay fires
      pendingPlay.current = true;
      return;
    }
    try {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        if (progress >= 0.99) {
          await videoRef.current.setPositionAsync(0);
        }
        await videoRef.current.playAsync();
      }
    } catch (e) {
      console.warn("[MediaViewer playPause]", e);
    }
  }, [isPlaying, videoReady, progress, resetControlsTimer]);

  // ── Seek ──────────────────────────────────────────────────────
  const handleSeek = useCallback(
    async (ratio: number) => {
      if (!videoRef.current || !durationMs) return;
      try {
        await videoRef.current.setPositionAsync(
          Math.max(0, ratio) * durationMs,
        );
        resetControlsTimer();
      } catch {}
    },
    [durationMs, resetControlsTimer],
  );

  // ── Playback status callback ──────────────────────────────────
  const handleStatus = useCallback((status: any) => {
    if (!status.isLoaded) return;
    if (status.error) {
      setVideoError(true);
      return;
    }

    setVideoReady(true);
    setIsPlaying(status.isPlaying ?? false);
    setIsBuffering(status.isBuffering ?? false);
    setDurationMs(status.durationMillis ?? 0);
    setPositionMs(status.positionMillis ?? 0);
    setProgress(
      status.durationMillis ? status.positionMillis / status.durationMillis : 0,
    );

    if (status.didJustFinish) {
      setIsPlaying(false);
      setProgress(1);
      setShowControls(true);
    }

    // Auto-play if user tapped before video was ready
    if (pendingPlay.current && !status.isPlaying && videoRef.current) {
      pendingPlay.current = false;
      videoRef.current.playAsync().catch(() => {});
    }
  }, []);

  // ── Format time ───────────────────────────────────────────────
  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  };

  // ── Progress bar press ────────────────────────────────────────
  const progressBarWidth = SW - 48; // horizontal padding
  const handleProgressPress = useCallback(
    (x: number) => {
      handleSeek(x / progressBarWidth);
    },
    [handleSeek, progressBarWidth],
  );

  if (!uri) return null;
  const isVideo = type === "video";

  return (
    <Modal
      visible={!!uri}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      hardwareAccelerated
    >
      <Animated.View style={[vw.backdrop, backdropStyle]}>
        {/* ── Tap-to-toggle overlay ─────────────────────────── */}
        <TouchableWithoutFeedback onPress={handleTapMedia}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        {/* ── Media ────────────────────────────────────────── */}
        <Animated.View
          style={[vw.mediaWrap, mediaStyle]}
          pointerEvents="box-none"
        >
          {isVideo ? (
            Platform.OS === "web" ? (
              // ── Web: native <video> element ──────────────────
              <View style={vw.media}>
                {React.createElement("video", {
                  src: videoUri ?? uri,
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
              </View>
            ) : Video ? (
              // ── Native: expo-av streaming ─────────────────────
              // STREAMING ARCHITECTURE:
              //   source.uri = /video/upload/q_auto,f_auto,vc_auto/{id}.mp4
              //   Cloudinary returns Content-Range headers → expo-av buffers
              //   only the first few seconds, then streams the rest lazily.
              //   This gives WhatsApp-level "instant" playback feel.
              //   shouldPlay=false: user-initiated (no autoplay)
              //   progressUpdateIntervalMillis=100: 10fps progress bar updates
              <View style={vw.media}>
                <Video
                  ref={videoRef}
                  source={{ uri: videoUri ?? uri }}
                  style={vw.media}
                  resizeMode={"contain" as any}
                  shouldPlay={false}
                  isLooping={false}
                  isMuted={false}
                  useNativeControls={false}
                  progressUpdateIntervalMillis={100}
                  positionMillis={0}
                  onPlaybackStatusUpdate={handleStatus}
                  onReadyForDisplay={() => {
                    setVideoReady(true);
                    if (pendingPlay.current && videoRef.current) {
                      pendingPlay.current = false;
                      videoRef.current.playAsync().catch(() => {});
                    }
                  }}
                  onError={(e: any) => {
                    console.error("[MediaViewer Video error]", e, videoUri);
                    setVideoError(true);
                  }}
                />

                {/* Buffering overlay */}
                {(isBuffering || (!videoReady && !videoError)) && (
                  <View style={vw.bufferingOverlay}>
                    <BufferingDots />
                  </View>
                )}

                {/* Error overlay */}
                {videoError && (
                  <View style={vw.errorOverlay}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={44}
                      color="rgba(255,255,255,0.5)"
                    />
                    <Text style={vw.errorTxt}>Could not play video</Text>
                  </View>
                )}

                {/* Play button overlay (center) — shown when paused */}
                {!isPlaying && !videoError && (
                  <TouchableOpacity
                    style={vw.playCenter}
                    onPress={handlePlayPause}
                    activeOpacity={0.8}
                  >
                    <View style={vw.playBtn}>
                      {!videoReady ? (
                        <ActivityIndicator size="large" color="#fff" />
                      ) : (
                        <Ionicons
                          name="play"
                          size={32}
                          color="#fff"
                          style={{ paddingLeft: 4 }}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                )}

                {/* Invisible tap surface to pause when playing */}
                {isPlaying && (
                  <TouchableWithoutFeedback onPress={handlePlayPause}>
                    <View style={StyleSheet.absoluteFill} />
                  </TouchableWithoutFeedback>
                )}
              </View>
            ) : (
              <View style={[vw.media, vw.fallback]}>
                <Ionicons
                  name="videocam-outline"
                  size={52}
                  color="rgba(255,255,255,0.35)"
                />
                <Text style={vw.fallbackTxt}>
                  Install expo-av to play videos
                </Text>
              </View>
            )
          ) : (
            // ── Image viewer ──────────────────────────────────
            <Image
              source={{ uri: imageUri ?? "" }}
              style={vw.media}
              resizeMode="contain"
            />
          )}
        </Animated.View>

        {/* ── Controls (conditionally shown, fade in/out) ────── */}
        {showControls && (
          <Animated.View
            style={StyleSheet.absoluteFill}
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(220)}
            pointerEvents="box-none"
          >
            {/* Top bar — close only */}
            <View style={[vw.topBar, { paddingTop: insets.top + 6 }]}>
              <TouchableOpacity
                style={vw.closeBtn}
                onPress={onClose}
                activeOpacity={0.8}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Bottom controls — only for video */}
            {isVideo && videoReady && !videoError && (
              <View
                style={[vw.bottomBar, { paddingBottom: insets.bottom + 12 }]}
              >
                {/* Time */}
                <Text style={vw.timeTxt}>{fmt(positionMs)}</Text>

                {/* Progress bar */}
                <TouchableOpacity
                  style={vw.progressTrack}
                  activeOpacity={1}
                  onPress={(e) => handleProgressPress(e.nativeEvent.locationX)}
                >
                  <View
                    style={[
                      vw.progressFill,
                      { width: `${progress * 100}%` as any },
                    ]}
                  />
                  <View
                    style={[
                      vw.progressThumb,
                      { left: `${Math.min(progress * 100, 98)}%` as any },
                    ]}
                  />
                </TouchableOpacity>

                {/* Duration */}
                <Text style={vw.timeTxt}>{fmt(durationMs)}</Text>

                {/* Play / Pause */}
                <TouchableOpacity
                  onPress={handlePlayPause}
                  style={vw.controlBtn}
                >
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={22}
                    color="#fff"
                  />
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
};

export default MediaViewer;

// ── Styles ────────────────────────────────────────────────────────
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
  media: {
    width: SW,
    height: SH,
  },

  // Buffering dots
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
  },

  // Error
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  errorTxt: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    fontWeight: "600",
  },

  // Center play button
  playCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Fallback
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  fallbackTxt: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 13,
  },

  // Controls overlay
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    // Subtle gradient-like fade for readability
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  timeTxt: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
    minWidth: 38,
    textAlign: "center",
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 2,
    justifyContent: "center",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#6D4AFF",
    borderRadius: 2,
  },
  progressThumb: {
    position: "absolute",
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#fff",
    top: -5,
    transform: [{ translateX: -6 }],
  },
  controlBtn: {
    padding: 4,
  },
});
