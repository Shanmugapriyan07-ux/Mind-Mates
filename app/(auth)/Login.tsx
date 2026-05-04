// auth/login.tsx

import React, { useState,useCallback, useMemo, useEffect, memo } from 'react';
import icons from '@/constants/icons';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { googleLogin, prewarmGoogleOAuth } from '@/lib/supabase';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import images from '@/constants/images';
import Toast from 'react-native-toast-message';
import { useFormValidation } from '@/hooks/useFormValidation';
import { loginValidationRules } from '@/utils/validationRules';
import { Ionicons } from '@expo/vector-icons';
import GoogleSignInButton from '@/components/Googlesigninbutton';
import { useAuth } from '@/hooks/useAuth';
import { useAuthh } from '@/Contexts/authContext';


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 8px Grid System
const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

// ─── Single Animated Dot ──────────────────────────────────────────────────────
interface LoginScreenProps {
  onAuthenticated?: () => void; // Called after successful login
}

const LoginScreen = memo(({ onAuthenticated }: LoginScreenProps)=> {
  const { isSigningIn, error, signIn, clearError } = useAuth();
  const { login,loginWithOAuth } = useAuthh();


   

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);


  const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);


   const {
    values,
    errors,
    touched,
    isValidating,
    handleChange,
    handleBlur,
    validateAll,
    reset,
  } = useFormValidation(
    { email: '', password: '' },
    loginValidationRules
  ) as {
    values: { email: string; password: string };
    errors: { email?: string; password?: string };
    touched: { email?: boolean; password?: boolean };
    isValidating: boolean;
    handleChange: (field: string, value: string) => void;
    handleBlur: (field: string) => void;
    validateAll: () => boolean;
    reset: () => void;
  };

    const canSubmit = useMemo(() => {
    return (
      values.email.trim() !== '' &&
      values.password !== '' &&
      !errors.email &&
      !errors.password &&
      !loading
    );
  }, [values.email, values.password, errors.email, errors.password, loading]);

  
  const handleEmailChange = useCallback((text:any) => {
    handleChange('email', text);
  }, [handleChange]);

  const handlePasswordChange = useCallback((text:any) => {
    handleChange('password', text);
  }, [handleChange]);

  const handleEmailBlur = useCallback(() => {
    handleBlur('email');
  }, [handleBlur]);

  const handlePasswordBlur = useCallback(() => {
    handleBlur('password');
  }, [handleBlur]);

  useEffect(() => {
    prewarmGoogleOAuth();
  }, []);

 

  
  // ── Email Login ────────────────────────────────────────────────────────
  const handleLogin = useCallback(async () => {
    if (!validateAll() || isSubmitting) return;
    setIsSubmitting(true);
    
    router.prefetch('/(tabs)/home');
    router.prefetch('/(profileSetUp)/BasicInfo');
    router.prefetch('/(auth)/Signup');
    try {
      await login(
        values.email.trim().toLowerCase(),
        values.password.trim(),
      );
      // _layout.tsx detects authStatus = 'authenticated' and routes to home ✅
      // No need to router.replace() here

    } catch (error: any) {
      const msg = error?.message ?? '';

      // CHECK_EMAIL = signup with email confirm ON
      if (msg === 'CHECK_EMAIL') {
        Toast.show({ type: 'info', text1: 'Check your email', text2: 'Click the confirmation link we sent you.' });
        return;
      }

      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: msg || 'Something went wrong.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [validateAll, isSubmitting, login, values.email, values.password]);

  const handleGoogleLogin = useCallback(async () => {
          // googleLogin() handles all logic:
          //   - Shows native account picker
          //   - Exchanges token with Supabase
          //   - Returns null (success/cancel) or error string
          // After success, onAuthStateChange fires → _layout.tsx routes automatically
          await googleLogin();
        }, [googleLogin]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor="#FFFFFF"
      />

      <View style={styles.container}>
        {/* Background */}
        <View style={styles.background} />

        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={
                styles.content
               
              }
            >
              {/* Logo Section */}
            
              <View style={styles.logoSection}>

                  <Image 
                    source={images.splash} 
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
             
                </View>
               
                                
              {/* Form Card */}
              <View style={styles.card}>
              

                {/* Email Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email</Text>
                  <View style={[
                    styles.inputWrapper,
                    focused === "email" && styles.inputWrapperFocused
                  ]}>
                    <Ionicons name="mail" size={18} color="#6D4AFF" style={{ marginRight: 8,marginTop: 5 }} />
                    <TextInput
                      style={styles.input}
                      placeholder="your@email.com"
                      placeholderTextColor="#9CA3AF"
                      value={values.email}
                      onChangeText={handleEmailChange}
                      onBlur={handleEmailBlur}
                      
                      keyboardType="email-address"
                      autoCapitalize="none"
                      editable={!loading && !googleLoading}
                      onFocus={() => setFocused("email")}
                     
                    />
                  </View>
                   {touched.email && errors.email && (
                     <Text style={styles.errorText}>{errors.email}</Text>
                      )}
                </View>
                

                {/* Password Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={[
                    styles.inputWrapper,
                    focused === "password" && styles.inputWrapperFocused
                  ]}>
                   <Ionicons name="key" size={18} color="#6D4AFF" style={{ marginRight: 8,marginTop: 5 }} />
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor="#9CA3AF"
                      value={values.password}
                      onChangeText={handlePasswordChange}
                      onBlur={handlePasswordBlur}
             

                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      editable={!loading && !googleLoading}
                      onFocus={() => setFocused("password")}
                      
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Text style={styles.eyeIcon}>
                        {showPassword ? <Ionicons name="eye" size={18} color="#323134" /> : <Ionicons name="eye-off" size={18} color="#323134" />}
                      </Text>
                    </TouchableOpacity>
                    </View>
                      {touched.password && errors.password && (
                  <Text style={styles.errorText}>{errors.password}</Text>
                        )}
                    </View>
                    
                    
                 
              
                   
                {/* Forgot Password */}
         
               
                {/* Login Button */}
                <View>

                <TouchableOpacity
                  style={[styles.loginButtonContainer, (loading || googleLoading) && styles.buttonDisabled]}
                  onPress={handleLogin}
                  
                  disabled={loading || googleLoading}
                  activeOpacity={0.8}
                 
                >
                  <LinearGradient
                    colors={['#6D4AFF', '#6844f9']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.loginButtonGradient}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#ffffff" size="small" style={{alignSelf:'center'}} />
                    ) : (
                      <Text style={styles.loginButtonText}>Login</Text>
                    )}
                  </LinearGradient>

                </TouchableOpacity>
                            
                </View>

                {/* Divider */}
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>
               
                {/* Google Sign-In */}
                <View style={styles.authSection}>
                  <GoogleSignInButton
                   onPress={handleGoogleLogin}
                   isLoading={loading}
                   disabled={loading}
                 />
       
                 {/* Error message — only shown if non-empty */}
                 {!!error && (
                   <View style={styles.errorContainer}>
                     <Text style={styles.errorText}>{error}</Text>
                   </View>
                 )}
               </View>
                     
              </View>

              {/* Sign Up Link */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>Don't have an account? </Text>
                <Pressable onPress={() => router.push('/(auth)/Signup')}>
                  <Text style={styles.footerLink}>Sign Up</Text>
                </Pressable>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  )});

