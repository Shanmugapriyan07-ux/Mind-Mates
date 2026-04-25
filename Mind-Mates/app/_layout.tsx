
// import { useEffect, useRef } from 'react';
// import { InteractionManager, Platform } from 'react-native';
// import { Stack, SplashScreen, useRouter, useSegments } from 'expo-router';
// import { AuthProvider, useAuth }       from '@/Contexts/authContext';
// import { ProfileProvider, useProfile } from '@/Contexts/profileContext';
// import { SafeAreaProvider }            from 'react-native-safe-area-context';
// import { PaperProvider }               from 'react-native-paper';
// import GlobalProvider                  from '@/lib/GlobalProvider';
// import { GestureHandlerRootView }      from 'react-native-gesture-handler';

// SplashScreen.preventAutoHideAsync();

// function RootLayoutNav() {
//   const { isLoggedIn, authStatus, deleteType } = useAuth();
//   const { profile, profileStatus }             = useProfile();
//   const segments = useSegments();
//   const router   = useRouter();

//   const hasRouted    = useRef(false);
//   const prevLoggedIn = useRef(false);
//   const rafRef       = useRef<number | null>(null);

//   // Cancel any pending navigation RAF on unmount
//   useEffect(() => () => {
//     if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
//   }, []);

//   // Hide splash once auth is settled
//   useEffect(() => {
//     if (authStatus === 'loading') return;
//     if (!isLoggedIn) { SplashScreen.hideAsync(); return; }
//     if (profileStatus !== 'idle' && profileStatus !== 'loading') SplashScreen.hideAsync();
//   }, [authStatus, isLoggedIn, profileStatus]);

//   // Reset hasRouted on fresh login
//   useEffect(() => {
//     if (isLoggedIn && !prevLoggedIn.current) hasRouted.current = false;
//     prevLoggedIn.current = isLoggedIn;
//   }, [isLoggedIn]);

//   // ── Mobile-safe navigate helper ──────────────────────────────
//   // On mobile the Expo Router navigator is driven by the RN bridge (async).
//   // router.replace() called before the navigator is ready = silent no-op ❌
//   //
//   // Strategy:
//   //   1. requestAnimationFrame — waits for next paint cycle (web + mobile)
//   //   2. InteractionManager.runAfterInteractions — waits for all animations/
//   //      transitions to finish (mobile only). This is what React Navigation
//   //      uses internally for navigate-on-mount. ✅
//   const safeReplace = (path: string) => {
//     if (rafRef.current != null) cancelAnimationFrame(rafRef.current);

//     if (Platform.OS === 'web') {
//       // Web: RAF is sufficient
//       rafRef.current = requestAnimationFrame(() => {
//         router.replace(path as any);
//         rafRef.current = null;
//       });
//     } else {
//       // Native: wait for animations + bridge to settle
//       rafRef.current = requestAnimationFrame(() => {
//         InteractionManager.runAfterInteractions(() => {
//           router.replace(path as any);
//           rafRef.current = null;
//         });
//       });
//     }
//   };

//   // ── Main routing logic ────────────────────────────────────────
//   useEffect(() => {
//     if (authStatus === 'loading') return;

//     const inAuth  = segments[0] === '(auth)';
//     const inTabs  = segments[0] === '(tabs)';
//     const inSetup = segments[0] === '(profileSetUp)';
//     const inSub   = segments[0] === 'subScreens';
//     const inCb    = segments[0] === 'auth' || segments[0] === 'auth-callback';

//     if (!isLoggedIn) {
//       hasRouted.current = false;
//       if (inAuth || inCb) return;

//       // deleteType determines destination:
//       //   'logout'  → Login  (they know their password, can re-enter)
//       //   'deleted' → Onboarding (account gone — treat as brand new user)
//       //   null      → Onboarding (never logged in)
//       if (deleteType === 'logout') {
//         safeReplace('/(auth)/Login');
//       } else {
//         safeReplace('/(auth)/onBoarding');
//       }
//       return;
//     }

