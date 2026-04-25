// ═══════════════════════════════════════════════════════════════════════════
// profileCache.ts — plugged into your existing persistentStorage.ts
// Uses userKey(userId).profile as the cache key (already defined!)
// Flow: Optimistic UI → AsyncStorage (~5ms) → Navigate → Appwrite (background)
// ═══════════════════════════════════════════════════════════════════════════

import AsyncStorage from "@react-native-async-storage/async-storage";
import supabase, { TABLES } from "@/lib/supabase";
 
// global, survives logout
const RETRY_KEY = 'profile_retry_queue';

export const userKey = (userId: string) => ({
  profile: `user_${userId}_profile`,
});

// ─────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────

export type ProfilePayload = {
  user_id:            string;
  full_name:          string;
  interested_skills:  string;
  bio:               string;
  location:          string;
  skills:            string[];
  profile_image?:     string | null;
  is_profile_complete: boolean;
};

type CachedProfile = ProfilePayload & {
  $id?:      string;    // Appwrite document ID (set after first sync)
  _cachedAt: string;
  _synced:   boolean;   // false = not yet confirmed by Appwrite
};

type RetryItem = {
  payload:  ProfilePayload;
  docId:    string | null;
  failedAt: string;
  attempts: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// READ — instant from AsyncStorage using your userKey
// ═══════════════════════════════════════════════════════════════════════════

export const readProfileCache = async (
  userId: string
): Promise<CachedProfile | null> => {
  try {
    const raw = await AsyncStorage.getItem(userKey(userId).profile);
    if (!raw) return null;
    const parsed: CachedProfile = JSON.parse(raw);
    if (parsed.user_id !== userId) return null; // wrong user safety check
    return parsed;
  } catch {
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// WRITE CACHE — instant (~5ms), called BEFORE navigate
// ═══════════════════════════════════════════════════════════════════════════

export const writeProfileCache = async (
  payload: ProfilePayload,
  docId?: string | null
): Promise<void> => {
  const data: CachedProfile = {
    ...payload,
    $id:       docId ?? undefined,
    _cachedAt: new Date().toISOString(),
    _synced:   false, // flips true after Appwrite confirms
  };
  await AsyncStorage.setItem(
    userKey(payload.user_id).profile, // reuses your existing key!
    JSON.stringify(data)
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SYNC TO APPWRITE — background, never blocks UI
// ═══════════════════════════════════════════════════════════════════════════

export const syncProfileToAppwrite = async (
  payload: ProfilePayload,
  existingDocId?: string | null
): Promise<void> => {
  try {
    let docId = existingDocId;

    if (docId) {
      await supabase
        .from(TABLES.users)
        .update({
          full_name:          payload.full_name,
          interested_skills:  payload.interested_skills,
          bio:               payload.bio,
          location:          payload.location,
          skills:            payload.skills,
          profile_image:      payload.profile_image ?? null,
          is_profile_complete: payload.is_profile_complete,
        })
        .eq('id', docId);
    } else {
      const { data, error } = await supabase.from(TABLES.users).insert([payload]).select().single();
      if (error) throw error;
      docId = data.id; // save returned id
    }

    // ✅ Mark cache synced + store $id for future updates
    const raw = await AsyncStorage.getItem(userKey(payload.user_id).profile);
    if (raw) {
      const cached: CachedProfile = JSON.parse(raw);
      await AsyncStorage.setItem(
        userKey(payload.user_id).profile,
        JSON.stringify({ ...cached, _synced: true, $id: docId })
      );
    }

    await removeFromRetryQueue(payload.user_id);
    console.log("✅ Appwrite synced:", docId);
  } catch (error) {
    console.warn("⚠️ Appwrite sync failed, queuing retry");
    await addToRetryQueue(payload, existingDocId ?? null);
    throw error;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// RETRY QUEUE
// ═══════════════════════════════════════════════════════════════════════════

const addToRetryQueue = async (
  payload: ProfilePayload,
  docId: string | null
): Promise<void> => {
  try {
    const raw    = await AsyncStorage.getItem(RETRY_KEY);
    const queue: RetryItem[] = raw ? JSON.parse(raw) : [];
    const filtered = queue.filter((i) => i.payload.user_id !== payload.user_id);
    filtered.push({ payload, docId, failedAt: new Date().toISOString(), attempts: 1 });
    await AsyncStorage.setItem(RETRY_KEY, JSON.stringify(filtered));
  } catch {}
};

const removeFromRetryQueue = async (userId: string): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(RETRY_KEY);
    if (!raw) return;
    const queue: RetryItem[] = JSON.parse(raw);
    await AsyncStorage.setItem(
      RETRY_KEY,
      JSON.stringify(queue.filter((i) => i.payload.user_id !== userId))
    );
  } catch {}
};

// ── Call in _layout.tsx after isLoggedIn = true ────────────────────────────
export const flushRetryQueue = async (): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(RETRY_KEY);
    if (!raw) return;
    const queue: RetryItem[] = JSON.parse(raw);
    if (queue.length === 0) return;
    console.log(`🔄 Flushing ${queue.length} pending sync(s)...`);
    for (const item of queue) {
      if (item.attempts >= 5) { await removeFromRetryQueue(item.payload.user_id); continue; }
      await syncProfileToAppwrite(item.payload, item.docId).catch(() => { item.attempts += 1; });
    }
  } catch {}
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN — saveProfileCacheFirst (use in BasicInfo handleNext)
// ═══════════════════════════════════════════════════════════════════════════

export const saveProfileCacheFirst = async ({
  payload,
  existingDocId = null,
  onCacheSaved,
  onSyncComplete,
  onSyncError,
}: {
  payload:         ProfilePayload;
  existingDocId?:  string | null;
  onCacheSaved:    () => void;       // ← navigate here
  onSyncComplete?: (docId?: string) => void;
  onSyncError?:    (err: unknown) => void;
}): Promise<void> => {
  // 1. Write AsyncStorage instantly
  await writeProfileCache(payload, existingDocId);

  // 2. Unblock UI — navigate NOW
  onCacheSaved();

  // 3. Background Appwrite sync
  syncProfileToAppwrite(payload, existingDocId)
    .then(async () => {
      const cached = await readProfileCache(payload.user_id);
      onSyncComplete?.(cached?.$id);
    })
    .catch((err) => onSyncError?.(err));
};

// ═══════════════════════════════════════════════════════════════════════════
// LOAD — cache-first then silent Appwrite refresh (use in profileContext)
// ═══════════════════════════════════════════════════════════════════════════

export const loadProfileCacheFirst = async (
  userId: string,
  onProfile: (profile: CachedProfile, fromCache: boolean) => void
): Promise<void> => {
  // 1. Show cache instantly
  const cached = await readProfileCache(userId);
  if (cached) {
    onProfile(cached, true);

    // 2. Refresh if unsynced or stale (> 10 min)
    const isStale = Date.now() - new Date(cached._cachedAt).getTime() > 10 * 60 * 1000;
    if (!cached._synced || isStale) {
      refreshFromAppwrite(userId)
        .then((fresh) => { if (fresh) onProfile({ ...fresh, _cachedAt: new Date().toISOString(), _synced: true }, false); })
        .catch(() => {});
    }
    return;
  }

  // 3. No cache — fetch from Appwrite
  const fresh = await refreshFromAppwrite(userId);
  if (fresh) onProfile({ ...fresh, _cachedAt: new Date().toISOString(), _synced: true }, false);
};

const refreshFromAppwrite = async (
  userId: string
): Promise<(ProfilePayload & { $id: string }) | null> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.users)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    const doc = data;
    const profile = {
      $id:                 doc.id,
      user_id:             doc.user_id,
      full_name:           doc.full_name ?? doc.full_Name ?? "",
      interested_skills:   doc.interested_skills ?? doc.InterestedSkills ?? "",
      bio:                 doc.bio ?? "",
      location:            doc.location ?? "",
      skills:              doc.skills ?? [],
      profile_image:       doc.profile_image ?? null,
      is_profile_complete: doc.is_profile_complete ?? false,
    };
    // Update cache with fresh data
    await AsyncStorage.setItem(
      userKey(userId).profile,
      JSON.stringify({ ...profile, _cachedAt: new Date().toISOString(), _synced: true })
    );
    return profile;
  } catch {
    return null;
  }
};
