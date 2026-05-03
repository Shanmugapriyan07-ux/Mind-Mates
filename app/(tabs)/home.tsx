
import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, StatusBar, RefreshControl, Platform,
} from 'react-native';
import { Animated }               from 'react-native';
import { SafeAreaView }           from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { supabase, TABLES }       from '@/lib/supabase';
import { callFn }                from '@/lib/callFn';
import { useAuthh }                from '@/Contexts/authContext';
import { Ionicons }               from '@expo/vector-icons';
import { ChatMenuSheet }          from '@/components/blockSheet';
import { FriendsSearchModal }     from '@/components/FriendSearchModel';
import { SwipeableRow, Friend }   from '@/components/SwipeableRow';
import ConfirmModal               from '@/components/confirmModel'; // ← NEW

const cacheGet = async (k: string): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') return localStorage.getItem(k);
    return require('@react-native-async-storage/async-storage').default.getItem(k);
  } catch { return null; }
};
const cacheSet = async (k: string, v: string) => {
  try {
    if (Platform.OS === 'web') { localStorage.setItem(k, v); return; }
    require('@react-native-async-storage/async-storage').default.setItem(k, v).catch(() => {});
  } catch {}
};

const C = {
  white:'#FFFFFF', purple:'#6D4AFF', text:'#111827',
  muted:'#6B7280', red:'#EF4444', skeleton:'#E9EAEC',
};

const CACHE_KEY  = (uid: string) => `friends_v6_${uid}`;
const CACHE_TTL  = 60 * 1000;

const toMs         = (ts?: string | null) => ts ? new Date(ts).getTime() : 0;
const sortByRecent = (list: Friend[]) =>
  [...list].sort((a, b) => toMs(b.last_message_at) - toMs(a.last_message_at));

const orderChanged = (a: Friend[], b: Friend[]) =>
  a.length !== b.length || a.some((f, i) => f.connection_id !== b[i]?.connection_id);

const SkeletonRow = ({ opacity = 1 }: { opacity?: number }) => (
  <View style={[s.skRow, { opacity }]}>
    <View style={{ width:52, height:52, borderRadius:26, backgroundColor:C.skeleton }} />
    <View style={{ flex:1, gap:8 }}>
      <View style={{ height:11, width:'45%', backgroundColor:C.skeleton, borderRadius:5 }} />
      <View style={{ height:11, width:'65%', backgroundColor:C.skeleton, borderRadius:5 }} />
    </View>
  </View>
);

const BulkDeleteBar = ({ count, onDeleteAll }: { count: number; onDeleteAll: () => void }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue:count>=2?1:0, useNativeDriver:true, damping:150, stiffness:350 }).start();
  }, [count >= 2]);
  if (count < 2) return null;
  return (
    <Animated.View style={[bk.bar, { opacity:anim, transform:[{ translateY:anim.interpolate({ inputRange:[0,1], outputRange:[-44,0] }) }] }]}>
      <View style={bk.left}>
        <View style={bk.badge}><Text style={bk.num}>{count}</Text></View>
        <Text style={bk.label}>chats selected</Text>
      </View>
      <TouchableOpacity style={bk.btn} onPress={onDeleteAll} activeOpacity={0.85}>
        <Ionicons name="trash" size={14} color="#ffffff" />
        <Text style={bk.btnTxt}>Delete all</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};
const bk = StyleSheet.create({
  bar:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:'#1F1F1F', marginHorizontal:15,bottom:55, borderRadius:12, paddingHorizontal:18, paddingVertical:10, elevation:6,marginBottom:-45 },
  left:  { flexDirection:'row', alignItems:'center', gap:10 },
  badge: { backgroundColor:'rgba(255,255,255,0.2)', borderRadius:10, paddingHorizontal:9, paddingVertical:3, minWidth:26, alignItems:'center' },
  num:   { color:'#fff', fontWeight:'800', fontSize:13 },
  label: { color:'rgba(255,255,255,0.85)', fontSize:13, fontWeight:'500' },
  btn:   { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'#6D4AFF', paddingHorizontal:14, paddingVertical:8, borderRadius:8 },
  btnTxt:{ color:'#ffffff', fontWeight:'600', fontSize:13 },
});

