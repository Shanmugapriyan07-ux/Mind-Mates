import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useVoiceUpload, VoiceUploadCallbacks } from "@/hooks/useVoiceUpload";
import {
  clearPermissionCache,
  isCameraGranted,
  isLibraryGranted,
  requestCameraPermissionCached,
  requestMediaLibraryPermissionCached,
} from "@/lib/permissionsCache";
import { ms, s, vs } from "@/utils/scale";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const IMG_PREFIX = "__IMG__";
const VID_PREFIX = "__VID__";
const isImageMsg = (m: string) => m.startsWith(IMG_PREFIX);
const isVideoMsg = (m: string) => m.startsWith(VID_PREFIX);
const isMediaMsg = (m: string) => isImageMsg(m) || isVideoMsg(m);
const extractMediaCaption = (m: string) =>
  m
    .replace(IMG_PREFIX, "")
    .replace(VID_PREFIX, "")
    .split("\n")
    .slice(1)
    .join("\n")
    .trim();

const { height: SH } = Dimensions.get("window");

const T = {
  pill: "#2C2C2E",
  white: "#FFFFFF",
  grey: "#8E8E93",
  purple: "#6D4AFF",
  amber: "#F59E0B",
  red: "#FF3B30",
  circle: "#3A3A3C",
  recBg: "#1C1C1E",
  cancelBg: "#2C2C2E",
};
const fmtTime = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
};
const MediaSheet = ({
  visible,
  onClose,
  onImage,
  onVideo,
  onCamera,
}: {
  visible: boolean;
  onClose: () => void;
  onImage: () => void;
  onVideo: () => void;
  onCamera: () => void;
}) => {
  const slideAnim = useSharedValue(SH);
  const fadeAnim = useSharedValue(0);
  React.useEffect(() => {
    if (visible) {
      fadeAnim.value = withTiming(1, { duration: 150 });
      slideAnim.value = withSpring(0, {
        damping: 22,
        stiffness: 280,
        mass: 0.6,
      });
    } else {
      fadeAnim.value = withTiming(0, { duration: 120 });
      slideAnim.value = withTiming(SH, { duration: 200 });
    }
  }, [visible]);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: fadeAnim.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideAnim.value }],
  }));

  if (!visible) return null;

  const opts = [
    {
      key: "photo",
      icon: "image-outline",
      label: "Photo Library",
      sub: "Choose from your photos",
      onPress: onImage,
    },
    {
      key: "video",
      icon: "videocam-outline",
      label: "Video",
      sub: "Choose a video clip",
      onPress: onVideo,
    },
    ...(Platform.OS !== "web"
      ? [
          {
            key: "camera",
            icon: "camera-outline",
            label: "Camera",
            sub: "Take a photo or video",
            onPress: onCamera,
          },
        ]
      : []),
  ];
  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[stt.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[stt.sheet, sheetStyle]}>
        <View style={stt.handle} />
        {opts.map((opt) => (
          <View key={opt.key}>
            <TouchableOpacity
              style={stt.sheetRow}
              activeOpacity={0.7}
              onPress={() => {
                onClose();
                opt.onPress();
              }}
            >
              <View style={[stt.iconBox, { backgroundColor: T.purple }]}>
                <Ionicons name={opt.icon as any} size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={stt.rowLabel}>{opt.label}</Text>
                <Text style={stt.rowSub}>{opt.sub}</Text>
              </View>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          style={stt.cancelBtn}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Text style={stt.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};
const PulsingDot = React.memo(() => {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 600 }),
        withTiming(1.0, { duration: 600 }),
      ),
      -1,
      false,
    );
    return () => {
      scale.value = 1;
    };
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[rec.dot, style]} />;
});
const WaveBars = React.memo(({ bars }: { bars: number[] }) => {
  const display =
    bars.length >= 24
      ? bars.slice(-24)
      : [...Array(24 - bars.length).fill(5), ...bars];
  return (
    <View style={rec.waveRow}>
      {display.map((h, i) => {
        const px = 3 + (Math.max(3, Math.min(100, h)) / 100) * 24;
        return (
          <View
            key={i}
            style={[
              rec.bar,
              {
                height: px,
                opacity: 0.3 + (i / display.length) * 0.7,
              },
            ]}
          />
        );
      })}
    </View>
  );
});
const RecordingRow = React.memo(
  ({
    elapsedMs,
    liveBars,
    onCancel,
    onSend,
    sending,
  }: {
    elapsedMs: number;
    liveBars: number[];
    onCancel: () => void;
    onSend: () => void;
    sending: boolean;
  }) => {
    return (
      <View style={rec.root}>
        <TouchableOpacity
          style={rec.cancelBtn}
          onPress={onCancel}
          activeOpacity={0.75}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={20} color={T.red} />
        </TouchableOpacity>

        <View style={rec.pill}>
          <PulsingDot />
          <Text style={rec.timer}>{fmtTime(elapsedMs)}</Text>
          <WaveBars bars={liveBars} />
        </View>

        <TouchableOpacity
          style={rec.sendBtn}
          onPress={onSend}
          disabled={sending}
          activeOpacity={0.75}
        >
          {sending ? (
            <ActivityIndicator size="small" color={T.white} />
          ) : (
            <Ionicons name="send" size={20} color={T.white} />
          )}
        </TouchableOpacity>
      </View>
    );
  },
);
const rec = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(8),
    minHeight: vs(46),
  },
  cancelBtn: {
    width: s(44),
    height: s(44),
    borderRadius: s(22),
    backgroundColor: "#2C1B1B",
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.recBg,
    borderRadius: s(26),
    paddingHorizontal: s(12),
    paddingVertical: vs(6),
    minHeight: vs(46),
    gap: s(8),
  },
  dot: {
    width: s(9),
    height: s(9),
    borderRadius: s(5),
    backgroundColor: T.red,
  },
  timer: {
    fontSize: ms(14),
    fontWeight: "700",
    color: T.red,
    fontVariant: ["tabular-nums"],
    minWidth: s(36),
  },
  waveRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: s(2),
    height: s(28),
    overflow: "hidden",
  },
  bar: {
    width: s(3),
    borderRadius: s(2),
    backgroundColor: T.purple,
  },
  sendBtn: {
    width: s(44),
    height: s(44),
    borderRadius: s(22),
    backgroundColor: T.purple,
    alignItems: "center",
    justifyContent: "center",
  },
});

