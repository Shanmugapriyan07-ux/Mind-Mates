import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import images from '@/constants/images';
import icons from '@/constants/icons';
import { googleLogin as supabaseGoogleLogin, prewarmGoogleOAuth, signIn } from '@/lib/supabase';
import { useOpenLink } from "@/hooks/useOpenLink";
import { useAppLinks } from "@/Contexts/AppLinksContexts";
import { Toast } from 'react-native-toast-message/lib/src/Toast';
import Googlesigninbutton from '@/components/Googlesigninbutton';
import { useAuth } from '@/hooks/useAuth';

const { width } = Dimensions.get('window');
// ─── Main Onboarding ──────────────────────────────────────────────────────────
 export const  Welcome = () =>{
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { openByKey } = useOpenLink();
  const { isStale, refresh } = useAppLinks();
  const { isSigningIn, error, signIn, clearError } = useAuth();
  const tap = useCallback(
    (key: string, name: string) => () => openByKey(key, name),
    [openByKey]
  );

  const handleGoogleSignIn = useCallback(async () => {
      if (googleLoading) return;
      setGoogleLoading(true);
      try {
        await supabaseGoogleLogin();
      } catch (error: any) {
        const msg = error?.message ?? '';
        if (msg.toLowerCase().includes('cancel') || msg.includes('dismissed')) return;
        Toast.show({ type: 'error', text1: 'Sign In Failed', text2: msg || 'Try again.' });
      } finally {
        setGoogleLoading(false);
        prewarmGoogleOAuth();
      }
    }, [googleLoading]);

  return (
    <SafeAreaView style={styles.container}>

      {/* ── Top: Image area ────────────────────────────────────────────── */}
      <View style={styles.topHalf}>
        <Animated.Image
          source={images.splash}
          style={[styles.image]}
          resizeMode="contain"
        />
      </View>

      <View style={styles.bottomHalf}>
        <Animated.View style={[styles.textBlock]}>
          <Text style={styles.title}>Welcome to our Mindmates!</Text>
          <Text style={styles.subtitle}>
            Sign in with your Google account to get started
            </Text>
        </Animated.View>

         <View style={styles.authSection}>
          <Googlesigninbutton
            onPress={signIn}
            isLoading={isSigningIn}
            disabled={isSigningIn}
          />
 
          {/* Error banner — only shown for real errors, not cancellation */}
          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={clearError} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <Text style={styles.errorDismiss}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
                         
                            <View style={{ bottom: 110, paddingHorizontal: 1 }}>
                              <Text style={{ color: '#cccccc', fontSize: 14, textAlign: 'center' }}>
                                By continuing, you agree to our <TouchableOpacity onPress={tap("TERMS_OF_SERVICE", "Terms of Service")}><Text style={{ color: '#6D4AFF',top:5 }}>Terms of Service</Text></TouchableOpacity> and <TouchableOpacity onPress={tap("PRIVACY_POLICY", "Privacy Policy")}><Text style={{ color: '#6D4AFF',top:5 }}>Privacy Policy</Text></TouchableOpacity> .
                              </Text>
                            </View>

                            <TouchableOpacity onPress={()=> router.push('/(auth)/Login')}>
                              <View>
                                <Text style={{color:'white'}}>
                                  login
                                </Text>
                              </View>
                            </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },

  // ── Top white half ──
  topHalf: {
    height: 340,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 250,
    top: 20,
  },

  // ── Bottom black half ──
  bottomHalf: {
   height:450,
    backgroundColor: '#000000',
    paddingTop: 28,
    paddingHorizontal: 28,
    paddingBottom: 36,
    alignItems: 'center',
  },

  // ── Dots ──
  

  // ── Text ──
  textBlock: {
    alignItems: 'center',
    flex: 1,
  },
   authSection: {
    width: '100%',
    gap: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#B91C1C',
    lineHeight: 18,
  },
  errorDismiss: {
    fontSize: 13,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom:4,
    marginTop:10,
    bottom:9
  },
  subtitle: {
    color: '#cccccc',
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 26,
    bottom:5,
    marginLeft:10,
    marginRight:10
  },
   googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 40,
    height:53,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal:48,
   bottom:120
  },
  googleIconContainer: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleIcon: {
    width: 20,
    height: 20,
    right:5
  },
  googleButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    right:5
  },
});

export default Welcome;


