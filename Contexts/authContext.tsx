// Contexts/authContext.tsx
// deleteType ref tells _layout WHERE to redirect after auth change:
//   'logout'  → login screen (session removed, account exists)
//   'deleted' → onboarding (account destroyed, fresh start)
//   null      → onboarding (first time visitor)

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { supabase, signIn, signUp } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import { StoredSession } from '@/utils/Preloadassets';


// Key used to persist auth navigation intent across app restarts.
// Without this: after logout + app kill + restart, deleteType is null
// → layout routes to onBoarding (wrong). With persistence:
//   'logout'  stored → on restart → routes to login ✅
//   'deleted' stored → on restart → routes to onboarding ✅
//   key cleared on successful login → fresh start ✅
const NAV_INTENT_KEY = 'auth_nav_intent';

const storage = {
  clear: async () => {
    try {
      if (Platform.OS === 'web') localStorage.clear();
      else {
        const A = require('@react-native-async-storage/async-storage').default;
        await A.clear();
      }
    } catch {}
  },
  removeKeys: async (keys: string[]) => {
    try {
      if (Platform.OS === 'web') keys.forEach(k => localStorage.removeItem(k));
      else {
        const A = require('@react-native-async-storage/async-storage').default;
        await A.multiRemove(keys);
      }
    } catch {}
  },
  setItem: async (key: string, value: string) => {
    try {
      if (Platform.OS === 'web') localStorage.setItem(key, value);
      else {
        const A = require('@react-native-async-storage/async-storage').default;
        await A.setItem(key, value);
      }
    } catch {}
  },
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') return localStorage.getItem(key);
      const A = require('@react-native-async-storage/async-storage').default;
      return await A.getItem(key);
    } catch { return null; }
  },
  removeItem: async (key: string) => {
    try {
      if (Platform.OS === 'web') localStorage.removeItem(key);
      else {
        const A = require('@react-native-async-storage/async-storage').default;
        await A.removeItem(key);
      }
    } catch {}
  },
};

export interface AuthUser { id: string; email: string; name: string; }

