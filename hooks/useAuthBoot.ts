import { supabase } from "@/lib/supabase";
import { restoreSession } from "@/services/authServices";
import { useAuthStore } from "@/stores/authStore";
import { log } from "@/utils/logger";
import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
export function useAuthBoot(session: any): void {
  const booted = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session; // always keep latest, but don't react to it

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    log.auth("[AuthBoot] MOUNT");
    if (sessionRef.current) {
      log.auth("[AuthBoot] seeding from preload session");
      useAuthStore.getState().setHydrated();
    } else {
      log.auth("[AuthBoot] no preload session — restoring…");
      restoreSession().catch((err) => {
        console.error("[AuthBoot] restoreSession threw:", err?.message);
        useAuthStore.getState().setPhase("unauthenticated");
      });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const store = useAuthStore.getState();
        log.auth("[AuthBoot] event:", event, "phase:", store.phase);

        if (
          store.phase === 'unauthenticated' ||
          store.phase === 'logging_out' ||
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
            if (store.phase === "authenticated" || store.phase === "profile_incomplete") {
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
            if (session?.user && (store.phase === "authenticated" || store.phase === "profile_incomplete")) {
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
        if (store.phase === "authenticated" || store.phase === "profile_incomplete") {
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
      log.auth("[AuthBoot] UNMOUNT");
    };
  }, []); // ← run once per mount, intentionally. Reads sessionRef.current, not the reactive prop.
}