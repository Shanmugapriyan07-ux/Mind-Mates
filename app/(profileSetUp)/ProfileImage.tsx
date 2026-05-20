import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  ActivityIndicator, Platform, Animated, Dimensions, Modal, Pressable,
} from 'react-native';
import * as ImagePicker      from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { router }            from 'expo-router';
import { useAuthh }           from '@/Contexts/authContext';
import { useProfile }        from '@/Contexts/profileContext';
import Toast                 from 'react-native-toast-message';
import { Ionicons }          from '@expo/vector-icons';
import { SafeAreaView }      from 'react-native-safe-area-context';
import { saveDraft }         from '@/lib/profileDraft';
import { uploadToCloudinary, compressForUpload, cdnProfileUrl } from '@/lib/cloudinaryUpload';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AVATAR_SIZE = SCREEN_WIDTH * 0.38;
export default function ProfileImageScreen() {
  const { user }                   = useAuthh();
  const { updateProfile, profile } = useProfile();
  const [imageUri,       setImageUri]       = useState<string | null>(profile?.profileImage ?? null);
  const [uploading,      setUploading]      = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [showPicker,     setShowPicker]     = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const avatarScale = useRef(new Animated.Value(1)).current;
  const sheetAnim   = useRef(new Animated.Value(0)).current;
  const isMounted   = useRef(true);
  const webFileRef  = useRef<File | null>(null); 
  useEffect(() => () => { isMounted.current = false; }, []);
  const handleAvatarPressIn  = () => Animated.spring(avatarScale, { toValue: 0.94, useNativeDriver: true, speed: 50, bounciness: 8 }).start();
  const handleAvatarPressOut = () => {
    Animated.spring(avatarScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 12 }).start();
    if (typeof document !== 'undefined') { triggerWebFilePicker(); return; }
    openSheet();
  };
  const triggerWebFilePicker = () => {
    const input = document.createElement('input');
    input.type  = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.onchange = async (e: any) => {
      const file: File = e.target.files?.[0];
      document.body.removeChild(input);
      if (!file?.type.startsWith('image/')) return;
      webFileRef.current = file;
      setImageUri(URL.createObjectURL(file));
    };
    input.oncancel = () => document.body.removeChild(input);
    input.click();
  };
  const openSheet  = () => { setShowPicker(true); Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, damping: 280, stiffness: 180 }).start(); };
  const closeSheet = () => { Animated.timing(sheetAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => setShowPicker(false)); };
  const processImage = async (uri: string) => {
    const result = await ImageManipulator.manipulateAsync(
      uri, [{ resize: { width: 1080 } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  };
  const pickFromGallery = useCallback(async () => {
    if (typeof document !== 'undefined') { triggerWebFilePicker(); closeSheet(); return; }
    closeSheet();
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) { Toast.show({ type: 'error', text1: 'Permission needed' }); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setImageUri(await processImage(result.assets[0].uri));
  }, []);
  const takePhoto = useCallback(async () => {
    closeSheet();
    if (typeof document !== 'undefined') return;
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) { Toast.show({ type: 'error', text1: 'Camera permission needed' }); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (result.canceled || !result.assets?.[0]) return;
    setImageUri(await processImage(result.assets[0].uri));
  }, []);
  const removePhoto = useCallback(() => { setImageUri(null); closeSheet(); }, []);
  const uploadImage = useCallback(async (localUri: string): Promise<string | null> => {
    setUploading(true);
    setUploadProgress(0);
    try {
      let uploadUri = localUri;
      if (typeof document !== 'undefined' && webFileRef.current) {
        uploadUri = URL.createObjectURL(webFileRef.current);
      } else if (Platform.OS !== 'web') {
        uploadUri = await compressForUpload(localUri, 'profile');
      }
      const result = await uploadToCloudinary(uploadUri, {
        type: 'image',
        onProgress: (pct: number) => setUploadProgress(pct),
        uploadType: 'profile', 
      });
      const cdnUrl = cdnProfileUrl(result.secureUrl);
      if (typeof document !== 'undefined' && uploadUri.startsWith('blob:')) {
        URL.revokeObjectURL(uploadUri);
        webFileRef.current = null;
      }
      return cdnUrl;
    } catch (err: any) {
      console.error('❌ Upload failed:', err?.message);
      Toast.show({ type: 'error', text1: 'Upload failed', text2: err?.message ?? 'Try again' });
      return null;
    } finally {
      setUploading(false);
    }
  }, []);
  const handleNext = useCallback(async () => {
    if (!user?.id || uploading || saving) return;
    if (!imageUri || imageUri === profile?.profileImage) {
      router.push('/(profileSetUp)/SkillSelect');
      return;
    }
    setSaving(true);
    try {
      const uploadedUrl = await uploadImage(imageUri);
      if (!uploadedUrl) { setSaving(false); return; }
      updateProfile({ profileImage: uploadedUrl });
      saveDraft(user.id, { profileImage: uploadedUrl, currentStep: 2 }).catch(() => {});
      setSaving(false);
      router.push('/(profileSetUp)/SkillSelect');
    } catch (e: any) {
      console.error('❌ handleNext:', e?.message);
      if (isMounted.current) setSaving(false);
    }
  }, [user?.id, uploading, saving, imageUri, profile?.profileImage, uploadImage, updateProfile]);
  const handleSkip = useCallback(() => router.push('/(profileSetUp)/SkillSelect'), []);
  const initials = (profile?.fullName ?? user?.name ?? 'U')
    .split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  const isBusy = uploading || saving;
  const sheetTranslate = sheetAnim.interpolate({ inputRange: [0,1], outputRange: [300,0] });
  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.stepLabel}>Step 2 of 3</Text>
        <Text style={s.title}>Add a photo</Text>
        <Text style={s.subtitle}>Help others recognize you. You can change this any time.</Text>
      </View>
      <View style={s.avatarSection}>
        <Animated.View style={{ transform: [{ scale: avatarScale }] }}>
          <TouchableOpacity activeOpacity={1} onPressIn={handleAvatarPressIn}
            onPressOut={handleAvatarPressOut} style={s.avatarWrapper} disabled={isBusy}>
            {imageUri
              ? <Image source={{ uri: imageUri }} style={s.avatar} />
              : <View style={s.initialsCircle}><Text style={s.initialsText}>{initials}</Text></View>
            }
            {!isBusy && (
              <View style={s.cameraBadge}>
                <Ionicons name="camera" size={16} color="#6D4AFF" />
              </View>
            )}
            {uploading && (
              <View style={s.uploadOverlay}>
                <ActivityIndicator color="#fff" size="large" />
                <Text style={s.progressText}>{uploadProgress}%</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
        <Text style={s.tapHint}>{imageUri ? 'Tap to change photo' : 'Tap to add photo'}</Text>
      </View>
      <View style={s.actions}>
        <TouchableOpacity style={[s.nextBtn, isBusy && s.nextBtnDisabled]}
          onPress={handleNext} disabled={isBusy} activeOpacity={0.85}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.nextBtnText}>{imageUri && imageUri !== profile?.profileImage ? 'Save & Continue' : 'Continue'}</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity style={s.skipBtn} onPress={handleSkip} disabled={isBusy}>
          <Text style={s.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
      <Modal visible={showPicker} transparent animationType="none" onRequestClose={closeSheet}>
        <Pressable style={s.sheetBackdrop} onPress={closeSheet} />
        <Animated.View style={[s.sheet, { transform: [{ translateY: sheetTranslate }] }]}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Profile photo</Text>
          {Platform.OS !== 'web' && (
            <TouchableOpacity style={s.sheetOption} onPress={takePhoto}>
              <Ionicons name="camera" size={22} color="#131313" style={s.sheetIcon} />
              <Text style={s.sheetOptionText}>Take photo</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.sheetOption} onPress={pickFromGallery}>
            <Ionicons name="images" size={22} color="#131313" style={s.sheetIcon} />
            <Text style={s.sheetOptionText}>Choose from gallery</Text>
          </TouchableOpacity>
          {imageUri && (
            <TouchableOpacity style={s.sheetOption} onPress={removePhoto}>
              <Ionicons name="trash" size={22} color="#E53935" style={s.sheetIcon} />
              <Text style={[s.sheetOptionText, { color: '#E53935' }]}>Remove photo</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.sheetCancel} onPress={closeSheet}>
            <Text style={s.sheetCancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#FAFAFA', paddingHorizontal: 24 },
  header:         { marginTop: 20, marginBottom: 30 },
  stepLabel:      { fontSize: 13, fontWeight: '600', color: '#A0A0A0', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8,marginTop:5 },
  title:          { fontSize: 28, fontWeight: '700', color: '#111', marginBottom: 8 },
  subtitle:       { fontSize: 15, color: '#666', lineHeight: 22 },
  avatarSection:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarWrapper:  { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE/2, shadowColor: '#000', shadowOffset: { width:0, height:8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 10 },
  avatar:         { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE/2, backgroundColor: '#E0E0E0' },
  initialsCircle: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE/2, backgroundColor: '#6D4AFF', alignItems: 'center', justifyContent: 'center' },
  initialsText:   { fontSize: AVATAR_SIZE * 0.32, fontWeight: '700', color: '#fff', letterSpacing: 2 },
  cameraBadge:    { position: 'absolute', bottom: 4, right: 4, width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 5, borderWidth: 1.5, borderColor: '#F0F0F0' },
  uploadOverlay:  { ...StyleSheet.absoluteFillObject, borderRadius: AVATAR_SIZE/2, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', gap: 6 },
  progressText:   { color: '#fff', fontSize: 13, fontWeight: '600' },
  tapHint:        { marginTop: 12, fontSize: 14, color: '#888',marginBottom:37},
  actions:        { gap: 8, marginBottom: 40 },
  nextBtn:        { backgroundColor: '#6D4AFF', borderRadius: 14, height: 54, alignItems: 'center', justifyContent: 'center', shadowColor: '#6D4AFF', shadowOffset: { width:0, height:4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  nextBtnDisabled:{ opacity: 0.65 },
  nextBtnText:    { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  skipBtn:        { height: 44, alignItems: 'center', justifyContent: 'center' },
  skipText:       { color: '#999', fontSize: 15, fontWeight: '500' },
  sheetBackdrop:  { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  sheet:          { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 36 : 24, paddingHorizontal: 20 },
  sheetHandle:    { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 20 },
  sheetTitle:     { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 4, textAlign: 'center' },
  sheetOption:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', gap: 14 },
  sheetIcon:      {},
  sheetOptionText:{ fontSize: 16, color: '#222', fontWeight: '500' },
  sheetCancel:    { marginTop: 14, height: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ececec', borderRadius: 12 },
  sheetCancelText:{ fontSize: 16, fontWeight: '600', color: '#555' },
});
