import React, { useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, StyleSheet, StatusBar,
  RefreshControl,
} from 'react-native';
import { SafeAreaView }          from 'react-native-safe-area-context';
import { Ionicons }              from '@expo/vector-icons';
import { router }                from 'expo-router';
import { ProfileAvatar }         from '@/components/Profileavatar';
import { useAuthh }               from '@/Contexts/authContext';
import { useConnection }         from '@/hooks/useConnection';
import { useMatches, MatchUser } from '@/hooks/useMatches';


// ─── Design tokens ────────────────────────────────────────────────
const C = {
  bg:       '#F7F8FA',
  white:    '#FFFFFF',
  purple:   '#6D4AFF',
  purpleL:  '#EDE9FE',
  purpleD:  '#5538E5',
  text:     '#0F0F10',
  muted:    '#6b6b6d',
  border:   '#EAECF0',
  green:    '#16A34A',
  greenL:   '#F0FDF4',
  orange:   '#6D4AFF',
  skeleton: '#F0F0F3',
  gold:     '#F59E0B',
};



// ─── Skeleton ─────────────────────────────────────────────────────
const SkeletonCard = ({ opacity = 1 }: { opacity?: number }) => (
  <View style={[s.card, { opacity }]}>
    <View style={s.cardRow}>
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.skeleton }} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ height: 13, width: '50%', backgroundColor: C.skeleton, borderRadius: 6 }} />
        <View style={{ height: 11, width: '35%', backgroundColor: C.skeleton, borderRadius: 6 }} />
        <View style={{ height: 11, width: '65%', backgroundColor: C.skeleton, borderRadius: 6 }} />
      </View>
      <View style={{ width: 88, height: 34, backgroundColor: C.skeleton, borderRadius: 20 }} />
    </View>
  </View>
);

// ─── Connect button ───────────────────────────────────────────────
const ConnectButton = ({ userId, fullName, profileImage, skills, location }: {
  userId: string; fullName: string; profileImage: string | null;
  skills: string; location: string;
}) => {
  const { getStatus, isLoading, sendRequest, cancelRequest } = useConnection();
  const status  = getStatus(userId);
  const loading = isLoading(userId);

  const cfg = {
    none:     { label: 'Connect',   bg: C.purple, fg: '#fff',   border: C.purple },
    pending:  { label: 'Requested', bg: C.white,  fg: C.orange, border: C.orange },
    accepted: { label: 'Connected', bg: C.greenL, fg: C.green,  border: C.greenL },
    rejected: { label: 'Connect',   bg: C.purple, fg: '#fff',   border: C.purple },
  }[status];

  return (
    <TouchableOpacity
      style={[s.connectBtn, { backgroundColor: cfg.bg, borderColor: cfg.border }]}
      onPress={() => {
        if (loading || status === 'accepted') return;
        if (status === 'none' || status === 'rejected') {
          sendRequest({ userId, fullName, profileImage, skills, location });
        } else {
          cancelRequest(userId);
        }
      }}
      disabled={loading || status === 'accepted'}
      activeOpacity={status === 'accepted' ? 1 : 0.82}
    >
      {loading
        ? <ActivityIndicator size="small" color={cfg.fg} />
        : <Text style={[s.connectText, { color: cfg.fg }]}>{cfg.label}</Text>
      }
    </TouchableOpacity>
  );
};

// ─── Match Card ───────────────────────────────────────────────────
const MatchCard = React.memo(({ item }: { item: MatchUser }) => {
  const skillsStr    = item.skillsArray?.join(',') ?? '';
  const commonSkills = item.commonSkills ?? [];
  const allSkills    = item.skillsArray  ?? [];

  // Common skills → purple dot-separated string (max 3 shown)
  const commonDots = commonSkills.slice(0, 3).join(' · ');

  // Extra = skills user has beyond the common ones shown
  const extraCount = allSkills.length - commonSkills.length;

  return (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.82}
      onPress={() => router.push({
        pathname: '/subScreens/userProfile',
        params:   { userId: item.userId },
      })}
    >
      <View style={s.cardRow}>
        {/* Avatar */}
        <ProfileAvatar uri={item.profileImage} name={item.fullName} size={52} />

        {/* Info column */}
        <View style={s.info}>
          {/* Name */}
          <Text style={s.name} numberOfLines={1}>{item.fullName}</Text>

          {/* Location — purple if same city */}
          {!!item.location && (
            <View style={s.locRow}>
              <Ionicons
                name="location-sharp"
                size={11}
                color={item.sameCity ? C.purple : C.muted}
              />
              <Text
                style={[s.locText, { color: item.sameCity ? C.purple : C.muted }]}
                numberOfLines={1}
              >
                {item.location}
              </Text>
            </View>
          )}

          {/* Skills: common → purple · dots  +  extra → +N grey badge */}
          <View style={s.skillsRow}>
            {!!commonDots && (
              <Text style={s.skillsCommon} numberOfLines={1}>
                {commonDots}
              </Text>
            )}
            {extraCount > 0 && (
              <View style={s.extraBadge}>
                <Text style={s.extraText}>+{extraCount}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Connect button — inline right */}
        <ConnectButton
          userId={item.userId}
          fullName={item.fullName}
          profileImage={item.profileImage}
          skills={skillsStr}
          location={item.location}
        />
      </View>
    </TouchableOpacity>
  );
});


