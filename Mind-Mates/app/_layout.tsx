
import { useEffect } from 'react';
import { Stack, SplashScreen, useRouter, useSegments } from 'expo-router';
import GlobalProvider, { useGlobalContext } from '@/lib/GlobalProvider';
import { PaperProvider } from 'react-native-paper';
import { AuthProvider } from '@/Contexts/authContext';
import { ProfileProvider, useProfile } from '@/Contexts/profileContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Prevent splash from hiding automatically
SplashScreen.preventAutoHideAsync();



export  function RootLayoutNav() {
  const { isLogged, loading } = useGlobalContext();
  const { profile } = useProfile();
  const segments = useSegments();
  const router = useRouter();

useEffect(() => {
  console.log("📍 Current Location:", segments.join('/'));
}, [segments]);
  // ✅ SMART NAVIGATION LOGIC
  // This runs whenever auth state changes
  useEffect(() => {
    if (loading) return; // Wait for auth check

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    const inProfileSetup = segments[0] === '(profileSetUp)';
    const inSubScreens = segments[0] === 'subScreens';

    console.log('🔍 Navigation check:', { isLogged, segments });

    if (isLogged) {
      // ✅ User is logged in

      // Use profile context to determine completion
      const profileComplete = Boolean(profile && profile.isProfileComplete);

      if (!profileComplete) {
        // If we are already in setup, don't redirect (prevents loops)
        if (!inProfileSetup) {
          router.replace('/(profileSetUp)/BasicInfo');
        }
      } else if (!inTabsGroup && !inSubScreens) {
        router.replace('/(tabs)/home');
      }
    } else {
      // ❌ User is logged out
      if (!inAuthGroup) {
        // Redirect to welcome
        router.replace('/(auth)/Welcome');
      }
    }}, [isLogged, loading, segments]);

  // Hide splash when auth is loaded
  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [loading]);

  // Show nothing while loading (splash screen is visible)
  if (loading) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Auth Stack */}
      <Stack.Screen name="(auth)" />
      
      {/* Main App Tabs */}
      <Stack.Screen name="(tabs)" />
      
      {/* Profile Setup Flow */}
      <Stack.Screen name="(profileSetUp)" />

      <Stack.Screen name="subScreens" />      
      {/* Global Modals */}
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
            <PaperProvider>
              <RootLayoutNav />
            </PaperProvider>
          </ProfileProvider>
        </AuthProvider>
      </GlobalProvider>
    </SafeAreaProvider>
  );
}




















