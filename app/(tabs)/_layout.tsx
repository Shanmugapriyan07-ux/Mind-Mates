import { useAuthh } from "@/Contexts/authContext";
import { useProfile } from "@/Contexts/profileContext";
import { cdnProfileUrl } from "@/lib/cloudinaryUpload";
import { supabase, TABLES } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { Tabs } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
const BAR_HEIGHT = 64;
const SIDE_MARGIN = 24;
const POLL_INTERVAL = 30_000;
const useUnreadCount = (myUserId: string | undefined) => {
  const [count, setCount] = useState(0);
  const markTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchCount = useCallback(async () => {
    if (!myUserId) return;
    try {
      const { count: total, error } = await supabase
        .from(TABLES.notifications)
        .select("*", { count: "exact", head: true })
        .eq("user_id", myUserId)
        .eq("is_read", false);
      if (!error && total !== null) setCount(total);
    } catch (e: any) {
      console.warn("[Badge] fetch failed:", e?.message);
    }
  }, [myUserId]);
  useEffect(() => {
    if (!myUserId) return;
    fetchCount();
    const channelName = `badge_${myUserId}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: TABLES.notifications,
          filter: `user_id=eq.${myUserId}`,
        },
        (payload: any) => {
          const { eventType, new: n, old: o } = payload;
          if (eventType === "INSERT") {
            if (n?.is_read === false) {
              setCount((prev) => prev + 1);
            }
            return;
          }
          if (eventType === "UPDATE") {
            const wasRead = o?.is_read;
            const isRead = n?.is_read;
            if (wasRead !== isRead) fetchCount();
            return;
          }
          if (eventType === "DELETE") {
            fetchCount();
          }
        },
      )
      .subscribe((status: string) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (!pollingRef.current) {
            pollingRef.current = setInterval(fetchCount, POLL_INTERVAL);
          }
        } else if (status === "SUBSCRIBED") {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      });
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [myUserId, fetchCount]);
  const markAllRead = useCallback(() => {
    if (!myUserId || count === 0) return;
    setCount(0);

    if (markTimerRef.current) clearTimeout(markTimerRef.current);
    markTimerRef.current = setTimeout(async () => {
      try {
        await supabase
          .from(TABLES.notifications)
          .update({ is_read: true })
          .eq("user_id", myUserId)
          .eq("is_read", false);
      } catch (e: any) {
        console.warn("[Badge] markAllRead failed:", e?.message);
        fetchCount();
      }
    }, 300);
  }, [myUserId, count, fetchCount]);

  return { count, markAllRead };
};
const Badge = React.memo(({ count }: { count: number }) => {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  const isWide = count > 9;
  return (
    <View style={[bs.wrap, isWide && bs.wrapWide]}>
      <Text style={bs.text}>{label}</Text>
    </View>
  );
});

const FloatingBlurTabBar = React.memo(({ state, navigation }: any) => {
  const { profile } = useProfile();
  const { user } = useAuthh();
  const { count, markAllRead } = useUnreadCount(user?.id);
  const insets = useSafeAreaInsets();
  const bottomOffset =
    Math.max(insets.bottom, 8) + (Platform.OS === "ios" ? 4 : 6);

  const iconMap: Record<string, { active: string; inactive: string }> = {
    home: { active: "home", inactive: "home-outline" },
    search: { active: "search-sharp", inactive: "search-outline" },
    chat: { active: "notifications", inactive: "notifications-outline" },
  };

  return (
    <View
      style={[
        t.outerWrapper,
        {
          bottom: bottomOffset + 16,
          left: SIDE_MARGIN,
          right: SIDE_MARGIN,
          pointerEvents: "box-none",
        } as any,
      ]}
    >
      <BlurView intensity={80} tint="light" style={t.blurContainer}>
         <View
      style={{
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(255,255,255,0.12)",
      }}
    />
        <View
          style={[t.tabRow, { paddingBottom: Platform.OS === "ios" ? 0 : 0 }]}
        >
          {state.routes.map((route: any, index: number) => {
            const focused = state.index === index;
            const icons = iconMap[route.name] ?? {
              active: "ellipse",
              inactive: "ellipse-outline",
            };
            const color = focused ? "#6D4AFF" : "#000000";
            const isChat = route.name === "chat";
            const isProfile = route.name === "profile";

            const handlePress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented)
                navigation.navigate(route.name);
              if (isChat) markAllRead();
            };

            return (
              <View key={route.key} style={t.tabItem as any}>
                {focused && <View style={t.activePill as any} />}
                <Pressable
                  onPress={handlePress}
                  style={t.pressable}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  android_ripple={{ color: "transparent", radius: 28 }}
                >
                  {isProfile ? (
                    profile?.profileImage ? (
                      <Image
                        source={{
                          uri: cdnProfileUrl(profile.profileImage, 160),
                        }}
                        style={[t.avatar, focused && t.avatarFocused]}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <View
                        style={[t.avatarFallback, focused && t.avatarFocused]}
                      >
                        <Text
                          style={[t.avatarText, focused && t.avatarTextFocused]}
                        >
                          {profile?.fullName?.charAt(0)?.toUpperCase() ?? "?"}
                        </Text>
                      </View>
                    )
                  ) : (
                    <View style={t.iconWrap}>
                      <Ionicons
                        name={(focused ? icons.active : icons.inactive) as any}
                        size={24}
                        color={color}
                      />
                      {isChat && <Badge count={count} />}
                    </View>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
});

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" },
        freezeOnBlur: true,
      }}
      tabBar={(props: any) => <FloatingBlurTabBar {...props} />}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="search" options={{ title: "Search" }} />
      <Tabs.Screen name="chat" options={{ title: "Chat" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

const t = StyleSheet.create({
outerWrapper: {
  position: "absolute",
  backgroundColor: "rgba(255,255,255,0.85)",
  borderRadius: 32,
  borderWidth: 0,
  borderColor: "rgba(255,255,255,0.4)",
  shadowColor: "#000",
  shadowOffset: {
    width: 0,
    height: 3,
  },
  shadowOpacity: 0.03,
  shadowRadius: 12,
  elevation: 10,
},
blurContainer: {
  borderRadius: 32,
  overflow: "hidden",
  borderWidth: 0.5,
  borderColor: "rgba(255,255,255,0.25)",
},
  tabRow: {
    flexDirection: "row",
    height: BAR_HEIGHT,
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: BAR_HEIGHT,
    position: "relative",
  },
  pressable: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
    minWidth: 44, // minimum tap target (Apple HIG / Material)
    minHeight: 44,
  },
  activePill: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(109,74,255,0.12)",
  },
  iconWrap: {
    position: "relative",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  avatarFocused: {
    borderColor: "#6D4AFF",
  },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
  },
  avatarTextFocused: {
    color: "#6D4AFF",
  },
});

const bs = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: -7,
    right: -9,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#6D4AFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    zIndex: 99,
  },
  wrapWide: {
    minWidth: 24,
    borderRadius: 10,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 13,
  },
});
