import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import * as ImageManipulator from 'expo-image-manipulator';
const CLOUD_NAME      = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME    ?? '';
const UNSIGNED_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? 'mindmates_unsigned';
export const COMPRESS_CONFIG = {
  profile:   { maxDim: 600,  quality: 0.75, format: ImageManipulator.SaveFormat.JPEG },
  chat:      { maxDim: 800,  quality: 0.70, format: ImageManipulator.SaveFormat.JPEG },
  thumbnail: { maxDim: 300,  quality: 0.55, format: ImageManipulator.SaveFormat.JPEG },
} as const;
export type UploadType = keyof typeof COMPRESS_CONFIG;
export interface CloudinaryResult {
  secureUrl:    string;
  publicId:     string;
  resourceType: 'image' | 'video';
  format:       string;
  width?:       number;
  height?:      number;
  bytes:        number;
  duration?:    number;
}
export type ProgressFn = (pct: number) => void;
export const compressForUpload = async (
  uri:  string,
  type: UploadType = 'chat',
): Promise<string> => {
  if (typeof document !== 'undefined') return uri; 
  const cfg = COMPRESS_CONFIG[type];
  try {
    const probe = await ImageManipulator.manipulateAsync(uri, [], { 
      format: ImageManipulator.SaveFormat.JPEG 
    });
    const { width, height } = probe;
    const actions: ImageManipulator.Action[] = [];
    const maxDim = cfg.maxDim;
    if (Math.max(width, height) > maxDim) {
      if (width >= height) {
        actions.push({ resize: { width: maxDim } });
      } else {
        actions.push({ resize: { height: maxDim } });
      }
    }
    const result = await ImageManipulator.manipulateAsync(
      probe.uri, 
      actions, 
      { compress: cfg.quality, format: cfg.format }
    );
    return result.uri;
  } catch (e) {
    console.warn('[compress] failed, using original:', e);
    return uri;
  }
};
export const uploadProfileToCloudinary = async (
  uri:         string,
  userId:      string,
  onProgress?: ProgressFn,
): Promise<CloudinaryResult> => {
  const { data: sigData, error: sigErr } = await supabase.functions.invoke('mindmates', {
    body: { action: 'sign_upload', userId, resourceType: 'image' },
  });
  if (sigErr) {
    throw new Error(`Signature request failed: ${sigErr.message}`);
  }
  if (!sigData?.success || sigData?.error) {
    throw new Error(sigData?.error ?? 'Could not get upload signature from server');
  }
  const { signature, timestamp, apiKey, cloudName: sigCloud, publicId } = sigData as {
    signature: string; timestamp: string; apiKey: string;
    cloudName: string; publicId: string;
  };
  const cloudName = sigCloud || CLOUD_NAME;
  const endpoint  = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const formData = new FormData();
  formData.append('public_id',  publicId);
  formData.append('overwrite',  'true');
  formData.append('timestamp',  timestamp);
  formData.append('signature',  signature);
  formData.append('api_key',    apiKey);
  if (Platform.OS === 'web') {
    const resp = await fetch(uri);
    if (!resp.ok) throw new Error(`Blob fetch failed: ${resp.status}`);
    const blob = await resp.blob();
    if (blob.size === 0) throw new Error('Selected file is empty');
    formData.append('file', new File([blob], 'profile.jpg', { type: 'image/jpeg' }));
  } else {
    (formData as any).append('file', {
      uri:  Platform.OS === 'android' ? uri : uri.replace('file://', ''),
      name: 'profile.jpg',
      type: 'image/jpeg',
    });
  }
  return xhrUpload(endpoint, formData, onProgress);
};
interface ChatUploadOptions {
  type:        'image' | 'video';
  onProgress?: ProgressFn;
  uploadType?: UploadType;
}
export const uploadToCloudinary = (
  uri:     string,
  optOrType: ChatUploadOptions | 'image' | 'video',
  legacyProgress?: ProgressFn,
  legacyUploadType?: UploadType,
): Promise<CloudinaryResult> => {
  const opts: ChatUploadOptions = typeof optOrType === 'string'
    ? { type: optOrType, onProgress: legacyProgress, uploadType: legacyUploadType }
    : optOrType;

  return new Promise(async (resolve, reject) => {
    if (!CLOUD_NAME) {
      reject(new Error('EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME not set'));
      return;
    }
    try {
      const { type, onProgress } = opts;
      const resourceType = type === 'video' ? 'video' : 'image';
      const endpoint     = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

      const formData = new FormData();
      formData.append('upload_preset', UNSIGNED_PRESET);
      formData.append('folder', 'mindmates/chat');

      if (Platform.OS === 'web') {
        const resp = await fetch(uri);
        if (!resp.ok) throw new Error(`Blob fetch failed: ${resp.status}`);
        const blob = await resp.blob();
        if (blob.size === 0) throw new Error('File is empty');
        const ext = type === 'video' ? 'mp4' : 'jpg';
        formData.append('file', new File([blob], `media.${ext}`, {
          type: type === 'video' ? 'video/mp4' : 'image/jpeg',
        }));
      } else {
        const ext = type === 'video' ? 'mp4' : 'jpg';
        (formData as any).append('file', {
          uri:  Platform.OS === 'android' ? uri : uri.replace('file://', ''),
          name: `media.${ext}`,
          type: type === 'video' ? 'video/mp4' : 'image/jpeg',
        });
      }
      resolve(await xhrUpload(endpoint, formData, onProgress));
    } catch (e: any) {
      reject(e);
    }
  });
};
const xhrUpload = (
  endpoint:    string,
  formData:    FormData,
  onProgress?: ProgressFn,
): Promise<CloudinaryResult> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint, true);
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress)
       onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const d = JSON.parse(xhr.responseText);
          resolve({
            secureUrl:    d.secure_url,
            publicId:     d.public_id,
            resourceType: d.resource_type as 'image' | 'video',
            format:       d.format,
            width:        d.width,
            height:       d.height,
            bytes:        d.bytes,
            duration:     d.duration,
          });
        } catch { reject(new Error('Cloudinary response parse error')); }
      } else {
        let msg = `Upload failed (HTTP ${xhr.status})`;
        try { msg = JSON.parse(xhr.responseText)?.error?.message ?? msg; } catch {}
        console.warn('[Cloudinary]', xhr.status, msg);
        reject(new Error(msg));
      }
    };
    xhr.onerror   = () => reject(new Error('Network error'));
    xhr.ontimeout = () => reject(new Error('Upload timed out (2 min exceeded)'));
    xhr.send(formData);
  });
