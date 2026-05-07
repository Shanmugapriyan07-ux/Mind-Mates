import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import * as ImageManipulator from 'expo-image-manipulator';

const CLOUD_NAME      = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME    ?? '';
const UNSIGNED_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? 'mindmates_unsigned';

// ── Compression ───────────────────────────────────────────────────
export const COMPRESS_CONFIG = {
  profile:   { maxDim: 600,  quality: 0.78, format: ImageManipulator.SaveFormat.JPEG },
  chat:      { maxDim: 1080, quality: 0.72, format: ImageManipulator.SaveFormat.JPEG },
  thumbnail: { maxDim: 300,  quality: 0.60, format: ImageManipulator.SaveFormat.JPEG },
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

// ── Compression ───────────────────────────────────────────────────
export const compressForUpload = async (
  uri:  string,
  type: UploadType = 'chat',
): Promise<string> => {
  if (typeof document !== 'undefined') return uri;
  const cfg = COMPRESS_CONFIG[type];
  try {
    const probe = await ImageManipulator.manipulateAsync(
      uri, [], { format: ImageManipulator.SaveFormat.JPEG }
    );
    const { width, height } = probe;
    const ops: ImageManipulator.Action[] = Math.max(width, height) > cfg.maxDim
      ? [width >= height ? { resize: { width: cfg.maxDim } } : { resize: { height: cfg.maxDim } }]
      : [];
    const out = await ImageManipulator.manipulateAsync(
      probe.uri, ops, { compress: cfg.quality, format: cfg.format }
    );
    console.log(`[compress:${type}] ${width}×${height}→${out.width}×${out.height}`);
    return out.uri;
  } catch (e) {
    console.warn('[compress] failed, using original:', e);
    return uri;
  }
};

// ══════════════════════════════════════════════════════════════════
// SIGNED UPLOAD — Profile images
// Gets SHA-1 signature from edge fn, uploads directly to Cloudinary.
// Signed = overwrite=true allowed. Same public_id = same slot forever.
// ══════════════════════════════════════════════════════════════════
export const uploadProfileToCloudinary = async (
  uri:         string,
  userId:      string,
  onProgress?: ProgressFn,
): Promise<CloudinaryResult> => {

  // Step 1: Get signature from edge fn
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

  // Step 2: Build FormData — EXACTLY matching the signed params
  // CRITICAL: only include fields that were in the signature
  //   signed params: overwrite, public_id, timestamp
  //   plus: signature, api_key, file (these are NOT in signature string)
  //   NO upload_preset — signed uploads don't use presets
  //   NO folder — full path is already in public_id
  const formData = new FormData();
  formData.append('public_id',  publicId);
  formData.append('overwrite',  'true');
  formData.append('timestamp',  timestamp);
  formData.append('signature',  signature);
  formData.append('api_key',    apiKey);

  // Attach file
  if (Platform.OS === 'web') {
    const resp = await fetch(uri);
    if (!resp.ok) throw new Error(`Blob fetch failed: ${resp.status}`);
    const blob = await resp.blob();
    if (blob.size === 0) throw new Error('Selected file is empty');
    formData.append('file', new File([blob], 'profile.jpg', { type: 'image/jpeg' }));
    console.log(`[Cloudinary:signed:web] public_id=${publicId}`);
  } else {
    (formData as any).append('file', {
      uri:  Platform.OS === 'android' ? uri : uri.replace('file://', ''),
      name: 'profile.jpg',
      type: 'image/jpeg',
    });
    console.log(`[Cloudinary:signed:native] public_id=${publicId}`);
  }

  return xhrUpload(endpoint, formData, onProgress);
};

// ══════════════════════════════════════════════════════════════════
// UNSIGNED UPLOAD — Chat media (images + videos)
// ══════════════════════════════════════════════════════════════════
interface ChatUploadOptions {
  type:        'image' | 'video';
  onProgress?: ProgressFn;
  uploadType?: UploadType;
}

export const uploadToCloudinary = (
  uri:     string,
  // Accept legacy positional args OR options object
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

// ── XHR with progress (required on React Native) ──────────────────
const xhrUpload = (
  endpoint:    string,
  formData:    FormData,
  onProgress?: ProgressFn,
): Promise<CloudinaryResult> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint, true);
    xhr.timeout = 300_000;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const d = JSON.parse(xhr.responseText);
          console.log(`[Cloudinary] ✅ ${d.public_id} ${(d.bytes/1024).toFixed(0)}KB`);
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
        console.error('[Cloudinary]', xhr.status, msg);
        reject(new Error(msg));
      }
    };
    xhr.onerror   = () => reject(new Error('Network error'));
    xhr.ontimeout = () => reject(new Error('Upload timed out (5 min exceeded)'));
    xhr.send(formData);
  });

