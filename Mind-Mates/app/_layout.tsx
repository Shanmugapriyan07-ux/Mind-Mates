import { useEffect, useRef } from 'react';
import { Stack, SplashScreen, useRouter, useSegments } from 'expo-router';
import GlobalProvider, { useGlobalContext } from '@/lib/GlobalProvider';
import { PaperProvider } from 'react-native-paper';
import { AuthProvider } from '@/Contexts/authContext';
import { ProfileProvider, useProfile } from '@/Contexts/profileContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SettingsProvider } from '@/Contexts/settingsContext';

SplashScreen.preventAutoHideAsync();

export function RootLayoutNav() {
  const { isLogged, loading } = useGlobalContext();
  const { profile, isLoading: profileLoading } = useProfile();
  const segments = useSegments();
  const router = useRouter();
  const navigationHandled = useRef(false); // ← prevents double navigation

  // Hide splash only when BOTH auth AND profile are loaded
  useEffect(() => {
    if (!loading && !profileLoading) {
      SplashScreen.hideAsync();
    }
  }, [loading, profileLoading]);

  // ✅ SINGLE navigation effect — no conflicts
  useEffect(() => {
    // Wait for both auth AND profile to finish loading
    if (loading || profileLoading) return;

    const inAuthGroup     = segments[0] === '(auth)';
    const inTabsGroup     = segments[0] === '(tabs)';
    const inProfileSetup  = segments[0] === '(profileSetUp)';
    const inSubScreens    = segments[0] === 'subScreens';

    console.log('🔍 Nav check:', { isLogged, segments, profileComplete: profile?.isProfileComplete });

    if (!isLogged) {
      // Not logged in → go to auth (only if not already there)
      if (!inAuthGroup) {
        router.replace('/(auth)/Welcome');
      }
      return;
    }

    // Logged in — check profile completion
    const profileComplete = Boolean(profile?.isProfileComplete);

    if (!profileComplete) {
      // Profile incomplete → go to setup (only if not already there)
      if (!inProfileSetup) {
        router.replace('/(profileSetUp)/BasicInfo');
      }
      return;
    }

    // Profile complete → go to tabs (only if in wrong place)
    if (!inTabsGroup && !inSubScreens && !inProfileSetup) {
      router.replace('/(tabs)/home');
    }

  // ✅ segments intentionally LEFT OUT of deps — prevents infinite loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLogged, loading, profileLoading, profile?.isProfileComplete]);

  if (loading || profileLoading) {
    return null; // Splash is visible
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(profileSetUp)" />
      <Stack.Screen name="subScreens" />
      <Stack.Screen
        name="modal"
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GlobalProvider>
        <AuthProvider>
          <ProfileProvider>
              <SettingsProvider>
            <PaperProvider>
              <RootLayoutNav />
            </PaperProvider>
            </SettingsProvider>
          </ProfileProvider>
        </AuthProvider>
      </GlobalProvider>
    </SafeAreaProvider>
  );
}
















