// hooks/useAuthBoot.ts
import { useEffect, useRef }        from "react";
import { AppState, AppStateStatus } from "react-native";
import { supabase }                 from "@/lib/supabase";
import { useAuthStore }             from "@/stores/authStore";
import { restoreSession }           from "@/services/authServices";
import { log }                      from "@/utils/logger";

export function useAuthBoot(): void {
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    log.auth("[AuthBoot] restoring session…");
    restoreSession().catch((err) => {
      log.error("[AuthBoot] restoreSession threw:", err?.message);
      useAuthStore.getState().setPhase("unauthenticated");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const store = useAuthStore.getState();
        log.auth("[AuthBoot] event:", event, "phase:", store.phase);

        // Always ignore events during intentional sign-out / delete flows
        if (
          store.phase === 'unauthenticated' ||
          store.phase === 'logging_out'     ||
          store.phase === 'deleting'
        ) {
          log.auth("[AuthBoot] ignoring — signed out phase");
          return;
        }

        switch (event) {

          case "SIGNED_IN":
            if (store.phase === "booting") {
              // Only re-try restoreSession if we're still in boot phase
              // (means restoreSession() above didn't resolve yet)
              log.auth("[AuthBoot] SIGNED_IN during boot — retrying restore");
              restoreSession().catch(() => store.setPhase("unauthenticated"));
            }
            // If phase is already 'authenticated' or 'profile_incomplete',
            // signInWithGoogle() already handled this — do nothing.
            break;

          case "SIGNED_OUT":
            // Only genuine external revocations reach here (token expired,
            // revoked from another device, etc.) — our own logout() calls
            // finalizeSignOut() before supabase.auth.signOut(), so by the time
            // this event fires the phase is already 'logging_out' and the
            // guard above catches it.
            if (
              store.phase === "authenticated" ||
              store.phase === "profile_incomplete"
            ) {
              log.auth("[AuthBoot] external sign-out — finalizing");
              store.finalizeSignOut();
            }
            break;

          case "TOKEN_REFRESHED":
            if (session?.access_token) {
              // Update token in store without touching phase or user
              useAuthStore.setState({ token: session.access_token } as any);
            }
            break;

          // USER_UPDATED: profile changes from another session — re-sync user
          case "USER_UPDATED":
            if (session?.user && (
              store.phase === "authenticated" ||
              store.phase === "profile_incomplete"
            )) {
              restoreSession().catch(() => {});
            }
            break;
        }
      },
    );

    let prevState: AppStateStatus = AppState.currentState;
    const appSub = AppState.addEventListener("change", (next) => {
      if (next === "active" && prevState !== "active") {
        const store = useAuthStore.getState();
        if (
          store.phase === "authenticated" ||
          store.phase === "profile_incomplete"
        ) {
          // Verify session is still valid on app resume
          supabase.auth.getSession()
            .then(({ data: { session } }) => {
              if (!session) store.finalizeSignOut();
            })
            .catch(() => {});
        }
      }
      prevState = next;
    });

    return () => {
      subscription.unsubscribe();
      appSub.remove();
    };
  }, []);
}