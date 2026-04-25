// app/auth.tsx — OAuth callback handler (Supabase version)
// TEACHING: When Google redirects back to your app via deep link
// this screen handles the code exchange automatically
//
// Deep link: mindmates://auth?code=xxx
// Supabase: exchanges code → JWT session automatically ✅

import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth }  from '@/Contexts/authContext';
import images       from '@/constants/images';

export default function AuthCallback() {
  const params        = useLocalSearchParams();
  const { loginWithOAuth } = useAuth();
  const pulseAnim     = useRef(new Animated.Value(0.4)).current;
  const hasProcessed  = useRef(false);

  // Pulse animation
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
    ])).start();
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // TEACHING: Supabase OAuth on mobile works differently from Appwrite:
      //
      // Appwrite flow: deep link had userId + secret → createSession(userId, secret)
      // Supabase flow: deep link has code → exchangeCodeForSession(code)
      //
      // The 'code' is a one-time PKCE code from Google
      // Supabase exchanges it for an access_token + refresh_token
      // Session is stored in AsyncStorage automatically ✅

      const code = params.code as string | undefined;

      if (code) {
        // Exchange PKCE code for session
        console.log('🔑 Exchanging OAuth code for session...');
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw new Error(error.message);
        console.log('✅ OAuth session created:', data.user?.email);
      } else {
        // No code — maybe user already has a session (tab reopened etc.)
        console.log('ℹ️ No code param — checking existing session');
        await loginWithOAuth();
      }

      // _layout.tsx will detect authStatus = 'authenticated'
      // and redirect to (tabs)/home automatically ✅
      // No need to router.replace() here

    } catch (err: any) {
      console.error('❌ Auth callback error:', err?.message);
      // If callback fails, redirect to login
    
    }
  };

  return (
    <View style={s.container}>
      <Animated.View style={[s.logoWrap, { opacity: pulseAnim }]}>
        <Image source={images.splash} style={s.logo} resizeMode="contain" />
      </Animated.View>
      <Text style={s.text}>Signing you in...</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  logoWrap:  { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  logo:      { width: 48, height: 48 },
  text:      { fontSize: 15, color: '#6B7280' },
});