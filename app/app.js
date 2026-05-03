// App.js
// Boot sequence:
//   1. configureGoogleSignIn() — called immediately, synchronously
//   2. useAuth() restores Supabase session from AsyncStorage
//   3. Renders blank screen during init (no flicker)
//   4. Routes to LoginScreen or your main app based on auth state

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { configureGoogleSignIn } from './config/googleAuth';
import { useAuth } from './hooks/useAuth';
import Google from './(auth)/Google'
import home from './(tabs)/home'; // Your main app screen

// Configure IMMEDIATELY — before any render cycle.
// This is what makes login feel instant: Google SDK is ready before user taps.
configureGoogleSignIn();

function AppContent() {
  const { user, status, signOut } = useAuth();

  // During session restore: render nothing (white screen, no flicker)
  // Do NOT show a spinner here — it causes a flash on every app open
  if (status === 'initializing') {
    return <View style={styles.blank} />;
  }

  if (status === 'authenticated' && user) {
    return <home user={user} onSignOut={signOut} />;
  }

  return <Google/>;
}

export default function App() {
  return <AppContent />;
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: '#FFFFFF' },
});