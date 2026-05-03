// hooks/useProfileImage.ts
// Profile image upload — signed Cloudinary strategy
//
// SIGNED UPLOAD FLOW:
//   1. User picks image → compress → show instantly (optimistic UI)
//   2. Call edge fn sign_upload → returns {signature, timestamp, apiKey, publicId}
//   3. POST FormData to Cloudinary directly (overwrite=true, signed)
//   4. Get back secure_url → save to Supabase users table
//   5. On any error → rollback to previous image
//
// This works on Android + iOS + Web without any 500 errors

import { useState, useCallback, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Platform }     from 'react-native';
import { supabase }     from '@/lib/supabase';
import { useProfile }   from '@/Contexts/profileContext';
import { useAuthh }      from '@/Contexts/authContext';
import { clearAvatarCache } from '@/components/Profileavatar';
import {
  uploadProfileToCloudinary,
  compressForUpload,
  cdnProfileUrl,
} from '@/lib/cloudinaryUpload';

// Web canvas compression (600px, 78%)
const compressOnWeb = (blob: Blob): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const MAX = 600;
      const r = Math.min(MAX / img.width, MAX / img.height, 1);
      const c = document.createElement('canvas');
      c.width  = Math.round(img.width  * r);
      c.height = Math.round(img.height * r);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(
        b => b ? resolve(b) : reject(new Error('Canvas compression failed')),
        'image/jpeg', 0.78
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });

export const useProfileImage = () => {
  const { user }                   = useAuthh();
  const { profile, updateProfile } = useProfile();

  const [imageUri,  setImageUri]  = useState<string | null>(profile?.profileImage ?? null);
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [error,     setError]     = useState<string | null>(null);

  const webBlobRef   = useRef<Blob | null>(null);
  const prevImageRef = useRef<string | null>(profile?.profileImage ?? null);

  // ── Pick from gallery ─────────────────────────────────────────
  const pickFromGallery = useCallback(async () => {
    setError(null);

    if (typeof document !== 'undefined') {
      const input    = document.createElement('input');
      input.type     = 'file';
      input.accept   = 'image/jpeg,image/png,image/webp,image/heic';
      input.onchange = async (e: any) => {
        const file: File = e.target.files?.[0];
        if (!file) return;
        setImageUri(URL.createObjectURL(file));
        try { webBlobRef.current = await compressOnWeb(file); }
        catch { webBlobRef.current = file; }
      };
      input.click();
      return;
    }

    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) { setError('Photo library permission denied'); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:    ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect:        [1, 1],
      quality:       1,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const compressed = await compressForUpload(result.assets[0].uri, 'profile');
    setImageUri(compressed);
  }, []);

  // ── Take photo ────────────────────────────────────────────────
  const takePhoto = useCallback(async () => {
    setError(null);
    if (typeof document !== 'undefined') return;

    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) { setError('Camera permission denied'); return; }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect:        [1, 1],
      quality:       1,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const compressed = await compressForUpload(result.assets[0].uri, 'profile');
    setImageUri(compressed);
  }, []);

  // ── Upload and save ───────────────────────────────────────────
  const uploadAndSave = useCallback(async (): Promise<boolean> => {
    if (!user?.id || !imageUri) return false;
    if (imageUri === profile?.profileImage) return true; // no change

    const localUri = imageUri;
    const prevUri  = prevImageRef.current;

    // Optimistic: show local image immediately
    updateProfile({ profileImage: localUri });
    clearAvatarCache(localUri);

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const result = await uploadProfileToCloudinary(
        localUri,
        user.id,
        (pct) => setProgress(pct),
      );

      const cdnUrl = cdnProfileUrl(result.secureUrl);
      console.log('[profile] CDN URL:', cdnUrl.slice(0, 100));

      // Save to Supabase
      const { error: dbErr } = await supabase
        .from('users')
        .update({ profile_image: cdnUrl })
        .eq('user_id', user.id);
      if (dbErr) throw new Error(`DB save failed: ${dbErr.message}`);

      updateProfile({ profileImage: cdnUrl });
      setImageUri(cdnUrl);
      prevImageRef.current = cdnUrl;
      setProgress(100);

      if (typeof document !== 'undefined' && localUri.startsWith('blob:')) {
        URL.revokeObjectURL(localUri);
        webBlobRef.current = null;
      }
      return true;

    } catch (e: any) {
      console.error('[profile upload] failed:', e?.message);
      setError(e?.message ?? 'Upload failed — please try again');
      updateProfile({ profileImage: prevUri });
      setImageUri(prevUri);
      setProgress(0);
      return false;
    } finally {
      setUploading(false);
    }
  }, [user?.id, imageUri, profile?.profileImage, updateProfile]);

  // ── Remove photo ──────────────────────────────────────────────
  const removePhoto = useCallback(async () => {
    const oldUri = profile?.profileImage;
    if (oldUri) clearAvatarCache(oldUri);
    setImageUri(null);
    webBlobRef.current   = null;
    prevImageRef.current = null;
    updateProfile({ profileImage: null });

    if (!user?.id) return;

    // Clear in DB
    const { error: dbErr } = await supabase
      .from('users')
      .update({ profile_image: null })
      .eq('user_id', user.id);
    if (dbErr) console.warn('[removePhoto DB]', dbErr.message);

    // Best-effort Cloudinary cleanup (signed delete)
    const safeId   = user.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const publicId = `mindmates/profiles/profile_${safeId}`;
    supabase.functions.invoke('mindmates', {
      body: { action: 'delete_cloudinary_image', publicId, resourceType: 'image' },
    }).catch(e => console.warn('[removePhoto Cloudinary]', e?.message));
  }, [profile?.profileImage, user?.id, updateProfile]);

  return {
    imageUri, setImageUri,
    uploading, progress, error,
    pickFromGallery, takePhoto,
    uploadAndSave, removePhoto,
  };
};