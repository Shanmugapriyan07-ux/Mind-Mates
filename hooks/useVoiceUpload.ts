/**
 * useVoiceUpload
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles Supabase Storage upload + chat table insert for voice messages.
 *
 * Strategy:
 *   • Upload audio to: voice-messages/{userId}/{timestamp}.m4a
 *   • Insert metadata row into chat messages table with type = "voice".
 *   • On failure → add to persistent retry queue.
 *   • NetInfo listener → auto-retry queue when connection restores.
 *   • Optimistic: caller receives a tempId immediately; hook fires callback
 *     with (tempId, realMsg) when the real row is ready.
 *
 * Never stores binary audio in the database — URL only.
 */

import { callFn } from "@/lib/callFn";
import { supabase } from "@/lib/supabase";
import NetInfo from "@react-native-community/netinfo";
import * as FileSystem from "expo-file-system";
import { useCallback, useEffect, useRef } from "react";
import { File } from 'expo-file-system';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface VoiceUploadPayload {
  localUri: string;
  durationMs: number;
  waveform: number[];
  chatId: string;
  senderId: string;
  replyToId?: string | null;
  replyToText?: string | null;
  replyToSender?: string | null;
}

export interface VoiceUploadCallbacks {
  /** Fired immediately with a temp ID so caller can show optimistic bubble. */
  onOptimistic: (tempId: string) => void;
  /** Fired when real row is confirmed (replace tempId bubble). */
  onSuccess: (tempId: string, audioUrl: string, messageId: string) => void;
  /** Fired on permanent failure after all retries. */
  onFailed: (tempId: string) => void;
}

interface QueueItem {
  payload: VoiceUploadPayload;
  tempId: string;
  retries: number;
  callbacks: VoiceUploadCallbacks;
}

// ─── Module-level retry queue ─────────────────────────────────────────────────
// Persists across component re-renders; items survive brief unmounts.
const retryQueue: QueueItem[] = [];
const MAX_RETRIES = 5;

// ─── Upload to Supabase Storage ───────────────────────────────────────────────
const uploadAudio = async (
  localUri: string,
  senderId: string
): Promise<string> => {
  const timestamp = Date.now();
  const storagePath = `voice-messages/${senderId}/${timestamp}.m4a`;

  const file = new File(localUri);

const base64 = await file.base64();

  // Decode to Uint8Array for Supabase upload
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const { error } = await supabase.storage
    .from("voice-messages")
    .upload(storagePath, bytes.buffer, {
      contentType: "audio/mp4",
      upsert: false,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from("voice-messages")
    .getPublicUrl(storagePath);

  if (!urlData?.publicUrl) throw new Error("Failed to get public URL");
  return urlData.publicUrl;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useVoiceUpload = () => {
  const processingRef = useRef(false);

  // ── Process one item from the queue ─────────────────────────────────────────
  const processItem = useCallback(async (item: QueueItem) => {
    const { payload, tempId, callbacks } = item;
    try {
      const audioUrl = await uploadAudio(payload.localUri, payload.senderId);

      // Insert into chat table via Edge Function
      const result = await callFn({
        action: "send_message",
        chatId: payload.chatId,
        message: "", // empty text; type=voice carries the content
        type: "voice",
        audioUrl,
        duration: Math.round(payload.durationMs / 1000),
        waveform: JSON.stringify(payload.waveform),
        replyToId: payload.replyToId ?? null,
        replyToText: payload.replyToText ?? null,
        replyToSender: payload.replyToSender ?? null,
      });

      const messageId = result?.messageId ?? tempId;

      // Clean up local temp file
      try {
        await FileSystem.deleteAsync(payload.localUri, { idempotent: true });
      } catch {
        /* non-critical */
      }

      callbacks.onSuccess(tempId, audioUrl, messageId);

      // Remove from queue
      const idx = retryQueue.indexOf(item);
      if (idx !== -1) retryQueue.splice(idx, 1);
    } catch (e) {
      console.error("[useVoiceUpload] upload failed:", e);
      item.retries += 1;

      if (item.retries >= MAX_RETRIES) {
        // Permanent failure
        const idx = retryQueue.indexOf(item);
        if (idx !== -1) retryQueue.splice(idx, 1);
        callbacks.onFailed(tempId);
      }
      // else: leave in queue for next network recovery
    }
  }, []);

  // ── Drain queue ───────────────────────────────────────────────────────────────
  const drainQueue = useCallback(async () => {
    if (processingRef.current || retryQueue.length === 0) return;
    processingRef.current = true;
    // Process sequentially to avoid hammering the server
    for (const item of [...retryQueue]) {
      await processItem(item);
    }
    processingRef.current = false;
  }, [processItem]);

  // ── NetInfo: auto-retry when connection returns ───────────────────────────────
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && retryQueue.length > 0) {
        drainQueue();
      }
    });
    return unsubscribe;
  }, [drainQueue]);

  // ── Public: enqueue upload ────────────────────────────────────────────────────
  const enqueueUpload = useCallback(
    (payload: VoiceUploadPayload, callbacks: VoiceUploadCallbacks) => {
      const tempId = `voice_tmp_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 7)}`;

      // Fire optimistic callback immediately
      callbacks.onOptimistic(tempId);

      const item: QueueItem = { payload, tempId, retries: 0, callbacks };
      retryQueue.push(item);

      // Try immediately
      drainQueue();

      return tempId;
    },
    [drainQueue]
  );

  return { enqueueUpload };
};