interface AuthContextType {
  user:           AuthUser | null;
  session:        Session  | null;
  isLoggedIn:     boolean;
  authStatus:     'loading' | 'authenticated' | 'unauthenticated';
  loading:        boolean;
  // deleteType tells _layout which screen to go to after sign-out
  deleteType:     'logout' | 'deleted' | null;
  login:          (email: string, password: string) => Promise<void>;
  register:       (email: string, password: string, name: string) => Promise<void>;
  logout:         () => Promise<void>;
  deleteAccount:  () => Promise<void>;
  loginWithOAuth: () => Promise<AuthUser | null>;
  googleLogin:    () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const toAuthUser = (u: User | null): AuthUser | null => {
  if (!u) return null;
  return {
    id:    u.id,
    email: u.email ?? '',
    name:  u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email ?? '',
  };
};

export const AuthProvider = ({ children,initialSession}: { children: React.ReactNode, initialSession: StoredSession | null }) => {
  const [user,       setUser]       = useState<AuthUser | null>(null);
  const [session,    setSession]    = useState<Session | null>(null);
  const [authStatus, setAuthStatus] = useState<'loading'|'authenticated'|'unauthenticated'>('loading');
  const [loading,    setLoading]    = useState(false);
 const [userr, setUserr] = useState(initialSession ? { id: initialSession.userId } : null); 
  // TEACHING: Use a ref not state for deleteType.
  // We need _layout to read this DURING the onAuthStateChange callback.
  // If we used setState, there'd be a render cycle gap where the old value
  // is still visible. A ref is synchronous — set it, then sign out. ✅
  const deleteTypeRef = useRef<'logout'|'deleted'|null>(null);
  const [deleteType, setDeleteType] = useState<'logout'|'deleted'|null>(null);

  const setDeleteTypeSync = (t: 'logout'|'deleted'|null) => {
    deleteTypeRef.current = t;
    setDeleteType(t);
  };

  useEffect(() => {
    // On startup: restore persisted nav intent so _layout can route correctly
    // after app restart following a logout or account delete ✅
    storage.getItem(NAV_INTENT_KEY).then(intent => {
      if (intent === 'logout' || intent === 'deleted') {
        setDeleteTypeSync(intent as 'logout' | 'deleted');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(toAuthUser(session?.user ?? null));
      setAuthStatus(session ? 'authenticated' : 'unauthenticated');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(toAuthUser(session?.user ?? null));
      setAuthStatus(session ? 'authenticated' : 'unauthenticated');
    });
    return () => subscription.unsubscribe();
  }, []);

  // Validate cached session silently in background (moved outside nested useEffect)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserr(data.session?.user ?? null);
      // Cache the fresh session for next launch
      if (data.session) {
        storage.setItem('supabase_session_cache', JSON.stringify({
          accessToken:  data.session.access_token,
          refreshToken: data.session.refresh_token,
          userId:       data.session.user.id,
          expiresAt:    data.session.expires_at,
        }));
      }
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      // Reset deleteType + clear persisted intent on fresh login ✅
      setDeleteTypeSync(null);
      await storage.removeItem(NAV_INTENT_KEY);
      await signIn(email, password);
    } finally { setLoading(false); }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    setLoading(true);
    try { await signUp(email, password, name); }
    finally { setLoading(false); }
  }, []);

  // ── LOGOUT — session only, → login screen ─────────────────────
  // TEACHING:
  //   1. Set deleteType='logout' BEFORE signing out
  //   2. supabase.auth.signOut() triggers onAuthStateChange
  //   3. onAuthStateChange sets authStatus='unauthenticated'
  //   4. _layout useEffect fires: sees deleteType='logout' → router.replace('/(auth)/login')
  //   No race condition because deleteType is set synchronously before sign-out ✅
  const logout = useCallback(async () => {
    setLoading(true);
    try {
      const uid = user?.id;
      // Step 1: Mark intent BEFORE sign-out fires onAuthStateChange
      // Also persist to storage so _layout routes correctly after app restart ✅
      setDeleteTypeSync('logout');
      await storage.setItem(NAV_INTENT_KEY, 'logout');
      // Step 2: Clear user-specific cache (not full storage)
      if (uid) await storage.removeKeys([
        `friends_v5_${uid}`, `friends_v6_${uid}`, `profile_${uid}`,
        `profile_cache_${uid}`, `matches_v1_${uid}`,
      ]);
      // Step 3: Sign out → triggers onAuthStateChange → _layout routes to login ✅
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    } finally { setLoading(false); }
  }, [user?.id]);

  // ── DELETE ACCOUNT — destroys everything, → onboarding ────────
  // TEACHING:
  //   1. Set deleteType='deleted' BEFORE anything
  //   2. Edge function deletes ALL data + auth record
  //   3. supabase.auth.signOut() fires onAuthStateChange
  //   4. _layout sees deleteType='deleted' → router.replace('/(auth)/onBoarding')
  //   5. AsyncStorage.clear() wipes local cache (fresh install feel) ✅
  const deleteAccount = useCallback(async () => {
    if (!user?.id) throw new Error('No user session');
    setLoading(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      // Step 1: Mark intent + persist so it survives app restart ✅
      setDeleteTypeSync('deleted');
      await storage.setItem(NAV_INTENT_KEY, 'deleted');

      // Step 2: Edge function deletes all data + Supabase Auth record
      const { data, error } = await supabase.functions.invoke('mindmates', {
        body: { action: 'delete_account', userId: user.id },
        headers: currentSession?.access_token
          ? { Authorization: `Bearer ${currentSession.access_token}` }
          : {},
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      // Step 3: Sign out (token invalid anyway after admin delete)
      await supabase.auth.signOut().catch(() => {});

      // Step 4: Full local storage wipe — fresh install
      await storage.clear();

      // Step 5: Clear React state
      setUser(null);
      setSession(null);
      setAuthStatus('unauthenticated');
      // _layout.tsx reads deleteType='deleted' → routes to onBoarding ✅
    } finally { setLoading(false); }
  }, [user?.id]);


  const loginWithOAuth = useCallback(async () => null, []);
  const googleLogin    = useCallback(async () => {}, []);

  return (
    <AuthContext.Provider value={{
      user, session, isLoggedIn: !!user,
      authStatus, loading, deleteType,
      login, register, logout, deleteAccount,
      loginWithOAuth, googleLogin
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


// ══════════════════════════════════════════════════════════════════
// HOW TO WIRE AuthProvider WITH PRELOADED SESSION
// ══════════════════════════════════════════════════════════════════
//
// Your AuthProvider should accept `initialSession` as a prop.
// This lets it hydrate immediately from the cached session without
// an async Supabase call, eliminating the "loading" flash on login state.
//
// Example AuthContext modification:
//
//   export const AuthProvider = ({
//     children,
//     initialSession,
//   }: {
//     children: React.ReactNode;
//     initialSession: StoredSession | null;
//   }) => {
//     const [user, setUser] = useState(
//       initialSession ? { id: initialSession.userId } : null
//     );
//
//     useEffect(() => {
//       // Validate cached session silently in background
//       supabase.auth.getSession().then(({ data }) => {
//         setUser(data.session?.user ?? null);
//         // Cache the fresh session for next launch
//         if (data.session) {
//           AsyncStorage.setItem('supabase_session_cache', JSON.stringify({
//             accessToken:  data.session.access_token,
//             refreshToken: data.session.refresh_token,
//             userId:       data.session.user.id,
//             expiresAt:    data.session.expires_at,
//           }));
//         }
//       });
//     }, []);
//
//     // ...rest of auth logic
//   };

