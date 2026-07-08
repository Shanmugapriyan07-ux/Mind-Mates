import { ChatMenuSheet }           from "@/components/blockSheet";
import ChatInput                   from "@/components/chatInput";
import ConfirmModal                from "@/components/confirmModel";
import MediaPreview                from "@/components/mediaPreview";
import MediaViewer                 from "@/components/mediaViewer";
import { ActionMessage, MessageActionSheet } from "@/components/messageActionSheet";
import { ProfileAvatar }           from "@/components/Profileavatar";
import { VoiceMessageBubble, VoiceStatus } from "@/components/voiceMessageBubble";
import { useAuthh }                from "@/Contexts/authContext";
import { ChatMessage, findChat, getChatId, useMessages } from "@/hooks/useChat";
import { useOnlineStatus }         from "@/hooks/useOnlineStatus";
import { useTyping }               from "@/hooks/useTyping";
import {
  cdnChatUrl, cdnVideoThumbUrl, compressForUpload, uploadToCloudinary,
} from "@/lib/cloudinaryUpload";
import { presenceService }         from "@/lib/presenceService";
import { supabase }                from "@/lib/supabase";
import { clearAppIconBadge }       from "@/services/badgeService";
import { useChatStore }            from "@/stores/chatStore";
import { ms, s, vs }               from "@/utils/scale";
import { Ionicons }                from "@expo/vector-icons";
import * as Clipboard              from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import React, { RefObject, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Dimensions, FlatList, Image,
  KeyboardAvoidingView, PanResponder, Platform,
  Animated as RNAnimated, StatusBar, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

let CachedImage: any;
try   { CachedImage = require("expo-image").Image; }
catch { CachedImage = require("react-native").Image; }

const IMG_PREFIX = "__IMG__";
const VID_PREFIX = "__VID__";
const isImageMsg  = (m: string) => m.startsWith(IMG_PREFIX);
const isVideoMsg  = (m: string) => m.startsWith(VID_PREFIX);
const isMediaMsg  = (m: string) => isImageMsg(m) || isVideoMsg(m);
const extractMediaUrl     = (m: string) => m.replace(IMG_PREFIX, "").replace(VID_PREFIX, "").split("\n")[0].trim();
const extractMediaCaption = (m: string) => m.replace(IMG_PREFIX, "").replace(VID_PREFIX, "").split("\n").slice(1).join("\n").trim();

const callFn = async (body: Record<string, any>) => {
  const { data, error } = await supabase.functions.invoke("mindmates", { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
};

const withRetry = async <T,>(fn: () => Promise<T>, attempts = 3): Promise<T> => {
  let last: any;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      last = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 300 * 2 ** i));
    }
  }
  throw last;
};

const C = {
  bg:        "#F5F5F7",
  white:     "#FFFFFF",
  purple:    "#6D4AFF",
  purpleMsg: "#6D4AFF",
  otherMsg:  "#FFFFFF",
  text:      "#111827",
  muted:     "#6B7280",
  border:    "#E5E7EB",
  red:       "#EF4444",
  seen:      "#6D4AFF",
};

const SCREEN_WIDTH  = Dimensions.get("window").width;
const MAX_MEDIA_WIDTH = SCREEN_WIDTH * 0.7;
const IMAGE_SIZE_CACHE = new Map<string, { width: number; height: number; ratio: number }>();

const secToMs    = (ts: number) => (ts < 10_000_000_000 ? ts * 1000 : ts);
const formatTime = (ts: number) =>
  new Date(secToMs(ts)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const formatLastSeen = (seen: string | null) => {
  if (!seen) return "";
  const diff = Math.floor((Date.now() - new Date(seen).getTime()) / 60000);
  if (diff < 5)  return "online";
  if (diff < 60) return `last seen ${diff}m ago`;
  const d  = new Date(seen);
  const tt = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const today = new Date(), yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return `last seen today at ${tt}`;
  if (d.toDateString() === yest.toDateString())  return `last seen yesterday at ${tt}`;
  return `last seen ${d.toLocaleDateString([], { day: "numeric", month: "short" })} at ${tt}`;
};

const useRemoteImageSize = (uri: string | null) => {
  const [size,    setSize]    = useState<{ width: number; height: number; ratio: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    if (!uri) { setSize(null); setLoading(false); setError(false); return; }
    const lowerUri   = uri.toLowerCase();
    const isVideoUrl =
      lowerUri.includes("/video/upload/") ||
      lowerUri.endsWith(".mp4") || lowerUri.endsWith(".mov") ||
      lowerUri.endsWith(".webm") || lowerUri.endsWith(".avi");
    if (isVideoUrl) { setSize(null); setLoading(false); setError(false); return; }

    let active = true;
    const cached = IMAGE_SIZE_CACHE.get(uri);
    if (cached) { setSize(cached); setLoading(false); setError(false); return; }

    setLoading(true); setError(false);
    Image.getSize(
      uri,
      (width, height) => {
        if (!active) return;
        const ratio         = width > 0 && height > 0 ? width / height : 1;
        const displayWidth  = Math.min(width, MAX_MEDIA_WIDTH);
        const displayHeight = Math.round(displayWidth / ratio);
        const resolved = { width: displayWidth, height: Math.max(displayHeight, 80), ratio };
        IMAGE_SIZE_CACHE.set(uri, resolved);
        setSize(resolved); setLoading(false);
      },
      () => { if (!active) return; setError(true); setLoading(false); },
    );
    return () => { active = false; };
  }, [uri]);

  return { size, loading, error };
};

// ─── StatusTick ──────────────────────────────────────────────────────────────
const StatusTick = ({ status, pending, failed }: {
  status: string; pending?: boolean; failed?: boolean;
}) => {
  if (failed)            return <Ionicons name="alert-circle-outline" size={s(14)} color={C.red} />;
  if (pending)           return <ActivityIndicator size={s(10)} color="rgba(255,255,255,0.7)" />;
  if (status === "seen") return null;
  return <Ionicons name="checkmark" size={s(16)} color="rgba(255,255,255,0.7)" />;
};

