import { callFn } from "@/lib/callFn";
import NetInfo from "@react-native-community/netinfo";
import { File } from "expo-file-system";
import { useCallback, useEffect, useRef } from "react";
export interface VoiceUploadPayload {
  localUri:       string;
  durationMs:     number;
  waveform:       number[];
  chatId:         string;
  senderId:       string;
  replyToId?:     string | null;
  replyToText?:   string | null;
  replyToSender?: string | null;
}
export interface VoiceUploadCallbacks {
  onOptimistic: (tempId: string) => void;
  onSuccess:    (tempId: string, audioUrl: string, messageId: string) => void;
  onFailed:     (tempId: string) => void;
}
interface QueueItem {
  payload:   VoiceUploadPayload;
  tempId:    string;
  retries:   number;
  callbacks: VoiceUploadCallbacks;
}
const retryQueue: QueueItem[]  = [];
const MAX_RETRIES               = 5;
const CLOUDINARY_UPLOAD_URL     = "https://api.cloudinary.com/v1_1";
interface SignedParams {
  cloudName:  string;
  apiKey:     string;
  signature:  string;
  timestamp:  string;
  publicId:   string;
  folder:     string;
}
const getSignedParams = async (senderId: string): Promise<SignedParams> => {
  const result = await callFn({
    action:       "sign_voice_upload",
    userId:       senderId,
    resourceType: "video", 
  });

  if (!result?.signature) throw new Error("Failed to get upload signature");
  return result as SignedParams;
};
const uploadToCloudinary = async (
  localUri:  string,
  senderId:  string,
): Promise<string> => {
  const params = await getSignedParams(senderId);
  const formData = new FormData();
  formData.append("file",       {
  uri: localUri,
  type: "audio/mp4",
  name: "voice.m4a",
} as any);
  formData.append("api_key",    params.apiKey);
  formData.append("timestamp",  params.timestamp);
  formData.append("signature",  params.signature);
  formData.append("public_id",  params.publicId);
  formData.append("folder",     params.folder);
  formData.append("resource_type", "video");
  const res = await fetch(
    `${CLOUDINARY_UPLOAD_URL}/${params.cloudName}/video/upload`,
    {
      method:  "POST",
      body:    formData,
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Cloudinary upload failed: ${res.status}`);
  }
  const data = await res.json();
  if (!data?.secure_url) throw new Error("No secure_url in Cloudinary response");
  return data.secure_url as string;
};
const saveVoiceMessage = async (
  payload:  VoiceUploadPayload,
  audioUrl: string,
): Promise<string> => {
  const result = await callFn({
    action:        "send_message",
    chatId:        payload.chatId,
    message:       "",
    type:          "voice",
    audioUrl,
    duration:      Math.round(payload.durationMs / 1000),
    waveform:      JSON.stringify(payload.waveform),
    replyToId:     payload.replyToId     ?? null,
    replyToText:   payload.replyToText   ?? null,
    replyToSender: payload.replyToSender ?? null,
  });
  return result?.messageId ?? "";
};
const processItem = async (item: QueueItem): Promise<void> => {
  const { payload, tempId, callbacks } = item;
  try {
    const audioUrl = await uploadToCloudinary(payload.localUri, payload.senderId);
    const messageId = await saveVoiceMessage(payload, audioUrl);
    try {
      const file = new File(payload.localUri);
      if (file.exists) {
        await file.delete();
      }
    } catch {
    }
    callbacks.onSuccess(tempId, audioUrl, messageId);
    const idx = retryQueue.indexOf(item);
    if (idx !== -1) retryQueue.splice(idx, 1);
  } catch (e: any) {
    console.warn("[useVoiceUpload] upload failed:", e?.message);
    item.retries += 1;
    if (item.retries >= MAX_RETRIES) {
      const idx = retryQueue.indexOf(item);
      if (idx !== -1) retryQueue.splice(idx, 1);
      callbacks.onFailed(tempId);
    }
  }
};
export const useVoiceUpload = () => {
  const processingRef = useRef(false);
  const drainQueue = useCallback(async () => {
    if (processingRef.current || retryQueue.length === 0) return;
    processingRef.current = true;
    for (const item of [...retryQueue]) {
      await processItem(item);
    }
    processingRef.current = false;
  }, []);
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected && retryQueue.length > 0) drainQueue();
    });
    return unsub;
  }, [drainQueue]);
  const enqueueUpload = useCallback(
    (payload: VoiceUploadPayload, callbacks: VoiceUploadCallbacks): string => {
      const tempId = `voice_tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      callbacks.onOptimistic(tempId);
      retryQueue.push({ payload, tempId, retries: 0, callbacks });
      drainQueue();
      return tempId;
    },
    [drainQueue]
  );
  return { enqueueUpload };
};