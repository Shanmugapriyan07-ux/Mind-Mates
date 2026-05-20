import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, StatusBar, RefreshControl,
} from 'react-native';
import { SafeAreaView }               from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import supabase, { TABLES }           from '@/lib/supabase';
import { Ionicons }                   from '@expo/vector-icons';
import { ProfileAvatar }              from '@/components/Profileavatar';
import { useAuthh }                    from '@/Contexts/authContext';
import { Swipeable }                  from 'react-native-gesture-handler';

interface ConnectedUser {
  user_id:       string;
  full_name:     string;
  profile_image: string | null;
  location:      string;
  skills:        string;
  bio:           string;
  connection_id: string;
}

const C = {
  white:'#FFFFFF', purple:'#6D4AFF', text:'#0F0F10',
  muted:'#6B7280', border:'#EAECF0', skeleton:'#F0F0F3',
};

const parseSkills = (s: string): string[] =>
  s ? s.split(',').map(x => x.trim()).filter(Boolean) : [];

const SkeletonRow = ({ opacity = 1 }: { opacity?: number }) => (
  <View style={[sl.card, { opacity }]}>
    <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
      <View style={{ width:52, height:52, borderRadius:26, backgroundColor:C.skeleton }} />
      <View style={{ flex:1, gap:8 }}>
        <View style={{ height:13, width:'50%', backgroundColor:C.skeleton, borderRadius:6 }} />
        <View style={{ height:11, width:'70%', backgroundColor:C.skeleton, borderRadius:6 }} />
      </View>
    </View>
  </View>
);

