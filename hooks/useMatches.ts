import { useState, useCallback, useRef } from 'react';
import { Platform }   from 'react-native';
import { supabase }   from '@/lib/supabase';
import { useAuthh }   from '@/Contexts/authContext';
import { useProfile } from '@/Contexts/profileContext';

export interface MatchUser {
  userId:         string;
  fullName:       string;
  bio:            string;
  location:       string;
  profileImage:   string | null;
  skillsArray:    string[];
  matchScore:     number;
  commonSkills:   string[];
  sameCity:       boolean;
  allSkillsMatch: boolean;
  tier:           number;
}

const CACHE_KEY = (id: string) => `matches_v5_${id}`; 
const CACHE_TTL = 5 * 60 * 1000;

const cacheGet = async (key: string): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    const AS = require('@react-native-async-storage/async-storage').default;
    return AS.getItem(key);
  } catch { return null; }
};

const cacheSet = async (key: string, val: string) => {
  try {
    if (Platform.OS === 'web') { localStorage.setItem(key, val); return; }
    const AS = require('@react-native-async-storage/async-storage').default;
    await AS.setItem(key, val);
  } catch {}
};

const toSkillsArray = (s: any): string[] => {
  if (!s) return [];
  const str = Array.isArray(s) ? s.join(',') : String(s);
  return str.split(',').map((x: string) => x.trim().toLowerCase()).filter(Boolean);
};

const normCity = (s: any): string =>
  (s ?? '').toString().toLowerCase().trim().split(',')[0].trim();

const rankMatches = (
  rows:     any[],
  mySkills: string[],
  myCity:   string,
): MatchUser[] => {
  if (!mySkills.length) return [];
  const results: MatchUser[] = [];
  for (const row of rows) {
    const theirSkills  = toSkillsArray(row.skills);
    const commonSkills = mySkills.filter(s => theirSkills.includes(s));
    if (!commonSkills.length) continue;
    const sameCity   = myCity.length > 0 && normCity(row.location) === myCity;
    const allMatch   = commonSkills.length >= mySkills.length;
    const matchScore = (commonSkills.length * 10) + (allMatch ? 50 : 0) + (sameCity ? 30 : 0);
    const tier       = allMatch && sameCity ? 1 : allMatch ? 2 : sameCity ? 3 : 4;
    results.push({
      userId:         row.user_id       ?? '',
      fullName:       row.full_name     ?? '',
      bio:            row.bio           ?? '',
      location:       row.location      ?? '',
      profileImage:   row.profile_image ?? null,
      skillsArray:    theirSkills,
      matchScore,
      commonSkills,
      sameCity,
      allSkillsMatch: allMatch,
      tier,
    });
  }
  return results.sort((a, b) =>
    a.tier !== b.tier ? a.tier - b.tier : b.matchScore - a.matchScore
  );
};

export const useMatches = () => {
  const { user }    = useAuthh();
  const { profile } = useProfile();

  const [matches,    setMatches]    = useState<MatchUser[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [fetching,   setFetching]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const running = useRef(false);

  const fetchAndRank = useCallback(async (): Promise<MatchUser[]> => {
    if (!user?.id) return [];

    const mySkills = toSkillsArray(profile?.skills ?? '');
    const myCity   = normCity(profile?.location ?? '');
    if (!mySkills.length) return [];
    const [{ data: connRows }, { data: blockRows }] = await Promise.all([
      supabase
        .from('connections')
        .select('sender_id, receiver_id')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`),
      supabase
        .from('blocks')
        .select('blocker_id, blocked_id')
        .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`),
    ]);
    const excluded = new Set<string>([user.id]);
    for (const r of connRows  ?? []) {
      excluded.add(r.sender_id);
      excluded.add(r.receiver_id);
    }
    for (const r of blockRows ?? []) {
      excluded.add(r.blocker_id);
      excluded.add(r.blocked_id);
    }
    const excludedArr = [...excluded];
    const { data, error: dbErr } = await supabase
      .from('users')
      .select('user_id, full_name, bio, location, profile_image, skills')
      .eq('is_profile_complete', true)
      .not('user_id', 'in', `(${excludedArr.join(',')})`)  // ← DB-level exclusion
      .or(mySkills.map(s => `skills.ilike.%${s}%`).join(',')) // ← only skill-matched
      .limit(500);

    if (dbErr) throw new Error(dbErr.message);
    return rankMatches(data ?? [], mySkills, myCity);
  }, [user?.id, profile?.skills, profile?.location]);

  const loadInitial = useCallback(async () => {
    if (!user?.id || running.current) return;
    running.current = true;
    setError(null);

    try {
      const raw = await cacheGet(CACHE_KEY(user.id));
      let servedFromCache = false;

      if (raw) {
        try {
          const { data, at } = JSON.parse(raw);
          const isFresh = Date.now() - at < CACHE_TTL;
          const isValid = Array.isArray(data) && typeof data[0]?.tier === 'number';

          if (isValid && isFresh) {
            setMatches(data);
            setLoading(false);
            running.current = false;
            return; 
          }

          if (isValid && !isFresh) {
            setMatches(data);
            setLoading(false);
            servedFromCache = true;
          }
        } catch {}
      }
      if (!servedFromCache) setLoading(true);
      else setFetching(true);

      const ranked = await fetchAndRank();
      setMatches(ranked);
      await cacheSet(CACHE_KEY(user.id), JSON.stringify({ data: ranked, at: Date.now() }));

      if (ranked.length === 0) {
        setError('No MindMates yet');
      }
        } catch (e: any) {
      console.warn('❌ useMatches:', e?.message);
      if (matches.length === 0) {
        setError(e?.message ?? 'Could not load matches. Try again.');
      }
    } finally {
      setLoading(false);
      setFetching(false);
      running.current = false;
    }
  }, [user?.id, fetchAndRank]);

  const refresh = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setRefreshing(true);
    setError(null);
    try {
      const ranked = await fetchAndRank();
      setMatches(ranked);
      await cacheSet(CACHE_KEY(user!.id), JSON.stringify({ data: ranked, at: Date.now() }));
    } catch (e: any) {
      setError(e?.message ?? 'Refresh failed');
    } finally {
      setRefreshing(false);
      running.current = false;
    }
  }, [fetchAndRank, user?.id]);

  return {
    matches, loading, fetching,
    refreshing, hasMore: false, error,
    loadInitial, loadMore: useCallback(() => {}, []), refresh,
  };
};