// ─── DateDivider ─────────────────────────────────────────────────────────────
const DateDivider = ({ ts }: { ts: number }) => {
  const d     = new Date(secToMs(ts));
  const today = new Date();
  const diff  = Math.floor((today.getTime() - secToMs(ts)) / 86400000);
  const label = diff === 0 ? "Today" : diff === 1 ? "Yesterday"
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
  return (
    <View style={t.dateDivider}>
      <View style={t.dateLine} />
      <Text style={t.dateText}>{label}</Text>
      <View style={t.dateLine} />
    </View>
  );
};

// ─── ReplyQuote ───────────────────────────────────────────────────────────────
const ReplyQuote = ({ replyToText, replyToSender, myId, otherName }: {
  replyToText: string; replyToSender: string; myId: string; otherName: string;
}) => {
  const isImg   = replyToText?.startsWith("__IMG__");
  const isVid   = replyToText?.startsWith("__VID__");
  const isMedia = isImg || isVid;
  const mediaUrl = isMedia ? extractMediaUrl(replyToText) : null;
  const caption  = isMedia ? extractMediaCaption(replyToText) : null;
  const preview  = isMedia ? caption || (isVid ? " Video" : " Photo") : replyToText;
  return (
    <View style={t.replyQuote}>
      <Text style={t.replyQuoteName}>{replyToSender === myId ? "You" : otherName}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: s(6) }}>
        {isMedia && mediaUrl && (
          <View style={t.replyThumb}>
            {isImg ? (
              <CachedImage source={{ uri: mediaUrl }} style={t.replyThumbImg} contentFit="cover" />
            ) : (
              <View style={[t.replyThumbImg, {
                backgroundColor: "#1C1C1E", alignItems: "center", justifyContent: "center",
              }]}>
                <Ionicons name="play-circle" size={s(16)} color="#fff" />
              </View>
            )}
          </View>
        )}
        <Text style={t.replyQuoteText} numberOfLines={1}>{preview}</Text>
      </View>
    </View>
  );
};

