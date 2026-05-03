
import { useState, useCallback, useRef } from 'react';
import { Platform }   from 'react-native';
import { supabase }   from '@/lib/supabase';
import { useAuthh }    from '@/Contexts/authContext';
import { useProfile } from '@/Contexts/profileContext';

// ── Types ─────────────────────────────────────────────────────
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

const CACHE_KEY = (id: string) => `matches_v4_${id}`;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

// ── Web-safe cache ────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────
const toSkillsArray = (s: any): string[] => {
  if (!s) return [];
  const str = Array.isArray(s) ? s.join(',') : String(s);
  return str.split(',').map((x: string) => x.trim().toLowerCase()).filter(Boolean);
};

const normCity = (s: any): string =>
  (s ?? '').toString().toLowerCase().trim().split(',')[0].trim();

// ── Client-side ranking (same result as edge function) ────────
// TEACHING: Instagram/LinkedIn both do client-side ranking for feeds
// when dataset < 1000 items — it's faster and avoids server round-trip.
//
// Tier system:
//   Tier 1: all skills match + same city  (best)
//   Tier 2: all skills match + diff city
//   Tier 3: partial skills  + same city
//   Tier 4: partial skills  + diff city   (fallback)
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
    if (!commonSkills.length) continue; // needs at least 1 skill in common

    const sameCity     = myCity.length > 0 && normCity(row.location) === myCity;
    const allMatch     = commonSkills.length >= mySkills.length;
    const matchScore   = (commonSkills.length * 10) + (allMatch ? 50 : 0) + (sameCity ? 30 : 0);
    const tier         = allMatch && sameCity ? 1
                       : allMatch             ? 2
                       : sameCity             ? 3
                       :                        4;

    results.push({
      userId:         row.user_id        ?? '',
      fullName:       row.full_name      ?? '',
      bio:            row.bio            ?? '',
      location:       row.location       ?? '',
      profileImage:   row.profile_image  ?? null,
      skillsArray:    theirSkills,
      matchScore,
      commonSkills,
      sameCity,
      allSkillsMatch: allMatch,
      tier,
    });
  }

  // Sort: tier ASC, then matchScore DESC
  return results.sort((a, b) =>
    a.tier !== b.tier ? a.tier - b.tier : b.matchScore - a.matchScore
  );
};

// ── Hook ──────────────────────────────────────────────────────
export const useMatches = () => {
  const { user }    = useAuthh();
  const { profile } = useProfile();

  const [matches,    setMatches]    = useState<MatchUser[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [fetching,   setFetching]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const running = useRef(false);

  // ── Core fetch + rank ─────────────────────────────────────────
  // Direct Supabase query — no edge function, no CORS issues ✅
  const fetchAndRank = useCallback(async () => {
    if (!user?.id) return [];

    // Get my skills — profile already loaded in context
    const rawSkills  = profile?.skills ?? '';
    const mySkills   = toSkillsArray(rawSkills);
    const myCity     = normCity(profile?.location ?? '');

    if (!mySkills.length) return [];

    // Direct DB query — only fetch fields we need (fast)
    const { data, error: dbErr } = await supabase
      .from('users')
      .select('user_id, full_name, bio, location, profile_image, skills')
      .eq('is_profile_complete', true)
      .neq('user_id', user.id)
      .limit(500);

    if (dbErr) throw new Error(dbErr.message);
    return rankMatches(data ?? [], mySkills, myCity);
  }, [user?.id, profile?.skills, profile?.location]);

  // ── Load initial — cache-first strategy ───────────────────────
  // TEACHING: Instagram cache strategy:
  //   1. Read cache → show stale data instantly (feels like 0ms load)
  //   2. Fetch fresh → update UI silently in background
  //   3. If cache is fresh enough → skip network call entirely
  const loadInitial = useCallback(async () => {
    if (!user?.id || running.current) return;
    running.current = true;
    setError(null);

    try {
      // STEP 1: Show cache instantly
      const raw = await cacheGet(CACHE_KEY(user.id));
      let cacheValid = false;

      if (raw) {
        try {
          const { data, at } = JSON.parse(raw);
          if (
            Array.isArray(data) && data.length > 0 &&
            typeof data[0]?.tier === 'number' &&       // valid match shape
            Date.now() - at < CACHE_TTL
          ) {
            setMatches(data);
            setLoading(false);
            setFetching(true); // show subtle spinner — refresh in BG
            cacheValid = true;
          }
        } catch {}
      }

      // STEP 2: Fetch fresh (always — to catch new users)
      const ranked = await fetchAndRank();

      setMatches(ranked);
      await cacheSet(CACHE_KEY(user.id), JSON.stringify({
        data: ranked,
        at:   Date.now(),
      }));

      if (!cacheValid && ranked.length === 0) {
        setError('No matches yet — add more skills to find people!');
      }

    } catch (e: any) {
      console.error('❌ useMatches:', e?.message);
      if (matches.length === 0) {
        setError(e?.message ?? 'Could not load matches. Try again.');
      }
    } finally {
      setLoading(false);
      setFetching(false);
      running.current = false;
    }
  }, [user?.id, fetchAndRank]);

  // ── Pull-to-refresh ───────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setRefreshing(true);
    setError(null);

    try {
      const ranked = await fetchAndRank();
      setMatches(ranked);
      await cacheSet(CACHE_KEY(user!.id), JSON.stringify({
        data: ranked, at: Date.now(),
      }));
    } catch (e: any) {
      setError(e?.message ?? 'Refresh failed');
    } finally {
      setRefreshing(false);
      running.current = false;
    }
  }, [fetchAndRank, user?.id]);

  // No pagination needed — all results ranked client-side at once
  const loadMore = useCallback(() => {}, []);

  return {
    matches, loading, fetching,
    refreshing, hasMore: false, error,
    loadInitial, loadMore, refresh,
  };
};