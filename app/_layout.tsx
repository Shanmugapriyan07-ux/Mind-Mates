import {
  hideLogoutLoader,
  LogoutLoadingModal,
} from "@/components/logoutLoadingModel";
import { configureGoogleSignIn } from "@/config/googleAuth";
import { AppLinksProvider } from "@/Contexts/AppLinksContexts";
import { AuthProvider } from "@/Contexts/authContext";
import { ProfileProvider } from "@/Contexts/profileContext";
import { useAuthBoot } from "@/hooks/useAuthBoot";
import { usePresence } from "@/hooks/usePresence";
import { useRealtimeManager } from "@/hooks/useRealtimeManager";
import GlobalProvider from "@/lib/GlobalProvider";
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
import { InteractionManager, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

const CONTENT_FADE_MS = 220;
const STORAGE_KEY_ONBOARDING = "hso";

SplashScreen.preventAutoHideAsync().catch(() => {});

let _profileCompleting = false;
export function setProfileCompleting(v: boolean) {
  _profileCompleting = v;
}

// ─── resolveTarget ────────────────────────────────────────────────────────
function resolveTarget(
  phase: string,
  isProfileComplete: boolean,
  seg: string | undefined,
): string | null {
  switch (phase) {
    case "booting":
    case "reading_storage":
    case "logging_out":
    case "deleting":
      return null;

    case "unauthenticated":
      return seg === "(auth)" ? null : "/(auth)/onBoarding";

    case "profile_incomplete":
      if (isProfileComplete) return null;
      if (seg === "(profileSetUp)") return null;
      return "/(profileSetUp)/BasicInfo";

    case "authenticated":
      if (seg === "(profileSetUp)") return "/(tabs)/home";
      return seg === "(tabs)" || seg === "subScreens" ? null : "/(tabs)/home";

    case "logging_out":
    case "deleting":
      // Initiate navigation immediately to prevent the "blink" stay on current screen
      return "/(auth)/onBoarding";

    default:
      return null;
  }
}
// ─── Module-level guard — never resets, survives all remounts ───────────────

// ─── RootLayoutNav ────────────────────────────────────────────────────────
interface RootLayoutNavProps {
  startupPhase: string;
  onAnimationComplete: () => void;
  onContentReady: () => void;
}

function RootLayoutNav({ startupPhase, onAnimationComplete, onContentReady }: RootLayoutNavProps) {
  usePresence();
  useRealtimeManager();
  useAuthBoot();

  const router            = useRouter();
  const segments          = useSegments();
  const phase             = useAuthStore(selPhase);
  const isProfileComplete = useAuthStore(selIsProfileComplete);
  const lastTarget        = useRef<string>('');
  const navTimer          = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => onContentReady(), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 6_000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const isAuthSegment = segments[0] === '(auth)';
    const isExiting = phase === 'unauthenticated' || phase === 'logging_out' || phase === 'deleting';
    if (isAuthSegment && isExiting) {
      const t = setTimeout(() => hideLogoutLoader(), 300);
      return () => clearTimeout(t);
    }
  }, [segments, phase]);

  useEffect(() => {
    if (phase === 'authenticated' || phase === 'profile_incomplete') {
      AsyncStorage.setItem(STORAGE_KEY_ONBOARDING, '1').catch(() => {});
    }
  }, [phase]);

  useEffect(() => () => { if (navTimer.current) clearTimeout(navTimer.current); }, []);

  useEffect(() => {
    const isHome = segments[0] === '(tabs)';
    if (phase === 'booting' || (phase === 'authenticated' && isHome)) {
      lastTarget.current = '';
    }
  }, [phase, segments]);

  useEffect(() => {
    if (_profileCompleting) return;
    const seg    = segments[0] as string | undefined;
    const target = resolveTarget(phase, isProfileComplete, seg);
    if (!target) return;
    if (target === lastTarget.current) return;
    lastTarget.current = target;
    log.nav(`[Layout] "${phase}" → "${target}"`);

    const isLoggingIn  = phase === 'authenticated' || phase === 'profile_incomplete';
    const isLoggingOut = phase === 'unauthenticated' || phase === 'logging_out' || phase === 'deleting';

    const doNavigate = () => {
      try {
        if (isLoggingOut) {
          try { if (router.canDismiss()) router.dismissAll(); } catch {}
          setTimeout(() => { try { router.replace(target as any); } catch {} }, 50);
        } else {
          router.replace(target as any);
        }
      } catch {
        if (navTimer.current) clearTimeout(navTimer.current);
        navTimer.current = setTimeout(() => {
          try { router.replace(target as any); } catch {}
        }, 300);
      }
    };

    if (Platform.OS === 'web' || isLoggingIn || isLoggingOut) {
      doNavigate();
      setTimeout(() => useAuthStore.getState().setTransitioning(false), 800);
    } else {
      if (navTimer.current) clearTimeout(navTimer.current);
      navTimer.current = setTimeout(() => {
        InteractionManager.runAfterInteractions(doNavigate);
      }, 0);
    }
  }, [phase, isProfileComplete, segments]);

  const showSplash =
    startupPhase === 'booting' ||
    startupPhase === 'preloading' ||
    startupPhase === 'splash_animating';

  // ✅ Stack lives HERE inside RootLayoutNav — this is what expo-router needs
  // RootLayout wraps providers around this, navRef is hoisted up via registerNavRef
  return (
    <>
      <Stack
        screenOptions={{
          headerShown:    false,
          animation:      'none',
          freezeOnBlur:   true,
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(profileSetUp)" />
        <Stack.Screen name="subScreens" />
      </Stack>

      {/* Splash overlays on top of Stack — only visible during boot */}
      {showSplash && <AnimatedSplash onComplete={onAnimationComplete} />}
    </>
  );
}

let _notifSub: Notifications.Subscription | null = null;

export default function RootLayout() {
  const { phase, preloadData, onSplashAnimationComplete, onContentReady } = useStartup();
  const navRef         = useNavigationContainerRef();
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    if (phase === 'transitioning' || phase === 'done') {
      contentOpacity.value = withTiming(1, {
        duration: CONTENT_FADE_MS,
        easing:   Easing.out(Easing.ease),
      });
    }
  }, [phase]);

  const contentStyle = useAnimatedStyle(() => ({
    flex:          1,
    opacity:       contentOpacity.value,
    pointerEvents: (contentOpacity.value < 0.05 ? 'none' : 'auto') as any,
  }));

  const handleContentReady = useCallback(() => onContentReady(), [onContentReady]);

  useEffect(() => {
    if (!__DEV__) return;
    const task = InteractionManager.runAfterInteractions(() => {
      if (Platform.OS !== 'web') {
        setTimeout(async () => { try { await activateKeepAwakeAsync(); } catch {} }, 500);
      }
    });
    return () => task.cancel();
  }, []);

  useEffect(() => { try { configureGoogleSignIn(); } catch {} }, []);

  useEffect(() => {
    // Register navRef so deepLinkService can check isReady()
    registerNavRef(navRef);
    // Check if app was cold-started from a notification
    handleColdStartNotification();

    // Single listener — never duplicated thanks to _notifSub guard
    if (_notifSub) return;
    _notifSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as unknown as NotificationData;

      // Filter internal badge notifications
      if (!data?.url || data?.type === 'badge_sync') {
        console.log('[Layout] ignoring internal notif:', data?.type);
        return;
      }

      console.log('[Layout] notification tapped:', JSON.stringify(data));
      navigateFromNotification(data);
    });
    // No cleanup — listener must survive for entire app session
  }, []);

  useEffect(() => {
    const g = globalThis as any;
    const errorUtils = g.ErrorUtils || g.global?.ErrorUtils;
    if (errorUtils?.getGlobalHandler) {
      const def = errorUtils.getGlobalHandler();
      errorUtils.setGlobalHandler((err: any, fatal: boolean) => {
        log.error(`Global JS Error [Fatal: ${fatal}]:`, err);
        SplashScreen.hideAsync().catch(() => {});
        def(err, fatal);
      });
    }
    log.info('RootLayout mounted');
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppLinksProvider>
          <SafeAreaProvider>
            <PaperProvider>
              <GlobalProvider>
                <AuthProvider initialSession={(preloadData as any)?.sessionData ?? null}>
                  <ProfileProvider>
                    {/*
                      Animated.View wraps RootLayoutNav which contains the Stack.
                      This is the correct layering — providers wrap the navigator,
                      not the other way around.
                    */}
                    <Animated.View style={[StyleSheet.absoluteFill, contentStyle]}>
                      <NotificationProvider>
                        <RootLayoutNav
                          startupPhase={phase}
                          onAnimationComplete={onSplashAnimationComplete}
                          onContentReady={handleContentReady}
                        />
                      </NotificationProvider>
                    </Animated.View>
                  </ProfileProvider>
                </AuthProvider>
              </GlobalProvider>
            </PaperProvider>
          </SafeAreaProvider>
        </AppLinksProvider>
      </GestureHandlerRootView>
      <LogoutLoadingModal />
    </View>
  );
}