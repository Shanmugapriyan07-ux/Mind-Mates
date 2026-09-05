import LocationPicker from '@/components/LocationPicker';
import { useProfile } from '@/Contexts/profileContext';
import { useRenderCount } from '@/Count';
import { SPACING } from '@/theme/Spacing';
import { ms, s, vs } from '@/utils/scale';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView, Platform,
    ScrollView,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
const Edit = () => {
  const { profile, updateProfile, isLoading: contextLoading } = useProfile();
  const [formData, setFormData] = useState({
    fullName: '', InterestedSkills: '', location: '', bio: '',
  });
  const [focused, setFocused] = useState<string | null>(null);
  const [, setSaving] = useState(false);
    useRenderCount("editprofile");
  useEffect(() => {
    if (profile) {
      const newData = {
        fullName:         profile.fullName         || '',
        InterestedSkills: profile.InterestedSkills || '',
        location:         profile.location         || '',
        bio:              profile.bio              || '',
      };
      if (
        newData.fullName         !== formData.fullName         ||
        newData.InterestedSkills !== formData.InterestedSkills ||
        newData.location         !== formData.location         ||
        newData.bio              !== formData.bio
      ) { setFormData(newData); }
    }
  }, [profile, formData.InterestedSkills, formData.bio, formData.fullName, formData.location]);

  const handleChange = useCallback((field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  }, []);

  const handleLocationSelect = (district: any) => {
    setFormData((prev: any) => ({ ...prev, location: district }));
  };
  const validateForm = useCallback(() => {
    if (!formData.fullName.trim()) {
      Toast.show({ type: 'error', text1: 'Name Required', text2: 'Please enter your full name' });
      return false;
    }
    if (formData.fullName.trim().length < 2) {
      Toast.show({ type: 'error', text1: 'Invalid Name', text2: 'Name must be at least 2 characters' });
      return false;
    }
    if (!formData.InterestedSkills.trim()) {
      Toast.show({ type: 'error', text1: 'Title Required', text2: 'Please enter your professional title' });
      return false;
    }
    return true;
  }, [formData]);
  const handleNext = useCallback(async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      updateProfile({
        fullName:         formData.fullName.trim(),
        InterestedSkills: formData.InterestedSkills.trim(),
        location:         formData.location.trim(),
        bio:              formData.bio.trim(),
      });
      Toast.show({ type: 'success', text1: 'Profile Updated! ✅', text2: 'Your changes have been saved' });
      setTimeout(() => router.replace('/(tabs)/profile'));
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Save Failed', text2: error.message || 'Could not save changes' });
    } finally { setSaving(false); }
  }, [formData, validateForm, updateProfile]);
  if (contextLoading) return (
    <View style={st.loadingContainer}>
      <ActivityIndicator size="large" color="#6D4AFF" />
    </View>
  );
  return (
    <SafeAreaView style={st.safe} edges={['top']}>
    
      <KeyboardAvoidingView
        style={st.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={st.header}>
          <Text style={st.brand}>MindMates</Text>
          <Text style={st.stepLabel}>Edit Profile</Text>
        </View>
        <ScrollView
          contentContainerStyle={st.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={st.subtitle}>Update your information</Text>
          <View style={st.inputGroup}>
            <Text style={st.label}>Full Name *</Text>
            <View style={[st.inputWrapper, focused === 'fullName' && st.inputFocused]}>
              <Ionicons name="person" size={s(18)} color="#6D4AFF" style={st.icon} />
              <TextInput
                style={st.input}
                placeholder="Your full name"
                placeholderTextColor="#9CA3AF"
                value={formData.fullName}
                onChangeText={t => handleChange('fullName', t)}
                onFocus={() => setFocused('fullName')}
                onBlur={() => setFocused(null)}
                autoCapitalize="words"
              />
            </View>
          </View>
          <View style={st.inputGroup}>
            <Text style={st.label}>Interested Skills *</Text>
            <View style={[st.inputWrapper, focused === 'InterestedSkills' && st.inputFocused]}>
              <Ionicons name="happy" size={s(18)} color="#6D4AFF" style={st.icon} />
              <TextInput
                style={st.input}
                placeholder="Arts & Sports"
                placeholderTextColor="#9CA3AF"
                value={formData.InterestedSkills}
                onChangeText={t => handleChange('InterestedSkills', t)}
                onFocus={() => setFocused('InterestedSkills')}
                onBlur={() => setFocused(null)}
                autoCapitalize="words"
              />
            </View>
          </View>
          <View style={st.inputGroup}>
            <Text style={st.label}>Location *</Text>
            <View style={[st.inputWrapper, focused === 'location' && st.inputFocused]}>
              <Ionicons name="location" size={s(18)} color="#6D4AFF" style={st.icon} />
              <View style={{ flex: 1 }}>
                <LocationPicker
                  placeholder="Search District"
                  value={formData.location}
                  onSelect={handleLocationSelect}
                  onFocus={() => setFocused('location')}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </View>
          </View>
          <View style={st.inputGroup}>
            <Text style={st.label}>About You</Text>
            <View style={[st.textAreaWrapper, focused === 'bio' && st.inputFocused]}>
              <TextInput
                style={st.textArea}
                placeholder="Something about your passion!"
                placeholderTextColor="#9CA3AF"
                value={formData.bio}
                onChangeText={t => handleChange('bio', t)}
                onFocus={() => setFocused('bio')}
                onBlur={() => setFocused(null)}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={200}
              />
            </View>
            <Text style={st.charCount}>{formData.bio.length}/200</Text>
          </View>
        </ScrollView>
        <View style={st.buttonContainer}>
          <TouchableOpacity onPress={handleNext} activeOpacity={0.8} style={st.btnOuter}>
            <LinearGradient
              colors={['#6D4AFF', '#6542f0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={st.btn}
            >
              <Text style={st.btnText}>Save</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

Edit.whyDidYouRender = true;
const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  kav:  { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    paddingTop:        vs(16),
    paddingBottom:     vs(10),
    paddingHorizontal: s(22),
    alignItems:        'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  brand: {
    fontSize:      ms(18),
    fontWeight:    '700',
    color:         '#6D4AFF',
    letterSpacing: 0.15,
  },
  stepLabel: {
    fontSize:      ms(11),
    fontWeight:    '600',
    color:         '#A0A0A0',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop:     vs(3),
  },
  scroll: {
    paddingHorizontal: s(22),
    paddingBottom:     vs(80),
  },
  subtitle: {
    fontSize:     ms(15),
    color:        '#1F2937',
    lineHeight:   ms(22),
    marginTop:    vs(10),
    marginBottom: vs(8),
    fontWeight:   '500',
  },
  inputGroup: { marginBottom: SPACING.md },
  label: {
    fontSize:     ms(14),
    fontWeight:   '600',
    color:        '#374151',
    marginBottom: vs(7),
  },
  inputWrapper: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: '#F9FAFB',
    borderRadius:    s(12),
    borderWidth:     1,
    borderColor:     '#E5E7EB',
    minHeight:       vs(48),
    paddingVertical: vs(10),
    paddingRight:    s(8),
  
  },
  inputFocused: {
    borderColor:     '#6D4AFF',
    backgroundColor: '#FAFAFE',
  },
  icon:  { marginHorizontal: s(8) },
  input: {
    flex:            1,
    fontSize:        ms(14),
    color:           '#1F2937',
    paddingVertical: 0,
  },

  textAreaWrapper: {
    backgroundColor: '#F9FAFB',
    borderRadius:    s(12),
    borderWidth:     1,
    borderColor:     '#E5E7EB',
    padding:         s(16),
  },
  textArea: {
    fontSize:  ms(14),
    color:     '#1F2937',
    minHeight: vs(110),       
  },
  charCount: {
    fontSize:  ms(10),
    color:     '#9CA3AF',
    textAlign: 'right',
    marginTop: vs(3),
  },

  buttonContainer: {
    backgroundColor:   '#FFFFFF',
    paddingHorizontal: s(22),
    paddingTop:        vs(16),
    paddingBottom:     Platform.OS === 'ios' ? vs(21) : vs(22),
    borderTopWidth:    1,
    borderTopColor:    '#F3F4F6',
  },
  btnOuter: {
    borderRadius:  s(18),
    overflow:      'hidden',
    shadowColor:   '#6D4AFF',
    shadowOffset:  { width: 0, height: vs(4) },
    shadowOpacity: 0.2,
    shadowRadius:  s(12),
    elevation:     6,
  },
  btn: {
    paddingVertical: vs(16),
    minHeight:       vs(52),
    alignItems:      'center',
    justifyContent:  'center',
  },
  btnText: {
    fontSize:   ms(16),
    fontWeight: '500',
    color:      '#FFFFFF',
  },

  loadingContainer: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: { marginTop: vs(13), fontSize: ms(15), color: '#6B7280' },
});

export default Edit;