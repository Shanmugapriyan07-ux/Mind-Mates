import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useProfile } from '@/Contexts/profileContext';
import Toast from 'react-native-toast-message';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const ProfileImage = ({ onNext, onBack }: { onNext: () => void; onBack: () => void }) => {
  const { profile, updateProfile } = useProfile();
  const [image, setImage] = useState(profile.profileImage);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
     Toast.show({ type: 'error', text1: 'Permission needed', text2: 'Please allow access to photos' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

 

  const handleNext = async () => {
    await  updateProfile({ profileImage: image });
    // onNext();
    router.replace('/(tabs)/profile');
  };

  return (
      <SafeAreaProvider style={{ flex: 1, backgroundColor: '#fff' }}>
         <KeyboardAvoidingView
                style={s.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              >
    <View style={s.container}>
      <View style={s.headerImage}>
                <View>
            <Text style={s.sptext}>Add your photo 📸</Text>
            </View>
            </View>
         <ScrollView
             contentContainerStyle={s.scroll}
             keyboardShouldPersistTaps="handled"
             showsVerticalScrollIndicator={true}
           >
      <Text style={s.subtitle}>Help others recognize you</Text>

      <TouchableOpacity style={s.imageContainer} onPress={pickImage}>
        {image ? (
          <Image source={{ uri: image }} style={s.image} />
        ) : (
          <View style={s.placeholder}>
            <Text style={s.placeholderIcon}>📷</Text>
            <Text style={s.placeholderText}>Tap to upload</Text>
          </View>
        )}
      </TouchableOpacity>
      <View>
        <Text style={{alignSelf:'center',justifyContent:'center', color:'#68676a'}}>(Optional)*</Text>
      </View>

      {image && (
        <TouchableOpacity onPress={pickImage} style={s.changeBtn}>
          <Text style={s.changeText}>Change Photo</Text>
        </TouchableOpacity>
      )}
      </ScrollView>

      <View style={s.buttons}>
        <TouchableOpacity onPress={handleNext} style={s.nextOuter}>
          <LinearGradient colors={['#7C3AED', '#F59E0B']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.next}>
            <Text style={s.nextText}>Continue</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
      
    </View>
    </KeyboardAvoidingView>
    </SafeAreaProvider>
  );
}; 

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  headerImage: {
       zIndex:10,  
    width: '100%',
    height: 19,
    justifyContent:'center',
    alignItems:'center',                            
     padding: 36,
     shadowColor: '#bdbdbd',
    elevation: 6,
     marginTop: 0, 
     flexDirection:'row',
  },
  sptext:{
  fontSize: 23,
    fontWeight: '600',
    color: '#0f0f0f',
    position:'relative',
    alignItems:'center',
    justifyContent:'center',
    marginTop:10,
    marginRight:110,
    marginBottom:10,
  },
   scroll: {
    paddingHorizontal: 24,
    paddingBottom: 100,
    flexGrow:1,
    marginBottom:500,
  },
  subtitle: { fontSize: 15, color: '#494a4c', marginBottom: 40, marginTop: -1, },
  imageContainer: { alignSelf: 'center', marginBottom: 20 , borderColor:'#111' },
  image: { width: 150, height: 150, borderRadius: 75 },
  placeholder: { width: 150, height: 150, borderRadius: 75, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed' },
  placeholderIcon: { fontSize: 40, marginBottom: 8 },
  placeholderText: { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },
  changeBtn: { alignSelf: 'center', padding: 12 },
  changeText: { fontSize: 15, color: '#7C3AED', fontWeight: '600' },
  buttons: { position: 'absolute', bottom: 20, left: 24, right: 24, flexDirection: 'row', gap: 12,},
  nextOuter: { flex: 2, borderRadius: 19, overflow: 'hidden', width: '100%',justifyContent:'center',alignItems:'center' },
  next: { paddingVertical: 16, borderRadius: 14, alignItems: 'center',paddingHorizontal:90, justifyContent: 'center'},
  nextText: { fontSize: 17, fontWeight: '700', color: '#FFF' },
});

export default ProfileImage;