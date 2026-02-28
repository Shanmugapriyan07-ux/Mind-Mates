import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import icons from '@/constants/icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { account, login } from '@/lib/appwrite';
import { useGlobalContext } from '@/lib/GlobalProvider';
import { router } from 'expo-router';
import {getCurrentUser} from '@/lib/appwrite';

import { SafeAreaView } from 'react-native-safe-area-context';
import { API_BASE_URL } from '@/config';
import Toast from 'react-native-toast-message';
import { useFormValidation } from '@/hooks/useFormValidation';
import { signupValidationRules } from '@/utils/validationRules';
import z from 'zod';
import { ID } from 'react-native-appwrite';
import { Ionicons } from '@expo/vector-icons';


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

const SignupScreen = () => {
  const { refetch, loading: globalLoading, isLogged } = useGlobalContext();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

    const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string }>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

   const {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateAll,
  } = useFormValidation(
    { name: '', email: '', password: '', confirmPassword: '' },
    signupValidationRules
  ) as {
    values: { name: string; email: string; password: string; confirmPassword: string };
    errors: { name?: string; email?: string; password?: string; confirmPassword?: string };
    touched: { name?: boolean; email?: boolean; password?: boolean; confirmPassword?: boolean };
    handleChange: (field: string, value: string) => void;
    handleBlur: (field: string) => void;
    validateAll: () => boolean;
  }

  // ✅ FIXED: Optimized canSubmit - only recalculates when necessary
  const canSubmit = useMemo(() => {
    const hasValues = 
      values.name?.trim() &&
      values.email?.trim() &&
      values.password &&
      values.confirmPassword;

    const hasNoErrors = 
      !errors.name &&
      !errors.email &&
      !errors.password &&
      !errors.confirmPassword;

    return hasValues && hasNoErrors && !loading;
  }, [
    values.name,
    values.email,
    values.password,
    values.confirmPassword,
    errors.name,
    errors.email,
    errors.password,
    errors.confirmPassword,
    loading,
  ]);

  // ✅ FIXED: Memoized handlers to prevent re-creation
  const handleNameChange = useCallback((text:any) => {
    handleChange('name', text);
  }, [handleChange]);

  const handleEmailChange = useCallback((text:any) => {
    handleChange('email', text);
  }, [handleChange]);

  const handlePasswordChange = useCallback((text:any) => {
    handleChange('password', text);
  }, [handleChange]);

  const toggleConfirmPassword = useCallback((text:any) => {
    handleChange('confirmPassword', text);
  }, [handleChange]);

  // Blur handlers
  const handleNameBlur = useCallback(() => {
    handleBlur('name');
  }, [handleBlur]);

  const handleEmailBlur = useCallback(() => {
    handleBlur('email');
  }, [handleBlur]);

  const handlePasswordBlur = useCallback(() => {
    handleBlur('password');
  }, [handleBlur]);

  const toggleConfirmBlur = useCallback(() => {
    handleBlur('confirmPassword');
  }, [handleBlur]);

  // Toggle password visibility



  // ✅ FIXED: Correct signup logic (was calling login session instead!)
  const handleSignup = useCallback(async () => {
    console.log('🚀 Signup started');

    // Validate all fields
    const isValid = validateAll();
    
    if (!isValid) {
      console.log('❌ Validation failed');
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please fix the errors in the form',
      });
      return;
    }

    setLoading(true);

    try {
      const name = values.name.trim();
      const email = values.email.trim().toLowerCase();
      const password = values.password.trim();

      console.log('📝 Creating account for:', email);

      const APPWRITE_ID = Platform.OS === 'web' ? 'unique()' : ID.unique();

      // ✅ STEP 1: CREATE NEW ACCOUNT (This was missing!)
      const newUser = await account.create(
        ID.unique(),
        email,
        password,
        name
      );

      console.log('✅ Account created:', newUser.$id);

      // ✅ STEP 2: AUTO-LOGIN (Create session)
      const session = await account.createEmailPasswordSession(email, password);
      console.log('✅ Session created:', session.$id);

      // ✅ STEP 3: Get user data and JWT
      const [jwtObj, user] = await Promise.all([
        account.createJWT(),
        account.get(),
      ]);

      console.log('✅ User data fetched:', user.email);

      // ✅ STEP 4: Save auth data to AsyncStorage
      await AsyncStorage.multiSet([
        ['userToken', jwtObj.jwt],
        ['userId', user.$id],
        ['userName', user.name],
        ['userEmail', user.email],
        ['sessionId', session.$id],
        ['isLoggedIn', 'true'],
      ]);

      console.log('✅ Auth data saved');

      // ✅ STEP 5: Background sync with backend (non-blocking)
      fetch(`${API_BASE_URL}/auth/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwtObj.jwt}`,
        },
        body: JSON.stringify({
          appwriteId: user.$id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerification,
          action: 'SIGNUP',
        }),
      })
        .then(() => console.log('✅ Backend sync complete'))
        .catch(e => console.warn('⚠️ Backend sync failed:', e));

      // ✅ STEP 6: Update global state
       refetch();

      // ✅ STEP 7: Navigate to profile setup
      console.log('✅ Navigating to BasicInfo');
      router.replace('/(profileSetUp)/BasicInfo');

    } catch (error:any) {
      console.error('❌ Signup error:', error);

      let errorMessage = 'Signup failed. Please try again.';

      // Handle specific Appwrite errors
      if (error.code === 409) {
        Toast.show({
          type: 'error',
          text1: 'Account Already Exists',
          text2: 'An account with this email already exists.',
        });
        return;
      } else if (error.code === 400) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Input',
          text2: 'Invalid email or password format.',
        });
      } else if (error.message) {
        errorMessage = error.message;
      }

      Toast.show({
        type: 'error',
        text1: 'Signup Failed',
        text2: errorMessage,
      });

    } finally {
      setLoading(false);
    }
  }, [validateAll, values, refetch]);


  const handleGoogleSignIn = async () => {
    if (googleLoading) return;

    setGoogleLoading(true);

    try {
      const session = await login();
      if (!session) {
        Toast.show({
          type: 'error',
          text1: 'Login Failed',
          text2: 'Unable to create session',
        });
        return;
      }
      const [user, jwtObj] = await Promise.all([
       account.get(),
        account.createJWT(),
      ]);

      const isNewUser = user.registration === user.accessedAt;

      // Save to AsyncStorage
      await AsyncStorage.multiSet([
        ['userToken', jwtObj.jwt],
        ['userId', user.$id],
        ['userName', user.name],
        ['userEmail', user.email],
        ['sessionId', session.$id],
        ['isLoggedIn', 'true'],
      ]);

      // Update global state
      await refetch();

      // Show success toast
      Toast.show({
        type: 'success',
        text1: isNewUser ? 'Account Created! 🎉' : 'Welcome Back! 👋',
        text2: user.name || user.email,
      });

      // Navigate
      router.replace(isNewUser 
        ? "/(profileSetUp)/BasicInfo" 
        : "/(tabs)/home"
      );

    } catch (error:any) {
      console.error('Google sign-in error:', error);
      if (!error.message?.includes('cancel')) {
        Toast.show({
          type: 'error',
          text1: 'Login Failed',
          text2: error.message || 'An unexpected error occurred',
        });
      }
    } finally {
      setGoogleLoading(false);
    }


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
          behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
>
        
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View
              style={
                styles.content
                }
            >
              {/* ✅ Gradient Text Title - Mobile Only */}
               <View style={styles.headerImage} >
                
                      <Text style={styles.sptext}>Signup</Text>        
                    </View>
             

              {/* Form Card */}
              <View style={styles.card}>
                

                {/* Name Input */}
                <View style={styles.inputGroup}>
                  <Text style={{...styles.label, marginTop: SPACING.lg} }>Full Name</Text>
                  <View style={[
                    styles.inputWrapper,
                    focused === 'name' && styles.inputWrapperFocused
                  ]}>
                    <Ionicons name="person" size={18} color="#7134da" style={{ marginRight: 8,marginTop: 5 }} />
                    <TextInput
                      style={styles.input}
                      placeholder="John Doe"
                      placeholderTextColor="#9CA3AF"
                      value={values.name}
                      onChangeText={handleNameChange}
                      autoCapitalize="words"
                      editable={!loading && !googleLoading}
                      onFocus={() => setFocused('name')}
                      onBlur={handleNameBlur}
                      selectionColor="#6366F1"
                    />
                  </View>
                  {touched.name && errors.name && (
                    <Text style={styles.errorText}>{errors.name}</Text>
                  )}
                </View>

                {/* Email Input */}
                <View style={styles.inputGroup}>
                  <Text style={{...styles.label, marginTop: SPACING.lg} }>Email</Text>
                  <View style={[
                    styles.inputWrapper,
                    focused === 'email' && styles.inputWrapperFocused
                  ]}>
                   <Ionicons name="mail" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.input}
                      placeholder="your@email.com"
                      placeholderTextColor="#9CA3AF"
                      value={values.email}
                      onChangeText={handleEmailChange}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      editable={!loading && !googleLoading}
                      onFocus={() => setFocused('email')}
                      onBlur={handleEmailBlur}
                      selectionColor="#6366F1"
                    nativeID="email"
                    autoComplete="email" // 👈 Helps Autofill
  textContentType="emailAddress" // 👈 Add this for the ID attribute
 
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
                    focused === 'password' && styles.inputWrapperFocused
                  ]}>
                    <Ionicons name="key" size={18} color="#7134da" style={{ marginRight: 8,marginTop: 5 }} />
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor="#9CA3AF"
                      value={values.password}
                      onChangeText={handlePasswordChange}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      editable={!loading && !googleLoading}
                      onFocus={() => setFocused('password')}
                      onBlur={handlePasswordBlur}
                      selectionColor="#6366F1"
                      autoComplete="new-password"
                    />
                     <View>
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Text style={styles.eyeIcon}>
                       {showPassword ? <Ionicons name="eye" size={18} color="#323134" /> : <Ionicons name="eye-off" size={18} color="#323134" />}} 
                      </Text>
                    </TouchableOpacity>
                  </View>
                    </View>
                       {touched.password && errors.password && (
                                           <Text style={styles.errorText}>{errors.password}</Text>
                                            )}
                    </View>
                  
                

                {/* Confirm Password Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <View style={[
                    styles.inputWrapper,
                    focused === 'confirmPassword' && styles.inputWrapperFocused
                  ]}>
                    <Text style={styles.inputIcon}>✅</Text>
                    <TextInput
                      style={styles.input}
                      placeholder='••••••••'
                      placeholderTextColor="#9CA3AF"
                      value={values.confirmPassword}
                      onChangeText={toggleConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      editable={!loading && !googleLoading}
                      onFocus={() => setFocused('confirmPassword')}
                      onBlur={() => toggleConfirmBlur}
                      selectionColor="#6366F1"
                      autoComplete="new-password"
                    />
                    <View>
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <Text style={styles.eyeIcon}>
                        {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                      </Text>
                    </TouchableOpacity>
                  
                </View>
                    </ View>
                      {touched.confirmPassword && errors.confirmPassword && (
                                           <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                                            )}
                    </View>
                    

                {/* Signup Button */}
                <TouchableOpacity
                  style={[styles.gradientButtonContainer, (loading || googleLoading) && styles.buttonDisabled]}
                  onPress={handleSignup}
                  disabled={loading || googleLoading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#7C3AED', '#A855F7']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.gradientButtonText}>Create Account</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Google Sign-In */}
                <TouchableOpacity
                  style={styles.googleButton}
                  onPress={handleGoogleSignIn}
                  disabled={loading || googleLoading}
                  activeOpacity={0.8}
                >
                  {googleLoading ? (
                    <ActivityIndicator color="#1F2937" size="small" />
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

                {/* Terms */}
                <Text style={styles.termsText}>
                  By signing up, you agree to our{' '}
                  <Text style={styles.termsLink}>Terms</Text> and{' '}
                  <Text style={styles.termsLink}>Privacy</Text>
                </Text>
              </View>

              {/* Login Link */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => router.replace('/(auth)/Login')}>
                  <Text style={styles.footerLink}>Login</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // ✅ SafeAreaView must have flex
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
    flexDirection:'column'
  },
    sptext:{
  fontSize: 20,
    fontWeight: '600',
    alignSelf:'center',
    justifyContent:'center', 
    marginRight:25,
    color:'#893feb',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
  },
    headerImage: {
        zIndex:10,  
    width: '100%',
    height: 40,
    justifyContent:'center',
    alignItems:'center',                            
     padding: 10,
     shadowColor: '#bdbdbd',
    elevation: 6,
     marginTop: 0, 
     flexDirection:'row',
     position:'relative',
     backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.md,
    paddingTop: 0,
    paddingBottom: 16,
  },
  content: {
    flex: 1,
  },

  // Title with gradient
  titleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily:'Poppins-Bold',
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: SPACING.md,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    position:'relative',
   marginTop:60,
  },


  // Input Group
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: SPACING.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    height: 44,
  },
  inputWrapperFocused: {
    borderColor: '#6366F1',
    backgroundColor: '#FFFFFF',
  },
  inputIcon: {
    fontSize: 16,
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 6,
    marginRight: -6,
  },
  eyeIcon: {
    fontSize: 16,
  },

  // Gradient Button
  gradientButtonContainer: {
    borderRadius: 24,
    elevation:8,
    marginTop: SPACING.xl,
    marginBottom: 16,
    overflow: 'hidden',
  },
  gradientButton: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
   
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: '#6B7280',
  },

  // Google Button
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  googleIconContainer: {
    width: 18,
    height: 18,
    marginRight: SPACING.sm,
  },
  googleIcon: {
    width: 18,
    height: 18,
  },
  googleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },

  // Terms
  termsText: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  termsLink: {
    color: '#6366F1',
    fontWeight: '600',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  footerText: {
    fontSize: 13,
    color: '#6B7280',
  },
  footerLink: {
    fontSize: 13,
    color: '#6366F1',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
}

export default SignupScreen;