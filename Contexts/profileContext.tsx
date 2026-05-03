// Contexts/profileContext.tsx — Supabase (all bugs fixed)
// FIXES:
//   1. .eq('user_id', userId) not .eq('userId', userId) — 400 fixed ✅
//   2. Insert uses auth.uid() as id — 403 fixed ✅  
//   3. Navigation timing fixed — home routing works ✅
//   4. Web-safe cache (localStorage not AsyncStorage) ✅

import React, {
  createContext, useContext, useState,
  useEffect, useCallback, useRef,
} from 'react';
import { Platform }         from 'react-native';
import { useAuthh }          from '@/Contexts/authContext';
import { supabase, TABLES } from '@/lib/supabase';

// ── Web-safe cache ────────────────────────────────────────────
const storage = {
  get: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') return localStorage.getItem(key);
      const AS = require('@react-native-async-storage/async-storage').default;
      return AS.getItem(key);
    } catch { return null; }
  },
  set: async (key: string, val: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') { localStorage.setItem(key, val); return; }
      const AS = require('@react-native-async-storage/async-storage').default;
      await AS.setItem(key, val);
    } catch {}
  },
  remove: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
      const AS = require('@react-native-async-storage/async-storage').default;
      await AS.removeItem(key);
    } catch {}
  },
};

const CACHE_KEY = (uid: string) => `profile_cache_${uid}`;
const CACHE_TTL = 5 * 60 * 1000;

type ProfileStatus = 'idle' | 'loading' | 'loaded' | 'not_found' | 'error';

export interface Profile {
  $id?:                string;
  userId:              string;
  user_id?:            string;
  fullName:            string;
  full_name?:          string;
  bio:                 string;
  location:            string;
  locationSearch:      string;
  location_search?:    string;
  InterestedSkills:    string;
  interested_skills?:  string;
  profileImage:        string | null;
  profile_image?:      string | null;
  skills:              string;
  skillsArray:         string[];
  connections:         number;
  likes:               number;
  isProfileComplete:   boolean;
  is_profile_complete?: boolean;
}

interface ProfileContextType {
  profile:         Profile | null;
  isLoading:       boolean;
  profileStatus:   ProfileStatus;
  error:           string | null;
  updateProfile:   (updates: Partial<Profile>) => void;
  completeProfile: () => void;
  clearProfile:    () => void;
  reloadProfile:   () => Promise<void>;
  loadProfile:     () => void;
}

// ── Field helpers ─────────────────────────────────────────────
const toArr  = (v: any): string[] =>
  !v ? [] : Array.isArray(v) ? v.map(String).filter(Boolean)
  : typeof v === 'string' ? v.split(',').map(s=>s.trim()).filter(Boolean) : [];

const toStr  = (v: any): string =>
  Array.isArray(v) ? v.join(',') : typeof v === 'string' ? v.trim() : '';

const safeImg = (v: any): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

// Supabase DB row (snake_case) → Profile (camelCase + both)
const rowToProfile = (row: any): Profile => {
  const fn  = row.full_name         ?? row.fullName         ?? '';
  const ls  = row.location_search   ?? row.locationSearch   ?? '';
  const is_ = row.interested_skills ?? row.InterestedSkills ?? '';
  const pi  = safeImg(row.profile_image ?? row.profileImage);
  const sk  = toStr(row.skills ?? '');
  const ipc = row.is_profile_complete ?? row.isProfileComplete ?? false;
  const uid = row.user_id ?? row.userId ?? '';
  const id  = row.id ?? row.$id ?? undefined;

  return {
    $id:               id,
    userId:            uid,
    user_id:           uid,
    fullName:          fn,
    full_name:         fn,
    bio:               row.bio      ?? '',
    location:          row.location ?? '',
    locationSearch:    ls,
    location_search:   ls,
    InterestedSkills:  is_,
    interested_skills: is_,
    profileImage:      pi,
    profile_image:     pi,
    skills:            sk,
    skillsArray:       toArr(sk),
    connections:       row.connections ?? 0,
    likes:             row.likes       ?? 0,
    isProfileComplete: ipc,
    is_profile_complete: ipc,
  };
};

