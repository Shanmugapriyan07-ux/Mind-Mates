
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  ScrollView, StatusBar, Animated, ActivityIndicator, Pressable,
} from 'react-native';
import { SafeAreaView }                from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import supabase, { TABLES }            from '@/lib/supabase';
import { Ionicons }                    from '@expo/vector-icons';
import { useConnection }               from '@/hooks/useConnection';
import { useAuth }                     from '@/Contexts/authContext';
import { useConnectionCount }          from '@/hooks/useConnectionCount';

interface UserProfile {
  user_id:           string;
  full_name:         string;
  interested_skills: string | null;
  location:          string | null;
  bio:               string | null;
  profile_image:     string | null;
  skills:            string | null;
}

const SKILL_ICONS: Record<string, string> = {
  'Art':             'color-palette-outline',
  'Painting':        'brush-outline',
  'Photography':     'camera-outline',
  'Videography':     'videocam-outline',
  'Acting':          'theater-outline',
  'Singing':         'mic-outline',
  'Freefire':        'game-controller-outline',
  'BGMI':            'game-controller-outline',
  'Freelancing':     'laptop-outline',
  'Gym':             'barbell-outline',
  'Yoga':            'body-outline',
  'Running':         'walk-outline',
  'Cycling':         'bicycle-outline',
  'Swimming':        'water-outline',
  'Boxing':          'fitness-outline',
  'Bulking':         'fitness-outline',
  'Weight Loss':     'scale-outline',
  'PowerLifter':     'barbell-outline',
  'Bodybuilding':    'body-outline',
  'Programming':     'code-slash-outline',
  'App Development': 'phone-portrait-outline',
  'Web Development': 'globe-outline',
  'AI / ML':         'hardware-chip-outline',
  'Cybersecurity':   'shield-checkmark-outline',
  'UI/UX Design':    'color-wand-outline',
  'Python':          'code-slash-outline',
  'Java':            'code-slash-outline',
  'Govt Prep':       'book-outline',
  'Business':        'briefcase-outline',
  'Short Films':     'film-outline',
  'Football':        'football-outline',
  'Cricket':         'baseball-outline',
  'Basketball':      'basketball-outline',
  'Tennis':          'tennisball-outline',
  'Kabaddi':         'people-outline',
  'Athletics':       'timer-outline',
  'Startups':        'rocket-outline',
  'Content Creator': 'create-outline',
};
const DEFAULT_ICON = 'flash-outline';

const parseSkills = (s: string | null): string[] =>
  s ? s.split(',').map(x => x.trim()).filter(Boolean) : [];

// ── Skeleton ──────────────────────────────────────────────────────
const SkeletonBox = ({ width, height, borderRadius = 8, style }: any) => {
  const opacity = React.useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,   duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[{ width, height, borderRadius, backgroundColor: '#E5E7EB', opacity }, style]} />;
};

const ProfileSkeleton = () => (
  <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
    <View style={{ alignItems: 'center', paddingTop: 32 }}>
      <SkeletonBox width={110} height={110} borderRadius={55} style={{ marginBottom: 14 }} />
      <SkeletonBox width={160} height={22} style={{ marginBottom: 10 }} />
      <SkeletonBox width={120} height={16} style={{ marginBottom: 8 }} />
      <SkeletonBox width={100} height={14} style={{ marginBottom: 24 }} />
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24, paddingHorizontal: 20 }}>
        <SkeletonBox width={90} height={36} borderRadius={20} />
        <SkeletonBox width={90} height={36} borderRadius={20} />
        <SkeletonBox width={90} height={36} borderRadius={20} />
      </View>
    </View>
    <View style={{ paddingHorizontal: 20 }}>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
        <SkeletonBox width={90} height={100} borderRadius={14} />
        <SkeletonBox width={90} height={100} borderRadius={14} />
        <SkeletonBox width={90} height={100} borderRadius={14} />
      </View>
      <SkeletonBox width="100%" height={14} style={{ marginBottom: 8 }} />
      <SkeletonBox width="75%"  height={14} />
    </View>
  </ScrollView>
);

