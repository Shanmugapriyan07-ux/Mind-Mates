import { createClient } from "@supabase/supabase-js";
const SUPABASE_URL     = process.env.EXPO_PUBLIC_SUPABASE_URL     || "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
function createSafeClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    if (__DEV__) {
      console.warn(
        "[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.\n" +
        "App will use static fallback links."
      );
    }
    return null;
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      headers: { "x-app-version": "1.0.0" },
    },
    realtime: { params: { eventsPerSecond: 10 } },
  });
}
export const supabase = createSafeClient();
export const isSupabaseAvailable = supabase !== null;