const ProfileAction = ({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity style={sl.profileAction} onPress={onPress} activeOpacity={0.8}>
    <Ionicons name="person-outline" size={20} color="#fff" />
    <Text style={sl.actionText}>Profile</Text>
  </TouchableOpacity>
);

const RemoveAction = ({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity style={sl.removeAction} onPress={onPress} activeOpacity={0.8}>
    <Ionicons name="person-remove-outline" size={20} color="#fff" />
    <Text style={sl.actionText}>Remove</Text>
  </TouchableOpacity>
);

const ConnectionCard = React.memo(({ item, isMyProfile, onRemove }: {
  item:ConnectedUser; isMyProfile:boolean; onRemove?:(i:ConnectedUser)=>void;
}) => {
  const skills = parseSkills(item.skills).slice(0, 3);
  const ref    = useRef<Swipeable>(null);
  const goToProfile = () => { ref.current?.close(); router.push({ pathname:'/subScreens/userProfile', params:{ userId:item.user_id } }); };
  const handleRemove = () => { ref.current?.close(); onRemove?.(item); };
  return (
    <Swipeable ref={ref} friction={2} overshootLeft={false} overshootRight={false}
      renderRightActions={() => <ProfileAction onPress={goToProfile} />}
      renderLeftActions={isMyProfile && onRemove ? () => <RemoveAction onPress={handleRemove} /> : undefined}>
      <TouchableOpacity style={sl.card} activeOpacity={0.82} onPress={goToProfile}>
        <View style={sl.row}>
          <ProfileAvatar uri={item.profile_image} name={item.full_name} size={52} />
          <View style={sl.info}>
            <Text style={sl.name} numberOfLines={1}>{item.full_name}</Text>
            {!!item.location && (
              <View style={sl.locRow}>
                <Ionicons name="location-sharp" size={11} color={C.muted} />
                <Text style={sl.locText} numberOfLines={1}>{item.location}</Text>
              </View>
            )}
            {skills.length > 0 && (
              <Text style={sl.skills} numberOfLines={1}>{skills.join(' · ')}</Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={17} color={C.muted} />
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
});

// ═══════════════════════════════════════════════════════════════════
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
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Parallel: get connections as sender + as receiver
      const [sentRes, recvRes] = await Promise.all([
        supabase.from(TABLES.connections)
          .select('id, receiver_id')
          .eq('sender_id', targetUserId)
          .eq('status', 'accepted')
          .limit(200),
        supabase.from(TABLES.connections)
          .select('id, sender_id')
          .eq('receiver_id', targetUserId)
          .eq('status', 'accepted')
          .limit(200),
      ]);

      const pairs: { otherId:string; connId:string }[] = [
        ...(sentRes.data ?? []).map((d:any) => ({ otherId:d.receiver_id, connId:d.id })),
        ...(recvRes.data  ?? []).map((d:any) => ({ otherId:d.sender_id,  connId:d.id })),
      ].filter(p => p.otherId);

      if (!pairs.length) { setConnections([]); return; }

      // Batch fetch all profiles in ONE query ✅
      const { data: profiles } = await supabase
        .from(TABLES.users)
        .select('user_id, full_name, profile_image, location, skills, bio')
        .in('user_id', pairs.map(p => p.otherId))
        .limit(200);

      const pm: Record<string,any> = {};
      (profiles ?? []).forEach((p:any) => { pm[p.user_id] = p; });

      const enriched: ConnectedUser[] = pairs
        .map(({ otherId, connId }) => {
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
        })
        .filter(Boolean) as ConnectedUser[];

      enriched.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setConnections(enriched);
    } catch (e: any) {
      console.error('❌ fetchConnections:', e?.message);
    } finally { setLoading(false); setRefreshing(false); }
  }, [targetUserId]);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  const handleRemove = useCallback((item: ConnectedUser) => {
    setConnections((prev: any) => prev.filter((c: { connection_id: string; }) => c.connection_id !== item.connection_id));
    supabase.from(TABLES.connections)
      .delete()
      .eq('id', item.connection_id)
      .then(() => { fetchConnections(); });
  }, [fetchConnections]);

  const renderItem = useCallback(({ item }: { item: ConnectedUser }) => (
    <ConnectionCard item={item} isMyProfile={isMyProfile} onRemove={isMyProfile ? handleRemove : undefined} />
  ), [isMyProfile, handleRemove]);

  if (loading) return (
    <SafeAreaView style={sl.safe} edges={['top']}>
      <Header count={0} isMyProfile={isMyProfile} ownerName={ownerName} />
      <View style={{ padding:16 }}>
        <SkeletonRow /><SkeletonRow opacity={0.7} /><SkeletonRow opacity={0.4} /><SkeletonRow opacity={0.2} />
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
        contentContainerStyle={sl.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchConnections(true)} tintColor={C.purple} colors={[C.purple]} />}
        ListEmptyComponent={
          <View style={sl.empty}>
            <Ionicons name="people-outline" size={52} color={C.muted} style={{ marginBottom:16 }} />
            <Text style={sl.emptyTitle}>
              {isMyProfile ? 'No Mindmates yet' : `${ownerName} has no Mindmates yet`}
            </Text>
            <Text style={sl.emptySub}>
              {isMyProfile ? 'Connect with people to see them here' : 'Check back later'}
            </Text>
            {isMyProfile && (
              <TouchableOpacity style={sl.discoverBtn} onPress={() => router.push('/subScreens/searchUser')}>
                <Text style={sl.discoverText}>Discover People</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        initialNumToRender={15} maxToRenderPerBatch={10} windowSize={5} removeClippedSubviews
        getItemLayout={(_,i) => ({ length:80, offset:80*i, index:i })}
      />
    </SafeAreaView>
  );
}

const Header = ({ count, isMyProfile, ownerName }: { count:number; isMyProfile:boolean; ownerName:string }) => (
  <View style={sl.header}>
    <TouchableOpacity onPress={() => router.back()} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
      <Ionicons name="arrow-back" size={22} color={C.text} />
    </TouchableOpacity>
    <View style={{ flex:1 }}>
      <Text style={sl.headerTitle}>
        {isMyProfile ? 'My Mindmates' : `${ownerName}'s Mindmates`}
      </Text>
      {count > 0 && <Text style={sl.headerSub}>{count} Mindmate{count !== 1 ? 's' : ''}</Text>}
    </View>
  </View>
);

const sl = StyleSheet.create({
  safe:          { flex:1, backgroundColor:C.white },
  list:          { paddingBottom:100 },
  header:        { flexDirection:'row', alignItems:'center', gap:14, paddingHorizontal:16, paddingVertical:13, backgroundColor:C.white,},
  headerTitle:   { fontSize:17, fontWeight:'700', color:C.text },
  headerSub:     { fontSize:13, color:C.muted, marginTop:1 },
  card:          { backgroundColor:C.white, paddingHorizontal:16, paddingVertical:14 },
  row:           { flexDirection:'row', alignItems:'center', gap:12 },
  info:          { flex:1 },
  name:          { fontSize:15, fontWeight:'700', color:C.text, marginBottom:3 },
  locRow:        { flexDirection:'row', alignItems:'center', gap:3, marginBottom:2 },
  locText:       { fontSize:12, color:C.muted },
  skills:        { fontSize:12, color:C.purple, fontWeight:'500' },

  profileAction: { backgroundColor:'#6D4AFF', justifyContent:'center', alignItems:'center', width:80, gap:4 },
  removeAction:  { backgroundColor:'#EF4444', justifyContent:'center', alignItems:'center', width:80, gap:4 },
  actionText:    { color:'#fff', fontSize:12, fontWeight:'600' },
  empty:         { alignItems:'center', paddingTop:80, paddingHorizontal:32 },
  emptyTitle:    { fontSize:17, fontWeight:'700', color:C.text, marginBottom:8, textAlign:'center' },
  emptySub:      { fontSize:14, color:C.muted, textAlign:'center', lineHeight:21, marginBottom:20 },
  discoverBtn:   { backgroundColor:C.purple, paddingHorizontal:24, paddingVertical:12, borderRadius:12 },
  discoverText:  { color:'#fff', fontWeight:'700', fontSize:14 },
});
