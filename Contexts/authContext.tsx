import { supabase } from "@/lib/supabase";
import { trySilentGoogleSignIn } from "@/services/googleAuthService";
import { log } from "@/utils/logger";
import { StoredSession } from "@/utils/Preloadassets";
import type { Session, User } from "@supabase/supabase-js";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";

const NAV_INTENT_KEY = "auth_nav_intent";

// ─── Storage helper (UNCHANGED from your original) ────────────────────────────
const storage = {
  clear: async () => {
    try {
      if (Platform.OS === "web") localStorage.clear();
      else {
        const A = require("@react-native-async-storage/async-storage").default;
        await A.clear();
      }
    } catch {}
  },
  removeKeys: async (keys: string[]) => {
    try {
      if (Platform.OS === "web")
        keys.forEach((k) => localStorage.removeItem(k));
      else {
        const A = require("@react-native-async-storage/async-storage").default;
        await A.multiRemove(keys);
      }
    } catch {}
  },
  setItem: async (key: string, value: string) => {
    try {
      if (Platform.OS === "web") localStorage.setItem(key, value);
      else {
        const A = require("@react-native-async-storage/async-storage").default;
        await A.setItem(key, value);
      }
    } catch {}
  },
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === "web") return localStorage.getItem(key);
      const A = require("@react-native-async-storage/async-storage").default;
      return await A.getItem(key);
    } catch {
      return null;
    }
  },
  removeItem: async (key: string) => {
    try {
      if (Platform.OS === "web") localStorage.removeItem(key);
      else {
        const A = require("@react-native-async-storage/async-storage").default;
        await A.removeItem(key);
      }
    } catch {}
  },
};

// ─── Types (UNCHANGED) ────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  isLoggedIn: boolean;
  authStatus: "loading" | "authenticated" | "unauthenticated";
  loading: boolean;
  deleteType: "logout" | "deleted" | null;
  isGoogleSigningIn: boolean;
  googleError: string | null;
  loginWithOAuth: () => Promise<AuthUser | null>;
  clearGoogleError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Helper (UNCHANGED) ───────────────────────────────────────────────────────

