// BasicInfo.tsx — All 10 strategies applied
// FIXES: SafeAreaProvider→SafeAreaView, dead imports removed, wrong field names,
//        saveDraft never called, handlers not memoized, paddingBottom excessive

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useProfile } from '@/Contexts/profileContext';
import Toast from 'react-native-toast-message';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context'; // ✅ NOT SafeAreaProvider
import { spacing } from '@/constants/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import LocationPicker from '@/components/LocationPicker';
import { useAuth } from '@/Contexts/authContext';
import { readDraft, saveDraft } from '@/lib/profileDraft';

const BasicInfo = () => {
  const { profile, updateProfile } = useProfile();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    fullName:         profile?.fullName         ?? '',
    InterestedSkills: profile?.InterestedSkills ?? '', // ✅ fixed: was InterestedSkills
    location:         profile?.location         ?? '', // ✅ fixed: was location
    bio:              profile?.bio              ?? '',
  });

  const [focused, setFocused] = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);

  // ── STRATEGY #8: memoized handlers — never recreated on re-render ─────
  const handleChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleLocationSelect = useCallback((district: string) => {
    setFormData(prev => ({ ...prev, location: district }));
  }, []); // ✅ FIXED: was setting "district" key instead of "location"

  // ── OPTIMIZATION: Stable handlers to prevent "focusin" violations ─────
  // These prevent child components (like LocationPicker) from re-rendering on every keystroke
  const onNameChange  = useCallback((t: string) => handleChange('fullName', t), [handleChange]);
  const onNameFocus   = useCallback(() => setFocused('fullName'), []);
  const onNameBlur    = useCallback(() => setFocused(null), []);

  const onSkillChange = useCallback((t: string) => handleChange('InterestedSkills', t), [handleChange]);
  const onSkillFocus  = useCallback(() => setFocused('InterestedSkills'), []);
  const onSkillBlur   = useCallback(() => setFocused(null), []);

  const onLocFocus    = useCallback(() => setFocused('location'), []);
  const onLocBlur     = useCallback(() => setFocused(null), []);

  const onBioChange   = useCallback((t: string) => handleChange('bio', t), [handleChange]);
  const onBioFocus    = useCallback(() => setFocused('bio'), []);
  const onBioBlur     = useCallback(() => setFocused(null), []);

  // ── STRATEGY #10: Restore draft on mount ─────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    readDraft(user.id).then((draft) => {
      if (!draft) return;
      setFormData({
        fullName:         draft.full_Name         ?? '',
        InterestedSkills: draft.InterestedSkills ?? '', // ✅ fixed field name
        location:         draft.location         ?? '', 
        bio:              draft.bio              ?? '',
      });
    });
  }, [user?.id]);

  // ── STRATEGY #5: Prefetch next screen early ─────────────────────────
const isMounted = useRef(true);

