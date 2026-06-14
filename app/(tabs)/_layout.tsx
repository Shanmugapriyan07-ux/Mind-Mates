import { Tabs }              from 'expo-router';
import {
  Platform,
  StyleSheet,
  View,
  Image,
  Text,
  Pressable,
}                            from 'react-native';
import { BlurView }          from 'expo-blur';
import { Ionicons }          from '@expo/vector-icons';
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
}                            from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';  // ← FIX 1
import { useProfile }        from '@/Contexts/profileContext';
import { useAuthh }          from '@/Contexts/authContext';
import { supabase, TABLES }  from '@/lib/supabase';

// ─── Constants ────────────────────────────────────────────────────────────────
const BAR_HEIGHT     = 64;
const SIDE_MARGIN    = 24;
const POLL_INTERVAL  = 30_000; // 30 s fallback poll when RT is broken

// ─── useUnreadCount ───────────────────────────────────────────────────────────
const useUnreadCount = (myUserId: string | undefined) => {
  const [count,       setCount]       = useState(0);
  const markTimerRef                  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef                    = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch from DB (source of truth) ────────────────────────────────────────
  const fetchCount = useCallback(async () => {
    if (!myUserId) return;
    try {
      const { count: total, error } = await supabase
        .from(TABLES.notifications)
        .select('*', { count: 'exact', head: true })
        .eq('user_id',  myUserId)
        .eq('is_read',  false);
      if (!error && total !== null) setCount(total);
    } catch (e: any) {
      console.warn('[Badge] fetch failed:', e?.message);
    }
  }, [myUserId]);

  // ── RT subscription ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!myUserId) return;

    fetchCount(); // initial load

    // Stable channel name — no Date.now() so only ONE subscription per user
    const channelName = `badge_${myUserId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  TABLES.notifications,
          filter: `user_id=eq.${myUserId}`,
        },
        (payload: any) => {
          const { eventType, new: n, old: o } = payload;

          if (eventType === 'INSERT') {
            // Optimistic: increment instead of re-fetching
            if (n?.is_read === false) {
              setCount(prev => prev + 1);
            }
            return;
          }

          if (eventType === 'UPDATE') {
            // Only re-fetch if is_read changed (avoids spurious re-renders)
            const wasRead = o?.is_read;
            const isRead  = n?.is_read;
            if (wasRead !== isRead) fetchCount();
            return;
          }

          if (eventType === 'DELETE') {
            // A notification was hard-deleted — re-sync
            fetchCount();
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // RT broke — fall back to polling every 30 s
          if (!pollingRef.current) {
            pollingRef.current = setInterval(fetchCount, POLL_INTERVAL);
          }
        } else if (status === 'SUBSCRIBED') {
          // RT recovered — stop polling
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

  // ── Mark all read (debounced — fires once even if user tab-switches fast) ──
  const markAllRead = useCallback(() => {
    if (!myUserId || count === 0) return;

    // Optimistic clear immediately so badge disappears on tap
    setCount(0);

    if (markTimerRef.current) clearTimeout(markTimerRef.current);
    markTimerRef.current = setTimeout(async () => {
      try {
        await supabase
          .from(TABLES.notifications)
          .update({ is_read: true })
          .eq('user_id', myUserId)
          .eq('is_read', false);
      } catch (e: any) {
        console.warn('[Badge] markAllRead failed:', e?.message);
        fetchCount(); // rollback on error
      }
    }, 300);
  }, [myUserId, count, fetchCount]);

  return { count, markAllRead };
};

// ─── Badge pill ───────────────────────────────────────────────────────────────
const Badge = React.memo(({ count }: { count: number }) => {
  if (count <= 0) return null;
  const label = count > 99 ? '99+' : String(count);
  const isWide = count > 9; // 10+ needs wider pill
  return (
    <View style={[bs.wrap, isWide && bs.wrapWide]}>
      <Text style={bs.text}>{label}</Text>
    </View>
  );
});

// ─── FloatingBlurTabBar ───────────────────────────────────────────────────────
const FloatingBlurTabBar = React.memo(({ state, navigation }: any) => {
  const { profile }            = useProfile();
  const { user }               = useAuthh();
  const { count, markAllRead } = useUnreadCount(user?.id);
  const insets                 = useSafeAreaInsets();     // ← FIX 1

  // Dynamic bottom offset — respects gesture nav bars on ALL Android phones
  // and home indicator on iPhone. Minimum 8 px so it never hugs the edge.
  const bottomOffset = Math.max(insets.bottom, 8) + (Platform.OS === 'ios' ? 4 : 6);

  const iconMap: Record<string, { active: string; inactive: string }> = {
    home:   { active: 'home',         inactive: 'home-outline'   },
    search: { active: 'search-sharp', inactive: 'search-outline' },
    chat:   { active: 'people-sharp', inactive: 'people-outline' },
  };

  return (
    <View
      style={[
        t.outerWrapper,
        {
          bottom:        bottomOffset + 16, // extra breathing room above system bar
          left:          SIDE_MARGIN,
          right:         SIDE_MARGIN,
          pointerEvents: 'box-none',
        } as any,
      ]}
    >
      <BlurView intensity={10} style={t.blurContainer}>
        <View style={[t.tabRow, { paddingBottom: Platform.OS === 'ios' ? 0 : 0 }]}>
          {state.routes.map((route: any, index: number) => {
            const focused   = state.index === index;
            const icons     = iconMap[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline' };
            const color     = focused ? '#6D4AFF' : '#000000';
            const isChat    = route.name === 'chat';
            const isProfile = route.name === 'profile';

            const handlePress = () => {
              const event = navigation.emit({
                type: 'tabPress', target: route.key, canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              if (isChat) markAllRead();
            };

            return (
              <View key={route.key} style={t.tabItem as any}>
                {focused && <View style={t.activePill as any} />}
                <Pressable
                  onPress={handlePress}
                  style={t.pressable}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  android_ripple={{ color: 'transparent', radius: 28 }}
                >
                  {isProfile ? (
                    profile?.profileImage ? (
                      <Image
                        source={{ uri: profile.profileImage }}
                        style={[t.avatar, focused && t.avatarFocused]}
                      />
                    ) : (
                      <View style={[t.avatarFallback, focused && t.avatarFocused]}>
                        <Text style={[t.avatarText, focused && t.avatarTextFocused]}>
                          {profile?.fullName?.charAt(0)?.toUpperCase() ?? '?'}
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

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown:  false,
        tabBarStyle:  { display: 'none' },
        lazy:         false,
        freezeOnBlur: true,
      }}
      tabBar={(props: any) => <FloatingBlurTabBar {...props} />}
    >
      <Tabs.Screen name="home"    options={{ title: 'Home'    }} />
      <Tabs.Screen name="search"  options={{ title: 'Search'  }} />
      <Tabs.Screen name="chat"    options={{ title: 'Chat'    }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const t = StyleSheet.create({
  outerWrapper: {
    position:        'absolute',
    shadowColor:     '#8d8d8d',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.18,
    shadowRadius:    12,
    elevation:       8,
    borderRadius:    50,
    overflow:        'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.6)',
    zIndex:          999,
  },
  blurContainer: {
    borderRadius:    35,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.98)',
    backgroundColor: 'rgba(255,255,255,0.97)',
  },
  tabRow: {
    flexDirection:   'row',
    height:          BAR_HEIGHT,
    alignItems:      'center',
    justifyContent:  'space-around',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    height:          BAR_HEIGHT,
    position:        'relative',
  },
  pressable: {
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          1,
    minWidth:        44,   // minimum tap target (Apple HIG / Material)
    minHeight:       44,
  },
  activePill: {
    position:        'absolute',
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: 'rgba(109,74,255,0.12)',
  },
  iconWrap: {
    position:        'relative',
  },
  avatar: {
    width:           32,
    height:          32,
    borderRadius:    16,
    borderWidth:     2,
    borderColor:     '#E5E7EB',
  },
  avatarFocused: {
    borderColor:     '#6D4AFF',
  },
  avatarFallback: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: '#E5E7EB',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     2,
    borderColor:     '#E5E7EB',
  },
  avatarText: {
    fontSize:        14,
    fontWeight:      '700',
    color:           '#6B7280',
  },
  avatarTextFocused: {
    color:           '#6D4AFF',
  },
});

const bs = StyleSheet.create({
  wrap: {
    position:        'absolute',
    top:             -7,
    right:           -9,
    minWidth:        18,
    height:          18,
    borderRadius:    9,
    backgroundColor: '#6D4AFF',
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 4,
    borderWidth:     1.5,
    borderColor:     '#FFFFFF',
    zIndex:          99,
  },
  wrapWide: {
    minWidth:        24,
    borderRadius:    10,
  },
  text: {
    color:           '#FFFFFF',
    fontSize:        10,
    fontWeight:      '700',
    lineHeight:      13,
  },
});