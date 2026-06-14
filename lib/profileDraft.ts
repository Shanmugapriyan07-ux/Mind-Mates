import AsyncStorage from "@react-native-async-storage/async-storage";
import supabase, { TABLES } from "@/lib/supabase";
import { userKey } from "./persistentStorage";
const draftKey = (userId: string) => `profile_draft_${userId}`;
export type ProfileDraft = {
  user_id: string;
  full_Name?:         string;
  InterestedSkills?: string;
  bio?:              string;
  location?:         string;
  profileImage?:     string | null;
  profileImageUrl?:  string | null;
  skills?:           string[];
  currentStep?:      1 | 2 | 3;
  _savedAt?:         string;
};
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
export const saveDraft = async (
  userId: string,
  updates: Partial<ProfileDraft>
): Promise<ProfileDraft> => {
  const existing = await readDraft(userId) ?? { userId };

  const merged: ProfileDraft = {
    ...existing,
    ...updates,
    user_id: userId,     
    _savedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(draftKey(userId), JSON.stringify(merged));
  return merged;
};

export const clearDraft = async (userId: string): Promise<void> => {
  await AsyncStorage.removeItem(draftKey(userId));
};
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
    await AsyncStorage.setItem(
      userKey(userId).profile,
      JSON.stringify({
        ...payload,
        $id:       docId,
        _cachedAt: new Date().toISOString(),
        _synced:   true,
      })
    );
    await clearDraft(userId);

    console.log("✅ Profile fully synced to Appwrite:", docId);
    return docId;
  } catch (error) {
    console.warn("⚠️ Final sync failed — draft preserved for retry");
    throw error;
  }
};