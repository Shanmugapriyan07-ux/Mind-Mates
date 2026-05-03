
import { useEffect, useRef } from 'react';
import {InteractionManager, Platform, View } from 'react-native';
import { Stack, SplashScreen, useRouter, useSegments, router } from 'expo-router';
import { AuthProvider, useAuthh }       from '@/Contexts/authContext';
import { ProfileProvider, useProfile } from '@/Contexts/profileContext';
import { SafeAreaProvider }            from 'react-native-safe-area-context';
import { PaperProvider }               from 'react-native-paper';
import GlobalProvider                  from '@/lib/GlobalProvider';
import { GestureHandlerRootView }      from 'react-native-gesture-handler';
import { AppLinksProvider } from '@/Contexts/AppLinksContexts';
import { useAppReady } from '@/hooks/Useappready';
import AnimatedSplash from '@/components/animatedSplash';
import { useAnimatedStyle, useSharedValue, withTiming,Easing  } from 'react-native-reanimated';
import { useBadgeSync } from '@/hooks/useBadgeSync';

SplashScreen.preventAutoHideAsync();

const CONTENT_FADE_MS = 280;

function RootLayoutNav() {
  const { isLoggedIn, authStatus, deleteType, user } = useAuthh();
  const { profile, profileStatus }             = useProfile();
  const segments = useSegments();
  const router   = useRouter();
    const { phase, preloadData, onAnimationComplete } = useAppReady();

  useBadgeSync(
    user?.id ?? null,
    (chatId) => router.push({ pathname: '/subScreens/chatScreen', params: { chatId } }),
    ()       => router.push('/(tabs)/chat'),
  );

  const hasRouted    = useRef(false);
  const prevLoggedIn = useRef(false);
  const rafRef       = useRef<number | null>(null);

    const contentOpacity = useSharedValue(0);

      useEffect(() => {
        if (phase === 'ready') {
          contentOpacity.value = withTiming(1, {
            duration: CONTENT_FADE_MS,
            easing:   Easing.out(Easing.ease),
          });
        }
      }, [phase]);
    
      const contentStyle = useAnimatedStyle(() => ({
        opacity: contentOpacity.value,
        // Disable touches while invisible — prevents accidental taps during transition
        pointerEvents: contentOpacity.value < 0.1 ? 'none' : 'auto',
      } as any));

  // Cancel any pending navigation RAF on unmount
  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  // Hide splash once auth is settled
  useEffect(() => {
    if (authStatus === 'loading') return;
    if (!isLoggedIn) { SplashScreen.hideAsync(); return; }
    if (profileStatus !== 'idle' && profileStatus !== 'loading') SplashScreen.hideAsync();
  }, [authStatus, isLoggedIn, profileStatus]);

  // Reset hasRouted on fresh login
  useEffect(() => {
    if (isLoggedIn && !prevLoggedIn.current) hasRouted.current = false;
    prevLoggedIn.current = isLoggedIn;
  }, [isLoggedIn]);

  // ── Mobile-safe navigate helper ──────────────────────────────
  // On mobile the Expo Router navigator is driven by the RN bridge (async).
  // router.replace() called before the navigator is ready = silent no-op ❌
  //
  // Strategy:
  //   1. requestAnimationFrame — waits for next paint cycle (web + mobile)
  //   2. InteractionManager.runAfterInteractions — waits for all animations/
  //      transitions to finish (mobile only). This is what React Navigation
  //      uses internally for navigate-on-mount. ✅
  const safeReplace = (path: string) => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);

    if (Platform.OS === 'web') {
      // Web: RAF is sufficient
      rafRef.current = requestAnimationFrame(() => {
        router.replace(path as any);
        rafRef.current = null;
      });
    } else {
      // Native: wait for animations + bridge to settle
      rafRef.current = requestAnimationFrame(() => {
        InteractionManager.runAfterInteractions(() => {
          router.replace(path as any);
          rafRef.current = null;
        });
      });
    }
  };

  // ── Main routing logic ────────────────────────────────────────
  useEffect(() => {
    if (authStatus === 'loading') return;

    const inAuth  = segments[0] === '(auth)';
    const inTabs  = segments[0] === '(tabs)';
    const inSetup = segments[0] === '(profileSetUp)';
    const inSub   = segments[0] === 'subScreens';
    const inCb    = segments[0] === 'auth' || segments[0] === 'auth-callback';



    if (!isLoggedIn) {
      hasRouted.current = false;
      if (inAuth || inCb) return;

      if (deleteType === 'logout') {
        safeReplace('/(auth)/Google');
      } else {
        safeReplace('/(auth)/onBoarding');
      }
      return;
    }

    if (profileStatus === 'idle' || profileStatus === 'loading') return;
    if (hasRouted.current) return;

    if (profileStatus === 'not_found') {
      hasRouted.current = true;
      if (!inSetup) safeReplace('/(profileSetUp)/BasicInfo');
      return;
    }
    if (profileStatus === 'error') return;

    const isComplete = profile?.isProfileComplete === true;
    hasRouted.current = true;
    if (isComplete) {
      if (!inTabs && !inSub) safeReplace('/(tabs)/home');
    } else {
      if (!inSetup) safeReplace('/(profileSetUp)/BasicInfo');
    }
  }, [isLoggedIn, authStatus, profileStatus, profile?.isProfileComplete, deleteType]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppLinksProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
        <Stack.Screen name="(auth)"         />
        <Stack.Screen name="(tabs)"         />
        <Stack.Screen name="(profileSetUp)" />
        <Stack.Screen name="subScreens"     />
        <Stack.Screen name="auth-callback"  />
      </Stack>
    </AppLinksProvider>
     {phase === 'animating' && (
              <AnimatedSplash onAnimationComplete={onAnimationComplete} />
            )}
    
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const { preloadData } = useAppReady();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
     <AppLinksProvider>
       <SafeAreaProvider>
         <PaperProvider>
           <GlobalProvider>
             <AuthProvider initialSession={preloadData?.sessionData ?? null}>
               <ProfileProvider>
                <RootLayoutNav />
               </ProfileProvider>
             </AuthProvider>
           </GlobalProvider>
         </PaperProvider>
        </SafeAreaProvider>
      </AppLinksProvider>
    </GestureHandlerRootView>
  );
}
