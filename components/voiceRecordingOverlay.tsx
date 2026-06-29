import { ms, s, vs } from "@/utils/scale";
import { Ionicons } from "@expo/vector-icons";
import React, { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
interface Props {
  visible: boolean;
  elapsedMs: number;
  liveBars: number[];
  translateX: SharedValue<number>; 
  cancelThreshold: number; 
}
const formatDuration = (ms: number): string => {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};
const T = {
  purple: "#6D4AFF",
  white: "#FFFFFF",
  grey: "#8E8E93",
  red: "#6D4AFF",
  bg: "#1C1C1E",
};
const WaveformBars = memo(({ bars }: { bars: number[] }) => {
  const displayBars = bars.length < 20
    ? [...Array(20 - bars.length).fill(8), ...bars]
    : bars.slice(-20);
  return (
    <View style={wv.container}>
      {displayBars.map((height, i) => {
        const h = Math.max(4, Math.min(100, height));
        const pxHeight = 3 + (h / 100) * 25;
        return (
          <View
            key={i}
            style={[
              wv.bar,
              {
                height: pxHeight,
                backgroundColor: T.purple,
                opacity: 0.4 + (i / displayBars.length) * 0.6,
              },
            ]}
          />
        );
      })}
    </View>
  );
});

const wv = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(2),
    height: s(32),
  },
  bar: {
    width: s(3),
    borderRadius: s(2),
  },
});

// ─── RecordDot (pulsing red dot) ─────────────────────────────────────────────
const RecordDot = memo(() => {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 500 }),
        withTiming(1, { duration: 500 })
      ),
      -1,
      false
    );
    return () => {
      scale.value = 1;
    };
  }, []);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[rd.dot, dotStyle]} />
  );
});

const rd = StyleSheet.create({
  dot: {
    width: s(10),
    height: s(10),
    borderRadius: s(5),
    backgroundColor: T.purple,
  },
});

// ─── VoiceRecordingOverlay ────────────────────────────────────────────────────
export const VoiceRecordingOverlay = memo(
  ({ visible, elapsedMs, liveBars, translateX, cancelThreshold }: Props) => {
    const mountAnim = useSharedValue(0);

    useEffect(() => {
      mountAnim.value = visible
        ? withSpring(1, { damping: 18, stiffness: 260 })
        : withTiming(0, { duration: 150 });
    }, [visible]);

    // Slide hint fades out as user slides left
    const slideHintStyle = useAnimatedStyle(() => {
      const progress = Math.min(1, Math.abs(translateX.value) / cancelThreshold);
      return {
        opacity: interpolate(progress, [0, 0.5, 1], [0.7, 0.3, 0]),
      };
    });

    // Trash icon fades in as user slides left
    const trashStyle = useAnimatedStyle(() => {
      const progress = Math.min(1, Math.abs(translateX.value) / cancelThreshold);
      return {
        opacity: interpolate(progress, [0.4, 1], [0, 1]),
        transform: [
          { scale: interpolate(progress, [0.4, 1], [0.6, 1]) },
        ],
      };
    });

    // Container slides in from bottom
    const containerStyle = useAnimatedStyle(() => ({
      opacity: mountAnim.value,
      transform: [
        { translateY: interpolate(mountAnim.value, [0, 1], [12, 0]) },
      ],
    }));

    // Mic button follows finger horizontally
    const micBtnStyle = useAnimatedStyle(() => ({
      transform: [
        {
          translateX: interpolate(
            translateX.value,
            [cancelThreshold, 0],
            [cancelThreshold, 0],
            "clamp"
          ),
        },
      ],
    }));

    if (!visible) return null;

    return (
      <Animated.View style={[st.container, containerStyle]}>
        <View style={st.leftSection}>
          <RecordDot />
          <Text style={st.timer}>{formatDuration(elapsedMs)}</Text>
        </View>
        <View style={st.waveSection}>
          <WaveformBars bars={liveBars} />
        </View>
        <View style={st.rightSection}>
          <Animated.View style={[st.slideHint, slideHintStyle]}>
            <Ionicons name="chevron-back" size={14} color={T.grey} />
            <Text style={st.slideText}>Slide to cancel</Text>
          </Animated.View>
          <Animated.View style={[st.trashIcon, trashStyle]}>
            <Ionicons name="trash-outline" size={20} color={T.purple} />
          </Animated.View>
        </View>
        <Animated.View style={[st.micBtn, micBtnStyle]}>
          <Ionicons name="mic" size={20} color={T.white} />
        </Animated.View>
      </Animated.View>
    );
  }
);
const st = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7F7F7",
    borderRadius: s(26),
    paddingHorizontal: s(12),
    height: vs(46),
    flex: 1,
    overflow: "hidden",
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(6),
    minWidth: s(60),
  },
  timer: {
    fontSize: ms(13),
    fontWeight: "600",
    color: T.red,
    fontVariant: ["tabular-nums"],
  },
  waveSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: s(4),
  },
  rightSection: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    minWidth: s(90),
  },
  slideHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(2),
    position: "absolute",
  },
  slideText: {
    fontSize: ms(12),
    color: T.grey,
  },
  trashIcon: {
    position: "absolute",
  },
  micBtn: {
    width: s(36),
    height: s(36),
    borderRadius: s(18),
    backgroundColor: T.purple,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: s(8),
  },
});