interface ReplyMsg {
  $id: string;
  message: string;
  senderId: string;
}
interface EditMsg {
  $id: string;
  message: string;
}

export interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending: boolean;
  disabled?: boolean;
  inputRef?: React.RefObject<TextInput>;
  chatId?: string;
  replyTo?: ReplyMsg | null;
  editingMsg?: EditMsg | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  myId: string;
  otherName: string;
  isBlocked?: boolean;
  iBlockedThem?: boolean;
  onUnblock?: () => void;
  blockedName?: string;
  onMediaSend?: (uri: string, type: "image" | "video") => void;
  onVoiceOptimistic?: (
    tempId: string,
    durationMs: number,
    waveform: number[],
  ) => void;
  onVoiceSuccess?: (
    tempId: string,
    audioUrl: string,
    messageId: string,
  ) => void;
  onVoiceFailed?: (tempId: string) => void;
}
export const ChatInput = ({
  value,
  onChangeText,
  onSend,
  sending,
  disabled,
  inputRef,
  chatId,
  replyTo,
  editingMsg,
  onCancelReply,
  onCancelEdit,
  myId,
  otherName,
  isBlocked,
  iBlockedThem,
  onUnblock,
  blockedName,
  onMediaSend,
  onVoiceOptimistic,
  onVoiceSuccess,
  onVoiceFailed,
}: Props) => {
  const [showMedia, setShowMedia] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceSending, setVoiceSending] = useState(false);

  const actionInFlightRef = useRef(false);
  const localInputRef = useRef<TextInput>(null);
  const resolvedInputRef =
    (inputRef as React.RefObject<TextInput>) ?? localInputRef;

  const recorder = useVoiceRecorder();
  const { enqueueUpload } = useVoiceUpload();

  const hasText = useSharedValue(0);
  const focused = useSharedValue(0);

  const sendStyle = useAnimatedStyle(() => ({
    width: withTiming(hasText.value ? 36 : 0, { duration: 150 }),
    opacity: withTiming(hasText.value ? 1 : 0, { duration: 150 }),
    marginLeft: withTiming(hasText.value ? 6 : 0, { duration: 150 }),
    transform: [
      {
        scale: withSpring(hasText.value ? 1 : 0.4, {
          damping: 200,
          stiffness: 340,
        }),
      },
    ],
    overflow: "hidden" as const,
  }));

  const micStyle = useAnimatedStyle(() => ({
    width: withTiming(hasText.value ? 0 : 36, { duration: 150 }),
    opacity: withTiming(hasText.value ? 0 : 1, { duration: 150 }),
    marginLeft: withTiming(hasText.value ? 0 : 6, { duration: 150 }),
    overflow: "hidden" as const,
  }));
  const plusStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(focused.value ? 0.9 : 1, {
          damping: 200,
          stiffness: 300,
        }),
      },
    ],
    backgroundColor: withTiming(focused.value ? "#565658" : T.circle, {
      duration: 0,
    }),
  }));

  const handleFocus = useCallback(() => {
    focused.value = 1;
  }, []);
  const handleBlur = useCallback(() => {
    focused.value = 0;
  }, []);

  const handleChangeText = useCallback(
    (text: string) => {
      onChangeText(text);
      hasText.value = text.trim().length > 0 ? 1 : 0;
    },
    [onChangeText],
  );
  const handleSend = useCallback(() => {
    if (!value.trim() || sending || disabled) return;
    onSend();
    hasText.value = 0;
  }, [value, sending, disabled, onSend]);
  const handleMicPress = useCallback(async () => {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    try {
      resolvedInputRef.current?.blur();
      focused.value = 0;
      Keyboard.dismiss();
      await new Promise<void>((resolve) => setTimeout(resolve, 80));

      const ok = await recorder.startRecording();
      if (ok) {
        setIsRecording(true);
      }
    } finally {
      actionInFlightRef.current = false;
    }
  }, [recorder, resolvedInputRef]);
  const handleVoiceSend = useCallback(async () => {
    if (actionInFlightRef.current || !isRecording) return;
    actionInFlightRef.current = true;
    setVoiceSending(true);
    try {
      if (recorder.elapsedMs < 1000) {
        await recorder.stopAndDiscard();
        setIsRecording(false);
        setVoiceSending(false);
        actionInFlightRef.current = false;
        return;
      }

      const result = await recorder.stopAndSave();
      setIsRecording(false);
      setVoiceSending(false);

      if (!result || !chatId) {
        actionInFlightRef.current = false;
        return;
      }

      const callbacks: VoiceUploadCallbacks = {
        onOptimistic: (tempId) =>
          onVoiceOptimistic?.(tempId, result.durationMs, result.waveform),
        onSuccess: (tempId, audioUrl, messageId) =>
          onVoiceSuccess?.(tempId, audioUrl, messageId),
        onFailed: (tempId) => onVoiceFailed?.(tempId),
      };

      enqueueUpload(
        {
          localUri: result.uri,
          durationMs: result.durationMs,
          waveform: result.waveform,
          chatId,
          senderId: myId,
          replyToId: replyTo?.$id ?? null,
          replyToText: replyTo?.message ?? null,
          replyToSender: replyTo?.senderId ?? null,
        },
        callbacks,
      );
    } catch (e) {
      console.warn("[ChatInput] handleVoiceSend error:", e);
      await recorder.stopAndDiscard().catch(() => {});
      setIsRecording(false);
      setVoiceSending(false);
    } finally {
      actionInFlightRef.current = false;
    }
  }, [
    isRecording,
    recorder,
    chatId,
    myId,
    replyTo,
    enqueueUpload,
    onVoiceOptimistic,
    onVoiceSuccess,
    onVoiceFailed,
  ]);
  const handleVoiceCancel = useCallback(async () => {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;

    try {
      await recorder.stopAndDiscard();
      setIsRecording(false);
      setVoiceSending(false);
    } finally {
      actionInFlightRef.current = false;
    }
  }, [recorder]);

  useEffect(() => {
    return () => {
      recorder.stopAndDiscard().catch(() => {});
    };
  }, []);
  const pickImage = useCallback(async () => {
    try {
      const granted = isLibraryGranted()
        ? true
        : await requestMediaLibraryPermissionCached();
      if (!granted) {
        console.warn("❌ Photo library permission denied");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
        exif: false,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        if (asset?.uri) onMediaSend?.(asset.uri, "image");
      }
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("permission") || msg.includes("rejected"))
        clearPermissionCache();
      console.warn("❌ pickImage failed:", msg);
    }
  }, [onMediaSend]);
  const pickVideo = useCallback(async () => {
    try {
      const granted = isLibraryGranted()
        ? true
        : await requestMediaLibraryPermissionCached();
      if (!granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        videoMaxDuration: 60,
        quality: 0.85,
        exif: false,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        if (asset?.uri) onMediaSend?.(asset.uri, "video");
      }
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("permission") || msg.includes("rejected"))
        clearPermissionCache();
      console.warn("❌ pickVideo failed:", msg);
    }
  }, [onMediaSend]);

  const openCamera = useCallback(async () => {
    if (Platform.OS === "web") return;
    try {
      const granted = isCameraGranted()
        ? true
        : await requestCameraPermissionCached();
      if (!granted) {
        console.warn("❌ Camera permission denied");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.7,
        exif: false,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
        ...(Platform.OS === "ios" && {
          presentationStyle:
            ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
        }),
      });
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        if (asset?.uri) {
          onMediaSend?.(asset.uri, asset.type === "video" ? "video" : "image");
        }
      }
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("permission") || msg.includes("rejected"))
        clearPermissionCache();
      console.warn("❌ openCamera failed:", msg);
    }
  }, [onMediaSend]);
  if (isBlocked) {
    return (
      <View style={st.blockedWrap}>
        <Text style={st.blockedText}>
          {iBlockedThem
            ? `You blocked ${blockedName ?? "this person"}. Unblock to message.`
            : `You can't message this person.`}
        </Text>
        {iBlockedThem && (
          <TouchableOpacity onPress={onUnblock} style={{ marginTop: 6 }}>
            <Text style={st.unblockText}>Tap to Unblock</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }
  return (
    <View style={st.wrapper}>
      {editingMsg && (
        <View style={[st.contextBar, { borderLeftColor: T.amber }]}>
          <View style={{ flex: 1 }}>
            <Text style={[st.ctxName, { color: T.amber }]}> Editing</Text>
            <Text style={st.ctxText} numberOfLines={1}>
              {editingMsg.message}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onCancelEdit}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={18} color={T.grey} />
          </TouchableOpacity>
        </View>
      )}
      {replyTo &&
        !editingMsg &&
        (() => {
          const isMedia = isMediaMsg(replyTo.message);
          const caption = isMedia ? extractMediaCaption(replyTo.message) : null;
          const previewText = isMedia
            ? caption || (isVideoMsg(replyTo.message) ? "Video" : "Photo")
            : replyTo.message;

          return (
            <View style={[st.contextBar, { borderLeftColor: T.purple }]}>
              <View style={{ flex: 1 }}>
                <Text style={[st.ctxName, { color: T.purple }]}>
                  Replying to{" "}
                  {replyTo.senderId === myId ? "yourself" : otherName}
                </Text>
                <Text style={st.ctxText} numberOfLines={1}>
                  {previewText}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onCancelReply}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={18} color={T.grey} />
              </TouchableOpacity>
            </View>
          );
        })()}
      {isRecording ? (
        <RecordingRow
          elapsedMs={recorder.elapsedMs}
          liveBars={recorder.liveBars}
          onCancel={handleVoiceCancel}
          onSend={handleVoiceSend}
          sending={voiceSending}
        />
      ) : (
        <View style={st.row}>
          <Animated.View style={[st.plusCircle, plusStyle]}>
            <TouchableOpacity
              style={st.plusTouch}
              onPress={() => setShowMedia(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={22} color={T.white} />
            </TouchableOpacity>
          </Animated.View>
          <View style={st.pill}>
            <TextInput
              ref={resolvedInputRef}
              value={value}
              onChangeText={handleChangeText}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder="Type a message..."
              placeholderTextColor={T.grey}
              multiline
              maxLength={1000}
              style={[st.input, { maxHeight: 120 }]}
              blurOnSubmit={false}
              selectionColor={T.purple}
              keyboardAppearance="dark"
            />
            <Animated.View style={[st.iconSlot, sendStyle]}>
              <TouchableOpacity
                style={st.sendBtn}
                onPress={handleSend}
                disabled={!value.trim() || sending || disabled}
                activeOpacity={0.8}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Ionicons name="send" size={18} color={T.purple} />
                )}
              </TouchableOpacity>
            </Animated.View>
            <Animated.View style={[st.iconSlot, micStyle]}>
              <TouchableOpacity
                style={st.micBtn}
                onPress={handleMicPress}
                activeOpacity={0.75}
              >
                <Ionicons
                  name="mic"
                  size={25}
                  color={"#633dfc"}
                  style={{ marginRight: s(1) }}
                />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      )}
      <MediaSheet
        visible={showMedia}
        onClose={() => setShowMedia(false)}
        onImage={pickImage}
        onVideo={pickVideo}
        onCamera={openCamera}
      />
    </View>
  );
};
export default ChatInput;
const st = StyleSheet.create({
  wrapper: {
    backgroundColor: T.white,
    paddingHorizontal: s(12),
    paddingTop: vs(5),
    paddingBottom: Platform.OS === "ios" ? vs(28) : vs(10),
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: s(10),
    shadowOffset: { width: 0, height: 5 },
  },
  contextBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: s(12),
    paddingVertical: vs(8),
    borderLeftWidth: s(3),
    borderRadius: s(8),
    marginBottom: vs(8),
    gap: vs(8),
  },
  ctxName: { fontSize: ms(11), fontWeight: "700", marginBottom: vs(1) },
  ctxText: { fontSize: ms(12), color: T.grey },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: s(8),
  },
  plusCircle: {
    width: s(43),
    height: s(43),
    borderRadius: s(40),
    backgroundColor: T.circle,
    alignItems: "center",
    justifyContent: "center",
    bottom: vs(2),
  },
  plusTouch: {
    width: s(44),
    height: s(44),
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: T.pill,
    borderRadius: s(26),
    paddingLeft: s(16),
    paddingRight: s(6),
    paddingVertical: vs(6),
    minHeight: vs(46),
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: s(8),
    shadowOffset: { width: 0, height: vs(1) },
    elevation: s(4),
  },
  input: {
    flex: 1,
    fontSize: ms(16),
    color: T.white,
    paddingVertical: vs(4),
    lineHeight: vs(22),
    alignItems: "center",
    justifyContent: "center",
    bottom: vs(4),
  },
  iconSlot: {
    height: s(34),
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: vs(2),
  },
  sendBtn: {
    width: s(33),
    height: s(33),
    borderRadius: s(17),
    backgroundColor: T.white,
    alignItems: "center",
    justifyContent: "center",
    right: 1,
  },
  micBtn: {
    width: s(33),
    height: s(33),
    borderRadius: s(17),
    alignItems: "center",
    justifyContent: "center",
  },
  blockedWrap: {
    backgroundColor: "#2C1B1B",
    padding: s(14),
    alignItems: "center",
    borderTopWidth: s(1),
    borderTopColor: "#3D2020",
  },
  blockedText: {
    color: T.red,
    fontSize: ms(13),
    fontWeight: "600",
    textAlign: "center",
  },
  unblockText: {
    color: T.red,
    fontWeight: "700",
    fontSize: ms(13),
    marginTop: vs(4),
  },
});
const stt = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: T.white,
    borderTopLeftRadius: s(22),
    borderTopRightRadius: s(22),
    paddingBottom: s(40),
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: s(24),
    elevation: s(24),
  },
  handle: {
    width: s(36),
    height: s(4),
    borderRadius: s(2),
    backgroundColor: "#d6d6d6",
    alignSelf: "center",
    marginTop: vs(10),
    marginBottom: vs(8),
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(14),
    paddingHorizontal: s(20),
    paddingVertical: vs(15),
    marginTop: vs(4),
  },
  iconBox: {
    width: s(46),
    height: s(46),
    borderRadius: s(13),
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontSize: ms(15), fontWeight: "500", color: "#000000" },
  rowSub: { fontSize: ms(12), color: T.grey, marginTop: vs(2) },
  cancelBtn: {
    marginHorizontal: s(16),
    marginTop: vs(14),
    paddingVertical: vs(16),
    borderRadius: s(14),
    backgroundColor: "#e6e6e6",
    alignItems: "center",
  },
  cancelText: { fontSize: ms(16), fontWeight: "600", color: "#555" },
});