const styles = StyleSheet.create({
  // ✅ Fixed: SafeAreaView must have flex
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent:'center'
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF', // ✅ Changed from LinearGradient to solid color
  },
  keyboardView: {
    flex: 1,
  },
    authSection: {
    width: "100%",
    alignItems: "center",
  },
  errorContainer: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FEE8E6",
    borderRadius: 8,
    width: "100%",
  },
  errorText: {
    color: "#C5221F",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18, 
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  content: {
    flex: 1,
  },
  logoSection: {
    alignItems: 'center',
    top:-7
  },
  logoCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
    shadowColor: '#6D4AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
    top:-4,
  },
  logoImage: {
    width: 105,
    height: 105,
  },      
  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: SPACING.md,
    padding: 18,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 0,
    bottom:10
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: SPACING.md,
    height: 48,
  },
  inputWrapperFocused: {
    backgroundColor: '#FFFFFF',
    borderColor: '#6D4AFF', // ✅ Added border color on focus
  },
  inputIcon: {
    fontSize: 18,
    marginRight: SPACING.sm,
  },
  input: {
 flex: 1,
    fontSize: 15,
    color: '#1F2937',
    paddingVertical: 0,
  },
  eyeButton: {
    padding: SPACING.sm,
    marginRight: -SPACING.sm,
  },
  eyeIcon: {
    fontSize: 18,
  },


  // Forgot Password


  // Login Button
  loginButtonContainer: {
    borderRadius: 24,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
    marginTop:50,
  },
  loginButtonGradient: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: SPACING.md,
    fontSize: 13,
    color: '#6B7280',
  },

  // Google Button
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 40,
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
   
  },
  googleIconContainer: {
    width: 20,
    height: 20,
    marginRight: SPACING.sm,
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280', // ✅ Changed from rgba to hex
  },
  footerLink: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '700',
    textDecorationLine: 'none',
  },
});

export default LoginScreen;