// ─── Main Screen ──────────────────────────────────────────────────
export default function DiscoverScreen() {
  useAuthh();
  const { loadStatuses, getStatus } = useConnection();
  const {
    matches, fetching, refreshing,error,loading,
     loadInitial, refresh,hasMore,loadMore
  } = useMatches();

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (matches.length > 0) {
      loadStatuses(matches.map(m => m.userId));
    }
  }, [matches.length]);

  const displayMatches = useMemo(() =>
    matches.filter(m => getStatus(m.userId) !== 'accepted'),
    [matches, getStatus]
  );

  // Convert Supabase row → SearchUser

  const renderItem = useCallback(({ item }: { item: MatchUser }) => (
    <MatchCard item={item} />
  ), []);

  const keyExtractor = useCallback((item: MatchUser) => item.userId, []);

  // ── Loading skeleton ──────────────────────────────────────────
  if (loading && matches.length === 0) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Header />
        <View style={{ paddingTop: 8 }}>
          <SkeletonCard opacity={1}   />
          <SkeletonCard opacity={0.7} />
          <SkeletonCard opacity={0.4} />
          <SkeletonCard opacity={0.2} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ─────────────────────────────────────────────────────
  if (error && matches.length === 0) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Header />
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={loadInitial}>
            <Text style={s.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <Header />

      <FlatList
        data={displayMatches}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={C.purple}
            colors={[C.purple]}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListFooterComponent={
          fetching && matches.length > 0
            ? <ActivityIndicator color={C.purple} style={{ padding: 20 }} />
            : !hasMore && matches.length > 0
              ? null
              : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={s.center}>
              <Ionicons name="people-outline" size={52} color={C.muted} style={{bottom:60 }} />
              <Text style={s.emptyTitle}>No matches yet</Text>
             
              <TouchableOpacity style={s.retryBtn} onPress={() => router.push('/subScreens/searchUser')}>
                <Text style={s.retryText}>Find Your Mindmate</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews
        getItemLayout={(_, i) => ({ length: 77, offset: 77 * i, index: i })}
      />
    </SafeAreaView>
  );
}

// ─── Header ───────────────────────────────────────────────────────
const Header = () => (
  <View style={s.header}>
    <TouchableOpacity
      style={s.searchBar}
      onPress={() => router.push('/subScreens/searchUser')}
      activeOpacity={0.8}
    >
      <Ionicons name="search" size={20} color={C.muted} />
      <Text style={s.searchPlaceholder}>Search people, skills...</Text>
    </TouchableOpacity>
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.white },
  listContent: { paddingBottom: 120,bottom:5 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 80 },


  header: {
    backgroundColor: C.white,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 1,
    borderBottomColor: C.border, gap: 10,
   
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.bg,
    borderRadius: 50,
    paddingHorizontal: 16,
    height: 43,
    borderWidth: 0,
    borderColor: C.border,
     marginLeft: 8, marginRight: 8,bottom:3,
    marginBottom: 8,
  },
  searchPlaceholder: { flex: 1, fontSize: 15, color: C.muted, fontWeight: '400',right:2 },

  // ── Card ──────────────────────────────────────────────────────
  card: {
    backgroundColor: C.white,
    paddingHorizontal: 18,
    paddingVertical: 9,

  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  info:    { flex: 1 },
  name:    { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 3 },
  locRow:  { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 4 },
  locText: { fontSize: 12 },

  // ── Skills row: purple common dots + grey +N badge ────────────
  skillsRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'nowrap' },
  skillsCommon: { fontSize: 12, fontWeight: '600', color: C.purple, flexShrink: 1 },
  extraBadge:   {
    backgroundColor: C.bg,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: C.border,
  },
  extraText: { fontSize: 11, fontWeight: '600', color: C.muted },

  // ── Connect button ────────────────────────────────────────────
  connectBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 82,
  },
  connectText: { fontWeight: '700', fontSize: 12 },

  endText:    { textAlign: 'center', color: C.muted, fontSize: 13, paddingVertical: 24 },
  errorText:  { fontSize: 15, color: C.muted, textAlign: 'center',bottom:60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 8, textAlign: 'center',bottom:60 },
  emptySub:   { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 21, marginBottom: 20,bottom:60 },
  retryBtn:   { backgroundColor: C.purple, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, bottom:50 },
  retryText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
});
