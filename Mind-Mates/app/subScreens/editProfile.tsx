import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useProfile } from '@/Contexts/profileContext';
import Toast from 'react-native-toast-message';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context'
import BasicInfo from '@/(profileSetUp)/BasicInfo';
import { string } from 'zod';
import { } from '@/Contexts/profileContext';
import { Ionicons } from '@expo/vector-icons';

const Edit = ({}: { onNext: () => void }) => {
  const { profile, updateProfile, isLoading: contextLoading } = useProfile();
 
  // ──────────────────────────────────────────────────────────────────────
  // STEP 2: Local state for form data
  // ──────────────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    fullName: '',
    title: '',
    location: '',
    bio: '',
  });

  const [focused, setFocused] = useState<String |null>(null);
  const [saving, setSaving] = useState(false);

  // ──────────────────────────────────────────────────────────────────────
  // STEP 3: Load profile data when component mounts
  // ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (profile) {
      console.log('📥 Loading profile data:', profile);
      
      // ✅ CORRECT: Set entire object at once
      setFormData({
        fullName: profile.fullName || '',
        title: profile.title || '',
        location: profile.location || '',
        bio: profile.bio || '',
      });
    }
  }, [profile]); // Re-run if profile changes

  // ──────────────────────────────────────────────────────────────────────
  // STEP 4: Handle field changes
  // ──────────────────────────────────────────────────────────────────────
 const handleChange = useCallback((field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);


  // ──────────────────────────────────────────────────────────────────────
  // STEP 5: Validate form
  // ──────────────────────────────────────────────────────────────────────
  const validateForm = useCallback(() => {
    // Check required fields
    if (!formData.fullName.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Name Required',
        text2: 'Please enter your full name',
      });
      return false;
    }

    if (formData.fullName.trim().length < 2) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Name',
        text2: 'Name must be at least 2 characters',
      });
      return false;
    }

    if (!formData.title.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Title Required',
        text2: 'Please enter your professional title',
      });
      return false;
    }

    return true;
  }, [formData]);

  // ──────────────────────────────────────────────────────────────────────
  // STEP 6: Save changes
  // ──────────────────────────────────────────────────────────────────────
  const handleNext = useCallback(async () => {
    console.log('💾 Saving profile...');

    // Validate
    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      // ✅ CORRECT: Call updateProfile with form data
      await updateProfile({
        fullName: formData.fullName.trim(),
        title: formData.title.trim(),
        location: formData.location.trim(),
        bio: formData.bio.trim(),
      });

      console.log('✅ Profile saved successfully');

      // Success message
      Toast.show({
        type: 'success',
        text1: 'Profile Updated! ✅',
        text2: 'Your changes have been saved',
      });

      // Navigate back to profile
      setTimeout(() => {
        router.replace('/(tabs)/profile');
      }, 100);

    } catch (error:any) {
      console.error('❌ Save failed:', error);

      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: error.message || 'Could not save changes',
      });
    } finally {
      setSaving(false);
    }
  }, [formData, validateForm, updateProfile]);

  // ──────────────────────────────────────────────────────────────────────
  // STEP 7: Check if form has changes
  // ──────────────────────────────────────────────────────────────────────
  const hasChanges = useCallback(() => {
    return (
      formData.fullName !== (profile?.fullName || '') ||
      formData.title !== (profile?.title || '') ||
      formData.location !== (profile?.location || '') ||
      formData.bio !== (profile?.bio || '')
    );
  }, [formData, profile]);

  // ──────────────────────────────────────────────────────────────────────
  // STEP 8: Handle cancel
  // ──────────────────────────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    if (hasChanges()) {
      // Warn user about unsaved changes
      Toast.show({
        type: 'info',
        text1: 'Changes Discarded',
        text2: 'Your edits were not saved',
      });
    }
    router.back();
  }, [hasChanges]);
  
    if (contextLoading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={s.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider style={{flex: 1}}>
       <KeyboardAvoidingView
        style={s.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.headerImage}>
          
                <Text style={s.sptext}>Editprofile</Text>
      </View>
        

          <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
      >
        {/* Full Name */}
        <View style={s.inputGroup}>
          <Text style={s.label}>Full Name *</Text>
          <View style={[
            s.inputWrapper,
            focused === 'fullName' && s.inputFocused
          ]}>
                      <Ionicons name="person" size={20} color="#1c1c1d" style={s.icon} />
            <TextInput
              style={s.input}
              placeholder="Sakthi"
              placeholderTextColor="#9CA3AF"
              value={formData.fullName}
              onChangeText={(text) => handleChange('fullName', text)}
              onFocus={() => setFocused('fullName')}
              onBlur={() => setFocused(null)}
              autoCapitalize="words"
            />
          </View>
        </View>

        {/* Professional Title */}
        <View style={s.inputGroup}>
          <Text style={s.label}>Intrested Skill*</Text>
          <View style={[
            s.inputWrapper,
            focused === 'title' && s.inputFocused
          ]}>
           <Ionicons name="happy" style={s.icon}></Ionicons>
                     
            <TextInput
              style={s.input}
              placeholder="Arts & Sports"
              placeholderTextColor="#111c2f"
              value={formData.title}
              onChangeText={(text) => handleChange('title', text)}
              onFocus={() => setFocused('title')}
              onBlur={() => setFocused(null)}
              autoCapitalize="words"
              
            />
          </View>
        </View>

        {/* Location */}
        <View style={s.inputGroup}>
          <Text style={s.label}>Location *</Text>
          <View style={[
            s.inputWrapper,
            focused === 'location' && s.inputFocused
          ]}>
<Ionicons name="location" style={s.icon}></Ionicons>
            <TextInput
              style={s.input}
              placeholder="Cuddlore (DT)"
              placeholderTextColor="#9CA3AF"
              value={formData.location}
              onChangeText={(text) => handleChange('location', text)}
              onFocus={() => setFocused('location')}
              onBlur={() => setFocused(null)}
              autoCapitalize="words"
            />
          </View>
        </View>

        {/* Bio */}
        <View style={s.inputGroup}>
          <Text style={s.label}>About You</Text>
          <View style={[
            s.textAreaWrapper,
            focused === 'bio' && s.inputFocused
          ]}>
            <TextInput
              style={s.textArea}
              placeholder="Basically i am an artist, i am looking for artist as a mentor for Grow Together !"
              placeholderTextColor="#9CA3AF"
              value={formData.bio}
              onChangeText={(text) => handleChange('bio', text)}
              onFocus={() => setFocused('bio')}
              onBlur={() => setFocused(null)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
          <Text style={s.charCount}>{formData.bio.length}/200</Text>
        </View>

      </ScrollView>
      
     

      {/* Continue Button */}
      <View style={s.buttonContainer}>
        <TouchableOpacity
          onPress={handleNext}
          activeOpacity={0.8}
          style={s.btnOuter}
        >
          <LinearGradient
            colors={['#6b29de', '#7C3AED','#6b29de']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.btn}
          >
            <Text style={s.btnText}>Continue</Text>
          </LinearGradient>
        </TouchableOpacity>
      
      </View>
      </KeyboardAvoidingView>
    </SafeAreaProvider>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerImage: {
       zIndex:10,  
    width: '100%',
    height: 15,
    justifyContent:'center',
    alignItems:'center',                            
     padding: 36,
     shadowColor: '#bdbdbd',
    elevation: 6,
     marginTop: 0, 
     flexDirection:'row',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6B7280',
  },
  sptext:{
  fontSize: 23,
    fontWeight: '600',
    color: '#0f0f0f',
    position:'relative',
    alignItems:'center',
    justifyContent:'center',
    marginRight:207,
    marginTop:10,
  },
      scroll: {
    paddingHorizontal: 24,
    paddingBottom: 100,
    flexGrow:1,
    marginBottom:200,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 15,
    marginTop: 15,
  }, 
   inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 15,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    height: 52,
  },
  inputFocused: {
    borderColor: '#7C3AED',
    backgroundColor: '#FFFFFF',
  },
  icon: {
    fontSize: 20,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  textAreaWrapper: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    padding: 14,
  },
  textArea: {
    fontSize: 15,
    color: '#1F2937',
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  btnOuter: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  btn: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default Edit;