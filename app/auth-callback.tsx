import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import images       from '@/constants/images';

export default function AuthCallbackScreen() {
  const params    = useLocalSearchParams();
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const processed = useRef(false);

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
    ])).start();
  }, []);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // TEACHING: After Google OAuth, Supabase redirects to:
      //   mindmates://auth-callback#access_token=...&refresh_token=...
      // OR:
      //   mindmates://auth-callback?code=...  (PKCE flow)
      //
      // The hash fragment (#access_token=...) is the IMPLICIT flow
      // The query param (?code=...) is the PKCE flow
      //
      // We need to handle BOTH because Supabase uses different flows
      // depending on how signInWithOAuth was called ✅

      // Check for PKCE code
      const code = params.code as string | undefined;
      if (code) {
        console.log('🔑 PKCE code found — exchanging for session');
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) console.error('❌ Code exchange failed:', error.message);
        else console.log('✅ PKCE session created');
        return;
      }

      // Check for implicit flow tokens in URL hash
      // On web, Supabase detects hash automatically via detectSessionInUrl
      // On native, we need to handle it manually
      const accessToken  = params.access_token  as string | undefined;
      const refreshToken = params.refresh_token as string | undefined;

      if (accessToken && refreshToken) {
        console.log('🔑 Implicit tokens found — setting session');
        const { error } = await supabase.auth.setSession({
          access_token:  accessToken,
          refresh_token: refreshToken,
        });
        if (error) console.error('❌ Set session failed:', error.message);
        else console.log('✅ Implicit session created');
        return;
      }

      // No params — session may already exist
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log('✅ Session already exists:', session.user.email);
      } else {
        console.warn('⚠️ No session found after OAuth callback');
      }

      // _layout.tsx watches onAuthStateChange
      // It will route to (tabs)/home automatically once session is set ✅

    } catch (err: any) {
      console.error('❌ Auth callback error:', err?.message);
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



// // app/auth-callback.tsx  ← FILE NAME MUST MATCH Supabase redirect URL
// // Handle Google OAuth return — mindmates://auth-callback
// //
// // SETUP: Supabase Dashboard → Auth → URL Configuration
// //   Add redirect URL: mindmates://auth-callback
// //   (must match exactly what's in googleLogin() redirectTo param)
// //
// // Also add to app.json:
// //   "scheme": "mindmates"


// import { useEffect, useRef } from 'react';
// import { View, Text, StyleSheet, Animated, Image } from 'react-native';
// import { useLocalSearchParams } from 'expo-router';
// import { supabase } from '@/lib/supabase';
// import images       from '@/constants/images';

// export default function AuthCallbackScreen() {
//   const params    = useLocalSearchParams();
//   const pulseAnim = useRef(new Animated.Value(0.4)).current;
//   const processed = useRef(false);

//   useEffect(() => {
//     Animated.loop(Animated.sequence([
//       Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
//       Animated.timing(pulseAnim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
//     ])).start();
//   }, []);

//   useEffect(() => {
//     if (processed.current) return;
//     processed.current = true;
//     handleCallback();
//   }, []);

//   const handleCallback = async () => {
//     try {
//       // After Google OAuth, Supabase redirects to:
//       //   mindmates://auth-callback#access_token=...&refresh_token=...
//       // OR:
//       //   mindmates://auth-callback?code=...  (PKCE flow)
//       //
//       // The hash fragment (#access_token=...) is the IMPLICIT flow
//       // The query param (?code=...) is the PKCE flow
//       //
//       // We need to handle BOTH because Supabase uses different flows
//       // depending on how signInWithOAuth was called ✅

//       // Check for PKCE code
//       const code = params.code as string | undefined;
//       if (code) {
//         console.log('🔑 PKCE code found — exchanging for session');
//         const { error } = await supabase.auth.exchangeCodeForSession(code);
//         if (error) console.error('❌ Code exchange failed:', error.message);
//         else console.log('✅ PKCE session created');
//         return;
//       }

//       // Check for implicit flow tokens in URL hash
//       // On web, Supabase detects hash automatically via detectSessionInUrl
//       // On native, we need to handle it manually
//       const accessToken  = params.access_token  as string | undefined;
//       const refreshToken = params.refresh_token as string | undefined;

//       if (accessToken && refreshToken) {
//         console.log('🔑 Implicit tokens found — setting session');
//         const { error } = await supabase.auth.setSession({
//           access_token:  accessToken,
//           refresh_token: refreshToken,
//         });
//         if (error) console.error('❌ Set session failed:', error.message);
//         else console.log('✅ Implicit session created');
//         return;
//       }

//       // No params — session may already exist
//       const { data: { session } } = await supabase.auth.getSession();
//       if (session) {
//         console.log('✅ Session already exists:', session.user?.email);
//       } else {
//         console.warn('⚠️ No session found after OAuth callback');
//       }

//       // _layout.tsx watches onAuthStateChange
//       // It will route to (tabs)/home automatically once session is set ✅

//     } catch (err: any) {
//       console.error('❌ Auth callback error:', err?.message);
//     }
//   };


//   return (
//     <View style={s.container}>
//       <Animated.View style={[s.logoWrap, { opacity: pulseAnim }]}>
//         <Image source={images.splash} style={s.logo} resizeMode="contain" />
//       </Animated.View>
//       <Text style={s.text}>Signing you in...</Text>
//     </View>
//   );
// }

// const s = StyleSheet.create({
//   container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
//   logoWrap:  { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
//   logo:      { width: 48, height: 48 },
//   text:      { fontSize: 15, color: '#6B7280' },
// });
