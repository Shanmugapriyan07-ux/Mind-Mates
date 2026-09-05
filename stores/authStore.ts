import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
export type AuthPhase =
  | 'booting'
  | 'authenticated'
  | 'profile_incomplete'
  | 'unauthenticated'
  | 'logging_out'
  | 'deleting';
export type NavIntent = null;

export interface AuthUser {
  id:                 string;
  email:              string | null;
  name:               string | null;
  avatar:             string | null;
  is_profileComplete: boolean;
}

interface AuthState {
  phase:             AuthPhase;
  user:              AuthUser | null;
  token:             string | null;
  navIntent:         null;
  isSigningIn:       boolean;
  error:             string | null;
  isTransitioning:   boolean;
  hasSeenOnboarding: boolean;
  session:           Session | null;
  profile:           any | null;
  hydrated:          boolean;
  loading:           boolean;
  _completing:       boolean;
  markProfileComplete: () => void;
  beginLogout:         () => void;
  beginDelete:         () => void;
  finalizeSignOut:     () => void;
  clearSession:        () => void;
  setPhase:            (p: AuthPhase) => void;
  setSigningIn:        (v: boolean) => void;
  setError:            (e: string | null) => void;
  setTransitioning:    (v: boolean) => void;
  setProfile:          (profile: any) => void;
  setHydrated:         () => void;
  logout:              () => Promise<void>;
  setSession: (user: AuthUser | null, token: string | null) => void; 
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      phase:             'booting',
      user:              null,
      token:             null,
      navIntent:         null,
      isSigningIn:       false,
      error:             null,
      hasSeenOnboarding: false,
      isTransitioning:   false,
      session:           null,
      profile:           null,
      hydrated:          false,
      loading:           true,
      _completing:       false,

      setSession: (user, token) => {
  set({
    user,
    token: token ?? null,
    phase: user?.is_profileComplete ? 'authenticated' : 'profile_incomplete',
    navIntent: null,
    isSigningIn: false,
    isTransitioning: true,
    error: null,
    session: null,
    _completing: false,
  });
},
      clearSession: () => set({
        user:        null,
        token:       null,
        phase:       'unauthenticated',
        navIntent:   null,
        isSigningIn: false,
        session:     null,
        profile:     null,
        _completing: false,
      }),
      markProfileComplete: () => {
        const u = get().user;
        if (!u) return;
        set({
          user:        { ...u, is_profileComplete: true },
          phase:       'authenticated',
          navIntent:   null,
          _completing: false,
        });
        setTimeout(() => {
          useAuthStore.setState({ _completing: false });
        }, 2000);
      },
      beginLogout: () => set({ phase: 'logging_out', navIntent: null }),
      beginDelete: () => set({ phase: 'deleting',    navIntent: null }),
      finalizeSignOut: () => {
        if (get().phase === 'unauthenticated') return;
        set({
          phase:       'unauthenticated',
          user:        null,
          token:       null,
          isSigningIn: false,
          error:       null,
          navIntent:   null,
          isTransitioning: true,
          session:     null,
          profile:     null,
          _completing: false,
        });
      },
      setPhase:     (p) => set({ phase: p }),
      setSigningIn: (v) => set({ isSigningIn: v }),
      setError:     (e) => set({ error: e }),
      setTransitioning: (v) => set({ isTransitioning: v }),
      setProfile:   (profile) => set({ profile }),
      setHydrated:  () => set({ hydrated: true, loading: false }),
      logout:       async () => {
        set({ session: null, user: null, profile: null, token: null });
      },
    }),
    {
      name:    'mm-auth-v4',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ user: s.user, token: s.token }),
    },
  ),
);
AsyncStorage.getItem("hso").then((hso) => {
  useAuthStore.setState({ hasSeenOnboarding: hso === "1" });
});
export const selPhase             = (s: AuthState) => s.phase;
export const selUser              = (s: AuthState) => s.user;
export const selNavIntent         = (s: AuthState) => s.navIntent;
export const selIsSigningIn       = (s: AuthState) => s.isSigningIn;
export const selError             = (s: AuthState) => s.error;
export const selIsProfileComplete = (s: AuthState) => s.user?.is_profileComplete ?? false;
export const selCompleting        = (s: AuthState) => s._completing;
export const selIsTransitioning   = (s: AuthState) => s.isTransitioning;
export const selDidLogOutOrDelete = (s: AuthState) =>
  s.phase === 'logging_out' || s.phase === 'deleting';