import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, StatusBar, RefreshControl,
  Animated,
} from 'react-native';
import { SafeAreaView }                from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import supabase, { TABLES }            from '@/lib/supabase';
import { Ionicons }                    from '@expo/vector-icons';
import { ProfileAvatar }               from '@/components/Profileavatar';
import { useAuthh }                    from '@/Contexts/authContext';
import { Swipeable }                   from 'react-native-gesture-handler';
import { s, vs, ms }                   from '@/utils/scale';
import { callFn }                      from '@/lib/callFn';
import AsyncStorage                    from '@react-native-async-storage/async-storage';

interface ConnectedUser {
  user_id: string; full_name: string; profile_image: string | null;
  location: string; skills: string; bio: string; connection_id: string;
}

const C = {
  white:    '#FFFFFF',
  purple:   '#6D4AFF',
  text:     '#0F0F10',
  muted:    '#6B7280',
  border:   '#EAECF0',
  skeleton: '#F0F0F3',
};

const parseSkills = (sk: string): string[] =>
  sk ? sk.split(',').map(x => x.trim()).filter(Boolean) : [];

const CARD_H = vs(80);
const HINT_STORAGE_KEY = 'connections_swipe_hint_seen_v1';
const HINT_NUDGE = s(25);

const SwipeHintManager = (() => {
  let _checked = false;
  let _seen    = false;
  let _fired   = false;
  let _pending: (() => void) | null = null;

  const _init = async () => {
    try {
      const val = await AsyncStorage.getItem(HINT_STORAGE_KEY);
      _seen = val === 'true';
    } catch {
      _seen = false;
    }
    _checked = true;
    if (!_seen && _pending) {
      const cb = _pending;
      _pending = null;
      cb();
    }
  };

  const tryRegister = (onHint: () => void) => {
    if (_fired || _seen) return;
    if (!_checked) {
      if (!_pending) {
        _pending = () => {
          if (!_fired && !_seen) { _fired = true; onHint(); }
        };
        _init();
      }
      return;
    }
    if (!_fired && !_seen) { _fired = true; onHint(); }
  };

  const markSeen = () => {
    _seen = true;
    AsyncStorage.setItem(HINT_STORAGE_KEY, 'true').catch(() => {});
  };

  return { tryRegister, markSeen };
})();

const SkeletonRow = ({ opacity = 1 }: { opacity?: number }) => (
  <View style={[sl.card, { opacity }]}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(12) }}>
      <View style={{ width: s(52), height: s(52), borderRadius: s(26), backgroundColor: C.skeleton }} />
      <View style={{ flex: 1, gap: vs(8) }}>
        <View style={{ height: vs(13), width: '50%', backgroundColor: C.skeleton, borderRadius: s(6) }} />
        <View style={{ height: vs(11), width: '70%', backgroundColor: C.skeleton, borderRadius: s(6) }} />
      </View>
    </View>
  </View>
);

