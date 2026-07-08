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
export interface AuthUser {
  id: string;
  email: string;
  name: string;
}
interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  isLoggedIn: boolean;
  loading: boolean;
  deleteType: "logout" | "deleted" | null;
  isGoogleSigningIn: boolean;
  googleError: string | null;
  loginWithOAuth: () => Promise<AuthUser | null>;
  clearGoogleError: () => void;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
const toAuthUser = (u: User | null): AuthUser | null => {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email ?? "",
    name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email ?? "",
  };
};
export const AuthProvider = ({
  children,
}: {
  children: React.ReactNode;
  initialSession: StoredSession | null;
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [, setAuthStatus] = useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading");
  const [loading] = useState(false);
  const [isGoogleSigningIn] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const deleteTypeRef = useRef<"logout" | "deleted" | null>(null);
  const [deleteType, setDeleteType] = useState<"logout" | "deleted" | null>(
    null,
  );
  const setDeleteTypeSync = (t: "logout" | "deleted" | null) => {
    deleteTypeRef.current = t;
    setDeleteType(t);
  };
  useEffect(() => {
    storage.getItem(NAV_INTENT_KEY).then((intent) => {
      if (intent === "logout" || intent === "deleted") {
        setDeleteTypeSync(intent as "logout" | "deleted");
      }
    });
    supabase.auth
      .getSession()
      .then(({ data: { session } }: { data: { session: Session | null } }) => {
        setSession(session);
        setUser(toAuthUser(session?.user ?? null));
        setAuthStatus(session ? "authenticated" : "unauthenticated");
        log.auth("Session restored:", session ? "found" : "none");
        if (!session) {
          trySilentGoogleSignIn().then((silentSuccess) => {
            if (silentSuccess) {
              log.auth(
                "Silent Google sign-in succeeded — session will update via onAuthStateChange",
              );
            }
          });
        }
      });
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
  const loginWithOAuth = useCallback(async () => null, []);
  const clearGoogleError = useCallback(() => setGoogleError(null), []);
  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoggedIn: !!user,
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
