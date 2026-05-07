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
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useProfile } from '@/Contexts/profileContext';
import Toast from 'react-native-toast-message';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import LocationPicker from '@/components/LocationPicker';

const Edit = () => {
  const { profile, updateProfile, isLoading: contextLoading } = useProfile();
 
  // ──────────────────────────────────────────────────────────────────────
  // STEP 2: Local state for form data
  // ──────────────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    fullName: '',
    InterestedSkills: '',
    location: '',
    bio: '',
  });

  const [focused, setFocused] = useState<String |null>(null);
  const [, setSaving] = useState(false);

  // ──────────────────────────────────────────────────────────────────────
  // STEP 3: Load profile data when component mounts
  // ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (profile) {
      // console.log('📥 Loading profile data'); // Remove noisy log
      const newData = {
        fullName: profile.fullName || '',
        InterestedSkills: profile.InterestedSkills || '',
        location: profile.location || '',
        bio: profile.bio || '',
      };

      // Only update if data actually changed to prevent loop
      if (
        newData.fullName !== formData.fullName ||
        newData.InterestedSkills !== formData.InterestedSkills ||
        newData.location !== formData.location ||
        newData.bio !== formData.bio
      ) {
        setFormData(newData);
      }
    }
  }, [profile]); // Re-run if profile changes

  // ──────────────────────────────────────────────────────────────────────
  // STEP 4: Handle field changes
  // ──────────────────────────────────────────────────────────────────────
 const handleChange = useCallback((field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  }, []);

  const handleLocationSelect = (district:any) => {
    setFormData((prev: any) =>({
      ...prev,
      location:district,
    })
  );
    };


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

    if (!formData.InterestedSkills.trim()) {
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
      updateProfile({
        fullName: formData.fullName.trim(),
        InterestedSkills: formData.InterestedSkills.trim(),
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
      });

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

  // ──────────────────────────────────────────────────────────────────────
  // STEP 8: Handle cancel
  // ──────────────────────────────────────────────────────────────────────

  
    if (contextLoading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color="#6D4AFF" />
        <Text style={s.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: '#FFFFFF'}} edges={['top', 'bottom']}>
       <KeyboardAvoidingView
        style={s.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.headerImage}>
                <Text style={s.sptext}>Edit profile</Text>
          
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
          <Text style={s.label}>Interested Skills *</Text>
          <View style={[
            s.inputWrapper,
            focused === 'InterestedSkills' && s.inputFocused
          ]}>
           <Ionicons name="happy" style={s.icon}></Ionicons>
                     
            <TextInput
              style={s.input}
              placeholder="Art & Sports"
                placeholderTextColor="#9CA3AF"
              value={formData.InterestedSkills}
              onChangeText={(text) => handleChange('InterestedSkills', text)}
              onFocus={() => setFocused('InterestedSkills')}
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
            <View style={{flex:1}} >
                        <LocationPicker 
                          placeholder="search District"
                          value={formData.location}
                          onSelect={handleLocationSelect}
                          onFocus={() => setFocused('location')}
                          onBlur={() => setFocused(null)}
                        />
          </View>
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
            colors={['#6D4AFF', '#6845f3','#6D4AFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.btn}
          >
            <Text style={s.btnText}>Continue</Text>
          </LinearGradient>
        </TouchableOpacity>
      
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerImage: {
       zIndex:1,  
    width: '100%',
     padding: 20,

  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 13,
    fontSize: 15,
    color: '#6B7280',
    top:2
  },
  sptext:{
  fontSize: 23,
    fontWeight: '600',
    color: '#000000',
    position:'relative',
    alignItems:'center',
    justifyContent:'center',
    top:2

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
    marginTop: 10,
  }, 
   inputGroup: {
    marginBottom: 20,
  },
  label: {
   fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8
  },
  inputWrapper: {
   flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', height: 48 },
  inputFocused: {
    borderColor: '#6D4AFF',
    backgroundColor: '#FFFFFF',
  },
  icon:            { fontSize:18, marginRight: 8, marginLeft: 10 },
  input:           { flex: 1, fontSize: 15, color: '#1F2937', paddingVertical: 0 },
  textAreaWrapper: { backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 14 },
  textArea:        { fontSize: 15, color: '#1F2937', minHeight: 100 },
  charCount:       { fontSize: 12, color: '#9CA3AF', textAlign: 'right', marginTop: 4 },
  buttonContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  btnOuter:        { borderRadius: 14, overflow: 'hidden', shadowColor: '#6D4AFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 6, marginBottom: 12 },
  btn:             { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  btnText:         { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
    stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A0A0A0',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign:'left',
    marginRight:255,
    marginTop:10,
   
  },
});


export default Edit;