// Profile → Supabase insert/update payload (snake_case only)
const toInsertPayload = (p: Profile, authId: string): Record<string, any> => ({
  id:                  authId,          // PRIMARY KEY = Supabase auth UUID ✅
  user_id:             authId,          // text copy for compat
  full_name:           p.fullName       ?? '',
  bio:                 p.bio            ?? '',
  location:            p.location       ?? '',
  location_search:     p.locationSearch ?? '',
  interested_skills:   p.InterestedSkills ?? '',
  profile_image:       safeImg(p.profileImage),
  skills:              toStr(p.skills),
  connections:         p.connections    ?? 0,
  likes:               p.likes          ?? 0,
  is_profile_complete: p.isProfileComplete ?? false,
});

const toUpdatePayload = (updates: Partial<Profile>): Record<string, any> => {
  const p: Record<string, any> = {};
  if ('fullName'         in updates || 'full_name'          in updates) p.full_name           = updates.fullName ?? updates.full_name ?? '';
  if ('bio'              in updates)                                     p.bio                 = updates.bio      ?? '';
  if ('location'         in updates)                                     p.location            = updates.location ?? '';
  if ('locationSearch'   in updates || 'location_search'    in updates) p.location_search     = updates.locationSearch ?? updates.location_search ?? '';
  if ('InterestedSkills' in updates || 'interested_skills'  in updates) p.interested_skills   = updates.InterestedSkills ?? updates.interested_skills ?? '';
  if ('profileImage'     in updates || 'profile_image'      in updates) p.profile_image       = safeImg(updates.profileImage ?? updates.profile_image);
  if ('skills'           in updates)                                     p.skills              = toStr(updates.skills);
  if ('skillsArray'      in updates)                                     p.skills              = toStr(updates.skillsArray);
  if ('isProfileComplete'in updates || 'is_profile_complete'in updates) p.is_profile_complete = updates.isProfileComplete ?? updates.is_profile_complete ?? false;
  if ('connections'      in updates)                                     p.connections         = updates.connections ?? 0;
  if ('likes'            in updates)                                     p.likes               = updates.likes       ?? 0;
  return p;
};

// ── Write queue ───────────────────────────────────────────────
class WriteQueue {
  private q: { task: ()=>Promise<void>; retries: number }[] = [];
  private running = false;
  private delays  = [1000, 2000, 4000, 8000, 15000];

  add(task: ()=>Promise<void>) { this.q.push({ task, retries: 0 }); this.run(); }