const toAuthUser = (u: User | null): AuthUser | null => {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email ?? "",
    name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email ?? "",
  };
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider = ({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession: StoredSession | null;
}) => {
  // ── State (UNCHANGED) ────────────────────────────────────────────────────────
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authStatus, setAuthStatus] = useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading");
  const [loading, setLoading] = useState(false);

  // NEW: Separate loading + error state for Google Sign-In
  // Kept separate so your email/password loading spinner is unaffected
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const deleteTypeRef = useRef<"logout" | "deleted" | null>(null);
  const [deleteType, setDeleteType] = useState<"logout" | "deleted" | null>(
    null,
  );

  // Guard against double sign-in calls (e.g. user double-taps button)
  const googleSignInInProgress = useRef(false);

  const setDeleteTypeSync = (t: "logout" | "deleted" | null) => {
    deleteTypeRef.current = t;
    setDeleteType(t);
  };

  // ── Initialization (ENHANCED — adds silent sign-in) ──────────────────────────
  useEffect(() => {
    // Restore persisted nav intent (UNCHANGED)
    storage.getItem(NAV_INTENT_KEY).then((intent) => {
      if (intent === "logout" || intent === "deleted") {
        setDeleteTypeSync(intent as "logout" | "deleted");
      }
    });

    // Step 1: Restore Supabase session from AsyncStorage (UNCHANGED)
    // This is instant — no network call needed
    supabase.auth
      .getSession()
      .then(({ data: { session } }: { data: { session: Session | null } }) => {
        setSession(session);
        setUser(toAuthUser(session?.user ?? null));
        setAuthStatus(session ? "authenticated" : "unauthenticated");
        log.auth("Session restored:", session ? "found" : "none");

        // Step 2: If no Supabase session, try silent Google Sign-In
        // This auto-logs in returning users who signed in with Google before
        // Runs in background — does NOT block the UI
        if (!session) {
          trySilentGoogleSignIn().then((silentSuccess) => {
            if (silentSuccess) {
              log.auth(
                "Silent Google sign-in succeeded — session will update via onAuthStateChange",
              );
              // onAuthStateChange below will fire and update state automatically
            }
          });
        }
      });

    // Cache session (UNCHANGED)
    supabase.auth.getSession().then(({ data }: { data: any }) => {
      if (data.session) {
        storage.setItem(
          "supabase_session_cache",
          JSON.stringify({
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            userId: data.session.user.id,
            expiresAt: data.session.expires_at,
          }),
        );
      }
    });

    // Auth state listener (UNCHANGED)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: any, session: Session | null) => {
        setSession(session);
        setUser(toAuthUser(session?.user ?? null));
        setAuthStatus(session ? "authenticated" : "unauthenticated");
        log.auth("Auth state changed:", _event, session?.user?.email);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  // const logout = useCallback(async () => {
  //   setLoading(true);
  //   try {
  //     const uid = user?.id;
  //     setDeleteTypeSync('logout');
  //     await storage.setItem(NAV_INTENT_KEY, 'logout');

  //     if (uid) {
  //       await storage.removeKeys([
  //         `friends_v5_${uid}`, `friends_v6_${uid}`, `profile_${uid}`,
  //         `profile_cache_${uid}`, `matches_v1_${uid}`,
  //       ]);
  //     }

  //     // NEW: Clear Google SDK session alongside Supabase session
  //     // Prevents stale Google credentials from auto-signing in after logout
  //     await Promise.all([
  //       googleSignOut(),
  //       supabase.auth.signOut(),
  //     ]);

  //     setUser(null);
  //     setSession(null);
  //     log.auth('Logout complete');
  //   } finally {
  //     setLoading(false);
  //   }
  // }, [user?.id]);

  // // ── Delete account (UNCHANGED) ────────────────────────────────────────────────
  // const deleteAccount = useCallback(async () => {
  //   if (!user?.id) throw new Error('No user session');
  //   setLoading(true);
  //   try {
  //     const { data: { session: currentSession } } = await supabase.auth.getSession();

  //     setDeleteTypeSync('deleted');
  //     await storage.setItem(NAV_INTENT_KEY, 'deleted');

  //     const { data, error } = await supabase.functions.invoke('mindmates', {
  //       body: { action: 'delete_account', userId: user.id },
  //       headers: currentSession?.access_token
  //         ? { Authorization: `Bearer ${currentSession.access_token}` }
  //         : {},
  //     });
  //     if (error) throw new Error(error.message);
  //     if (data?.error) throw new Error(data.error);

  //     await googleSignOut(); // NEW: clear Google SDK too
  //     await supabase.auth.signOut().catch(() => {});
  //     await storage.clear();

  //     setUser(null);
  //     setSession(null);
  //     setAuthStatus('unauthenticated');
  //   } finally {
  //     setLoading(false);
  //   }
  // }, [user?.id]);

  // const login = useCallback(async (email: string, password: string) => {
  //   // Stub for AuthContextType compliance
  // }, []);

  // const register = useCallback(async (email: string, password: string, name: string) => {
  //   // Stub for AuthContextType compliance
  // }, []);

  // // ── Google Sign-In (COMPLETELY REPLACED — native, no WebView) ────────────────
  // // Returns null on success, error string on failure, null on cancel.
  // // Your Google.tsx screen just checks if string is returned to show error.
  // const googleLogin = useCallback(async (): Promise<string | null> => {
  //   // Guard against double-tap / double-call
  //   if (googleSignInInProgress.current) {
  //     log.auth('Google Sign-In already in progress — ignoring');
  //     return null;
  //   }

  //   googleSignInInProgress.current = true;
  //   setIsGoogleSigningIn(true);
  //   setGoogleError(null);

  //   try {
  //     // Clear nav intent — fresh login should NOT show deleteType routing
  //     setDeleteTypeSync(null);
  //     await storage.removeItem(NAV_INTENT_KEY);

  //     const result = await nativeGoogleSignIn();

  //     if (result.success) {
  //       // onAuthStateChange fires automatically → _layout.tsx routes correctly
  //       // No manual navigation needed here
  //       log.auth('✅ Google login success — waiting for onAuthStateChange');
  //       return null;
  //     }

  //     // User cancelled — show no error
  //     if (result.cancelled) return null;

  //     // Real error — show to user
  //     const err = result.error ?? 'An unknown error occurred';
  //     setGoogleError(err);
  //     return err;

  //   } finally {
  //     googleSignInInProgress.current = false;
  //     setIsGoogleSigningIn(false);
  //   }
  // }, []);

  // ── loginWithOAuth (kept as stub — UNCHANGED) ─────────────────────────────────
  const loginWithOAuth = useCallback(async () => null, []);

  const clearGoogleError = useCallback(() => setGoogleError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoggedIn: !!user,
        authStatus,
        loading,
        deleteType,
        isGoogleSigningIn,
        googleError,
        loginWithOAuth,
        clearGoogleError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthh = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuthh must be used within AuthProvider");
  return context;
};