const ProfileAction = ({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity style={sl.profileAction} onPress={onPress} activeOpacity={0.8}>
    <Ionicons name="person-outline" size={s(20)} color="#fff" />
    <Text style={sl.actionText}>Profile</Text>
  </TouchableOpacity>
);
const RemoveAction = ({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity style={sl.removeAction} onPress={onPress} activeOpacity={0.8}>
    <Ionicons name="person-remove-outline" size={s(20)} color="#fff" />
    <Text style={sl.actionText}>Remove</Text>
  </TouchableOpacity>
);

const ConnectionCard = React.memo(({
  item, isMyProfile, onRemove, isFirstCard,
}: {
  item:         ConnectedUser;
  isMyProfile:  boolean;
  onRemove?:    (i: ConnectedUser) => void;
  isFirstCard:  boolean;   // CHANGE
}) => {
  const skills      = parseSkills(item.skills).slice(0, 3);
  const ref         = useRef<Swipeable>(null);
  const hintPlaying = useRef(false);   // CHANGE
  const hintX = useRef(new Animated.Value(0)).current;
  const hintPanelOpacity = hintX.interpolate({
    inputRange:  [0, HINT_NUDGE],
    outputRange: [0, 0.85],
    extrapolate: 'clamp',
  });
  const goToProfile = () => {
    ref.current?.close();
    router.push({ pathname: '/subScreens/userProfile', params: { userId: item.user_id } });
  };
  const handleRemove = () => { ref.current?.close(); onRemove?.(item); };
  const playHint = useCallback(() => {
    if (hintPlaying.current) return;
    hintPlaying.current = true;
    setTimeout(() => {
      Animated.sequence([
        Animated.spring(hintX, {
          toValue:        HINT_NUDGE,
          useNativeDriver: true,
          damping:         18,
          stiffness:       260,
          mass:            0.6,
        }),
        Animated.delay(350),
        Animated.spring(hintX, {
          toValue:         0,
          useNativeDriver: true,
          damping:         20,
          stiffness:       240,
          mass:            0.7,
        }),
      ]).start(({ finished }) => {
        if (finished) SwipeHintManager.markSeen();
        hintPlaying.current = false;
      });
    }, 2000);
  }, [hintX]);
  useEffect(() => {
    if (isFirstCard && isMyProfile) {
      SwipeHintManager.tryRegister(playHint);
    }
  }, [isFirstCard, isMyProfile, playHint]);

  return (
    <View style={sl.cardWrapper}>
      <Animated.View style={[sl.hintPanel, { opacity: hintPanelOpacity }]}>
        <Ionicons name="person-remove-outline" size={s(20)} color="#fff" />
        <Text style={sl.actionText}>Remove</Text>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: hintX }] }}>
        <Swipeable
          ref={ref}
          friction={2}
          overshootLeft={false}
          overshootRight={false}
          renderRightActions={() => <ProfileAction onPress={goToProfile} />}
          renderLeftActions={
            isMyProfile && onRemove ? () => <RemoveAction onPress={handleRemove} /> : undefined
          }
        >
          <TouchableOpacity style={sl.card} activeOpacity={0.82} onPress={goToProfile}>
            <View style={sl.row}>
              <ProfileAvatar uri={item.profile_image} name={item.full_name} size={s(52)} />
              <View style={sl.info}>
                <Text style={sl.name} numberOfLines={1}>{item.full_name}</Text>
                {!!item.location && (
                  <View style={sl.locRow}>
                    <Ionicons name="location-sharp" size={s(11)} color={C.muted} />
                    <Text style={sl.locText} numberOfLines={1}>{item.location}</Text>
                  </View>
                )}
                {skills.length > 0 && (
                  <Text style={sl.skills} numberOfLines={1}>{skills.join(' · ')}</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </Swipeable>
      </Animated.View>

    </View>
  );
});
// ─── Header (unchanged) ───────────────────────────────────────────────────────
const Header = ({
  count, isMyProfile, ownerName,
}: {
  count: number; isMyProfile: boolean; ownerName: string;
}) => (
  <View style={sl.header}>
    <TouchableOpacity
      onPress={() => router.back()}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons name="arrow-back" size={s(18)} color={C.text} />
    </TouchableOpacity>
    <View style={{ flex: 1 }}>
      <Text style={sl.headerTitle}>
        {isMyProfile ? 'My Mindmates' : `${ownerName}'s Mindmates`}
      </Text>
      {count > 0 && (
        <Text style={sl.headerSub}>
          {count} Mindmate{count !== 1 ? 's' : ''}
        </Text>
      )}
    </View>
  </View>
);