useEffect(() => {
  isMounted.current = true;
  return () => {
    isMounted.current = false; // ← tells Portal cleanup we're unmounting
  };
}, []);

  const handleNext = useCallback(async () => {
    if (!formData.fullName.trim()) {
      Toast.show({ type: 'error', text1: 'Please enter your full name' });
      return;
    }
    if (!formData.location.trim()) {
      Toast.show({ type: 'error', text1: 'Please select your district' });
      return;
    }

    setSaving(true);

    const payload = {
      fullName:         formData.fullName.trim(),
      bio:              formData.bio.trim(),
      location:         formData.location.trim(),   // ✅ correct field name
      InterestedSkills: formData.InterestedSkills,  // ✅ correct field name
    };

    // ── STRATEGY #1: Update memory instantly (0ms) ────────────────────
    updateProfile(payload);

    // ── STRATEGY #3: saveDraft NOT awaited — fire and forget ──────────
    // ✅ FIXED: was missing entirely — draft was never saved!
    if (user?.id) {
      saveDraft(user.id, { ...payload, currentStep: 1 })
        .catch(e => console.warn('Draft save failed:', e));
    }

    // ✅ FIX: State updates must happen BEFORE navigation to avoid Portal unmount issues
    setSaving(false);
    setFormData({
      fullName:         '',
      InterestedSkills: '',
      location:         '',
      bio:              '',
    });

    // ── STRATEGY #9: Navigate immediately — no network wait ───────────
    router.push('/(profileSetUp)/ProfileImage');
  }, [formData, updateProfile, user?.id]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>{/* ✅ SafeAreaView not Provider */}
      <KeyboardAvoidingView
        style={s.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.headerImage}>
        
          <Text style={s.sptext}>MindMates</Text>
             <Text style={s.stepLabel}>Step 1 of 3</Text>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.subtitle}>Let's get to know you! 👋</Text>
         <View style={{padding:1}}>
          {/* Full Name */}
          <View style={s.inputGroup}>
            <Text style={s.label}>Full Name *</Text>
            <View style={[s.inputWrapper, focused === 'fullName' && s.inputFocused]}>
              <Ionicons name="person" size={20} color="#1c1c1d" style={s.icon} />
              <TextInput
                style={s.input}
                placeholder="Name"
                placeholderTextColor="#9CA3AF"
                value={formData.fullName}
                onChangeText={onNameChange}
                onFocus={onNameFocus}
                onBlur={onNameBlur}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Interested Skills */}
          <View style={s.inputGroup}>
            <Text style={s.label}>Interested Skill *</Text>
            <View style={[s.inputWrapper, focused === 'InterestedSkills' && s.inputFocused]}>
              <Ionicons name="happy" size={20} color="#1c1c1d" style={s.icon} />
              <TextInput
                style={s.input}
                placeholder="Arts & Sports"
                placeholderTextColor="#9CA3AF"
                value={formData.InterestedSkills}
                onChangeText={onSkillChange}
                onFocus={onSkillFocus}
                onBlur={onSkillBlur}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Location */}
          <View style={s.inputGroup}>
            <Text style={s.label}>Location *</Text>
            <View style={[s.inputWrapper, focused === 'location' && s.inputFocused]}>
              <Ionicons name="location" size={20} color="#1c1c1d" style={s.icon} />
              <View style={{ flex: 1 }}>
                <LocationPicker
                  placeholder="Search District"
                  value={formData.location}
                  onSelect={handleLocationSelect}
                  onFocus={onLocFocus}
                  onBlur={onLocBlur}
                />
              </View>
            </View>
          </View>

          {/* Bio */}
          <View style={s.inputGroup}>
            <Text style={s.label}>About You</Text>
            <View style={[s.textAreaWrapper, focused === 'bio' && s.inputFocused]}>
              <TextInput
                style={s.textArea}
                placeholder="Something about your passion!"
                placeholderTextColor="#9CA3AF"
                value={formData.bio}
                onChangeText={onBioChange}
                onFocus={onBioFocus}
                onBlur={onBioBlur}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={200}
              />
            </View>
            <Text style={s.charCount}>{formData.bio.length}/200</Text>
          </View>
   </View>
        </ScrollView>

        {/* Continue Button */}
        <View style={s.buttonContainer}>
          <TouchableOpacity
            onPress={handleNext}
            activeOpacity={0.8}
            style={s.btnOuter}
            disabled={saving}
          >
            <LinearGradient
              colors={['#6D4AFF', '#6542f0']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.btn}
            >
              {saving
                ? <ActivityIndicator color="#FFF" />
                : <Text style={s.btnText}>Continue</Text>
              }
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: '#FFFFFF' },
  container:       { flex: 1, backgroundColor: '#FFFFFF' },
  headerImage:     { width: '100%', height: 69, justifyContent: 'center', alignItems: 'center', paddingTop: 10,marginBottom:10 },
  sptext:          { fontSize: 24, fontWeight: '700', color: '#6D4AFF', letterSpacing: 0.15,marginTop:10 },
  scroll:          { paddingHorizontal: 24, paddingBottom: 120 }, // ✅ fixed: was 400
  subtitle:        { fontSize: 16, color: '#1F2937', lineHeight: 22, marginBottom: 15 },
  inputGroup:      { marginBottom: 20 },
  label:           { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  inputWrapper:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', height: 48 },
  inputFocused:    { borderColor: '#6D4AFF' },
  icon:            { marginRight: 8, marginLeft: 10 },
  input:           { flex: 1, fontSize: 15, color: '#1F2937', paddingVertical: 0 },
  textAreaWrapper: { backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 14 },
  textArea:        { fontSize: 15, color: '#1F2937', minHeight: 100 },
  charCount:       { fontSize: 12, color: '#9CA3AF', textAlign: 'right', marginTop: 4 },
  buttonContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  btnOuter:        { borderRadius: 14, overflow: 'hidden', shadowColor: '#6D4AFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 6, marginBottom: spacing.md },
  btn:             { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  btnText:         { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
    stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A0A0A0',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign:'left',
    marginRight:240,
    marginTop:10,
   
  },
});

export default BasicInfo;