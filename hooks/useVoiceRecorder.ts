import { Audio } from "expo-av";
import { useCallback, useEffect, useRef, useState } from "react";
export interface RecordingResult {
  uri: string;
  durationMs: number;
  waveform: number[]; 
}
export type RecordingState =
  | "idle"
  | "requesting"
  | "recording"
  | "stopping"
  | "error";
const SAMPLE_INTERVAL_MS = 80;
const MAX_WAVEFORM_BARS = 50; 
const MAX_DURATION_MS = 120_000;
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: ".m4a",
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 32000,
  },
  ios: {
    extension: ".m4a",
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.LOW,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 32000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: undefined,
    bitsPerSecond: undefined
  }
};
export const useVoiceRecorder = () => {
  const [state, setState] = useState<RecordingState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [liveBars, setLiveBars] = useState<number[]>([]);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const meterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const rawMeterRef = useRef<number[]>([]); 
  const stopAndSaveRef = useRef<(() => Promise<RecordingResult | null>) | null>(null);
  const clearTimers = useCallback(() => {
    if (meterTimerRef.current) {
      clearInterval(meterTimerRef.current);
      meterTimerRef.current = null;
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);
  const releaseRecording = useCallback(async () => {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {
      }
      recordingRef.current = null;
    }
  }, []);
  const dbToBar = (db: number): number => {
    const clamped = Math.max(-60, Math.min(0, db));
    return Math.round(((clamped + 60) / 60) * 95) + 5;
  };
  const buildWaveform = (samples: number[]): number[] => {
    if (!samples.length) return [];
    const count = Math.min(samples.length, MAX_WAVEFORM_BARS);
    if (samples.length <= count) return samples;
    const step = samples.length / count;
    return Array.from({ length: count }, (_, i) => {
      const idx = Math.floor(i * step);
      return samples[idx];
    });
  };
  const startRecording = useCallback(async (): Promise<boolean> => {
    if (state !== "idle") return false;
    setState("requesting");
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        setState("error");
        return false;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        RECORDING_OPTIONS,
        undefined,
        SAMPLE_INTERVAL_MS
      );
      recordingRef.current = recording;
      rawMeterRef.current = [];
      startTimeRef.current = Date.now();
      setElapsedMs(0);
      setLiveBars([]);
      setState("recording");
      durationTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setElapsedMs(elapsed);
        if (elapsed >= MAX_DURATION_MS) {
          stopAndSaveRef.current?.().catch(console.error);
        }
      }, 250);
      meterTimerRef.current = setInterval(async () => {
        if (!recordingRef.current) return;
        try {
          const status = await recordingRef.current.getStatusAsync();
          if (!status.isRecording) return;
          const db =
            (status as any).metering !== undefined
              ? (status as any).metering
              : -30;
          const bar = dbToBar(db);
          rawMeterRef.current.push(bar);
          setLiveBars((prev) => {
            const next = [...prev, bar];
            return next.length > 30 ? next.slice(next.length - 30) : next;
          });
        } catch {
        }
      }, SAMPLE_INTERVAL_MS);
      return true;
    } catch (e) {
      console.warn("[useVoiceRecorder] startRecording failed:", e);
      clearTimers();
      await releaseRecording();
      setState("error");
      setTimeout(() => setState("idle"), 1500);
      return false;
    }
  }, [state, clearTimers, releaseRecording]);
  const stopAndSave = useCallback(async (): Promise<RecordingResult | null> => {
    if (!recordingRef.current) return null;
    setState("stopping");
    clearTimers();
    const durationMs = Date.now() - startTimeRef.current;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) throw new Error("No URI from recording");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      const waveform = buildWaveform(rawMeterRef.current);
      rawMeterRef.current = [];
      setLiveBars([]);
      setElapsedMs(0);
      setState("idle");
      return { uri, durationMs, waveform };
    } catch (e) {
      console.warn("[useVoiceRecorder] stopAndSave failed:", e);
      recordingRef.current = null;
      setState("error");
      setTimeout(() => setState("idle"), 1500);
      return null;
    }
  }, [clearTimers]);
  stopAndSaveRef.current = stopAndSave;
  const stopAndDiscard = useCallback(async () => {
    clearTimers();
    await releaseRecording();
    rawMeterRef.current = [];
    setLiveBars([]);
    setElapsedMs(0);
    setState("idle");
  }, [clearTimers, releaseRecording]);
  useEffect(() => {
    return () => {
      clearTimers();
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
    };
  }, [clearTimers]);

  return {
    state,
    elapsedMs,
    liveBars,
    startRecording,
    stopAndSave,
    stopAndDiscard,
  };
};