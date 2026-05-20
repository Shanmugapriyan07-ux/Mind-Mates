import { configureGoogleSignIn } from "@/config/googleAuth";
import { AppLinksProvider } from "@/Contexts/AppLinksContexts";
import { AuthProvider, useAuthh } from "@/Contexts/authContext";
import { ProfileProvider, useProfile } from "@/Contexts/profileContext";
import { useAppReady } from "@/hooks/Useappready";
import { useAuthBoot } from "@/hooks/useAuthBoot";
import { useBadgeSync } from "@/hooks/useBadgeSync";
import { useRouteGuard } from "@/hooks/useRouteGuard";
import GlobalProvider from "@/lib/GlobalProvider";
import AnimatedSplash from "@/startup/animatedSplash";
import "@/startup/startupMachine";
import { useStartup } from "@/startup/useStartup";
import { selPhase, useAuthStore } from "@/stores/authStore";
import { log } from "@/utils/logger";
import { activateKeepAwakeAsync } from "expo-keep-awake";
import { SplashScreen, Stack, useRouter, useSegments } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { InteractionManager, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

const CONTENT_FADE_MS = 280;

SplashScreen.preventAutoHideAsync().catch((e) =>
  console.error("Failed to prevent splash screen auto-hide:", e),
);

// ─── Inner nav component ──────────────────────────────────────────
// onContentReady is passed here and called once the navigator mounts.
// This is the correct place — it signals that the first screen frame
// is ready, so the startup machine can begin the transition.
function RootLayoutNav({
  startupPhase,
  onAnimationComplete,
  onContentReady,         // ← moved here from AuthProvider
}: {
  startupPhase:        string;
  onAnimationComplete: () => void;
  onContentReady:      () => void;   // ← correct prop location
}) {
  const { isLoggedIn, authStatus, deleteType, user } = useAuthh();
  const { profile, profileStatus } = useProfile();
  const segments  = useSegments();
  const router    = useRouter();

  useBadgeSync(
    user?.id ?? null,
    (chatId) =>
      router.push({ pathname: "/subScreens/chatScreen", params: { chatId } }),
    () => router.push("/(tabs)/chat"),
  );

  const hasRouted    = useRef(false);
  const prevLoggedIn = useRef(false);
  const rafRef       = useRef<number | null>(null);
  const authPhase    = useAuthStore(selPhase);

  useAuthBoot();
  useRouteGuard();

  // ── Signal content ready on first mount ──────────────────────
  // Called once when this component mounts — meaning React has
  // finished the first render pass and the navigator is alive.
  // The startup machine uses this to know the app is ready to show.
  useEffect(() => {
    // Small delay ensures the first screen has actually painted
    const t = setTimeout(() => onContentReady(), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← intentionally empty: run once on mount only

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  useEffect(() => {
    if (authPhase !== "booting") {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [authPhase]);

  useEffect(() => {
    if (authStatus === "loading") return;
    const authSettled   = !isLoggedIn;
    const profileSettled =
      profileStatus !== "idle" && profileStatus !== "loading";
    if (authSettled || profileSettled) SplashScreen.hideAsync();
  }, [authStatus, isLoggedIn, profileStatus]);

  useEffect(() => {
    const timer = setTimeout(
      () => SplashScreen.hideAsync().catch(() => {}),
      6000,
    );
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isLoggedIn && !prevLoggedIn.current) hasRouted.current = false;
    prevLoggedIn.current = isLoggedIn;
  }, [isLoggedIn]);

  const safeReplace = (path: string) => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    log.nav(`Routing to: ${path}`);
    if (Platform.OS !== "web") {
      rafRef.current = requestAnimationFrame(() => {
        router.replace(path as any);
        rafRef.current = null;
      });
    } else {
      router.replace(path as any);
    }
  };

  useEffect(() => {
    if (authStatus === "loading") return;
    const inAuth  = segments[0] === "(auth)";
    const inTabs  = segments[0] === "(tabs)";
    const inSetup = segments[0] === "(profileSetUp)";
    const inSub   = segments[0] === "subScreens";
    const inCb    = segments[0] === "auth" || segments[0] === "auth-callback";

    log.nav("Routing check:", {
      isLoggedIn, authStatus, profileStatus,
      isComplete: profile?.isProfileComplete,
      deleteType, segments: segments[0],
    });

    if (!isLoggedIn) {
      hasRouted.current = false;
      if (inAuth || inCb) return;
      return;
    }

    if (profileStatus === "idle" || profileStatus === "loading") return;
    if (hasRouted.current) return;

    if (profileStatus === "not_found") {
      hasRouted.current = true;
      if (!inSetup) safeReplace("/(profileSetUp)/BasicInfo");
      return;
    }

    if (profileStatus === "error") return;

    const isComplete = profile?.isProfileComplete === true;
    hasRouted.current = true;

    if (isComplete) {
      if (!inTabs && !inSub) safeReplace("/(tabs)/home");
    } else {
      if (!inSetup) safeReplace("/(profileSetUp)/BasicInfo");
    }
  }, [
    isLoggedIn, authStatus, profileStatus,
    profile?.isProfileComplete, deleteType,
  ]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false, animation: "none" }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(profileSetUp)" />
        <Stack.Screen name="subScreens" />
        <Stack.Screen name="auth-callback" />
      </Stack>

      {startupPhase === "booting" ||
      startupPhase === "preloading" ||
      startupPhase === "splash_animating" ? (
        <AnimatedSplash
          visible={startupPhase === "splash_animating"}
          onComplete={onAnimationComplete}
        />
      ) : null}
    </>
  );
}

// ─── Root Layout ──────────────────────────────────────────────────
export default function RootLayout() {
  const {
    phase,
    preloadData,
    onSplashAnimationComplete,
    onContentReady,
  } = useStartup();

  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    if (phase === "transitioning" || phase === "ready") {
      contentOpacity.value = withTiming(1, {
        duration: CONTENT_FADE_MS,
        easing:   Easing.out(Easing.ease),
      });
    }
  }, [phase]);

  const contentStyle = useAnimatedStyle(
    () =>
      ({
        opacity:       contentOpacity.value,
        pointerEvents: contentOpacity.value < 0.1 ? "none" : "auto",
      }) as any,
  );

  // Wrap in useCallback so reference is stable
  const handleContentReady = useCallback(() => {
    onContentReady();
  }, [onContentReady]);

  useEffect(() => {
    if (__DEV__) {
      const task = InteractionManager.runAfterInteractions(() => {
        setTimeout(async () => {
          try {
            await activateKeepAwakeAsync();
          } catch (err: any) {
            console.log("[KeepAwake] Deferred activation failed:", err.message);
          }
        }, 500);
      });
      return () => task.cancel();
    }
  }, []);

  useEffect(() => {
    try {
      configureGoogleSignIn();
    } catch (e) {
      console.error("[CRITICAL] Google Sign-In Init Failed:", e);
    }
  }, []);

  useEffect(() => {
    const globalAny  = globalThis as any;
    const errorUtils = globalAny.ErrorUtils || globalAny.global?.ErrorUtils;
    if (errorUtils && typeof errorUtils.getGlobalHandler === "function") {
      const defaultHandler = errorUtils.getGlobalHandler();
      errorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
        log.error(`Global JS Error [Fatal: ${isFatal}]:`, error);
        SplashScreen.hideAsync().catch(() => {});
        defaultHandler(error, isFatal);
      });
    }
    log.info("RootLayout Mounted - JS Engine Active");
  }, []);


  return (
    <View
      style={{ flex: 1, backgroundColor: "black" }}
      onLayout={() =>
        console.log("[DEBUG] GestureHandlerRootView Layout complete")
      }
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppLinksProvider>
          <SafeAreaProvider>
            <PaperProvider>
              <GlobalProvider>
                <AuthProvider
                  initialSession={(preloadData as any)?.sessionData ?? null}
                >
                  <ProfileProvider>
                    <Animated.View style={[{ flex: 1 }, contentStyle]}>
                      <RootLayoutNav
                        startupPhase={phase}
                        onAnimationComplete={onSplashAnimationComplete}
                        onContentReady={handleContentReady}
                      />
                    </Animated.View>
                  </ProfileProvider>
                </AuthProvider>
              </GlobalProvider>
            </PaperProvider>
          </SafeAreaProvider>
        </AppLinksProvider>
      </GestureHandlerRootView>
    </View>
  );
}
