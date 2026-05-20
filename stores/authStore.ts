// store/authStore.ts
// THE single source of truth. One store. One phase. One navigation.
//
// WHY FLICKERING HAPPENS (and how this fixes it):
//
// ❌ Bad — multiple systems fighting:
//    AuthContext listener  → sets state → triggers useEffect → navigate
//    premiumAuthService   → sets state → triggers useEffect → navigate
//    supabase.onAuthStateChange → sets state → navigate
//    Result: 3 navigations, 50ms apart = flicker + double redirect
//
// ✅ Good — single system:
//    ONE store, ONE phase, ONE useRouteGuard in _layout.tsx
//    Every auth action updates ONLY this store
//    useRouteGuard reacts ONCE to phase change
//    Result: zero flicker, zero back navigation bug
//
// WHY BACK NAVIGATION EXPLOIT HAPPENS:
//    router.replace() only replaces CURRENT screen
//    Old screens stay in the navigation stack
//    User presses back → goes to old authenticated screen
//
// FIX: router.replace() + navigationLock prevents any back navigation
//    because the entire stack is replaced, not just the current screen

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Auth Phase Machine ─────────────────────────────────────────────────────────
//
//   booting
//     ├─► authenticated      (session found + profile complete)
//     ├─► profile_incomplete (session found + profile NOT done)
//     └─► unauthenticated    (no session)
//
//   authenticated
//     ├─► logging_out        (logout in progress — nav LOCKED)
//     └─► deleting           (delete in progress — nav LOCKED)
//
//   logging_out  ──► unauthenticated  (intent: to_login)
//   deleting     ──► unauthenticated  (intent: to_onboarding)

export type AuthPhase =
  | 'booting'
  | 'authenticated'
  | 'profile_incomplete'
  | 'unauthenticated'
  | 'logging_out'    // Nav LOCKED — overlay showing
  | 'deleting';      // Nav LOCKED — overlay showing

// Set BEFORE clearing session → _layout reads this, navigates once, correctly
export type NavIntent =
  | null
  | 'to_login'        // logout → Login screen
  | 'to_onboarding';  // delete → Onboarding screen

export interface AuthUser {
  id:                 string;
  email:              string | null;
  name:               string | null;
  avatar:             string | null;
  is_profileComplete: boolean;
}

interface AuthState {
  //
  // WHY BACK NAVIGATION EXPLOIT HAPPENS:
  //    router.replace() only replaces CURRENT screen
  //    Old screens stay in the navigation stack
  //    User presses back → goes to old authenticated screen
  //
  // FIX: router.replace() + navigationLock prevents any back navigation
  //    because the entire stack is replaced, not just the current screen
  clearSession(): unknown;
  phase:      AuthPhase;
  user:       AuthUser | null;
  token:      string | null;
  navIntent:  NavIntent;
  isSigningIn: boolean;
  error:      string | null;

  // ── Actions ────────────────────────────────────────────────────────────────
  setSession:          (user: AuthUser, token: string) => void;
  markProfileComplete: () => void;

  // Intent-first: set destination BEFORE clearing session
  beginLogout:         () => void;
  beginDelete:         () => void;
  finalizeSignOut:     () => void;

  setPhase:    (p: AuthPhase) => void;
  setSigningIn: (v: boolean) => void;
  setError:    (e: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      phase:       'booting',
      user:        null,
      token:       null,
      navIntent:   null,
      isSigningIn: false,
      error:       null,

      setSession: (user, token) => set({
        user,
        token,
        phase:       user.is_profileComplete ? 'authenticated' : 'profile_incomplete',
        navIntent:   null,
        isSigningIn: false,
        error:       null,
      }),

      clearSession: () => set({
        user:        null,
        token:       null,
        phase:       'unauthenticated',
        navIntent:   null,
        isSigningIn: false,
      }),

      markProfileComplete: () => {
        const u = get().user;
        if (!u) return;
        set({ user: { ...u, is_profileComplete: true }, phase: 'authenticated' });
      },
      beginLogout: () => set({
        phase:     'logging_out',
        navIntent: 'to_login',
      }),
      beginDelete: () => set({
        phase:     'deleting',
        navIntent: 'to_onboarding',
      }),

      finalizeSignOut: () => {
        const intent = get().navIntent; // Preserve intent through the clear
        set({
          phase:       'unauthenticated',
          user:        null,
          token:       null,
          isSigningIn: false,
          error:       null,
          navIntent:   intent, // Keep! _layout still needs this
        });
        // Clear intent after _layout has had time to navigate
        setTimeout(() => set({ navIntent: null }), 2000);
      },

      setPhase:     (p) => set({ phase: p }),
      setSigningIn: (v) => set({ isSigningIn: v }),
      setError:     (e) => set({ error: e }),
    }),
    {
      name:    'mm-auth-v4',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist user data — phases always reset on boot
      partialize: (s) => ({ user: s.user, token: s.token }),
    }
  )
);

// ── Stable selectors ──────────────────────────────────────────────────────────

export const selPhase       = (s: AuthState) => s.phase;
export const selUser        = (s: AuthState) => s.user;
export const selNavIntent   = (s: AuthState) => s.navIntent;
export const selIsSigningIn = (s: AuthState) => s.isSigningIn;
export const selError       = (s: AuthState) => s.error;