//     if (profileStatus === 'idle' || profileStatus === 'loading') return;
//     if (hasRouted.current) return;

//     if (profileStatus === 'not_found') {
//       hasRouted.current = true;
//       if (!inSetup) safeReplace('/(profileSetUp)/BasicInfo');
//       return;
//     }
//     if (profileStatus === 'error') return;

//     const isComplete = profile?.isProfileComplete === true;
//     hasRouted.current = true;
//     if (isComplete) {
//       if (!inTabs && !inSub) safeReplace('/(tabs)/home');
//     } else {
//       if (!inSetup) safeReplace('/(profileSetUp)/BasicInfo');
//     }
//   }, [isLoggedIn, authStatus, profileStatus, profile?.isProfileComplete, deleteType]);

//   return (
//     <GestureHandlerRootView style={{ flex: 1 }}>
//       <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
//         <Stack.Screen name="(auth)"         />
//         <Stack.Screen name="(tabs)"         />
//         <Stack.Screen name="(profileSetUp)" />
//         <Stack.Screen name="subScreens"     />
//         <Stack.Screen name="auth-callback"  />
//       </Stack>
//     </GestureHandlerRootView>
//   );
// }

// export default function RootLayout() {
//   return (
//     <GestureHandlerRootView style={{ flex: 1 }}>
//       <SafeAreaProvider>
//         <PaperProvider>
//           <GlobalProvider>
//             <AuthProvider>
//               <ProfileProvider>
//                 <RootLayoutNav />
//               </ProfileProvider>
//             </AuthProvider>
//           </GlobalProvider>
//         </PaperProvider>
//       </SafeAreaProvider>
//     </GestureHandlerRootView>
//   );
// }

// app/_layout.tsx
// Mobile-safe navigation after logout / account delete.
//
// WHY MOBILE NEEDS SPECIAL HANDLING:
//   On web, React re-renders synchronously within the same event loop tick.
//   router.replace() in a useEffect fires reliably.
//
//   On mobile (React Native), bridge communication is async.
//   The Expo Router navigator may not be mounted yet when authStatus changes.
//   Calling router.replace() before the navigator is ready = silent no-op ❌
//
// THE FIX — router.replace inside requestAnimationFrame:
//   RAF defers the call until after the current paint cycle.
//   By then, the navigator is guaranteed to be mounted and ready. ✅
//   This is the same pattern used by React Navigation's navigate-on-mount.
//
// ROUTING STRATEGY:
//   deleteType='logout'  → /(auth)/login      (account exists, can re-login)
//   deleteType='deleted' → /(auth)/onBoarding  (account gone, fresh start)
//   deleteType=null      → /(auth)/onBoarding  (first visit)

import { useEffect, useRef } from 'react';
import { InteractionManager, Platform } from 'react-native';
import { Stack, SplashScreen, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth }       from '@/Contexts/authContext';
import { ProfileProvider, useProfile } from '@/Contexts/profileContext';
import { SafeAreaProvider }            from 'react-native-safe-area-context';
import { PaperProvider }               from 'react-native-paper';
import GlobalProvider                  from '@/lib/GlobalProvider';
import { GestureHandlerRootView }      from 'react-native-gesture-handler';
import { AppLinksProvider } from '@/Contexts/AppLinksContexts';
import { NavigationContainer } from '@react-navigation/native';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { isLoggedIn, authStatus, deleteType } = useAuth();
  const { profile, profileStatus }             = useProfile();
  const segments = useSegments();
  const router   = useRouter();

  const hasRouted    = useRef(false);
  const prevLoggedIn = useRef(false);
  const rafRef       = useRef<number | null>(null);

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

      // deleteType determines destination:
      //   'logout'  → Login  (they know their password, can re-enter)
      //   'deleted' → Onboarding (account gone — treat as brand new user)
      //   null      → Onboarding (never logged in)
      if (deleteType === 'logout') {
        safeReplace('/(auth)/Login');
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
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
       <AppLinksProvider>
      <SafeAreaProvider>
        <PaperProvider>
          <GlobalProvider>
            <AuthProvider>
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