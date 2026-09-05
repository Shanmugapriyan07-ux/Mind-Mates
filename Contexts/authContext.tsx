import { useAuthStore, selUser, selPhase, AuthUser as StoreAuthUser } from "@/stores/authStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";

const NAV_INTENT_KEY = "auth_nav_intent";

const storage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === "web") return localStorage.getItem(key);
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
};

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: AuthUser | null;
  // Raw Supabase Session is intentionally NOT duplicated into this context.
  // If a consumer ever needs the real access/refresh token, call
  // supabase.auth.getSession() directly at the point of use — do not
  // reintroduce a stored copy here.
  session: null;
  isLoggedIn: boolean;
  loading: boolean;
  deleteType: "logout" | "deleted" | null;
  isGoogleSigningIn: boolean;
  googleError: string | null;
  loginWithOAuth: () => Promise<AuthUser | null>;
  clearGoogleError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const toContextUser = (u: StoreAuthUser | null): AuthUser | null => {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email ?? "",
    name: u.name ?? u.email ?? "",
  };
};

export const AuthProvider = ({
  children,
}: {
  children: React.ReactNode;
  /** @deprecated no longer used — session restore is owned by useAuthBoot */
  initialSession?: any;
}) => {
  const storeUser = useAuthStore(selUser);
  const phase = useAuthStore(selPhase);

  const [googleError, setGoogleError] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<"logout" | "deleted" | null>(null);

  useEffect(() => {
    let active = true;
    storage.getItem(NAV_INTENT_KEY).then((intent) => {
      if (active && (intent === "logout" || intent === "deleted")) {
        setDeleteType(intent);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const user = useMemo(() => toContextUser(storeUser), [storeUser]);
  const isLoggedIn = phase === "authenticated" || phase === "profile_incomplete";
  const loading = phase === "booting";

  const loginWithOAuth = useCallback(async () => null, []);
  const clearGoogleError = useCallback(() => setGoogleError(null), []);

  const value = useMemo(
    () => ({
      session: null,
      user,
      isLoggedIn,
      loading,
      loginWithOAuth,
      clearGoogleError,
      googleError,
      isGoogleSigningIn: false,
      deleteType,
    }),
    [user, isLoggedIn, loading, googleError, deleteType, loginWithOAuth, clearGoogleError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthh = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuthh must be used within AuthProvider");
  return context;
};