  private async run() {
    if (this.running || !this.q.length) return;
    this.running = true;
    while (this.q.length) {
      const job = this.q[0];
      try {
        await job.task();
        this.q.shift();
        console.log('✅ DB write success');
      } catch (e: any) {
        console.error(`❌ Write failed (${job.retries+1}):`, e?.message);
        job.retries++;
        if (job.retries >= 5) { this.q.shift(); continue; }
        await new Promise(r => setTimeout(r, this.delays[job.retries-1] ?? 15000));
      }
    }
    this.running = false;
  }
}
const wq = new WriteQueue();

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoggedIn, authStatus } = useAuthh();

  const [profile,       setProfile]       = useState<Profile | null>(null);
  const [isLoading,     setIsLoading]     = useState(true);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('idle');
  const [error,         setError]         = useState<string | null>(null);

  const profileRef   = useRef<Profile | null>(null);
  const hasFired     = useRef(false);
  const isLoadingRef = useRef(false);
  profileRef.current = profile;

  const saveCache = useCallback((uid: string, p: Profile) => {
    storage.set(CACHE_KEY(uid), JSON.stringify({ ...p, _at: Date.now() }));
  }, []);

  const clearProfile = useCallback(() => {
    setProfile(null);
    profileRef.current = null;
    setProfileStatus('idle');
    setError(null);
    isLoadingRef.current = false;
    hasFired.current     = false;
  }, []);

  // ── Fetch from Supabase ──────────────────────────────────────
  // FIX: use 'user_id' (snake_case) — NOT 'userId' → was causing 400 ✅
  const fetchFromDB = useCallback(async (userId: string, attempt = 1): Promise<Profile | null> => {
    console.log(`🌐 Fetching profile [attempt ${attempt}]`);
    try {
      const { data, error } = await supabase
        .from(TABLES.users)
        .select('*')
        .eq('user_id', userId)   // ✅ CRITICAL: snake_case, not 'userId'
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('❌ Supabase fetch error:', error.message, error.code);
        throw new Error(error.message);
      }

      if (data) {
        const fresh = rowToProfile(data);
        console.log('✅ Profile loaded | complete:', fresh.isProfileComplete);
        setProfile(fresh);
        profileRef.current = fresh;
        saveCache(userId, fresh);
        return fresh;
      }

      // Retry once — DB can be slow right after signup
      if (attempt === 1) {
        console.log('⏳ No profile yet — retrying in 800ms');
        await new Promise(r => setTimeout(r, 800));
        return fetchFromDB(userId, 2);
      }
      console.log('ℹ️ Confirmed: no profile in DB');
      return null;

    } catch (err: any) {
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 800 * attempt));
        return fetchFromDB(userId, attempt + 1);
      }
      throw err;
    }
  }, [saveCache]);

  // ── Load profile (cache-first, Instagram strategy) ───────────
  // TEACHING: Instagram performance pattern:
  //   1. Check local cache → instant UI (0ms)
  //   2. If cache valid & complete → show immediately, refresh in BG
  //   3. If cache incomplete → fetch fresh before routing (prevents flicker)
  const loadProfileForUser = useCallback(async (userId: string) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);
    setProfileStatus('loading'); // _layout waits here ✅

    try {
      const raw = await storage.get(CACHE_KEY(userId));

      if (raw) {
        const { _at, ...cached } = JSON.parse(raw);
        const cp = rowToProfile({ ...cached, user_id: cached.userId ?? cached.user_id, id: cached.$id });

        if (cp.userId === userId) {
          // Fast path: complete + has DB id → route instantly
          if (cp.isProfileComplete && cp.$id) {
            setProfile(cp);
            profileRef.current = cp;
            setIsLoading(false);
            isLoadingRef.current = false;
            setProfileStatus('loaded'); // ← _layout fires here → home ✅

            // Stale cache? Refresh silently in background
            if (Date.now() - (_at ?? 0) >= CACHE_TTL) {
              fetchFromDB(userId).catch(() => {});
            }
            return;
          }

          // Incomplete cache → must verify before routing
          setProfile(cp);
          profileRef.current = cp;
          try {
            const fresh = await fetchFromDB(userId);
            setProfileStatus(fresh ? 'loaded' : 'not_found');
          } catch {
            setProfileStatus(cp.$id ? 'loaded' : 'not_found');
          }
          setIsLoading(false);
          isLoadingRef.current = false;
          return;
        }
        await storage.remove(CACHE_KEY(userId));
      }

      // No cache → fresh fetch
      try {
        const fresh = await fetchFromDB(userId);
        setProfileStatus(fresh ? 'loaded' : 'not_found');
      } catch {
        setProfileStatus('error');
        setError('Failed to load profile');
      }

    } catch {
      setProfileStatus('error');
      setError('Failed to load profile');
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [fetchFromDB]);

  // ── updateProfile ─────────────────────────────────────────────
  // TEACHING: Optimistic update pattern (Instagram/WhatsApp):
  //   Step 1: Update React state instantly → UI updates in 0ms
  //   Step 2: Save to localStorage/AsyncStorage → next launch instant
  //   Step 3: Queue Supabase write → happens in background
  //   Step 4: If DB write fails → retry up to 5 times
  //   User NEVER waits for the network ✅
  const updateProfile = useCallback((updates: Partial<Profile>): void => {
    if (!user?.id) return;

    // Normalize both naming conventions
    if (updates.skillsArray !== undefined) {
      updates.skills     = toStr(updates.skillsArray);
      updates.skillsArray = toArr(updates.skillsArray);
    } else if (updates.skills !== undefined) {
      updates.skillsArray = toArr(updates.skills);
      updates.skills      = toStr(updates.skills);
    }
    if ('profileImage' in updates || 'profile_image' in updates) {
      const val = updates.profileImage ?? (updates as any).profile_image;
      updates.profileImage = safeImg(val);
    }
    if ('fullName'          in updates) (updates as any).full_name          = updates.fullName;
    if ('locationSearch'    in updates) (updates as any).location_search    = updates.locationSearch;
    if ('InterestedSkills'  in updates) (updates as any).interested_skills  = updates.InterestedSkills;
    if ('isProfileComplete' in updates) (updates as any).is_profile_complete = updates.isProfileComplete;

    const current = profileRef.current;
    const updated: Profile = {
      userId: user.id, user_id: user.id,
      fullName: '', full_name: '', bio: '',
      location: '', locationSearch: '', location_search: '',
      InterestedSkills: '', interested_skills: '',
      profileImage: null, profile_image: null,
      skills: '', skillsArray: [],
      connections: 0, likes: 0,
      isProfileComplete: false, is_profile_complete: false,
      ...current,
      ...updates,
    };

    // Step 1 + 2: instant state + cache update
    setProfile(updated);
    profileRef.current = updated;
    saveCache(user.id, updated);
    setProfileStatus('loaded');

    // Step 3: background DB write
    const snap   = { ...updated };
    const authId = user.id;

    wq.add(async () => {
      const docId = snap.$id;

      if (docId) {
        // UPDATE — profile exists
        const payload = toUpdatePayload(updates);
        if (!Object.keys(payload).length) return;
        const { error } = await supabase
          .from(TABLES.users)
          .update(payload)
          .eq('id', docId);
        if (error) throw new Error(`UPDATE failed: ${error.message} (${error.code})`);
        console.log('✅ Profile updated');

      } else {
        // INSERT — first time (new user after signup)
        // FIX: id = auth UUID so RLS auth.uid()=id check passes ✅
        const payload = toInsertPayload(snap, authId);
        const { data, error } = await supabase
          .from(TABLES.users)
          .upsert(payload, { onConflict: 'user_id' })  // safe re-run
          .select('id')
          .single();
        if (error) throw new Error(`INSERT failed: ${error.message} (${error.code})`);
        if (data?.id) {
          const withId = { ...profileRef.current!, $id: data.id };
          profileRef.current = withId;
          setProfile(withId);
          saveCache(authId, withId);
        }
        console.log('✅ Profile created');
      }
    });
  }, [user?.id, saveCache]);

  const completeProfile = useCallback(() =>
    updateProfile({ isProfileComplete: true, is_profile_complete: true }), [updateProfile]);

  const reloadProfile = useCallback(async () => {
    if (user?.id) { isLoadingRef.current = false; await loadProfileForUser(user.id); }
  }, [user?.id, loadProfileForUser]);

  // Boot: load profile when auth is ready
  useEffect(() => {
    if (!isLoggedIn) { clearProfile(); setIsLoading(false); return; }
    if (authStatus !== 'authenticated') return;
    if (!user?.id) return;
    if (hasFired.current) return;
    hasFired.current = true;
    loadProfileForUser(user.id);
  }, [user?.id, isLoggedIn, authStatus]);

  return (
    <ProfileContext.Provider value={{
      profile, isLoading, profileStatus, error,
      updateProfile, completeProfile, clearProfile, reloadProfile,
      loadProfile: () => { if (user?.id) loadProfileForUser(user.id); },
    }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
};
export default ProfileContext;