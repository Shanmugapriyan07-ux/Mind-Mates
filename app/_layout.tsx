import { LogoutLoadingModal } from "@/components/logoutLoadingModel";
import { configureGoogleSignIn } from "@/config/googleAuth";
import { AppLinksProvider } from "@/Contexts/AppLinksContexts";
import { AuthProvider } from "@/Contexts/authContext";
import { ProfileProvider } from "@/Contexts/profileContext";
import { useAuthBoot } from "@/hooks/useAuthBoot";
import { usePresence } from "@/hooks/usePresence";
import { useRealtimeManager } from "@/hooks/useRealtimeManager";
import { GlobalProvider } from "@/lib/GlobalProvider";
import { NotificationProvider } from "@/providers/notificationProvider";
import {
  handleColdStartNotification,
  navigateFromNotification,
  NotificationData,
  registerNavRef,
} from "@/services/deepLinkService";
import AnimatedSplash from "@/startup/animatedSplash";
import "@/startup/startupMachine";
import { useStartup } from "@/startup/useStartup";
import {
  selIsProfileComplete,
  selPhase,
  useAuthStore,
} from "@/stores/authStore";
import { log } from "@/utils/logger";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { activateKeepAwakeAsync } from "expo-keep-awake";
import * as Notifications from "expo-notifications";
import {
  SplashScreen,
  Stack,
  useNavigationContainerRef,
  useRouter,
  useSegments,
} from "expo-router";
import React, { useCallback, useEffect, useRef } from "react";
import {
  InteractionManager,
  Linking,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../wdyr";
const CONTENT_FADE_MS = 220;
const SPLASH_BG = "#6D4AFF";
const STORAGE_KEY_ONBOARDING = "hso";
if (__DEV__) {
}
SplashScreen.preventAutoHideAsync().catch(() => {});

let _profileCompleting = false;
export function setProfileCompleting(v: boolean) {
  _profileCompleting = v;
}
function resolveTarget(
  phase: string,
  isProfileComplete: boolean,
  seg: string | undefined,
): string | null {
  switch (phase) {
    case "booting":
    case "reading_storage":
      return null;
    case "logging_out":
    case "deleting":
    case "unauthenticated":
      return seg === "(auth)" ? null : "/(auth)/onBoarding";

    case "profile_incomplete":
      if (isProfileComplete) return null;
      if (seg === "(profileSetUp)") return null;
      return "/(profileSetUp)/BasicInfo";

    case "authenticated":
      if (seg === "(profileSetUp)") return "/(tabs)/home";
      return seg === "(tabs)" || seg === "subScreens" ? null : "/(tabs)/home";

    default:
      return null;
  }
}

interface RootLayoutNavProps {
  startupPhase: string;
  onAnimationComplete: () => void;
  onContentReady: () => void;
  preloadData: any;
}

function RootLayoutNav({
  startupPhase,
  onAnimationComplete,
  onContentReady,
  preloadData,
}: RootLayoutNavProps) {
  usePresence();
  useRealtimeManager();
  useAuthBoot(preloadData?.session);

  const router = useRouter();
  const segments = useSegments();
  const phase = useAuthStore(selPhase);
  const isProfileComplete = useAuthStore(selIsProfileComplete);
  const lastTarget = useRef<string>("");
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const t = setTimeout(() => onContentReady(), 50);
    return () => clearTimeout(t);
  }, [onContentReady]);

  // useEffect(() => {
  //   const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 1500);
  //   return () => clearTimeout(t);
  // }, []);

  useEffect(() => {
    if (phase === "authenticated" || phase === "profile_incomplete") {
      AsyncStorage.setItem(STORAGE_KEY_ONBOARDING, "1").catch(() => {});
    }
  }, [phase]);

  useEffect(
    () => () => {
      if (navTimer.current) clearTimeout(navTimer.current);
    },
    [],
  );

  useEffect(() => {
    const isHome = segments[0] === "(tabs)";
    if (phase === "booting" || (phase === "authenticated" && isHome)) {
      lastTarget.current = "";
    }
  }, [phase, segments]);

  useEffect(() => {
    if (_profileCompleting) return;
    const seg = segments[0] as string | undefined;
    const target = resolveTarget(phase, isProfileComplete, seg);
    if (!target) return;
    if (target === lastTarget.current) return;
    lastTarget.current = target;
    log.nav(`[Layout] "${phase}" → "${target}"`);

    const isLoggingIn =
      phase === "authenticated" || phase === "profile_incomplete";
    const isLoggingOut =
      phase === "unauthenticated" ||
      phase === "logging_out" ||
      phase === "deleting";

    const doNavigate = () => {
      try {
        if (isLoggingOut) {
          try {
            if (router.canDismiss()) router.dismissAll();
          } catch {}
          try {
            router.replace(target as any);
          } catch {}
        } else {
          router.replace(target as any);
        }
      } catch {
        if (navTimer.current) clearTimeout(navTimer.current);
        navTimer.current = setTimeout(() => {
          try {
            router.replace(target as any);
          } catch {}
        }, 300);
      }
    };
    if (Platform.OS === "web" || isLoggingIn || isLoggingOut) {
      doNavigate();
      if (isLoggingIn) {
        setTimeout(() => useAuthStore.getState().setTransitioning(false), 800);
      }
    } else {
      if (navTimer.current) clearTimeout(navTimer.current);
      navTimer.current = setTimeout(() => {
        InteractionManager.runAfterInteractions(doNavigate);
      }, 0);
    }
  }, [phase, isProfileComplete, router, segments]);
  const showSplash =
    startupPhase === "booting" ||
    startupPhase === "preloading" ||
    startupPhase === "splash_animating";
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "none",
          freezeOnBlur: true,
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="(auth)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
        <Stack.Screen
          name="(profileSetUp)"
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen name="subScreens" options={{ gestureEnabled: false }} />
      </Stack>
      {showSplash && <AnimatedSplash onComplete={onAnimationComplete} />}
    </>
  );
}

