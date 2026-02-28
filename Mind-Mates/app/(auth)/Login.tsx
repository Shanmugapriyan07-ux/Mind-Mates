import { useAuth } from '@/Contexts/authContext';
import React, { useState,useCallback, useMemo } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import images from '@/constants/images';
import MaskedView from '@react-native-masked-view/masked-view';
import { API_BASE_URL } from '@/config';
import Toast from 'react-native-toast-message';
import { useFormValidation } from '@/hooks/useFormValidation';
import { loginValidationRules } from '@/utils/validationRules';
import z from 'zod';
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

const LoginScreen = () => {
  const { refetch, loading: globalLoading, isLogged } = useGlobalContext();


  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);


  const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);


  const { login: contextLogin } = useAuth();

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




  const handleLogin = useCallback(async () => {
    // Validate all fields
    const isValid = validateAll();
    
    if (!isValid) {
      return;
    }
    setLoading(true);

    try {
      
      const email = values.email.trim().toLowerCase();
      const password = values.password.trim();
    
      const session = await account.createEmailPasswordSession(email, password);
      const [jwtObj, user] = await Promise.all([
        account.createJWT(),
        account.get(),
      ]);

      // Save auth data
      await AsyncStorage.multiSet([
        ['userToken', jwtObj.jwt],
        ['userId', user.$id],
        ['userName', user.name],
        ['userEmail', user.email],
        ['sessionId', session.$id],
        ['isLoggedIn', 'true'],
      ]);
 
       const isNewUser = user.registration === user.accessedAt;
      // Background sync
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
          action: 'LOGIN',
        }),
      }).catch(e => console.warn('Background sync failed'));

       refetch();
      router.replace(isNewUser 
              ? "/(profileSetUp)/BasicInfo" 
              : "/(tabs)/home"
            );
    } catch (error: any) {
  
      if (error instanceof z.ZodError){ 
     const fieldErrors: any = {};
        error.issues.forEach((e) => {
          fieldErrors[e.path[0]] = e.message;
        });
        setValidationErrors(fieldErrors);
      } else {
        // Handle Appwrite errors
        Toast.show({ type: 'error', text1: 'Error', text2: 'Invalid credentials' });
      }
    } finally {
      setIsSubmitting(false);
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


    //     fetch('http://10.0.2.2:8080/api/auth/google-sync', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     Authorization: `Bearer ${jwtObj.jwt}`,
    //   },
    //   body: JSON.stringify({
    //     appwriteId: user.$id,
    //     email: user.email,
    //     name: user.name,
    //     provider: 'google',
    //   }),
    // }).catch(e => console.warn('Sync failed'));
 
       // Update global state
       await refetch();
       await new Promise(resolve => setTimeout(resolve, 200));
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

                <View style={styles.logoCircle}>
                  <Image 
                    source={images.Welcome} 
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
                </View>
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
                    <Ionicons name="mail" size={18} color="#7134da" style={{ marginRight: 8,marginTop: 5 }} />
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
                   <Ionicons name="key" size={18} color="#7134da" style={{ marginRight: 8,marginTop: 5 }} />
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
                <TouchableOpacity style={styles.forgotButton}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
               
                {/* Login Button */}
                <View>
                <TouchableOpacity
                  style={[styles.loginButtonContainer, (loading || googleLoading) && styles.buttonDisabled]}
                  onPress={handleLogin}
                  disabled={loading || googleLoading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#7C3AED', '#A855F7']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.loginButtonGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
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
              </View>

              {/* Sign Up Link */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => router.replace('/(auth)/Signup')}>
                  <Text style={styles.footerLink}>Sign Up</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  )};
  

const styles = StyleSheet.create({
  // ✅ Fixed: SafeAreaView must have flex
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  content: {
    flex: 1,
  },

  // Logo Section
  logoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#FFFFFF',
    
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
    shadowColor: '#9d2de8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
    top:-4,
    
  },
  logoImage: {
    width: 95,
    height: 95,
  },      
  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: SPACING.md,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    marginTop: 0,
  },


  // Input Group
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
    borderColor: '#8138ff', // ✅ Added border color on focus
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
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
    flexDirection:'column'
  },


  // Forgot Password
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.lg,
  },
  forgotText: {
    fontSize: 13,
    color: '#6366F1',
    fontWeight: '600',
  },

  // Login Button
  loginButtonContainer: {
    borderRadius: 24,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
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
    marginTop: SPACING.lg,
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




// FIXED VERSION:
// ────────────────────────────────────────────────────────────────────────────
// const handleGoogleSignIn = async () => {
//   if (googleLoading) return;
//   setGoogleLoading(true);
//   console.log('🚀 Starting Google Sign In');      // ✅ Added logs

//   try {
//     console.log('📍 Step 1...');                   // ✅ Added logs
//     const session = await login();
//     if (!session) throw new Error('Failed to create session');
//     console.log('✅ Step 1 complete');              // ✅ Added logs

//     console.log('📍 Step 2...');                   // ✅ Added logs
//     const [jwtObj, user] = await Promise.all([
//       account.createJWT(),
//       account.get(),
//     ]);
//     console.log('✅ Step 2 complete');              // ✅ Added logs

//     console.log('📍 Step 3...');                   // ✅ Added logs
//     await contextLogin(
//       { id: user.$id, name: user.name, email: user.email },
//       jwtObj.jwt,
//       session.$id
//     );
//     console.log('✅ Step 3 complete');              // ✅ Added logs

//     console.log('📍 Step 4...');                   // ✅ Added logs
//     await refetch();
//     console.log('✅ Step 4 complete');              // ✅ Added logs

//     console.log('📍 Step 5...');                   // ✅ Added logs
//     await new Promise(resolve => setTimeout(resolve, 200));  // ✅ Fixed: Now awaited
//     console.log('✅ Step 5 complete');              // ✅ Added logs

//     console.log('📍 Step 6...');                   // ✅ Added logs
//     router.replace('/Screens/Matchscreen');
//     console.log('✅ Step 6 complete');              // ✅ Added logs
//     console.log('🎉 Complete!');                    // ✅ Added logs

//   } catch (error: any) {
//     console.error('❌ ERROR:', error);              // ✅ Added logs
//     if (!error.message?.includes('dismissed') && !error.message?.includes('cancel')) {
//       Alert.alert('Login Failed', error.message || 'Google sign-in failed.');
//     }
//   } finally {
//     setGoogleLoading(false);                       // ✅ Now runs at correct time
//     console.log('🔄 Loading reset');                // ✅ Added logs
//   }
// };
// */
