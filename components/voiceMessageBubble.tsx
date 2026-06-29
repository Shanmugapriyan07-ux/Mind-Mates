import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { ms, s, vs } from "@/utils/scale";
import { Ionicons } from "@expo/vector-icons";
import React, { memo, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";


const SCREEN_W = Dimensions.get("window").width;

// ─── Types ────────────────────────────────────────────────────────────────────
export type VoiceStatus =
  | "uploading"
  | "sent"
  | "delivered"
  | "seen"
  | "failed";

export interface VoiceMessageBubbleProps {
  messageId: string;
  audioUrl: string; // empty string while uploading
  durationSec: number;
  waveform: number[]; // 0-100 bar heights
  status: VoiceStatus;
  isMe: boolean;
  timestamp: string; // pre-formatted "HH:MM"
  isFailed?: boolean;
  onRetry?: () => void;
   onLongPress?: () => void;   // ← ADD
  onReact?: (emoji: string) => void;  // ← ADD
  onReply?: () => void;  
}

// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
  purple: "#6D4AFF",
  purpleLight: "#ffffff",
  white: "#FFFFFF",
  grey: "#ffffff",
  greyLight: "#ffffff",
  red: "#FF3B30",
  green: "#34C759",
  textDark: "#1C1C1E",
};
const fmt = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};
const durationToWidth = (sec: number): number => {
  const min = 0.52;
  const max = 0.90;
  const frac = Math.min(1, sec / 120); // 120s = 100%
  return Math.round(SCREEN_W * (min + frac * (max - min)));
};
const SPEEDS = [1, 1.5, 2] as const;
type Speed = (typeof SPEEDS)[number];
const StatusIcon = memo(({ status }: { status: VoiceStatus }) => {
  if (status === "uploading") {
    return <ActivityIndicator size={10} color={T.grey} />;
  }
  if (status === "failed") {
    return <Ionicons name="alert-circle" size={12} color={T.red} />;
  }
  if (status === "seen") {
    return null;
  }
  if (status === "delivered") {
    return <Ionicons name="checkmark-done" size={16} color={T.grey} />;
  }
  return <Ionicons name="checkmark" size={16} color={T.grey} />;
});
interface WaveformProps {
  bars: number[];
  progressFrac: number; // 0..1
  isMe: boolean;
  onSeek: (frac: number) => void;
}
const WaveformPlayback = memo(({ bars, progressFrac, isMe, onSeek }: WaveformProps) => {
  const display = bars.length > 0 ? bars : Array(24).fill(20);
  const capped = display.slice(0, 40);
  return (
    <View style={wf.container}>
      {capped.map((height, i) => {
        const frac = i / (capped.length - 1);
        const active = frac <= progressFrac;
        const h = Math.max(3, Math.min(100, height));
        const px = 3 + (h / 100) * 20;
        return (
          <TouchableOpacity
            key={i}
            onPress={() => onSeek(frac)}
            hitSlop={{ top: 8, bottom: 8, left: 1, right: 1 }}
            activeOpacity={0.7}
          >
            <View
              style={[
                wf.bar,
                {
                  height: px,
                  backgroundColor: active
                    ? isMe
                      ? T.purple
                      : T.purple
                    : isMe
                    ?  T.white
                    : T.greyLight,
                },
              ]}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const wf = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(2),
    height: s(28),
    flex: 1,
  },
  bar: {
    width: s(3),
    borderRadius: s(2),
  },
});

// ─── VoiceMessageBubble ───────────────────────────────────────────────────────
export const VoiceMessageBubble = memo(
  ({
    messageId,
    audioUrl,
    durationSec,
    waveform,
    status,
    isMe,
    timestamp,
    isFailed,
    onRetry,
   onLongPress  }: VoiceMessageBubbleProps) => {
    const { playingId, positionMs, durationMs, isPlaying, speed, play, seek, setSpeed } =
      useAudioPlayer();

    const isThisPlaying = playingId === messageId;
    const progressFrac = isThisPlaying && durationMs > 0
      ? Math.min(1, positionMs / durationMs)
      : 0;

    const displaySec = isThisPlaying
      ? Math.floor(positionMs / 1000)
      : durationSec;

    const bubbleWidth = useMemo(
      () => durationToWidth(durationSec),
      [durationSec]
    );

    const handlePlay = useCallback(() => {
      if (status === "uploading" || !audioUrl) return;
      play(messageId, audioUrl);
    }, [messageId, audioUrl, status, play]);

    const handleSeek = useCallback(
      (frac: number) => {
        if (!isThisPlaying || durationMs === 0) return;
        seek(frac * durationMs);
      },
      [isThisPlaying, durationMs, seek]
    );

    const handleSpeedToggle = useCallback(() => {
      const idx = SPEEDS.indexOf(speed as Speed);
      const next = SPEEDS[(idx + 1) % SPEEDS.length];
      setSpeed(next);
    }, [speed, setSpeed]);

    const isUploading = status === "uploading";

    const bubbleBg = isMe
      ? isFailed
        ? "#3D1A1A"
        :  T.white
      : T.purpleLight;

    return (
         <TouchableOpacity
        onLongPress={onLongPress}
        delayLongPress={300}
        activeOpacity={1}
        style={{ alignSelf: isMe ? "flex-end" : "flex-start" }}
      >
      <View
        style={[
          st.bubble,
          {
            width: bubbleWidth,
            backgroundColor: bubbleBg,
          
          },
        ]}
      >
        <TouchableOpacity
          style={[st.playBtn, { backgroundColor: isMe ? T.textDark : T.purple }]}
          onPress={isFailed ? onRetry : handlePlay}
          disabled={isUploading}
          activeOpacity={0.75}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color={isMe ? T.purple : T.purple} />
          ) : isFailed ? (
            <Ionicons name="reload" size={18} color={T.white} />
          ) : isThisPlaying && isPlaying ? (
            <Ionicons name="pause" size={18} color={isMe ? T.purple : T.white} />
          ) : (
            <Ionicons name="play" size={18} color={isMe ? T.purple : T.white} />
          )}
        </TouchableOpacity>
        <WaveformPlayback
          bars={waveform}
          progressFrac={progressFrac}
          isMe={isMe}
          onSeek={handleSeek}
        />
        <View style={st.footer}>
          <Text style={[st.durationText, { color: isMe ? T.purple : T.purple }]}>
            {isUploading ? "Uploading…" : fmt(displaySec)}
          </Text>
          {isThisPlaying && (
            <TouchableOpacity onPress={handleSpeedToggle} style={st.speedBtn}>
              <Text style={[st.speedText, { color: isMe ? T.purple : T.purple }]}>
                {speed}×
              </Text>
            </TouchableOpacity>
          )}

          <View style={st.rightFooter}>
            <Text style={[st.tsText, { color: isMe ? T.purple : T.purple }]}>
              {timestamp}
            </Text>
            {isMe && <StatusIcon status={status} />}
          </View>
        </View>
      </View>
      </TouchableOpacity>
    );
  }
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  bubble: {
    borderRadius: s(20),
    padding: s(10),
    paddingBottom: s(10),
    maxWidth: "90%",
    flexDirection:'row',
    marginBottom:vs(3)

  },
  playBtn: {
    width: s(38),
    height: s(38),
    borderRadius: s(19),
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    marginRight:s(5)
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: vs(25),
    gap: s(10),
  },
  durationText: {
    fontSize: ms(11),
    fontVariant: ["tabular-nums"],

  },
  speedBtn: {
    paddingHorizontal: s(5),
    paddingVertical: vs(1),
    borderRadius: s(6),
  },
  speedText: {
    fontSize: ms(11),
    fontWeight: "700",
  },
  rightFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(3),
    marginLeft: "auto",
  },
  tsText: {
    fontSize: ms(10),
    
  },
});