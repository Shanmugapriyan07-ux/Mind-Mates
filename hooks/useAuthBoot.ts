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
              log.auth("[AuthBoot] SIGNED_IN during boot — retrying restore");
              restoreSession().catch(() => store.setPhase("unauthenticated"));
            }
            break;

          case "SIGNED_OUT":
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
              useAuthStore.setState({ token: session.access_token } as any);
            }
            break;
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