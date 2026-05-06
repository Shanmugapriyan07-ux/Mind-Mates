// ═══════════════════════════════════════════════════════════════════════════
// profileDraft.ts — multi-step form draft system
// Accumulates data across BasicInfo → ImageUpload → SkillSelection
// One final Appwrite sync at the end (not on every page)
// ═══════════════════════════════════════════════════════════════════════════

import AsyncStorage from "@react-native-async-storage/async-storage";
import supabase, { config, TABLES } from "@/lib/supabase";
 
import { userKey } from "@/lib/persistentStorage";

const DB   = config.databaseId;
const PROF = config.usersCollectionId;

// ─────────────────────────────────────────────────────────────────────────
// Draft key — separate from final profile cache
// Cleared after successful Appwrite sync
// ─────────────────────────────────────────────────────────────────────────
const draftKey = (userId: string) => `profile_draft_${userId}`;

// ─────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────

export type ProfileDraft = {
  user_id: string;

  // Page 1 — BasicInfo
  full_Name?:         string;
  InterestedSkills?: string;
  bio?:              string;
  location?:         string;

  // Page 2 — ImageUpload
  profileImage?:     string | null; // local URI until uploaded
  profileImageUrl?:  string | null; // Appwrite Storage URL after upload

  // Page 3 — SkillSelection
  skills?:           string[];

  // Meta
  currentStep?:      1 | 2 | 3;
  _savedAt?:         string;
};

// ═══════════════════════════════════════════════════════════════════════════
// READ DRAFT — always call this on each page mount to restore progress
// ═══════════════════════════════════════════════════════════════════════════

export const readDraft = async (userId: string): Promise<ProfileDraft | null> => {
  try {
    const raw = await AsyncStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const parsed: ProfileDraft = JSON.parse(raw);
    if (parsed.user_id !== userId) return null;
    return parsed;
  } catch {
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// SAVE DRAFT — merges partial data, keeps existing fields
// Call this on each page's handleNext
// ═══════════════════════════════════════════════════════════════════════════

export const saveDraft = async (
  userId: string,
  updates: Partial<ProfileDraft>
): Promise<ProfileDraft> => {
  // Read existing draft (preserves data from previous pages)
  const existing = await readDraft(userId) ?? { userId };

  const merged: ProfileDraft = {
    ...existing,
    ...updates,
    user_id: userId,     // always keep correct userId
    _savedAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(draftKey(userId), JSON.stringify(merged));
  return merged;
};

// ═══════════════════════════════════════════════════════════════════════════
// CLEAR DRAFT — call after successful Appwrite sync
// ═══════════════════════════════════════════════════════════════════════════

export const clearDraft = async (userId: string): Promise<void> => {
  await AsyncStorage.removeItem(draftKey(userId));
};

// ═══════════════════════════════════════════════════════════════════════════
// FINAL SYNC — call on last page (SkillSelection) only
// Writes everything to Appwrite in ONE call
// ═══════════════════════════════════════════════════════════════════════════

export const syncDraftToAppwrite = async (
  userId: string,
  existingDocId?: string | null
): Promise<string | null> => {
  const draft = await readDraft(userId);
  if (!draft) throw new Error("No draft found");

  const payload = {
    user_id:           draft.user_id,
    full_Name:          draft.full_Name          ?? "",
    bio:               draft.bio               ?? "",
    location:          draft.location          ?? "",
    InterestedSkills:  draft.InterestedSkills  ?? "",
    profileImage:      draft.profileImageUrl   ?? draft.profileImage ?? null,
    skills:            draft.skills            ?? [],
    isProfileComplete: true,
  };

  try {
    let docId: string | null = existingDocId ?? null;

    if (docId) {
      await supabase.from(TABLES.users).update(payload).eq('id', docId);
    } else {
      const { data, error } = await supabase.from(TABLES.users).insert([payload]).select().single();
      if (error) throw error;
      docId = data.id;
    }

    // ✅ Write final profile to main cache (your userKey)
    await AsyncStorage.setItem(
      userKey(userId).profile,
      JSON.stringify({
        ...payload,
        $id:       docId,
        _cachedAt: new Date().toISOString(),
        _synced:   true,
      })
    );

    // ✅ Clear the draft now that it's saved
    await clearDraft(userId);

    console.log("✅ Profile fully synced to Appwrite:", docId);
    return docId;
  } catch (error) {
    console.warn("⚠️ Final sync failed — draft preserved for retry");
    throw error;
  }
};