import { useState, useEffect, useCallback, useMemo } from 'react';

import {
  View, Text, Image, StyleSheet, TextInput, TouchableOpacity,
  StatusBar, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';

import { prewarmGoogleOAuth, googleLogin as supabaseGoogleLogin } from '@/lib/supabase';
import { router }            from 'expo-router';
import { SafeAreaView }      from 'react-native-safe-area-context';
import { LinearGradient }    from 'expo-linear-gradient';
import Toast                 from 'react-native-toast-message';
import { useFormValidation } from '@/hooks/useFormValidation';
import { signupValidationRules } from '@/utils/validationRules';
import Ionicons              from '@expo/vector-icons/Ionicons';
import { useAuthh }           from '@/Contexts/authContext';
import React from 'react';
import icons from '@/constants/icons';


const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export default function SignupScreen() {
  const { register } = useAuthh();

  const [showPassword,        setShowPassword]        = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading,             setLoading]             = useState(false);
  const [googleLoading,       setGoogleLoading]       = useState(false);
  const [focused,             setFocused]             = useState<string | null>(null);

  const { values, errors, touched, handleChange, handleBlur, validateAll } =
    useFormValidation(
      { name: '', email: '', password: '', confirmPassword: '' },
      signupValidationRules,
    ) as any;

  const canSubmit = useMemo(() => {
    const filled = values.name?.trim() && values.email?.trim() && values.password && values.confirmPassword;
    const noErr  = !errors.name && !errors.email && !errors.password && !errors.confirmPassword;
    return filled && noErr && !loading;
  }, [values, errors, loading]);

  useEffect(() => { prewarmGoogleOAuth(); }, []);
  
  const handleSignup = useCallback(async () => {
    if (!validateAll() || loading) return;
    setLoading(true);

    try {
      await register(
        values.email.trim().toLowerCase(),
        values.password.trim(),
        values.name.trim(),
      );
      // Success: onAuthStateChange fires → _layout routes to BasicInfo ✅
      // No router.replace() needed here

    } catch (error: any) {
      const msg = error?.message ?? '';

      if (msg === 'CHECK_EMAIL') {
        Toast.show({
          type: 'info',
          text1: 'Check your email! 📧',
          text2: 'Click the confirmation link we sent you, then login.',
        });
        setTimeout(() => router.replace('/(auth)/Login'), 2000);
        return;
      }

      Toast.show({
        type: 'error',
        text1: 'Signup Failed',
        text2: msg || 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [validateAll, loading, register, values]);

  // ── GOOGLE SIGNUP ─────────────────────────────────────────
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

  const field = (
    name: string, label: string, placeholder: string,
    opts: {
      icon: any; keyboardType?: any; autoCapitalize?: any;
      secure?: boolean; showToggle?: boolean; onToggle?: () => void; showing?: boolean;
    }
  ) => (
    <View style={s.inputGroup}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.inputWrapper, focused === name && s.inputFocused]}>
        <Ionicons name={opts.icon} size={18} color="#6D4AFF" style={{ marginRight: 8 }} />
        <TextInput
          style={s.input} placeholder={placeholder} placeholderTextColor="#9CA3AF"
          value={values[name]} onChangeText={t => handleChange(name, t)}
          onBlur={() => handleBlur(name)} onFocus={() => setFocused(name)}
          keyboardType={opts.keyboardType ?? 'default'}
          autoCapitalize={opts.autoCapitalize ?? 'none'}
          secureTextEntry={opts.secure && !opts.showing}
          editable={!loading && !googleLoading}
          selectionColor="#6D4AFF"
        />
        {opts.showToggle && (
          <TouchableOpacity onPress={opts.onToggle} style={s.eyeBtn}>
            <Ionicons name={opts.showing ? 'eye' : 'eye-off'} size={18} color="#323134" />
          </TouchableOpacity>
        )}
      </View>
      {touched[name] && errors[name] && <Text style={s.errorText}>{errors[name]}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={s.container}>
        <KeyboardAvoidingView style={s.kbView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="#6D4AFF" style={{ top: 27,left:5}} />
            </TouchableOpacity>

            <Text style={s.title}>Sign Up</Text>

            <View style={s.card}>
              {field('name', 'Full Name', 'John Doe', { icon: 'person', autoCapitalize: 'words' })}
              {field('email', 'Email', 'your@email.com', { icon: 'mail', keyboardType: 'email-address' })}
              {field('password', 'Password', '••••••••', {
                icon: 'key', secure: true, showToggle: true,
                showing: showPassword, onToggle: () => setShowPassword(!showPassword),
              })}
              {field('confirmPassword', 'Confirm Password', '••••••••', {
                icon: 'checkmark-circle', secure: true, showToggle: true,
                showing: showConfirmPassword, onToggle: () => setShowConfirmPassword(!showConfirmPassword),
              })}

              {/* Submit */}
              <TouchableOpacity
                style={[s.submitBtn, (!canSubmit || loading || googleLoading) && s.btnDisabled]}
                onPress={handleSignup} disabled={!canSubmit || loading || googleLoading} activeOpacity={0.8}
              >
                <LinearGradient colors={['#6D4AFF','#6441f0']} start={{ x:0,y:0 }} end={{ x:1,y:0 }} style={s.gradient}>
                  {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={s.submitText}>Create Account</Text>}
                </LinearGradient>
              </TouchableOpacity>

              {/* Divider */}
              <View style={s.divider}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>or</Text>
                <View style={s.dividerLine} />
              </View>

              {/* Google */}
              <TouchableOpacity style={s.googleBtn} onPress={handleGoogleSignIn}
                disabled={loading || googleLoading} activeOpacity={0.8}>
                {googleLoading ? <ActivityIndicator color="#1F2937" size="small" /> : (
                  <>
                    <View style={s.googleIconWrap}><Image source={icons.google} style={s.googleIcon} resizeMode="contain" /></View>
                    <Text style={s.googleBtnText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={s.footer}>
              <Text style={s.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/Login')}>
                <Text style={s.footerLink}>Login</Text>
              </TouchableOpacity>
            </View>

           

          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea:      { flex: 1, backgroundColor: '#FFFFFF' },
  container:     { flex: 1, backgroundColor: '#FFFFFF' },
  kbView:        { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: SPACING.md, paddingBottom: 16 },
  title:         { fontSize: 22, fontWeight: '700', color: '#6D4AFF', alignSelf: 'center',marginTop: 7 },
  card:          { backgroundColor: '#FFFFFF', borderRadius: SPACING.md, padding: 20, marginTop: 5 },
  inputGroup:    { marginBottom: 4 },
  label:         { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: SPACING.sm },
  inputWrapper:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1,marginBottom: 6, borderColor: '#E5E7EB', paddingHorizontal: 12, height: 44 },
  inputFocused:  { borderColor: '#6366F1', backgroundColor: '#FFFFFF' },
  input:         { flex: 1, fontSize: 15, color: '#1F2937', paddingVertical: 0 },
  eyeBtn:        { padding: 6, marginRight: -6 },
  errorText:     { fontSize: 12, color: '#EF4444', marginTop: 4 },
  submitBtn:     { borderRadius: 24, marginBottom: 17, overflow: 'hidden', marginTop: 32 },
  gradient:      { height: 48, alignItems: 'center', justifyContent: 'center' },
  submitText:    { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  btnDisabled:   { opacity: 0.5 },
  divider:       { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  dividerLine:   { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText:   { marginHorizontal: 12, fontSize: 12, color: '#6B7280' },
  googleBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 40, height: 48, borderWidth: 1, borderColor: '#E5E7EB' },
  googleIconWrap:{ width: 18, height: 20, marginRight: SPACING.sm },
  googleIcon:    { width: 20, height: 20 },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  footer:        { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  footerText:    { fontSize: 13, color: '#6B7280' },
  footerLink:    { fontSize: 13, color: '#6366F1', fontWeight: '700', textDecorationLine: 'none' },
  terms:         { fontSize: 12, color: '#6B7280', textAlign: 'center', lineHeight: 16, top: 6 },
  termsLink:     { color: '#6366F1', fontWeight: '600', textDecorationLine: 'underline', },
});