import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View, Image, Text, Pressable } from 'react-native';
import { BlurView }  from 'expo-blur';
import { Ionicons }  from '@expo/vector-icons';
import React, { useEffect, useState, useCallback } from 'react';
import { useProfile } from '@/Contexts/profileContext';
import { useAuthh }    from '@/Contexts/authContext';
import { supabase, TABLES } from '@/lib/supabase';

// ── Notification badge hook ───────────────────────────────────
// TEACHING: How realtime badge works:
//   1. Mount: fetch count(is_read=false, user_id=me) from DB
//   2. Subscribe: Supabase realtime channel filtered to user_id=me
//   3. INSERT event: new notification → increment badge
//   4. Any other event: refetch count (handles mark-read etc.)
//   5. User taps chat tab → markAllRead() → set is_read=true → badge=0
//
//   Works on ALL platforms: iOS, Android, Web (via WebSocket) ✅
const useUnreadCount = (myUserId: string | undefined) => {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!myUserId) return;
    try {
      const { count: total, error } = await supabase
        .from(TABLES.notifications)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', myUserId)      // ✅ snake_case
        .eq('is_read', false);        // ✅ snake_case

      if (!error && total !== null) {
        setCount(total);
        console.log(`🔔 Badge count: ${total}`);
      }
    } catch (e: any) {
      console.warn('⚠️ Badge fetch failed:', e?.message);
    }
  }, [myUserId]);

  useEffect(() => {
    if (!myUserId) return;
    fetchCount();

    // ── Realtime subscription ─────────────────────────────
    // FIX: Properly unsubscribe before removing channel
    // Supabase realtime uses WebSocket — works on web too ✅
    // FIX: Appending a timestamp ensures we always work with a fresh channel instance
    const channelName = `badge-${myUserId}-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*', schema: 'public',
        table: TABLES.notifications,
        filter: `user_id=eq.${myUserId}`,
      }, (payload:any) => {
        console.log('badge realtime:', payload.eventType);
        if (payload.eventType === 'INSERT' && payload.new?.is_read === false) {
          setCount((prev:any) => prev + 1);
        } else {
          // For UPDATE/DELETE: refetch accurate count
          fetchCount();
        }
      })
      .subscribe((status:any) => {
        console.log('badge channel:', status);
      });

    return () => { 
      channel.unsubscribe();
      supabase.removeChannel(channel); 
    };
  }, [myUserId, fetchCount]);

  const markAllRead = useCallback(async () => {
    if (!myUserId || count === 0) return;
    setCount(0); // optimistic
    try {
      await supabase
        .from(TABLES.notifications)
        .update({ is_read: true })    // ✅ snake_case
        .eq('user_id', myUserId)     // ✅ snake_case
        .eq('is_read', false);       // ✅ snake_case
    } catch (e: any) {
      console.warn('markAllRead failed:', e?.message);
      fetchCount(); // rollback
    }
  }, [myUserId, count, fetchCount]);

  return { count, markAllRead };
};

// ── Badge pill ────────────────────────────────────────────────
const Badge = React.memo(({ count }: { count: number }) => {
  if (count <= 0) return null;
  return (
    <View style={bs.wrap}>
      <Text style={bs.text}>{count > 99 ? '99+' : String(count)}</Text>
    </View>
  );
});

// ── Tab bar ───────────────────────────────────────────────────
const FloatingBlurTabBar = React.memo(({ state, navigation }: any) => {
  const { profile }            = useProfile();
  const { user }               = useAuthh();
  const { count, markAllRead } = useUnreadCount(user?.id);

  const iconMap: Record<string, { active: string; inactive: string }> = {
    home:   { active: 'home',         inactive: 'home-outline'   },
    search: { active: 'search-sharp', inactive: 'search-outline' },
    chat:   { active: 'people-sharp', inactive: 'people-outline' },
  };

  return (
    <View style={[t.outerWrapper, { pointerEvents: 'box-none' } as any]}>
      <BlurView intensity={10} style={t.blurContainer}>
        <View style={t.tabRow}>
          {state.routes.map((route: any, index: number) => {
            const focused    = state.index === index;
            const icons      = iconMap[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline' };
            const color      = focused ? '#6D4AFF' : '#000000';
            const isChat     = route.name === 'chat';
            const isProfile  = route.name === 'profile';

            const handlePress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              if (isChat) markAllRead();
            };

            return (
              <View key={route.key} style={t.tabItem as any}>
                {focused && <View style={t.activePill as any} />}
                <Pressable onPress={handlePress} style={t.pressable}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  android_ripple={{ color: 'transparent', radius: 28 }}>
                  {isProfile ? (
                    profile?.profileImage
                      ? <Image source={{ uri: profile.profileImage }} style={[t.avatar, focused && { borderColor: '#6D4AFF' }]} />
                      : <View style={[t.avatarFallback, focused && { borderColor: '#6D4AFF' }]}>
                          <Text style={[t.avatarText, focused && { color: '#6D4AFF' }]}>
                            {profile?.fullName?.charAt(0)?.toUpperCase() ?? '?'}
                          </Text>
                        </View>
                  ) : (
                    <View style={t.iconWrap}>
                      <Ionicons name={(focused ? icons.active : icons.inactive) as any} size={24} color={color} />
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
      screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' }, lazy: false, freezeOnBlur: true }}
      tabBar={(props: any) => <FloatingBlurTabBar {...props} />}
    >
      <Tabs.Screen name="home"    options={{ title: 'Home'    }} />
      <Tabs.Screen name="search"  options={{ title: 'Search'  }} />
      <Tabs.Screen name="chat"    options={{ title: 'Chat'    }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const BAR_HEIGHT = 64;
const BOTTOM_OFFSET = Platform.OS === 'ios' ? 28 : 18;

const t = StyleSheet.create({
  outerWrapper:  { position: 'absolute', bottom: BOTTOM_OFFSET, left: 24, right: 24, shadowColor: '#8d8d8d', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3, borderRadius: 50, marginBottom: 25, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', zIndex: 1 },
  blurContainer: { borderRadius: 35, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.98)', backgroundColor: 'rgba(255,255,255,0.97)' },
  tabRow:        { flexDirection: 'row', height: BAR_HEIGHT, alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 8 },
  tabItem:       { flex: 1, alignItems: 'center', justifyContent: 'center', height: BAR_HEIGHT, position: 'relative' },
  pressable:     { alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  activePill:    { position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(124,58,237,0.12)' },
  iconWrap:      { position: 'relative' },
  avatar:        { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#E5E7EB' },
  avatarFallback:{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E5E7EB' },
  avatarText:    { fontSize: 14, fontWeight: '700', color: '#6B7280' },
});

const bs = StyleSheet.create({
  wrap: { position: 'absolute', top: -7, right: -9, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#6D4AFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#FFFFFF', zIndex: 99 },
  text: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', lineHeight: 13 },
});