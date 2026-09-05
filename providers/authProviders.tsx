import { supabase } from "@/lib/supabase";
import { flushPendingNavigation } from "@/services/deepLinkService";
import { notificationService } from "@/services/notificationService";
import { realtimeService } from "@/services/realtimeService";
import { useAuthStore } from "@/stores/authStore";
import React, { useCallback, useEffect } from "react";
import { InteractionManager } from "react-native";
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // const { setSession, setProfile, setHydrated } = useAuthStore();

  const setSession = useAuthStore((s) => s.setSession);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const hydrated = useAuthStore((s) => s.hydrated);

  const loadProfile = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (data) setProfile(data);
    },
    [setProfile],
  );

  const handleUserSetup = useCallback(
    async (userId: string) => {
      await loadProfile(userId);
      InteractionManager.runAfterInteractions(async () => {
        // await notificationService.registerForPushNotifications(userId);
      });
    },
    [loadProfile],
  );
  console.count("AuthProvider");

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setupAuthFlow = async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();
      // setSession(initialSession);
      // setHydrated();
      // if (initialSession?.user) {
      //   await handleUserSetup(initialSession.user.id);
      // }

      setSession(initialSession);
      setHydrated();

      if (initialSession?.user) {
        InteractionManager.runAfterInteractions(() => {
          handleUserSetup(initialSession.user.id);
        });
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        setSession(session);
        if (event === "SIGNED_IN" && session?.user) {
          await handleUserSetup(session.user.id);
        }
        if (event === "SIGNED_OUT") {
          setProfile(null);
          realtimeService.unsubscribeAll();
          notificationService.destroy();
        }
      });
      unsubscribe = () => subscription.unsubscribe();
    };

    setupAuthFlow();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [handleUserSetup, setHydrated, setProfile, setSession]);
  useEffect(() => {
    if (hydrated) {
      flushPendingNavigation();
    }
  }, [hydrated]);
  return <>{children}</>;
}
