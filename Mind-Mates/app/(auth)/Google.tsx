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
import { GoogleAuthSheet } from '@/components/googleAuthSheet';
import icons from '@/constants/icons';
import { googleLogin } from '@/lib/supabase';
import { useOpenLink } from "@/hooks/useOpenLink";
import { useAppLinks } from "@/Contexts/AppLinksContexts";

const { width } = Dimensions.get('window');

// ─── Slide Data ───────────────────────────────────────────────────────────────

// ─── Single Animated Dot ──────────────────────────────────────────────────────


// ─── Main Onboarding ──────────────────────────────────────────────────────────
 function Welcome() {
   const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
     const [sheetVisible, setSheetVisible] = useState(false);
      const [isSubmitting, setIsSubmitting] = useState(false);

  const { openByKey } = useOpenLink();
  const { isStale, refresh } = useAppLinks();

  const tap = useCallback(
    (key: string, name: string) => () => openByKey(key, name),
    [openByKey]
  );

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

      {/* ── Bottom: Black content area ──────────────────────────────────── */}
      <View style={styles.bottomHalf}>

        {/* Dots — always visible, just the active one changes */}

        {/* Animated text content */}
        <Animated.View style={[styles.textBlock]}>
          <Text style={styles.title}>Welcome to our Mindmates!</Text>
          <Text style={styles.subtitle}>
            Sign in with your Google account to get started
            </Text>
        </Animated.View>

        {/* Continue / Get Started button */}
         <TouchableOpacity
                         style={styles.googleButton}
                         //  onContinue={handleGoogleSignIn()}
                          onPress={() => setSheetVisible(true)}
                         disabled={loading || googleLoading}
                         activeOpacity={0.8}
                       >
                         {googleLoading ? (
                           <ActivityIndicator color="#6D4AFF" size="small" />
                         ) : (
                           <>
                             <View style={styles.googleIconContainer}>
                               <Image
                                 source={icons.google}
                                 style={styles.googleIcon}
                                 resizeMode="contain"
                               />
                             </View>
                             <Text style={styles.googleButtonText}>Continue with Google</Text>
                           </>
                         )}
                       </TouchableOpacity>
                             <GoogleAuthSheet
                          visible={sheetVisible}
                      onClose={() => setSheetVisible(false)}
                          onContinue={googleLogin}
                        savedAccount={null}   // pass saved name/email for returning users
                            />
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