// ─── ReactionsRow ─────────────────────────────────────────────────────────────
const ReactionsRow = ({ reactionsJson, onReact, msg }: {
  reactionsJson: string; onReact: (m: any, e: string) => void; msg: any;
}) => {
  let rx: { userId: string; emoji: string }[] = [];
  try { rx = JSON.parse(reactionsJson); } catch {}
  if (!rx.length) return null;
  const g: Record<string, number> = {};
  rx.forEach((r) => { g[r.emoji] = (g[r.emoji] || 0) + 1; });
  return (
    <View style={t.reactionsRow}>
      {Object.entries(g).map(([emoji, count]) => (
        <TouchableOpacity
          key={emoji}
          style={t.reactionBadge}
          onPress={() => onReact(msg, emoji)}
          activeOpacity={0.7}
        >
          <Text style={t.reactionEmoji}>{emoji}</Text>
          {count > 1 && <Text style={t.reactionCount}>{count}</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
};

// ─── TypingDots ───────────────────────────────────────────────────────────────
const TypingDots = React.memo(() => {
  const dot1 = useRef(new RNAnimated.Value(0.3)).current;
  const dot2 = useRef(new RNAnimated.Value(0.3)).current;
  const dot3 = useRef(new RNAnimated.Value(0.3)).current;
  useEffect(() => {
    const pulse = (val: RNAnimated.Value, delay: number) =>
      RNAnimated.loop(RNAnimated.sequence([
        RNAnimated.delay(delay),
        RNAnimated.timing(val, { toValue: 1,   duration: 300, useNativeDriver: true }),
        RNAnimated.timing(val, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        RNAnimated.delay(600),
      ])).start();
    pulse(dot1, 0); pulse(dot2, 180); pulse(dot3, 360);
    return () => { dot1.stopAnimation(); dot2.stopAnimation(); dot3.stopAnimation(); };
  }, []);
  return (
    <View style={t.typingDots}>
      {[dot1, dot2, dot3].map((d, i) => (
        <RNAnimated.View key={i} style={[t.typingDot, { opacity: d }]} />
      ))}
    </View>
  );
});

const TypingBubble = React.memo(() => (
  <View style={t.typingBubbleWrap}>
    <View style={t.typingBubble}><TypingDots /></View>
  </View>
));

// ─── MediaBubble ─────────────────────────────────────────────────────────────
const MediaBubble = React.memo(({ message, isMe, pending, onPress }: {
  message: string; isMe: boolean; pending: boolean; onPress: () => void;
}) => {
  const [hasLocalError, setHasLocalError] = React.useState(false);
  const url      = extractMediaUrl(message);
  const caption  = extractMediaCaption(message);
  const isVid    = isVideoMsg(message);
  const thumbUri = isVid ? cdnVideoThumbUrl(url, 400, 300) : null;
  const { size, loading, error: sizeError } = useRemoteImageSize(isVid ? null : url);
  const hasError    = isVid ? hasLocalError : (hasLocalError || sizeError);
  const mediaWidth  = size?.width  ?? MAX_MEDIA_WIDTH;
  const mediaHeight = size?.height ?? Math.round(MAX_MEDIA_WIDTH * 0.75);
  useEffect(() => { setHasLocalError(false); }, [url]);

  return (
    <View style={t.mediaBubbleWrap}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.88} disabled={pending || (hasError && !isVid) || !url}>
        <View style={[t.mediaContainer, { width: mediaWidth, height: mediaHeight }]}>
          {isVid ? (
            <View style={[t.mediaContainer, { width: mediaWidth, height: mediaHeight, backgroundColor: "#111" }]}>
              {thumbUri ? (
                <CachedImage
                  source={{ uri: thumbUri }}
                  style={[t.mediaImage, { width: mediaWidth, height: mediaHeight }]}
                  contentFit="cover"
                />
              ) : (
                <View style={[t.mediaFallback, { width: mediaWidth, height: mediaHeight }]}>
                  <Ionicons name="videocam-outline" size={s(38)} color="#9CA3AF" />
                </View>
              )}
              <View style={t.videoPlayOverlay}>
                <View style={t.videoPlayBtn}>
                  <Ionicons name="play" size={s(26)} color="#ffffff" style={{ paddingLeft: s(3) }} />
                </View>
              </View>
              <View style={t.videoBadge}>
                <Ionicons name="videocam" size={s(11)} color="#ffffff" style={{ marginRight: s(3) }} />
                <Text style={t.videoBadgeTxt}>Video</Text>
              </View>
            </View>
          ) : hasError ? (
            <View style={[t.mediaFallback, { width: mediaWidth, height: mediaHeight }]}>
              <Ionicons name="image-outline" size={s(36)} color="#9CA3AF" />
            </View>
          ) : (
            <CachedImage
              source={{ uri: url }}
              style={[t.mediaImage, { width: mediaWidth, height: mediaHeight }]}
              contentFit="cover"
              onError={() => setHasLocalError(true)}
            />
          )}
          {(loading || pending) && (
            <View style={[StyleSheet.absoluteFillObject, t.mediaLoadingOverlay]}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
        </View>
      </TouchableOpacity>
      {!!caption && (
        <Text style={[t.mediaCaption, isMe ? t.myText : t.otherText]}>{caption}</Text>
      )}
    </View>
  );
});

// ─── MessageBubble ────────────────────────────────────────────────────────────
const MessageBubble = React.memo(
  ({ item, isMe, onRetry, onLongPress, onReact, onReply, onOpenMedia, otherName, myId }: {
    item: ChatMessage; isMe: boolean;
    onRetry: (m: ChatMessage) => void; onLongPress: (m: ChatMessage) => void;
    onReact: (m: any, e: string) => void; onReply: (m: ChatMessage) => void;
    onOpenMedia: (uri: string, type: "image" | "video") => void;
    otherName: string; myId: string;
  }) => {
    const swipeX = React.useRef(new RNAnimated.Value(0)).current;
    const THRESH = s(60), MAX = s(80);
    const pan = React.useRef(PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        swipeX.setValue(isMe ? Math.max(-MAX, Math.min(0, g.dx)) : Math.min(MAX, Math.max(0, g.dx)));
      },
      onPanResponderRelease: (_, g) => {
        if (isMe ? g.dx < -THRESH : g.dx > THRESH) {
          onReply(item);
          RNAnimated.spring(swipeX, { toValue: 0, useNativeDriver: true, friction: 5, tension: 100 }).start();
        } else {
          RNAnimated.spring(swipeX, { toValue: 0, useNativeDriver: true, friction: 6, tension: 150 }).start();
        }
      },
    })).current;

    const iconOpacity = swipeX.interpolate({
      inputRange:  isMe ? [-THRESH, -20, 0] : [0, 20, THRESH],
      outputRange: isMe ? [1, 0.4, 0]       : [0, 0.4, 1],
      extrapolate: "clamp",
    });
    const iconScale = swipeX.interpolate({
      inputRange:  isMe ? [-THRESH, -20, 0] : [0, 20, THRESH],
      outputRange: isMe ? [1, 0.7, 0.4]     : [0.4, 0.7, 1],
      extrapolate: "clamp",
    });

    return (
      <View style={[t.msgWrap, isMe ? t.myWrap : t.otherWrap]}>

        <RNAnimated.View style={[
          t.swipeReplyIcon,
          isMe ? t.swipeIconLeft : t.swipeIconRight,
          { opacity: iconOpacity, transform: [{ scale: iconScale }] },
        ]}>
          <Ionicons name="return-down-back-outline" size={s(18)} color={C.muted} />
        </RNAnimated.View>

        <RNAnimated.View style={{ transform: [{ translateX: swipeX }] }} {...pan.panHandlers}>
          <TouchableOpacity
            activeOpacity={item._failed ? 0.6 : 0.95}
            onPress={() => item._failed && onRetry(item)}
            onLongPress={() => onLongPress(item)}
            delayLongPress={300}
            style={[
              t.bubble,
              isMe ? t.myBubble : t.otherBubble,
              item._pending && { opacity: 0.6 },
              item._failed  && t.failedBubble,
              isMediaMsg(item.message) && { padding: 0, overflow: "hidden" },
            ]}
          >
            {!!(item as any).replyToText && (
              <ReplyQuote
                replyToText={(item as any).replyToText}
                replyToSender={(item as any).replyToSender ?? ""}
                myId={myId}
                otherName={otherName}
              />
            )}
            {isMediaMsg(item.message) ? (
              <MediaBubble
                message={item.message}
                isMe={isMe}
                pending={!!item._pending}
                onPress={() => onOpenMedia(
                  extractMediaUrl(item.message),
                  isVideoMsg(item.message) ? "video" : "image",
                )}
              />
            ) : (
              <Text style={[t.msgText, isMe ? t.myText : t.otherText]}>{item.message}</Text>
            )}
            {(item as any).edited && (
              <Text style={[t.editedLabel, isMe && { color: "rgba(255,255,255,0.6)" }]}>edited</Text>
            )}
            {!isMediaMsg(item.message) && (
              <View style={t.metaRow}>
                <Text style={[t.timeText, isMe && { color: "rgba(255,255,255,0.7)" }]}>
                  {formatTime(item.createdAt)}
                </Text>
                {isMe && (
                  <View style={{ marginLeft: s(2) }}>
                    <StatusTick status={item.status} pending={item._pending} failed={item._failed} />
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>

          {!!(item as any).reactions && (item as any).reactions !== "[]" && (
            <ReactionsRow
              reactionsJson={(item as any).reactions}
              onReact={onReact}
              msg={item}
            />
          )}
        </RNAnimated.View>
      </View>
    );
  },
  (prev, next) =>
    prev.item.$id        === next.item.$id &&
    prev.item.status     === next.item.status &&
    prev.item.message    === next.item.message &&
    prev.item.reactions  === next.item.reactions &&
    prev.item._pending   === next.item._pending &&
    prev.item._failed    === next.item._failed &&
    prev.item.edited     === next.item.edited &&
    prev.item.deletedFor?.length === next.item.deletedFor?.length &&
    prev.isMe            === next.isMe &&
    prev.otherName       === next.otherName,
);

// ─── ChatHeader ───────────────────────────────────────────────────────────────
const ChatHeader = ({
  name, image, onMenuPress, userId, isOtherTyping, iBlockedThem,
}: {
  name?: string; image?: string; lastSeen?: string | null;
  onMenuPress: () => void; userId: string;
  isOtherTyping: boolean; iBlockedThem: boolean;
}) => {
  const { isOnline, lastSeen } = useOnlineStatus(userId);
  const statusText = formatLastSeen(lastSeen);
  return (
    <View style={[ch.header, iBlockedThem && { backgroundColor: "#000", borderBottomColor: "#333" }]}>
      <TouchableOpacity
        onPress={() => router.back()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="arrow-back" size={s(20)} color={iBlockedThem ? "#fff" : C.text} />
      </TouchableOpacity>
      <View style={{ position: "relative" }}>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/subScreens/userProfile", params: { userId } })}
          activeOpacity={0.8}
        >
          <ProfileAvatar uri={image || null} name={name ?? "?"} size={s(38)} />
        </TouchableOpacity>
        {isOnline && !isOtherTyping && <View style={ch.onlineDot} />}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[ch.headerName, iBlockedThem && { color: "#fff" }]} numberOfLines={1}>
          {name ?? "Chat"}
        </Text>
        {iBlockedThem ? (
          <Text style={[ch.headerStatus, { color: "#EF4444", fontWeight: "600" }]}>USER BLOCKED</Text>
        ) : isOtherTyping ? (
          <Text style={[ch.headerStatus, ch.typingStatus]}>typing...</Text>
        ) : isOnline ? (
          <Text style={[ch.headerStatus, { color: "#6D4AFF" }]}>online</Text>
        ) : !!statusText ? (
          <Text style={ch.headerStatus}>{statusText}</Text>
        ) : null}
      </View>

      <TouchableOpacity
        onPress={onMenuPress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={{ padding: s(4) }}
      >
        <Ionicons name="ellipsis-vertical" size={s(18)} color={iBlockedThem ? "#fff" : C.text} />
      </TouchableOpacity>
    </View>
  );
};

// ─── ChatScreen ───────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { user } = useAuthh();
  const myId = user?.id ?? "";

  const params = useLocalSearchParams<{
    chatId?:      string; userId?:      string; name?:        string;
    image?:       string; lastSeen?:    string;
    senderId?:    string; senderName?:  string; senderImage?: string;
  }>();

  const resolvedUserId  = params.userId  || params.senderId  || "";
  const resolvedName    = params.name    || params.senderName  || "";
  const resolvedImage   = params.image   || params.senderImage || "";

  const paramChatId = params.chatId?.trim() || "";
  const [chatId,    setChatId]    = useState(paramChatId);
  const [inputText, setInputText] = useState("");
  const [sending,   setSending]   = useState(false);
  const [chatState, setChatState] = useState<"idle" | "finding" | "ready" | "error">(
    paramChatId ? "idle" : "finding"
  );

  const [actionMsg,       setActionMsg]       = useState<ActionMessage | null>(null);
  const [replyTo,         setReplyTo]         = useState<ChatMessage | null>(null);
  const [editingMsg,      setEditingMsg]      = useState<ActionMessage | null>(null);
  const [menuSheet,       setMenuSheet]       = useState(false);
  const [isBlocked,       setIsBlocked]       = useState(false);
  const [iBlockedThem,    setIBlockedThem]    = useState(false);
  const [pendingMedia,    setPendingMedia]    = useState<{ uri: string; type: "image" | "video" } | null>(null);
  const [sendingMedia,    setSendingMedia]    = useState(false);
  const [viewerMedia,     setViewerMedia]     = useState<{ uri: string; type: "image" | "video" } | null>(null);
  const [deleteModal,     setDeleteModal]     = useState<{ msg: ActionMessage; mode: "soft" | "choose" } | null>(null);
  const [clearChatModal,  setClearChatModal]  = useState(false);
  const [reportModal,     setReportModal]     = useState(false);

  const setActiveChatId  = useChatStore((s) => s.setActiveChatId);
  const flatRef          = useRef<FlatList>(null);
  const isPaginatingRef  = useRef(false);
  const isNearBottomRef  = useRef(true);
  const inputRef         = useRef<TextInput>(null);

  const { messages, setMessages, loading, loadingOld, hasMore, sendMessage, retryMessage, loadOlderMessages } =
    useMessages(chatId);

  const { isOtherTyping, onTypingInput, onTypingStop } = useTyping(
    chatId || null, user?.id ?? null, resolvedUserId || null,
  );

  const handleLoadOlder = useCallback(async () => {
    if (loadingOld || !hasMore) return;
    isPaginatingRef.current = true;
    await loadOlderMessages();
    setTimeout(() => { isPaginatingRef.current = false; }, 1000);
  }, [loadOlderMessages, loadingOld, hasMore]);

  useEffect(() => {
    if (!resolvedUserId || !user?.id) return;
    callFn({ action: "check_block", otherUserId: resolvedUserId })
      .then((r) => { setIsBlocked(r.isBlocked ?? false); setIBlockedThem(r.iBlockedThem ?? false); })
      .catch(() => {});
  }, [resolvedUserId, user?.id]);

  useEffect(() => {
    clearAppIconBadge();
    if (chatId && user?.id) { setActiveChatId(chatId); presenceService.enterChat(chatId); }
    return () => { setActiveChatId(null); presenceService.leaveChat(); };
  }, [chatId, user?.id]);

  const markReadRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMarkedRef = useRef<string>("");
  const lastSyncRef   = useRef<number>(0);

  useEffect(() => {
    if (!chatId || chatId.trim() === "" || !user?.id) return;
    const uid = user.id;
    const unread = messages.filter(
      (m) => m.senderId !== uid && m.status !== "seen" && !m._pending && !m.$id.startsWith("tmp_")
    );
    if (unread.length > 0) {
      const fingerprint = unread.map((m) => m.$id).sort().join(",");
      if (fingerprint !== lastMarkedRef.current) {
        lastMarkedRef.current = fingerprint;
        setMessages((prev: ChatMessage[]) =>
          prev.map((m) =>
            m.senderId !== uid && m.status !== "seen" && !m._pending
              ? { ...m, status: "seen" as const } : m
          )
        );
        if (markReadRef.current) clearTimeout(markReadRef.current);
        markReadRef.current = setTimeout(() => {
          callFn({ action: "mark_chat_read", chatId })
            .catch((_err: any) => { lastMarkedRef.current = ""; });
        }, 150);
      }
    }
    const now = Date.now();
    const hasSentUnseen = messages.some(
      (m) => m.senderId === uid && m.status !== "seen" && !m._pending && !m.$id.startsWith("tmp_")
    );
    if (hasSentUnseen && now - lastSyncRef.current > 4000) {
      lastSyncRef.current = now;
      supabase.from("messages").select("id, status")
        .eq("chat_id", chatId).eq("sender_id", uid).eq("status", "seen")
        .then((res) => {
          if (!res.data || res.data.length === 0) return;
          const seenIds = new Set(res.data.map((r: any) => r.id));
          setMessages((prev: any) => {
            let dirty = false;
            const next = prev.map((m: any) => {
              if (m.senderId === uid && m.status !== "seen" && seenIds.has(m.$id)) {
                dirty = true; return { ...m, status: "seen" as const };
              }
              return m;
            });
            return dirty ? next : prev;
          });
        });
    }
  }, [chatId, user?.id, messages]);

  useEffect(() => {
    if (paramChatId || !resolvedUserId || !user?.id) return;
    let cancelled = false, attempts = 0;
    const tryFind = async () => {
      if (cancelled) return;
      attempts++;
      const chat = await findChat(user.id, resolvedUserId).catch(() => null);
      if (chat) { setChatId(chat.$id); setChatState("ready"); return; }
      if (attempts === 2) {
        const id = await getChatId(resolvedUserId).catch(() => null);
        if (id) { setChatId(id); setChatState("ready"); return; }
      }
      if (!cancelled && attempts < 8) setTimeout(tryFind, 1000);
      else if (!cancelled) setChatState("error");
    };
    tryFind();
    return () => { cancelled = true; };
  }, [resolvedUserId, user?.id, paramChatId]);

  useEffect(() => {
    if (messages.length > 0 && !isPaginatingRef.current && isNearBottomRef.current)
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length]);

  useEffect(() => {
    if (isOtherTyping && isNearBottomRef.current && !isPaginatingRef.current)
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
  }, [isOtherTyping]);

  // ─── Voice message handlers ───────────────────────────────────────────────

  const handleVoiceOptimistic = useCallback((
    tempId: string,
    durationMs: number,
    waveform: number[]
  ) => {
    const optimisticMsg: ChatMessage = {
      $id:        tempId,
      chatId,
      senderId:   myId,
      message:    "",
      type:       "voice",
      status:     "sent",
      reactions:  "[]",
      createdAt:  Math.floor(Date.now() / 1000),
      deletedFor: [],
      audioUrl:   "",
      duration:   Math.round(durationMs / 1000),
      waveform,
      _pending:   true,
    };
    setMessages((prev: ChatMessage[]) => [...prev, optimisticMsg]);
  }, [chatId, myId, setMessages]);

  const handleVoiceSuccess = useCallback((
    tempId: string,
    audioUrl: string,
    messageId: string
  ) => {
    setMessages((prev: any) => prev.map((m: any) =>
      m.$id === tempId
        ? { ...m, $id: messageId, audioUrl, _pending: false }
        : m
    ));
  }, [setMessages]);

  const handleVoiceFailed = useCallback((tempId: string) => {
    setMessages((prev: any) => prev.map((m: any) =>
      m.$id === tempId ? { ...m, _pending: false, _failed: true } : m
    ));
  }, [setMessages]);

  const handleReact = useCallback(async (msg: ChatMessage, emoji: string) => {
    if (!user?.id) return;
    setMessages((prev: any) =>
      prev.map((m: any) => {
        if (m.$id !== msg.$id) return m;
        let rx: { userId: string; emoji: string }[] = [];
        try { rx = JSON.parse((m as any).reactions || "[]"); } catch {}
        const idx = rx.findIndex((r) => r.userId === user.id);
        if (idx >= 0) {
          rx = rx[idx].emoji === emoji
            ? rx.filter((r) => r.userId !== user.id)
            : rx.map((r) => (r.userId === user.id ? { ...r, emoji } : r));
        } else { rx = [...rx, { userId: user.id, emoji }]; }
        return { ...m, reactions: JSON.stringify(rx) };
      })
    );
    callFn({ action: "react_message", messageId: msg.$id, emoji }).catch(() => {});
  }, [user?.id, setMessages]);

  const handleReply = useCallback((msg: ChatMessage) => {
    setReplyTo(msg);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleEdit = useCallback((msg: ActionMessage) => {
    setEditingMsg(msg); setInputText(msg.message); setReplyTo(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleDelete = useCallback((msg: ActionMessage) => {
    const isMine = msg.sender_id === user?.id;
    const ageMs  = Date.now() - new Date(msg.created_at).getTime();
    setDeleteModal({ msg, mode: isMine && ageMs < 60_000 ? "choose" : "soft" });
  }, [user?.id]);

  const doSoftDelete = useCallback((msg: ActionMessage) => {
    setMessages((prev: any) => prev.filter((m: any) => m.$id !== msg.$id));
    withRetry(() => callFn({ action: "delete_message", messageId: msg.$id })).catch(() => {});
  }, [setMessages]);

  const doHardDelete = useCallback((msg: ActionMessage) => {
    setMessages((prev: any) => prev.filter((m: any) => m.$id !== msg.$id));
    withRetry(() => callFn({ action: "delete_for_everyone", messageId: msg.$id })).catch(() => {});
  }, [setMessages]);

  const handleClearChat = useCallback(() => { if (chatId) setClearChatModal(true); }, [chatId]);
  const doClearChat = useCallback(async () => {
    setMessages([]);
    try { await withRetry(() => callFn({ action: "clear_chat", chatId })); }
    catch (e: any) { console.error("clear_chat failed:", e?.message); }
  }, [chatId, setMessages]);

  const handleBlock = useCallback(async () => {
    setMenuSheet(false);
    await callFn({ action: "block_user", blockedId: resolvedUserId }).catch(() => {});
    setIsBlocked(true); setIBlockedThem(true);
    Alert.alert("Blocked", `You blocked ${resolvedName}.`);
  }, [resolvedUserId, resolvedName]);

  const handleUnblock = useCallback(async () => {
    setMenuSheet(false);
    await callFn({ action: "unblock_user", blockedId: resolvedUserId }).catch(() => {});
    setIsBlocked(false); setIBlockedThem(false);
  }, [resolvedUserId]);

  const handleReportPress = useCallback(() => {
    setMenuSheet(false);
    setTimeout(() => setReportModal(true), 250);
  }, []);

  const doReport = useCallback(async () => {
    Alert.alert("Reported ✓", "Thank you. Our team will review this.");
  }, [resolvedUserId]);

  const handleMediaConfirm = useCallback(async (caption: string) => {
    if (!pendingMedia || !chatId) return;
    setSendingMedia(true);
    try {
      let uploadUri = pendingMedia.uri;
      if (pendingMedia.type === "image") uploadUri = await compressForUpload(pendingMedia.uri, "chat");
      const result  = await uploadToCloudinary(uploadUri, { type: pendingMedia.type, uploadType: "chat" });
      const fileUrl = pendingMedia.type === "image" ? cdnChatUrl(result.secureUrl) : result.secureUrl;
      const msgText = `${pendingMedia.type === "video" ? VID_PREFIX : IMG_PREFIX}${fileUrl}${caption ? `\n${caption}` : ""}`;
      setPendingMedia(null); setSendingMedia(false);
      await sendMessage(msgText, {});
    } catch (e: any) {
      Alert.alert("Upload failed", e?.message ?? "Please try again");
      setSendingMedia(false);
    }
  }, [pendingMedia, chatId, sendMessage]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending || !chatId || isBlocked) return;
    onTypingStop();
    if (editingMsg) {
      const msgId = editingMsg.$id;
      setInputText(""); setSending(true); setEditingMsg(null);
      setMessages((prev: any) => prev.map((m: any) =>
        m.$id === msgId ? { ...m, message: text, edited: true } : m
      ));
      callFn({ action: "edit_message", messageId: msgId, newText: text })
        .catch(() => { setMessages((prev: any) => prev.map((m: any) =>
          m.$id === msgId ? { ...m, message: editingMsg.message } : m
        )); });
      setSending(false); return;
    }
    setInputText(""); setSending(true);
    const reply = replyTo; setReplyTo(null);
    await sendMessage(text, {
      replyToId:     reply?.$id      ?? null,
      replyToText:   reply?.message  ?? null,
      replyToSender: reply?.senderId ?? null,
    });
    setSending(false);
  }, [inputText, sending, chatId, isBlocked, replyTo, editingMsg, sendMessage, setMessages, onTypingStop]);

  const handleChangeText = useCallback((text: string) => {
    setInputText(text);
    if (text.length > 0) onTypingInput(); else onTypingStop();
  }, [onTypingInput, onTypingStop]);

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    isNearBottomRef.current = layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
  };
  const handleVoiceLongPress = useCallback((msg: ChatMessage) => {
    setActionMsg({
      $id:        msg.$id,
      sender_id:  msg.senderId,
      message:    "",
       created_at: msg.createdAt,
    });
  }, []);
  const renderItem = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    if (user?.id && item.deletedFor?.includes(user.id)) return null;
    const isMe  = item.senderId === myId;
    const prev  = messages[index - 1];
    const showD = !prev || new Date(secToMs(item.createdAt)).toDateString() !== new Date(secToMs(prev.createdAt)).toDateString();
    if ((item as any).type === "voice") {
      const voiceStatus: VoiceStatus = item._pending
        ? "uploading"
        : item._failed
        ? "failed"
        : item.status === "seen"
        ? "seen"
        : "sent";

      return (
        <>
          {showD && <DateDivider ts={item.createdAt} />}
          <VoiceMessageBubble
            messageId={item.$id}
            audioUrl={(item as any).audioUrl ?? ""}
            durationSec={(item as any).duration ?? 0}
            waveform={(item as any).waveform ?? []}
            status={voiceStatus}
            isMe={isMe}
            timestamp={formatTime(item.createdAt)}
            isFailed={!!item._failed}
            onLongPress={() => handleVoiceLongPress(item)}
            onReact={(emoji: string) => handleReact(item, emoji)}
            onReply={() => handleReply(item)}
            onRetry={() => {
            }}
          />
          {!!(item as any).reactions && (item as any).reactions !== "[]" && (
            <View style={isMe ? t.myWrap : t.otherWrap}>
              <ReactionsRow
                reactionsJson={(item as any).reactions}
                onReact={handleReact}
                msg={item}
              />
            </View>
          )}
        </>
      );
    }

    // Text / media branch — unchanged
    return (
      <>
        {showD && <DateDivider ts={item.createdAt} />}
        <MessageBubble
          item={item} isMe={isMe} myId={myId}
          otherName={resolvedName}
          onRetry={retryMessage}
          onLongPress={(msg) => setActionMsg({
            $id: msg.$id, sender_id: msg.senderId,
            message: msg.message, created_at: msg.createdAt,
          })}
          onReact={handleReact}
          onReply={handleReply}
          onOpenMedia={(uri, type) => setViewerMedia({ uri, type })}
        />
      </>
    );
  }, [
    // CHANGE: Added handleVoiceLongPress to deps so the callback is always fresh.
    messages, myId, retryMessage, handleReact, handleReply, handleVoiceLongPress, resolvedName, user?.id,
  ]);

  // ─── Loading / error states ───────────────────────────────────────────────
  if (chatState === "finding")
    return (
      <SafeAreaView style={ch.safe} edges={["top"]}>
        <ChatHeader
          name={resolvedName} image={resolvedImage}
          onMenuPress={() => setMenuSheet(true)}
          userId={resolvedUserId} isOtherTyping={false} iBlockedThem={iBlockedThem}
        />
        <View style={ch.center}><ActivityIndicator size="large" color={C.purple} /></View>
      </SafeAreaView>
    );

  if (chatState === "error")
    return (
      <SafeAreaView style={ch.safe} edges={["top"]}>
        <ChatHeader
          name={resolvedName} image={resolvedImage}
          onMenuPress={() => setMenuSheet(true)}
          userId={resolvedUserId} isOtherTyping={false} iBlockedThem={iBlockedThem}
        />
        <View style={ch.center}>
          <Text style={ch.errorTitle}>Chat not available</Text>
          <Text style={ch.centerText}>Accept the connection request first</Text>
        </View>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={ch.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" />
      <ChatHeader
        name={resolvedName} image={resolvedImage}
        onMenuPress={() => setMenuSheet(true)}
        userId={resolvedUserId} isOtherTyping={isOtherTyping} iBlockedThem={iBlockedThem}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {loading ? (
          <View style={ch.center}><ActivityIndicator color={C.purple} size="large" /></View>
        ) : (
          <>
            <FlatList
              ref={flatRef}
              data={messages}
              renderItem={renderItem}
              keyExtractor={(item) => item.$id}
              extraData={messages}
              contentContainerStyle={ch.listContent}
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onScrollBeginDrag={({ nativeEvent }) => {
                if (nativeEvent.contentOffset.y < 60 && hasMore && !loadingOld) handleLoadOlder();
              }}
              ListHeaderComponent={
                loadingOld ? (
                  <ActivityIndicator color={C.purple} style={{ padding: vs(12) }} />
                ) : hasMore ? (
                  <TouchableOpacity style={ch.loadMoreBtn} onPress={handleLoadOlder}>
                    <Text style={ch.loadMoreText}>Load older messages</Text>
                  </TouchableOpacity>
                ) : null
              }
              ListEmptyComponent={
                <View style={ch.emptyChat}>
                  <Text style={ch.emptyChatText}>Say hello to {resolvedName}!</Text>
                </View>
              }
              ListFooterComponent={isOtherTyping ? <TypingBubble /> : null}
              initialNumToRender={20}
              maxToRenderPerBatch={10}
              windowSize={10}
              removeClippedSubviews={false}
            />
          </>
        )}
        <ChatInput
          value={inputText} onChangeText={handleChangeText}
          onSend={handleSend} sending={sending} disabled={!chatId}
          inputRef={inputRef as RefObject<TextInput>}
          chatId={chatId} replyTo={replyTo as any} editingMsg={editingMsg as any}
          onCancelReply={() => setReplyTo(null)}
          onCancelEdit={() => { setEditingMsg(null); setInputText(""); }}
          myId={myId} otherName={resolvedName}
          isBlocked={isBlocked} iBlockedThem={iBlockedThem}
          onUnblock={handleUnblock} blockedName={resolvedName}
          onMediaSend={(uri, type) => setPendingMedia({ uri, type })}
          onVoiceOptimistic={handleVoiceOptimistic}
          onVoiceSuccess={handleVoiceSuccess}
          onVoiceFailed={handleVoiceFailed}
        />
      </KeyboardAvoidingView>

      <MediaViewer uri={viewerMedia?.uri ?? null} type={viewerMedia?.type ?? "video"} onClose={() => setViewerMedia(null)} />
      <MediaPreview
        uri={pendingMedia?.uri ?? null} type={pendingMedia?.type ?? "image"}
        onSend={handleMediaConfirm} onClose={() => setPendingMedia(null)}
        sending={sendingMedia} otherName={resolvedName ?? "them"}
      />

    
      <MessageActionSheet
        visible={!!actionMsg} message={actionMsg} isMine={actionMsg?.sender_id === user?.id}
        onClose={() => setActionMsg(null)}
        onCopy={async (text) => { await Clipboard.setStringAsync(text); }}
        onReact={(msg, emoji) => handleReact(msg as unknown as ChatMessage, emoji)}
        onReply={(msg) => handleReply(msg as unknown as ChatMessage)}
        onEdit={handleEdit} onDelete={handleDelete}
      />
      <ChatMenuSheet
        visible={menuSheet} onClose={() => setMenuSheet(false)}
        items={[
          { icon: "trash-outline",     label: "Clear Chat",   onPress: handleClearChat },
          { icon: iBlockedThem ? "checkmark-circle-outline" : "ban-outline",
            label: iBlockedThem ? "Unblock User" : "Block User",
            onPress: iBlockedThem ? handleUnblock : handleBlock },
          { icon: "flag-outline",      label: "Report User",  onPress: handleReportPress },
        ]}
      />
      <ConfirmModal
        visible={deleteModal?.mode === "choose"}
        title="Delete Message?" message="Remove this message just for you, or delete it for everyone?"
        confirmLabel="Delete for Everyone" cancelLabel="Delete for Me" confirmDestructive icon="trash-outline"
        onConfirm={() => { const msg = deleteModal!.msg; setDeleteModal(null); doHardDelete(msg); }}
        onCancel={() => { const msg = deleteModal!.msg; setDeleteModal(null); doSoftDelete(msg); }}
        onDismiss={() => setDeleteModal(null)}
      />
      <ConfirmModal
        visible={deleteModal?.mode === "soft"}
        title="Delete Message?" message="This message will be removed from your view only."
        confirmLabel="Delete for Me" cancelLabel="Cancel" confirmDestructive icon="trash-outline"
        onConfirm={() => { const msg = deleteModal!.msg; setDeleteModal(null); doSoftDelete(msg); }}
        onCancel={() => setDeleteModal(null)}
      />
      <ConfirmModal
        visible={clearChatModal}
        title="Clear Chat?"
        message={`Delete all messages with ${resolvedName}? This only clears it for you.`}
        confirmLabel="Clear" cancelLabel="Cancel" confirmDestructive icon="chatbubble-ellipses-outline"
        onConfirm={() => { setClearChatModal(false); doClearChat(); }}
        onCancel={() => setClearChatModal(false)}
      />
      <ConfirmModal
        visible={reportModal}
        title="Report User?"
        message={`Report ${resolvedName} for inappropriate content? Our team will review this within 24 hours.`}
        confirmLabel="Report" cancelLabel="Cancel" confirmDestructive icon="flag-outline"
        onConfirm={() => { setReportModal(false); doReport(); }}
        onCancel={() => setReportModal(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ch = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.white },

  header: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               s(12),
    paddingHorizontal: s(16),
    paddingVertical:   vs(10),
    backgroundColor:   C.white,
  },
  headerName:   { fontSize: ms(14), fontWeight: "600", color: C.text },
  headerStatus: { fontSize: ms(11), color: C.muted, marginTop: vs(1) },
  typingStatus: { color: C.purple, fontWeight: "600" },
  onlineDot: {
    position:        "absolute",
    bottom:          0,
    right:           0,
    width:           s(12),
    height:          s(12),
    borderRadius:    s(6),
    backgroundColor: "#6D4AFF",
    borderWidth:     2,
    borderColor:     C.white,
  },
  center: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    padding:        s(40),
    gap:            vs(10),
  },
  centerText:    { fontSize: ms(14), color: C.muted, textAlign: "center" },
  errorTitle:    { fontSize: ms(18), fontWeight: "600", color: C.text },

  listContent:   { paddingHorizontal: s(12), paddingVertical: vs(12), paddingBottom: vs(8) },
  loadMoreBtn:   { alignSelf: "center", padding: s(8) },
  loadMoreText:  { color: C.purple, fontSize: ms(13), fontWeight: "600" },
  emptyChat:     { alignItems: "center", paddingTop: vs(80) },
  emptyChatText: { fontSize: ms(15), color: C.muted },

  blockedBanner: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   "#111",
    paddingHorizontal: s(16),
    paddingVertical:   vs(8),
    gap:               s(6),
  },
});

const t = StyleSheet.create({
  msgWrap:   { marginVertical: vs(2), maxWidth: "80%" },
  myWrap:    { alignSelf: "flex-end" },
  otherWrap: { alignSelf: "flex-start" },

  bubble: {
    borderRadius:      s(18),
    paddingHorizontal: s(12),
    paddingVertical:   vs(8),
    paddingBottom:     vs(6),
    elevation:         1,
  },
  myBubble:    { backgroundColor: C.purpleMsg, borderBottomRightRadius: s(4), elevation: 2 },
  otherBubble: { backgroundColor: C.otherMsg, borderBottomLeftRadius: s(4), borderColor: C.border, elevation: 2 },
  failedBubble:{ borderWidth: 1, borderColor: C.red },
  msgText:     { fontSize: ms(15), lineHeight: ms(21) },
  myText:      { color: "#fff" },
  otherText:   { color: C.text },
  mediaBubbleWrap: { borderRadius: s(18), overflow: "hidden", marginTop: vs(4), alignSelf: "flex-start" },
  mediaContainer:  { borderRadius: s(18), overflow: "hidden", backgroundColor: C.otherMsg, alignItems: "center", justifyContent: "center" },
  mediaImage:      { borderRadius: s(18) },
  mediaFallback:   { alignItems: "center", justifyContent: "center", backgroundColor: "#374151" },
  mediaCaption:    { marginTop: vs(6), paddingHorizontal: s(4), fontSize: ms(14), lineHeight: ms(20) },
  editedLabel:     { fontSize: ms(12), color: C.muted, marginTop: vs(1) },
  metaRow:         { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: vs(3), gap: s(2) },
  timeText:        { fontSize: ms(10), color: C.muted },

  replyQuote:     { borderLeftWidth: s(2), borderLeftColor: "rgb(255,255,255)", paddingLeft: s(8), marginBottom: vs(6), backgroundColor: "#6f4bfe", borderRadius: s(6), padding: s(6) },
  replyQuoteName: { fontSize: ms(11), color: "rgba(255,255,255,0.8)", fontWeight: "700", marginBottom: vs(2) },
  replyQuoteText: { fontSize: ms(12), color: "rgba(255,255,255,0.7)" },
  replyThumb:     { borderRadius: s(4), overflow: "hidden" },
  replyThumbImg:  { width: s(32), height: s(32), borderRadius: s(4) },

  mediaLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems:      "center",
    justifyContent:  "center",
    borderRadius:    s(12),
  },

  reactionsRow: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           s(4),
    marginLeft:    s(4),
    marginTop:     -vs(4),
  },

  swipeReplyIcon: {
    position:  "absolute",
    top:       "50%" as any,
    marginTop: -s(12),
    zIndex:    0,
  },
  swipeIconLeft:  { left:  -s(28) },
  swipeIconRight: { right: -s(28) },

  reactionBadge: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               s(3),
    backgroundColor:   "#ffffff",
    borderRadius:      s(12),
    paddingHorizontal: s(5),
    paddingVertical:   vs(2),
    borderColor:       C.border,
    elevation:         5,
  },
  reactionEmoji: { fontSize: ms(13) },
  reactionCount: { fontSize: ms(11), color: C.muted, fontWeight: "600" },

  dateDivider: { flexDirection: "row", alignItems: "center", marginVertical: vs(16), gap: s(10) },
  dateLine:    { flex: 1, height: 1, backgroundColor: C.border },
  dateText:    { fontSize: ms(11), color: C.muted, fontWeight: "600" },

  videoPlayOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  videoPlayBtn:     { width: s(50), height: s(50), borderRadius: s(25), backgroundColor: "rgba(0,0,0,0.58)", alignItems: "center", justifyContent: "center" },
  videoBadge: {
    position:          "absolute",
    bottom:            vs(7),
    right:             s(7),
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   "rgba(0,0,0,0.52)",
    paddingHorizontal: s(6),
    paddingVertical:   vs(3),
    borderRadius:      s(5),
  },
  videoBadgeTxt: { color: "#fff", fontSize: ms(11), fontWeight: "600" },
  typingBubbleWrap: { paddingLeft: s(12), paddingVertical: vs(6), alignSelf: "flex-start" },
  typingBubble:     { backgroundColor: C.otherMsg, borderRadius: s(18), borderBottomLeftRadius: s(4), borderWidth: 1, borderColor: C.border, paddingHorizontal: s(14), paddingVertical: vs(10), elevation: 1 },
  typingDots:       { flexDirection: "row", alignItems: "center", gap: s(5) },
  typingDot:        { width: s(7), height: s(7), borderRadius: s(4), backgroundColor: C.muted },
});
