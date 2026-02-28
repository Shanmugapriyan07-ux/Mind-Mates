
import React, { useState,useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useProfile } from '@/Contexts/profileContext';
import Toast from 'react-native-toast-message';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { spacing } from '@/constants/theme';
import Ionicons from '@expo/vector-icons/Ionicons';



const BasicInfo = (props: { onNext: () => void; onBack: () => void }) => {
  const { profile, updateProfile } = useProfile();
  
  const [formData, setFormData] = useState({
    fullName: profile?.fullName || '',
    title: profile?.title || '',
    location: profile?.location || '',
    bio: profile?.bio || '',
  });

  const [focused, setFocused] = useState<string | null>(null);
 
  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = async () => {
    // Validation
    if (!formData.fullName.trim()) {
      Toast.show({type:'error', text1:'Please enter your full name'});
      return;
    }
    // Save to profile context
    await updateProfile(formData);

       setFormData({
      fullName :'',
    title:'',
    location : '',
    bio : '',
    });
    
    // Go to next step
    
    router.replace('/(profileSetUp)/ProfileImage');
 
    // onNext(); // Navigate to profile image step
  };

  return (
    <SafeAreaProvider style={{flex: 1}}>
       <KeyboardAvoidingView
        style={s.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.headerImage}>
            
                      
         <Text style={s.sptext}>MindMates</Text>
      </View>
        

          <ScrollView
          
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
      <View>
        <Text style={s.subtitle}>
          Let's get to know you! 👋
        </Text>
        </View>

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
             placeholderTextColor="#9CA3AF"
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
            colors={['#7C3AED', '#8d47cf']}
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
    height: 20,
    justifyContent:'center',
    alignItems:'center',                            
     padding: 37,
     marginTop: 0, 
     flexDirection:'row',
  },
  sptext:{
  fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    position:'relative',
    alignSelf:'center',
    justifyContent:'center',
    letterSpacing:0.15,
  
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 400,
  },
  subtitle: {
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 22,
    marginBottom: 15,
    marginTop:-5
    
  }, 
   inputGroup: {
    marginBottom: 20,
  },
  label: {
   fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    
  },
  inputWrapper: {
     flexDirection: 'row',
    alignItems: 'center',
  backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 48,
  },
  inputFocused: {
    borderColor: '#c8c6c6',
  },
  icon: {
    fontSize: 20,
    marginRight: 8,
    marginLeft: 10,
  },
  input: {
     flex: 1,
    fontSize: 15,
    color: '#1F2937',
    paddingVertical: 0,
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
    marginBottom:spacing.md
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

export default BasicInfo;