// ── CDN URL helpers ───────────────────────────────────────────────
export const cdnProfileUrl = (url: string, size = 200): string =>
  insertTransform(url, `f_auto,q_auto:good,w_${size},h_${size},c_fill,g_face,r_max`);

export const cdnChatUrl = (url: string): string =>
  insertTransform(url, 'f_auto,q_auto:good,w_900,fl_progressive');

export const cdnFullUrl = (url: string): string =>
  insertTransform(url, 'f_auto,q_auto:best');

export const cdnVideoThumbUrl = (url: string, w = 400, h = 300): string => {
  // Generate thumbnail from first frame (so_0) of the video
  // w_xxx,h_xxx,c_fill = resize+crop to exact dimensions
  // f_jpg = force JPEG output (fast, widely supported)
  // q_auto:good = smart quality
  if (!url?.includes('cloudinary.com')) return '';
  const videoUrl = url
    .replace('/image/upload/', '/video/upload/')
    .replace('/video/upload/', `/video/upload/so_0,w_${w},h_${h},c_fill,f_jpg,q_auto:good/`);
  return videoUrl.replace(/\.(mp4|mov|webm|avi|m3u8)$/, '.jpg');
};

export const cdnVideoUrl = (url: string): string => {
  if (!url?.includes('cloudinary.com')) return url ?? '';
  // VIDEO STREAMING TRANSFORMATIONS:
  //   vc_auto       = transcode to best codec (h264/vp9) per device ✅
  //   f_auto        = auto format (mp4/webm) per browser/device ✅
  //   q_auto:good   = adaptive quality
  //   fl_progressive = progressive streaming — playback starts before full download ✅
  //   sp_hd         = streaming profile HD (Cloudinary adaptive bitrate) ✅
  // Result: video streams from first bytes, no waiting for full download
  const videoUrl = url
    .replace('/image/upload/', '/video/upload/')  // fix wrong resource type
    .replace('/video/upload/', '/video/upload/vc_auto,f_auto,q_auto:good,fl_progressive/');
  return videoUrl;
};

// Streaming URL — uses Cloudinary adaptive streaming (HLS/DASH)
// For long videos: delivers in chunks, never needs full download first
export const cdnVideoStreamUrl = (url: string): string => {
  if (!url?.includes('cloudinary.com')) return url ?? '';
  // sp_hd = HD streaming profile — Cloudinary generates adaptive bitrate stream
  // Works exactly like YouTube/Instagram streaming ✅
  const base = url
    .replace('/image/upload/', '/video/upload/')
    .replace('/video/upload/', '/video/upload/sp_hd/');
  // Return .m3u8 for HLS streaming (iOS native, Android via ExoPlayer)
  return base.replace(/\.(mp4|mov|webm|avi)$/, '.m3u8');
};

export const cdnThumbUrl = (url: string, size = 200): string =>
  insertTransform(url, `f_auto,q_auto:low,w_${size},h_${size},c_fill`);

const insertTransform = (url: string, t: string): string => {
  if (!url?.includes('cloudinary.com')) return url ?? '';
  return url.replace('/upload/', `/upload/${t}/`);
};