export default function RootLayout() {
  const { phase, preloadData, onSplashAnimationComplete, onContentReady } =
    useStartup();
  console.count("RootLayout");
  const navRef = useNavigationContainerRef();
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    Linking.getInitialURL().then(() => {});
  }, []);
  useEffect(() => {
    if (phase === "transitioning" || phase === "done") {
      contentOpacity.value = withTiming(1, {
        duration: CONTENT_FADE_MS,
        easing: Easing.out(Easing.ease),
      });
    }
  }, [contentOpacity, phase]);

  const contentStyle = useAnimatedStyle(() => ({
    flex: 1,
    opacity: contentOpacity.value,
    pointerEvents: (contentOpacity.value < 0.05 ? "none" : "auto") as any,
  }));

  const handleContentReady = useCallback(
    () => onContentReady(),
    [onContentReady],
  );

  useEffect(() => {
    if (!__DEV__) return;
    const task = InteractionManager.runAfterInteractions(() => {
      if (Platform.OS !== "web") {
        setTimeout(async () => {
          try {
            await activateKeepAwakeAsync();
          } catch {}
        }, 500);
      }
    });
    return () => task.cancel();
  }, []);

  useEffect(() => {
    if (phase !== "done") return;
    configureGoogleSignIn();
  }, [navRef, phase]);

  // useEffect(() => {
  //   registerNavRef(navRef);
  //   if (phase !== "done") return;
  //   handleColdStartNotification();
  //   if (_notifSub) return;
  //   _notifSub = Notifications.addNotificationResponseReceivedListener(
  //     (response) => {
  //       const data = response.notification.request.content
  //         .data as unknown as NotificationData;
  //       if (!data?.url || data?.type === "badge_sync") {
  //         return;
  //       }
  //       navigateFromNotification(data);
  //     },
  //   );
  // }, [phase]);

  useEffect(() => {
    registerNavRef(navRef);
    if (phase !== "done") return;
    handleColdStartNotification();

    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content
          .data as unknown as NotificationData;
        if (!data?.url || data?.type === "badge_sync") return;
        navigateFromNotification(data);
      },
    );

    return () => sub.remove();
  }, [navRef, phase]);

  useEffect(() => {
    const g = globalThis as any;
    const errorUtils = g.ErrorUtils || g.global?.ErrorUtils;
    if (errorUtils?.getGlobalHandler) {
      const def = errorUtils.getGlobalHandler();
      errorUtils.setGlobalHandler((err: any, fatal: boolean) => {
        SplashScreen.hideAsync().catch(() => {});
        // Sentry.captureException(err, { level: fatal ? 'fatal' : 'error' }); // or Crashlytics.recordError(err)
        def(err, fatal);
      });
    }
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: SPLASH_BG }}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppLinksProvider>
          <SafeAreaProvider>
            <PaperProvider>
              <GlobalProvider>
                <AuthProvider initialSession={(preloadData as any)?.sessionData ?? null}
                >
                  <ProfileProvider>
                    <Animated.View
                      style={[StyleSheet.absoluteFill, contentStyle]}
                    >
                      <NotificationProvider>
                        <RootLayoutNav
                          startupPhase={phase}
                          onAnimationComplete={onSplashAnimationComplete}
                          onContentReady={handleContentReady}
                          preloadData={preloadData} // Pass preloadData to RootLayoutNav
                        />
                      </NotificationProvider>
                    </Animated.View>
                  </ProfileProvider>
                </AuthProvider>
              </GlobalProvider>
            </PaperProvider>
          </SafeAreaProvider>
        </AppLinksProvider>
        <LogoutLoadingModal />
      </GestureHandlerRootView>
    </View>
  );
}