export default function ConnectionsListScreen() {
  const params       = useLocalSearchParams<{ userId: string; name: string }>();
  const { user: me } = useAuthh();
  const paramUserId  = params.userId?.trim();
  const targetUserId = paramUserId || me?.id || '';
  const ownerName    = params.name ?? 'Connections';
  const isMyProfile  = !paramUserId || paramUserId === me?.id;

  const [connections, setConnections] = useState<ConnectedUser[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  const fetchConnections = useCallback(async (isRefresh = false) => {
    if (!targetUserId) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [sentRes, recvRes] = await Promise.all([
        supabase.from(TABLES.connections).select('id, receiver_id')
          .eq('sender_id', targetUserId).eq('status', 'accepted').limit(200),
        supabase.from(TABLES.connections).select('id, sender_id')
          .eq('receiver_id', targetUserId).eq('status', 'accepted').limit(200),
      ]);
      const pairs: { otherId: string; connId: string }[] = [
        ...(sentRes.data ?? []).map((d: any) => ({ otherId: d.receiver_id, connId: d.id })),
        ...(recvRes.data  ?? []).map((d: any) => ({ otherId: d.sender_id,  connId: d.id })),
      ].filter(p => p.otherId);

      if (!pairs.length) { setConnections([]); return; }

      const { data: profiles } = await supabase.from(TABLES.users)
        .select('user_id, full_name, profile_image, location, skills, bio')
        .in('user_id', pairs.map(p => p.otherId)).limit(200);

      const pm: Record<string, any> = {};
      (profiles ?? []).forEach((p: any) => { pm[p.user_id] = p; });

      const enriched: ConnectedUser[] = pairs.map(({ otherId, connId }) => {
        const p = pm[otherId];
        if (!p) return null;
        return {
          user_id:       otherId,
          full_name:     p.full_name     ?? 'Unknown',
          profile_image: p.profile_image ?? null,
          location:      p.location      ?? '',
          skills:        p.skills        ?? '',
          bio:           p.bio           ?? '',
          connection_id: connId,
        };
      }).filter(Boolean) as ConnectedUser[];

      enriched.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setConnections(enriched);
    } catch (e: any) {
      console.error('❌ fetchConnections:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetUserId]);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  const handleRemove = useCallback(async (item: ConnectedUser) => {
    setConnections(prev => prev.filter(c => c.connection_id !== item.connection_id));
    try {
      await callFn({ action: 'remove_friend', connectionId: item.connection_id });
    } catch (e: any) {
      console.error('remove_friend failed:', e?.message);
      fetchConnections();
    }
  }, [fetchConnections]);

  const renderItem = useCallback(({ item, index }: { item: ConnectedUser; index: number }) => (
    <ConnectionCard
      item={item}
      isMyProfile={isMyProfile}
      onRemove={isMyProfile ? handleRemove : undefined}
      isFirstCard={index === 0}
    />
  ), [isMyProfile, handleRemove]);

  if (loading) return (
    <SafeAreaView style={sl.safe} edges={['top']}>
      <Header count={0} isMyProfile={isMyProfile} ownerName={ownerName} />
      <View style={{ padding: s(16) }}>
        <SkeletonRow />
        <SkeletonRow opacity={0.7} />
        <SkeletonRow opacity={0.4} />
        <SkeletonRow opacity={0.2} />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={sl.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <Header count={connections.length} isMyProfile={isMyProfile} ownerName={ownerName} />
      <FlatList
        data={connections}
        renderItem={renderItem}
        keyExtractor={item => item.connection_id}
        contentContainerStyle={[
          sl.list,
          connections.length === 0 && sl.listEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchConnections(true)}
            tintColor={C.purple}
            colors={[C.purple]}
          />
        }
        ListEmptyComponent={
          <View style={sl.empty}>
            <Ionicons
              name="people-outline"
              size={s(52)}
              color={C.purple}
              style={{ marginBottom: vs(8) }}
            />
            <Text style={sl.emptyTitle}>
              {isMyProfile ? 'No Mindmates yet' : `${ownerName} has no Mindmates yet`}
            </Text>
            <Text style={sl.emptySub}>
              {isMyProfile ? 'Connect with people to see them here' : 'Check back later'}
            </Text>
            {isMyProfile && (
              <TouchableOpacity
                style={sl.discoverBtn}
                onPress={() => router.push('/subScreens/searchUser')}
              >
                <Text style={sl.discoverText}>Discover People</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews
        getItemLayout={(_, i) => ({ length: CARD_H, offset: CARD_H * i, index: i })}
      />
    </SafeAreaView>
  );
}

const sl = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: C.white },
  list:      { paddingBottom: vs(40) },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               s(14),
    paddingHorizontal: s(16),
    paddingVertical:   vs(10),
    backgroundColor:   C.white,
  },
  headerTitle: { fontSize: ms(15), fontWeight: '600', color: C.text },
  headerSub:   { fontSize: ms(12), color: C.muted, marginTop: vs(1) },

  cardWrapper: {
    position:   'relative',
    overflow:   'hidden',
  },

  hintPanel: {
    position:        'absolute',
    left:            0,
    top:             0,
    bottom:          0,
    width:           s(80),
    backgroundColor: '#EF4444',
    justifyContent:  'center',
    alignItems:      'center',
    gap:             vs(4),
  },

  card: {
    backgroundColor:   C.white,
    paddingHorizontal: s(16),
    paddingVertical:   vs(8),
  },
  row:  { flexDirection: 'row', alignItems: 'center', gap: s(12) },
  info: { flex: 1 },

  name:    { fontSize: ms(14), fontWeight: '600', color: C.text, marginBottom: vs(3) },
  locRow:  { flexDirection: 'row', alignItems: 'center', gap: s(3), marginBottom: vs(2) },
  locText: { fontSize: ms(11), color: C.muted },
  skills:  { fontSize: ms(12), color: C.purple, fontWeight: '500' },

  profileAction: {
    backgroundColor: '#6D4AFF',
    justifyContent:  'center',
    alignItems:      'center',
    width:           s(80),
    gap:             vs(4),
    minHeight:       vs(64),
  },
  removeAction: {
    backgroundColor: '#EF4444',
    justifyContent:  'center',
    alignItems:      'center',
    width:           s(80),
    gap:             vs(4),
    minHeight:       vs(64),
  },
  actionText: { color: '#fff', fontSize: ms(12), fontWeight: '600' },

  empty: { alignItems: 'center', paddingHorizontal: s(32) },
  emptyTitle: {
    fontSize: ms(17), fontWeight: '700', color: C.text,
    marginBottom: vs(8), textAlign: 'center',
  },
  emptySub: {
    fontSize: ms(14), color: C.muted, textAlign: 'center',
    lineHeight: ms(21), marginBottom: vs(12),
  },
  discoverBtn: {
    backgroundColor:   C.purple,
    paddingHorizontal: s(24),
    paddingVertical:   vs(12),
    borderRadius:      s(12),
    marginBottom:      vs(40),
  },
  discoverText: { color: '#fff', fontWeight: '700', fontSize: ms(14) },
});