// ── Skill pill ────────────────────────────────────────────────────
const SkillPill = React.memo(({ skill, active }: { skill: string; active?: boolean }) => (
  <View style={[s.pill, active && s.pillActive]}>
    <Ionicons
      name={(SKILL_ICONS[skill] ?? DEFAULT_ICON) as any}
      size={13}
      color={active ? '#fff' : '#6D4AFF'}
      style={{ marginRight: 5 }}
    />
    <Text style={[s.pillText, active && s.pillTextActive]}>{skill}</Text>
  </View>
));

// ── Skill card ────────────────────────────────────────────────────
const SkillCard = React.memo(({ skill }: { skill: string }) => (
  <View style={s.skillCard}>
    <View style={s.skillIconWrap}>
      <Ionicons name={(SKILL_ICONS[skill] ?? DEFAULT_ICON) as any} size={32} color="#6D4AFF" />
    </View>
    <Text style={s.skillName}>{skill}</Text>
  </View>
));

// ── Scrollable pills with ‹ › arrow buttons ───────────────────────
// Works on both iOS and Android — arrows programmatically call scrollTo()
// so they bypass the touch-handling conflict of nested scroll views.
const ScrollablePills = ({ skills }: { skills: string[] }) => {
  const scrollRef  = useRef<ScrollView>(null);
  const scrollX    = useRef(0);
  const SCROLL_AMT = 140; // px per tap

  const scrollLeft = () =>
    scrollRef.current?.scrollTo({ x: Math.max(0, scrollX.current - SCROLL_AMT), animated: true });

  const scrollRight = () =>
    scrollRef.current?.scrollTo({ x: scrollX.current + SCROLL_AMT, animated: true });

  return (
    <View style={s.pillsWrapper}>
      {/* ‹ left arrow */}
     
      {/* horizontal pills */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled={true}
        onScroll={e => { scrollX.current = e.nativeEvent.contentOffset.x; }}
        scrollEventThrottle={16}
        contentContainerStyle={s.pillRow}
        style={s.pillsScroll}
      >
        {skills.map((skill, i) => (
          <SkillPill key={i} skill={skill} active={i === 0} />
        ))}
      </ScrollView>

      {/* › right arrow */}
     
    </View>
  );
};

// ── Connect button (logic unchanged) ─────────────────────────────
const ConnectBtn = ({ targetUserId, fullName, profileImage, skills }: {
  targetUserId: string; fullName: string; profileImage: string | null; skills: string;
}) => {
  const { getStatus, isLoading, sendRequest, cancelRequest } = useConnection();
  const status  = getStatus(targetUserId);
  const loading = isLoading(targetUserId);
  const cfg = {
    none:     { label: 'Connect',   bg: '#6D4AFF', fg: '#fff',    border: '#6D4AFF' },
    pending:  { label: 'Requested', bg: '#FFFFFF', fg: '#6D4AFF', border: '#6D4AFF' },
    accepted: { label: 'Connected', bg: '#F0FDF4', fg: '#16A34A', border: '#16A34A' },
    rejected: { label: 'Connect',   bg: '#6D4AFF', fg: '#fff',    border: '#6D4AFF' },
  }[status];
  const handlePress = () => {
    if (loading || status === 'accepted') return;
    if (status === 'none' || status === 'rejected') sendRequest({ userId: targetUserId, fullName, profileImage, skills });
    else if (status === 'pending') cancelRequest(targetUserId);
  };
  return (
    <TouchableOpacity
      style={[s.connectBtn, { backgroundColor: cfg.bg, borderColor: cfg.border }]}
      onPress={handlePress}
      disabled={loading || status === 'accepted'}
      activeOpacity={0.85}
    >
      {loading
        ? <ActivityIndicator size="small" color={cfg.fg} />
        : <Text style={[s.connectBtnText, { color: cfg.fg }]}>{cfg.label}</Text>}
    </TouchableOpacity>
  );
};

// ═══════════════════════════════════════════════════════════════════
export default function UserProfileScreen() {
  const params           = useLocalSearchParams<{ userId: string }>();
  const { user: me }     = useAuth();
  const { loadStatuses } = useConnection();

  const targetUserId = params.userId?.trim() ?? '';
  const { count }    = useConnectionCount(targetUserId);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!targetUserId) { setError('No user ID provided'); setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error: qErr } = await supabase
        .from(TABLES.users)
        .select('user_id, full_name, interested_skills, location, bio, profile_image, skills')
        .eq('user_id', targetUserId)
        .single();
      if (qErr || !data) {
        setError(qErr?.code === 'PGRST116' ? 'User not found' : 'Could not load profile');
        return;
      }
      setProfile(data as UserProfile);
      loadStatuses([targetUserId]);
    } catch {
      setError('Could not load profile');
    } finally { setLoading(false); }
  }, [targetUserId, loadStatuses]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const isOwnProfile = me?.id === targetUserId;

  if (loading) return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#17191B" style={{ top: 3 }} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Profile</Text>
        <View style={{ width: 32 }} />
      </View>
      <ProfileSkeleton />
    </SafeAreaView>
  );

  if (error || !profile) return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#17191B" style={{ top: 3 }} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Profile</Text>
        <View style={{ width: 32 }} />
      </View>
      <View style={s.errorState}>
        <Text style={s.errorText}>{error ?? 'Profile not found'}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={fetchProfile}>
          <Text style={s.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  const imageUrl = profile.profile_image?.trim() || null;
  const skills   = parseSkills(profile.skills);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#17191B" style={{ top: 3 }} />
        </TouchableOpacity>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        {/* ── Avatar ─────────────────────────────────────────────── */}
        <View style={s.avatarBlock}>
          <View style={s.avatarWrap}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={s.avatar} />
            ) : (
              <View style={s.avatarPlaceholder}>
                <Text style={s.avatarPlaceholderText}>
                  {profile.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
          </View>
          <Text style={s.name}>{profile.full_name || 'User'}</Text>
          {profile.interested_skills
            ? <Text style={s.headline}>{profile.interested_skills}</Text>
            : null}
          {profile.location ? (
            <View style={s.locationRow}>
              <Ionicons name="location" size={14} color="#6D4AFF" />
              <Text style={s.locationText}>{profile.location}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Stats ──────────────────────────────────────────────── */}
        <View style={s.statsRow}>
          <Pressable
            style={s.statItem}
            onPress={() => router.push({
              pathname: '/subScreens/friendsList',
              params: { userId: targetUserId, name: profile.full_name },
            })}
          >
            <View style={s.friend}>
              <Ionicons name="people" size={15} color="#6D4AFF" style={{ right: 7, marginLeft: 2 }} />
              <Text style={s.statNumber}>{count}</Text>
              <Text style={s.statLabel}>Mindmates</Text>
            </View>
          </Pressable>
        </View>

        {/* ── Action buttons ─────────────────────────────────────── */}
        {!isOwnProfile ? (
          <View style={s.actionsRow}>
            <ConnectBtn
              targetUserId={targetUserId}
              fullName={profile.full_name}
              profileImage={profile.profile_image}
              skills={profile.skills ?? ''}
            />
            <TouchableOpacity
              style={s.messageBtn}
              onPress={() => router.push({
                pathname: '/subScreens/chatScreen',
                params: {
                  userId: targetUserId,
                  name:   profile.full_name,
                  image:  profile.profile_image ?? '',
                  chatId: '',
                },
              })}
              activeOpacity={0.85}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={17} color="#6D4AFF" />
              <Text style={s.messageBtnText}>Message</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={s.editBtn}
            onPress={() => router.push('/subScreens/editProfile')}
          >
            <Ionicons name="create-outline" size={17} color="#6D4AFF" />
            <Text style={s.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        )}

        {/* ── Skill pills with ‹ › arrows ────────────────────────── */}
        {skills.length > 0 && <ScrollablePills skills={skills} />}

        {/* ── Skills card ─────────────────────────────────────────── */}
        {skills.length > 0 && (
          <View style={s.skillsCard}>
            <View style={s.skillGrid}>
              {skills.slice(0, 3).map((skill, i) => (
                <SkillCard key={i} skill={skill} />
              ))}
            </View>
            {profile.bio
              ? <Text style={s.bioText} numberOfLines={2}>{profile.bio}</Text>
              : null}
          </View>
        )}

        {/* ── Full bio ─────────────────────────────────────────────── */}
        {profile.bio && profile.bio.length > 80 && (
          <View style={s.bioSection}>
            <Text style={s.bioSectionTitle}>About</Text>
            <Text style={s.bioSectionText}>{profile.bio}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#FFFFFF' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 25, paddingVertical: 10, backgroundColor: '#FFFFFF', top: 10 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#17191B' },
  scroll:      { paddingBottom: 40, paddingTop: 8 },
  friend:      { flexDirection: 'row', alignItems: 'center', top: 2 },

  avatarBlock:           { alignItems: 'center', paddingBottom: 8 },
  avatarWrap:            { position: 'relative', marginBottom: 3 },
  avatar:                { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: '#fff' },
  avatarPlaceholder:     { width: 110, height: 110, borderRadius: 55, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
  avatarPlaceholderText: { fontSize: 38, fontWeight: '700', color: '#6D4AFF' },

  name:         { fontSize: 18, fontWeight: '700', color: '#17191B', marginBottom: 2 },
  headline:     { fontSize: 15, fontWeight: '500', color: '#6B7280', marginBottom: 4 },
  locationRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, right: 7 },
  locationText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },

  statsRow:   { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 2, borderRadius: 16, right: 110 },
  statItem:   { alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 14, fontWeight: '700', color: '#6D4AFF', right: 3 },
  statLabel:  { fontSize: 14, fontWeight: '500', color: '#6D4AFF' },

  actionsRow:     { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginTop: 10 },
  connectBtn:     { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1.5 },
  connectBtnText: { fontSize: 14, fontWeight: '600' },
  messageBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: '#6D4AFF', backgroundColor: '#EDE9FE' },
  messageBtnText: { fontSize: 14, fontWeight: '700', color: '#6D4AFF' },
  editBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 20, marginTop: 16, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  editBtnText:    { fontSize: 15, fontWeight: '600', color: '#6D4AFF' },

  // ── Pills with arrows ─────────────────────────────────────────
  pillsWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 18, paddingBottom: 6 },
 
  pillsScroll:  { flex: 1, marginHorizontal: 6 },
  pillRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  pill:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#D1D5DB', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center' },
  pillActive:   { backgroundColor: '#6D4AFF', borderColor: '#6D4AFF' },
  pillText:     { fontSize: 13, fontWeight: '600', color: '#374151' },
  pillTextActive: { color: '#fff' },

  // ── Skills card ───────────────────────────────────────────────
  skillsCard:    { backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 20, padding: 18, marginTop: 8 },
  skillGrid:     { flexDirection: 'row', gap: 12, marginBottom: 16 },
  skillCard:     { alignItems: 'center', flex: 1 },
  skillIconWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  skillName:     { fontSize: 12, fontWeight: '600', color: '#1F2937', textAlign: 'center', top: 2 },
  bioText:       { fontSize: 14, color: '#6B7280', lineHeight: 20, top: 7 },

  bioSection:      { backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 20, padding: 18, marginTop: 10 },
  bioSectionTitle: { fontSize: 15, fontWeight: '700', color: '#17191B', marginBottom: 8 },
  bioSectionText:  { fontSize: 14, color: '#374151', lineHeight: 22 },

  errorState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText:  { fontSize: 16, color: '#6B7280' },
  retryBtn:   { backgroundColor: '#6D4AFF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryText:  { color: '#fff', fontWeight: '600' },
});