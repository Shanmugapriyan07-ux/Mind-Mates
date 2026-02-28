// screens/Step2ProfileImage.js
// Step 2: Upload profile photo

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useProfile } from '@/Contexts/profileContext';
import Toast from 'react-native-toast-message';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AntDesign } from '@expo/vector-icons';
import images from '@/constants/images';

const ProfileImage = ({}: { onNext: () => void; onBack: () => void }) => {
  const { profile, updateProfile } = useProfile();
  const [image, setImage] = useState(profile?.profileImage);

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
    router.replace('/(profileSetUp)/SkillSelect')
  };

  return (
    <View style={s.container}>
       <View style={s.header}>
        <TouchableOpacity onPress={()=> router.push('/(tabs)/profile')}>
         <AntDesign name="arrow-left" size={20} color='#232529' style={{...s.headerIcon,marginLeft:-50,marginRight:40}} />
         </TouchableOpacity>
        <Text style={s.headerTitle}>Add you're picture</Text>
         </View>
      <Text style={s.subtitle}>Help others recognize you</Text>

      <TouchableOpacity style={s.imageContainer} onPress={pickImage}>
        {image ? (
          <Image source={{ uri: image }} style={s.image} />
        ) : (
           <View >
            <Image source={images.Profile} style={s.image} />
            
            <Text style={s.placeholderText}>Tap to upload</Text>
          </View>
        )}
      </TouchableOpacity>
      <View>
        <Text style={{alignSelf:'center',justifyContent:'center', color:'#9CA3AF', marginTop:-10}}>(Optional)</Text>
      </View>

      {image && (
        <TouchableOpacity onPress={pickImage} style={s.changeBtn}>
          <LinearGradient colors={['#6b29de', '#7C3AED']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.next}>
            <Text style={s.nextText}>Change Photo</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      <View style={s.buttons}>
        <TouchableOpacity onPress={handleNext} style={s.nextOuter}>
          <LinearGradient colors={['#6b29de', '#7C3AED','#6b29de']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.next}>
            <Text style={s.nextText}>Continue</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}; 

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  title: { fontSize: 25, fontWeight: '700', color: '#111', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#494a4c', marginBottom: 40, marginTop: -11, textAlign:'center' },
  imageContainer: { alignSelf: 'center', marginBottom: 18 , borderColor:'#111' },
  image: { width: 160, height: 160, textAlign:'center', alignSelf:'center',color:'black' },
  image: { width: 150, height: 150, textAlign:'center',borderRadius: 75,alignSelf:'center',color:'black' },
  // placeholder: { width: 140, height: 140, borderRadius: 75, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed' },
  placeholderIcon: { fontSize: 40, marginBottom: 8 },
  placeholderText: { fontSize: 14, color: '#494a4c', fontWeight: '600',marginTop:-6,marginBottom:18,textAlign:'center'   },
  changeBtn: { alignSelf: 'center', padding: 19, width:220,borderRadius:14},
  changeText: { fontSize: 15, color: '#7C3AED', fontWeight: '600' },
  buttons: { position: 'absolute', bottom: 20, left: 24, right: 24, flexDirection: 'row', gap: 12 },
  backBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center' },
  backText: { fontSize: 16, fontWeight: '600', color: '#6B7280' },
  nextOuter: { flex: 2, borderRadius: 14, overflow: 'hidden' },
  next: { paddingVertical: 16, alignItems: 'center',borderRadius:14 },
  nextText: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 50,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    
  },
  headerIcon: {
    marginRight: 20,
    alignSelf: 'center',
    marginTop: 3
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#17191b',
    padding:8,
    letterSpacing:0.15

  },
});

export default ProfileImage;