// ═══════════════════════════════════════════════════════════════
export default function ChatListScreen() {
  const { user } = useAuthh();

  const [friends,     setFriends]     = useState<Friend[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [menuSheet,   setMenuSheet]   = useState(false);
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [swipedIds,   setSwipedIds]   = useState<Set<string>>(new Set());

  // ── Modal state (replaces all Alert.alert calls) ──────────────
  // Holds the Friend being acted on; null = modal closed
  const [deleteModal, setDeleteModal] = useState<Friend | null>(null);
  const [clearModal,  setClearModal]  = useState<Friend | null>(null);

  const listKeyRef    = useRef(0);
  const friendsRef    = useRef<Friend[]>([]);
  const allFriendsRef = useRef<Friend[]>([]);
  const isFirstFocus  = useRef(true);
  const closeRegistry = useRef<Map<string, () => void>>(new Map());
  const channelRef    = useRef<any>(null);

  const registerClose  = useCallback((id: string, fn: () => void) => { closeRegistry.current.set(id, fn); }, []);
  const closeAllExcept = useCallback((exceptId?: string) => { closeRegistry.current.forEach((fn, id) => { if (id !== exceptId) fn(); }); }, []);
  const onSwipeLeftOpen  = useCallback((id: string) => setSwipedIds(p => new Set([...p, id])), []);
  const onSwipeLeftClose = useCallback((id: string) => setSwipedIds(p => { const n = new Set(p); n.delete(id); return n; }), []);

  const setAndSort = useCallback((updater: (p: Friend[]) => Friend[]) => {
    setFriends(prev => {
      const next = sortByRecent(updater(prev));
      if (orderChanged(prev, next)) listKeyRef.current += 1;
      friendsRef.current = next;
      return next;
    });
  }, []);

  const silentUpdate = useCallback((fresh: Friend[]) => {
    allFriendsRef.current = sortByRecent(fresh);
    const visible = allFriendsRef.current.filter(f => !(f as any).is_hidden);
    setFriends(prev => {
      if (orderChanged(prev, visible)) listKeyRef.current += 1;
      friendsRef.current = visible;
      return visible;
    });
  }, []);

  const fetchFresh = useCallback(async (): Promise<Friend[]> => {
    if (!user?.id) return [];
    const uid = user.id;
    const [sent, recv] = await Promise.all([
      supabase.from(TABLES.connections).select('id,receiver_id').eq('sender_id',uid).eq('status','accepted').limit(200),
      supabase.from(TABLES.connections).select('id,sender_id').eq('receiver_id',uid).eq('status','accepted').limit(200),
    ]);
    const conns = [
      ...(sent.data??[]).map(d => ({ connId:d.id, otherId:d.receiver_id })),
      ...(recv.data??[]).map(d => ({ connId:d.id, otherId:d.sender_id })),
    ].filter(c => c.otherId);
    if (!conns.length) return [];
    const otherIds = conns.map(c => c.otherId);
    const [profilesRes, chatsRes] = await Promise.all([
      supabase.from(TABLES.users)
        .select('user_id,full_name,profile_image,location,skills,last_seen')
        .in('user_id', otherIds).limit(200),
      supabase.from(TABLES.chats)
        .select('id,participants,last_message,last_message_at,last_sender_id,last_message_status,hidden_for')
        .contains('participants', [uid])
        .order('last_message_at', { ascending: false }).limit(200),
    ]);
    const pm: Record<string,any> = {};
    (profilesRes.data??[]).forEach(p => { pm[p.user_id] = p; });
    const cm: Record<string,any> = {};
    (chatsRes.data??[]).forEach(c => {
      const other = (c.participants as string[])?.find(p => p !== uid);
      if (other) cm[other] = c;
    });
    return conns.map(({ connId, otherId }) => {
      const p  = pm[otherId];
      const ch = cm[otherId];
      const isHidden = ch ? (ch.hidden_for ?? []).includes(uid) : false;
      return {
        connection_id:        connId,
        user_id:              otherId,
        full_name:            p?.full_name      ?? 'Unknown',
        profile_image:        p?.profile_image  ?? null,
        location:             p?.location       ?? '',
        skills:               p?.skills         ?? '',
        last_seen:            p?.last_seen       ?? null,
        chat_id:              ch?.id             ?? undefined,
        last_message:         isHidden ? null   : (ch?.last_message    ?? null),
        last_message_at:      isHidden ? null   : (ch?.last_message_at ?? null),
        last_message_is_mine: isHidden ? false  : (ch?.last_sender_id  === uid),
        last_message_status:  isHidden ? 'sent' : ((ch?.last_message_status ?? 'sent') as 'sent'|'seen'),
        is_hidden:            isHidden,
      };
    });
  }, [user?.id]);

  const loadFriends = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    if (isRefresh) setRefreshing(true);
    if (!isRefresh) {
      const raw = await cacheGet(CACHE_KEY(user.id));
      if (raw) {
        try {
          const { data, at } = JSON.parse(raw);
          if (Date.now() - at < CACHE_TTL && data.length) {
            const sorted   = sortByRecent(data);
            const visCache = sorted.filter((f: any) => !f.is_hidden);
            allFriendsRef.current = sorted;
            setFriends(visCache); friendsRef.current = visCache; setLoading(false);
          }
        } catch {}
      }
    }
    try {
      const allFresh = sortByRecent(await fetchFresh());
      const visible  = allFresh.filter((f: any) => !f.is_hidden);
      allFriendsRef.current = allFresh;
      setFriends(prev => {
        if (orderChanged(prev, visible)) listKeyRef.current += 1;
        friendsRef.current = visible;
        return visible;
      });
      cacheSet(CACHE_KEY(user.id), JSON.stringify({ data:allFresh, at:Date.now() }));
    } catch (e: any) { console.error('❌ loadFriends:', e?.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user?.id, fetchFresh]);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  useFocusEffect(useCallback(() => {
    if (isFirstFocus.current) { isFirstFocus.current = false; return; }
    fetchFresh()
      .then(fresh => { if (fresh.length) silentUpdate(fresh); })
      .catch(() => {});
  }, [fetchFresh, silentUpdate]));

  // ── Realtime ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    const topic = `cl-${uid}-${Date.now()}`;
    const ch = supabase
      .channel(topic)
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'chats' }, payload => {
        const doc = payload.new as any;
        const parts: string[] = doc.participants ?? [];
        if (!parts.includes(uid)) return;
        const otherId = parts.find(p => p !== uid);
        if (!otherId) return;
        const isNowHidden = (doc.hidden_for ?? []).includes(uid);
        if (isNowHidden) {
          setFriends(prev => {
            const next = prev.filter(f => f.user_id !== otherId);
            friendsRef.current = next;
            listKeyRef.current += 1;
            return next;
          });
          return;
        }
        setAndSort(prev => {
          const idx = prev.findIndex(f => f.user_id === otherId);
          if (idx === -1) { loadFriends(); return prev; }
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            chat_id:              doc.id,
            last_message:         doc.last_message      ?? null,
            last_message_at:      doc.last_message_at   ?? null,
            last_message_is_mine: doc.last_sender_id    === uid,
            last_message_status:  (doc.last_message_status ?? 'sent') as 'sent'|'seen',
          } as Friend;
          return next;
        });
      })
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'chats' }, payload => {
        if ((payload.new?.participants as string[])?.includes(uid)) loadFriends();
      })
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'users' }, payload => {
        const doc = payload.new as any;
        setFriends(prev => {
          const idx = prev.findIndex(f => f.user_id === doc.user_id);
          if (idx === -1) return prev;
          const next = [...prev]; next[idx] = { ...next[idx], last_seen:doc.last_seen }; return next;
        });
      })
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); channelRef.current = null; };
  }, [user?.id]);

  // ── handleDelete: just opens the modal ───────────────────────
  // Actual work (doHideChat) runs only after user confirms inside ConfirmModal
  // ConfirmModal uses InteractionManager → zero UI freeze ✅
  const handleDelete = useCallback((f: Friend) => {
    setDeleteModal(f);
  }, []);

  // Extracted from old handleDelete — same backend call, just separated
  const doHideChat = useCallback(async (f: Friend) => {
    setFriends(prev => prev.filter(x => x.connection_id !== f.connection_id));
    setSwipedIds(prev => { const n = new Set(prev); n.delete(f.connection_id); return n; });
    listKeyRef.current += 1;
    if (!f.chat_id) return;
    try {
      await callFn({ action: 'hide_chat', chatId: f.chat_id });
    } catch (e: any) {
      console.error('❌ hide_chat:', e?.message);
      setFriends(prev => sortByRecent([f, ...prev]));
      listKeyRef.current += 1;
    }
  }, []);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(swipedIds);
    const targets = friends.filter(f => ids.includes(f.connection_id));
    setFriends(prev => prev.filter(f => !ids.includes(f.connection_id)));
    setSwipedIds(new Set()); closeAllExcept(); listKeyRef.current += 1;
    // Bulk delete skips modal — it's already a deliberate multi-select action
    await Promise.all(targets.map(f => doHideChat(f)));
  }, [swipedIds, friends, doHideChat, closeAllExcept]);

  // ── handleClear: just opens the modal ────────────────────────
  // Actual work (doClearChat) runs only after user confirms inside ConfirmModal
  const handleClear = useCallback((f: Friend) => {
    if (!f.chat_id) return;
    setClearModal(f);
  }, []);

  // Extracted from old handleClear — same backend call, just separated
  const doClearChat = useCallback(async (f: Friend) => {
    setFriends(prev => prev.filter(x => x.user_id !== f.user_id));
    listKeyRef.current += 1;
    try {
      await callFn({ action: 'clear_chat', chatId: f.chat_id });
    } catch (e: any) {
      console.error('❌ clear_chat:', e?.message);
      loadFriends(); // rollback
    }
  }, [loadFriends]);

  const keyExtractor = useCallback((item: Friend) => item.connection_id, []);

  if (loading && !friends.length) return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <Header onSearch={() => setSearchOpen(true)} onMenuPress={() => {}} />
      <SkeletonRow /><SkeletonRow opacity={0.75} /><SkeletonRow opacity={0.5} /><SkeletonRow opacity={0.3} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <Header onSearch={() => setSearchOpen(true)} onMenuPress={() => setMenuSheet(true)} />
      <BulkDeleteBar count={swipedIds.size} onDeleteAll={handleBulkDelete} />

      <FlatList
        key={String(listKeyRef.current)}
        data={friends}
        renderItem={({ item }) => (
          <SwipeableRow item={item} onDelete={handleDelete} onClear={handleClear}
            onSwipeLeftOpen={onSwipeLeftOpen} onSwipeLeftClose={onSwipeLeftClose}
            registerClose={registerClose} onAnyPress={(id) => closeAllExcept(id)} />
        )}
        keyExtractor={keyExtractor}
        extraData={friends}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        directionalLockEnabled
        onScrollBeginDrag={() => closeAllExcept()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadFriends(true)} tintColor={C.purple} colors={[C.purple]} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={s.emptyIcon}><Ionicons name="chatbubble-ellipses-outline" size={36} color={C.purple} /></View>
            <Text style={s.emptyTitle}>No connections yet</Text>
            <Text style={s.emptySub}>Accept a connection request{'\n'}to start chatting</Text>
            <TouchableOpacity style={s.discoverBtn} onPress={() => router.push('/(tabs)/search')}>
              <Text style={s.discoverTxt}>Discover People</Text>
            </TouchableOpacity>
          </View>
        }
        initialNumToRender={15} maxToRenderPerBatch={10} windowSize={5} removeClippedSubviews
      />

      <FriendsSearchModal visible={searchOpen} friends={allFriendsRef.current} onClose={() => setSearchOpen(false)} />
      <ChatMenuSheet visible={menuSheet} onClose={() => setMenuSheet(false)} items={[
        { icon:'settings', label:'Settings', onPress:() => router.push('/subScreens/Settings') },
      ]} />

      {/* ── Delete Chat confirmation ─────────────────────────── */}
      <ConfirmModal
        visible={!!deleteModal}
        title="Delete Chat?"
        message={`Remove your conversation with ${deleteModal?.full_name ?? 'this person'}? This only affects your view — they won't be notified.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmDestructive={true}
        icon="trash-outline"
        onConfirm={() => {
          const f = deleteModal!;
          setDeleteModal(null);  // close first
          doHideChat(f);         // action runs after modal closes via InteractionManager ✅
        }}
        onCancel={() => setDeleteModal(null)}
      />

      {/* ── Clear Chat confirmation ──────────────────────────── */}
      <ConfirmModal
        visible={!!clearModal}
        title="Clear Chat?"
        message={`Clear all messages with ${clearModal?.full_name ?? 'this person'}? This only clears it for you — their view is unaffected.`}
        confirmLabel="Clear"
        cancelLabel="Cancel"
        confirmDestructive={true}
        icon="chatbubble-ellipses-outline"
        onConfirm={() => {
          const f = clearModal!;
          setClearModal(null);   // close first
          doClearChat(f);        // action runs after modal closes via InteractionManager ✅
        }}
        onCancel={() => setClearModal(null)}
      />

    </SafeAreaView>
  );
}

const Header = ({ onSearch, onMenuPress }: { onSearch:()=>void; onMenuPress:()=>void }) => (
  <View style={s.header}>
    <Text style={s.headerTitle}>MindMates</Text>
    <View style={{ flex:1 }} />
    <TouchableOpacity onPress={onSearch} style={{ padding:8 }}>
      <Ionicons name="search-outline" size={20} color={C.text} style={{ right:5 }} />
    </TouchableOpacity>
    <TouchableOpacity onPress={onMenuPress} style={{ padding:8 }}>
      <Ionicons name="ellipsis-vertical" size={20} color={C.text} style={{ left:17 }} />
    </TouchableOpacity>
  </View>
);

const s = StyleSheet.create({
  safe:        { flex:1, backgroundColor:C.white },
  listContent: { paddingBottom:120,bottom:8,left:1 },
  header:      { flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingVertical:17, backgroundColor:C.white },
  headerTitle: { fontSize:24, fontWeight:'700', color:C.purple },
  skRow:       { flexDirection:'row', alignItems:'center', paddingHorizontal:15, paddingVertical:8, gap:12, minHeight:72 },
  empty:       { alignItems:'center', paddingTop:100, paddingHorizontal:40 },
  emptyIcon:   { width:72, height:72, borderRadius:36, backgroundColor:'#EDE9FE', alignItems:'center', justifyContent:'center', marginBottom:18 },
  emptyTitle:  { fontSize:18, fontWeight:'800', color:C.text, marginBottom:6, bottom:8 },
  emptySub:    { fontSize:14, color:C.muted, textAlign:'center', lineHeight:21, marginBottom:20, bottom:8 },
  discoverBtn: { backgroundColor:C.purple, paddingHorizontal:22, paddingVertical:12, borderRadius:12, bottom:12 },
  discoverTxt: { color:'#fff', fontWeight:'700', fontSize:14 },
});