export const cdnProfileUrl = (url: string, size = 200): string =>
  insertTransform(url, `f_auto,q_auto:good,w_${size},h_${size},c_fill,g_face,r_max`);
export const cdnChatUrl = (url: string): string =>
  insertTransform(url, 'f_auto,q_auto:good,w_900,fl_progressive');
export const cdnFullUrl = (url: string): string =>
  insertTransform(url, 'f_auto,q_auto:best');
export const cdnVideoThumbUrl = (url: string, w = 400, h = 300): string => {
  if (!url?.includes('cloudinary.com')) return '';
  const videoUrl = url
    .replace('/image/upload/', '/video/upload/')
    .replace('/video/upload/', `/video/upload/so_0,w_${w},h_${h},c_fill,f_jpg,q_auto:good/`);
  return videoUrl.replace(/\.(mp4|mov|webm|avi|m3u8)$/, '.jpg');
};
export const cdnVideoUrl = (url: string): string => {
  if (!url?.includes('cloudinary.com')) return url ?? '';
  const videoUrl = url
    .replace('/image/upload/', '/video/upload/')
    .replace('/video/upload/', '/video/upload/vc_auto,f_auto,q_auto:good,fl_progressive/');
  return videoUrl;
};
export const cdnVideoStreamUrl = (url: string): string => {
  if (!url?.includes('cloudinary.com')) return url ?? '';
  const base = url
    .replace('/image/upload/', '/video/upload/')
    .replace('/video/upload/', '/video/upload/sp_hd/');
  return base.replace(/\.(mp4|mov|webm|avi)$/, '.m3u8');
};
export const cdnThumbUrl = (url: string, size = 200): string =>
  insertTransform(url, `f_auto,q_auto:low,w_${size},h_${size},c_fill`);
const insertTransform = (url: string, t: string): string => {
  if (!url?.includes('cloudinary.com')) return url ?? '';
  return url.replace('/upload/', `/upload/${t}/`);
};
