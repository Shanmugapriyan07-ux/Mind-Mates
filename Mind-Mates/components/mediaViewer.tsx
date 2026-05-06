// components/MediaViewer.tsx
// Full-screen media viewer — Instagram / WhatsApp style
//
// VIDEO PLAYBACK FIX:
//   Problem: video URL from Cloudinary (/image/upload/...) was wrong resource type
//   Fix:     cdnVideoUrl() ensures /video/upload/ + f_auto for proper streaming
//
//   expo-av Video props for reliable playback:
//     useNativeControls={false}  — we build our own controls
//     shouldPlay={false}         — don't auto-play (user taps to play)
//     isLooping={false}
//     resizeMode="contain"
//     The key fix: source={{ uri }} must use a direct .mp4 URL, not a Cloudinary
//     transformation URL with a .jpg extension (common mistake after chat images)
//
//   Auto-pause on screen leave: handled by Modal visible=false → Video unmounts ✅

import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Platform, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { Image }              from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import { Ionicons }            from '@expo/vector-icons';
import { useSafeAreaInsets }   from 'react-native-safe-area-context';
import { cdnFullUrl, cdnVideoUrl } from '@/lib/cloudinaryUpload';

const { width: SW, height: SH } = Dimensions.get('window');

// Lazy-load native-only modules
let Video:        any = null;
let MediaLibrary: any = null;
let FileSystem:   any = null;

if (Platform.OS !== 'web') {
  try { Video        = require('expo-av').Video;      } catch {}
  try { MediaLibrary = require('expo-media-library'); } catch {}
  try { FileSystem   = require('expo-file-system');   } catch {}
}

interface Props {
  uri:     string | null;
  type:    'image' | 'video';
  onClose: () => void;
}

export const MediaViewer = ({ uri, type, onClose }: Props) => {
  const insets = useSafeAreaInsets();

  // ── All hooks at top ──────────────────────────────────────────
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [isPlaying,  setIsPlaying]  = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [duration,   setDuration]   = useState(0);
  const [position,   setPosition]   = useState(0);
  const [muted,      setMuted]      = useState(false);

  const videoRef  = useRef<any>(null);
  const fadeAnim  = useSharedValue(0);
  const scaleAnim = useSharedValue(0.94);

  useEffect(() => {
    if (uri) {
      fadeAnim.value  = withTiming(1,  { duration: 200 });
      scaleAnim.value = withSpring(1,  { damping: 20, stiffness: 280 });
      setIsPlaying(false); setProgress(0);
      setVideoReady(false); setVideoError(false);
      setSaved(false); setMuted(false);
    } else {
      fadeAnim.value  = withTiming(0,  { duration: 160 });
      scaleAnim.value = withTiming(0.94, { duration: 160 });
    }
  }, [uri]);

  const bgStyle    = useAnimatedStyle(() => ({ opacity: fadeAnim.value }));
  const mediaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  // Build the correct video URL.
  // CRITICAL: Cloudinary video URLs must use /video/upload/ not /image/upload/.
  // If the URL ends in .mp4 but goes through /image/upload/, the CDN returns a 404.
  // cdnVideoUrl ensures /video/upload/ + fl_progressive + vc_auto
  // This makes Cloudinary stream progressively — playback starts before full download ✅
  const videoUri = uri ? cdnVideoUrl(uri) : null;
  const imageUri = uri ? cdnFullUrl(uri)  : null;

  // ── Play / Pause ──────────────────────────────────────────────
  // Track whether user has tapped play (to auto-start when videoReady fires)
  const pendingPlayRef = useRef(false);

  const handlePlayPause = useCallback(async () => {
    if (!videoRef.current) return;
    if (!videoReady) {
      // Video not ready yet — mark pending so it starts when ready
      pendingPlayRef.current = true;
      return;
    }
    try {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        if (progress >= 0.99) {
          await videoRef.current.setPositionAsync(0);
        }
        await videoRef.current.playAsync();
      }
    } catch (e) {
      console.warn('[video playPause]', e);
    }
  }, [isPlaying, videoReady, progress]);

  // ── Seek ──────────────────────────────────────────────────────
  const handleSeek = useCallback(async (ratio: number) => {
    if (!videoRef.current || !duration) return;
    try {
      await videoRef.current.setPositionAsync(ratio * duration);
    } catch {}
  }, [duration]);

  // ── Playback status ───────────────────────────────────────────
  const handleStatus = useCallback((status: any) => {
    if (status.isLoaded) {
      setVideoReady(true);
      // If user tapped play before the video was ready, start now ✅
      if (pendingPlayRef.current && !status.isPlaying && videoRef.current) {
        pendingPlayRef.current = false;
        videoRef.current.playAsync().catch(() => {});
      }
      setIsPlaying(status.isPlaying  ?? false);
      setDuration( status.durationMillis ?? 0);
      setPosition( status.positionMillis ?? 0);
      setProgress( status.durationMillis
        ? (status.positionMillis / status.durationMillis) : 0);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setProgress(0);
      }
    }
    if (status.error) {
      console.error('[video error]', status.error);
      setVideoError(true);
    }
  }, []);

  // ── Save to device ────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!uri || saving) return;
    setSaving(true);
    try {
      if (Platform.OS === 'web') {
        const a     = document.createElement('a');
        a.href      = uri;
        a.download  = `mindmates_${Date.now()}.${type === 'video' ? 'mp4' : 'jpg'}`;
        a.click();
        setSaved(true); return;
      }
      if (!MediaLibrary || !FileSystem) {
        Alert.alert('Missing package', 'Run: npx expo install expo-media-library expo-file-system');
        return;
      }
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed'); return; }

      const ext        = type === 'video' ? 'mp4' : 'jpg';
      const localPath  = `${FileSystem.cacheDirectory}mm_${Date.now()}.${ext}`;
      const dl         = await FileSystem.downloadAsync(uri, localPath);
      if (dl.status !== 200) throw new Error(`Download failed (${dl.status})`);
      await MediaLibrary.createAssetAsync(dl.uri);
      FileSystem.deleteAsync(localPath, { idempotent: true }).catch(() => {});
      setSaved(true);
    } catch (e: any) {
      Alert.alert('Save failed', e?.message);
    } finally {
      setSaving(false);
    }
  }, [uri, type, saving]);

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  };

  if (!uri) return null;
  const isVideo = type === 'video';

  return (
    <Modal visible={!!uri} transparent animationType="none"
      onRequestClose={onClose} statusBarTranslucent>

      <Animated.View style={[v.backdrop, bgStyle]}>

        {/* Top bar */}
        <View style={[v.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={v.iconBtn} onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="close" size={22} color="#fff"/>
          </TouchableOpacity>
          <View style={{ flex: 1 }}/>
          <TouchableOpacity
            style={[v.saveBtn, saved && v.savedBtn]}
            onPress={handleSave} disabled={saving || saved} activeOpacity={0.8}>
            {saving
              ? <ActivityIndicator size="small" color="#fff"/>
              : <>
                  <Ionicons name={saved ? 'checkmark' : 'download-outline'} size={16} color="#fff"/>
                  <Text style={v.saveTxt}>{saved ? 'Saved' : 'Save'}</Text>
                </>}
          </TouchableOpacity>
        </View>

        {/* Media area */}
        <Animated.View style={[v.mediaWrap, mediaStyle]}>

          {isVideo ? (
            Platform.OS === 'web' ? (
              // Web: native <video> element
              <View style={v.media}>
                {React.createElement('video', {
                  src:          videoUri ?? uri,
                  controls:     true,
                  playsInline:  true,
                  preload:      'auto',
                  style: {
                    width:'100%', height:'100%',
                    objectFit:'contain', backgroundColor:'#000',
                  },
                })}
              </View>
            ) : Video ? (
              // Native: expo-av
              // KEY PROPS for reliable playback:
              //   source={{ uri: videoUri }}  — must be /video/upload/ URL, not /image/upload/
              //   useNativeControls={false}   — custom controls below
              //   shouldPlay={false}          — user taps to start
              //   onPlaybackStatusUpdate      — drives our progress bar + play state
              <View style={v.media}>
                {!videoReady && !videoError && (
                  <View style={v.loadingOverlay}>
                    <ActivityIndicator size="large" color="#6D4AFF"/>
                    <Text style={v.loadingTxt}>Loading video…</Text>
                  </View>
                )}

                {videoError && (
                  <View style={v.errorOverlay}>
                    <Ionicons name="alert-circle-outline" size={48} color="rgba(255,255,255,0.5)"/>
                    <Text style={v.errorTxt}>Could not play video</Text>
                    <Text style={v.errorSub}>{videoUri?.slice(0, 60)}</Text>
                  </View>
                )}

                <Video
                  ref={videoRef}
                  source={{ uri: videoUri ?? uri }}
                  style={v.media}
                  resizeMode={'contain' as any}
                  shouldPlay={false}
                  isLooping={false}
                  isMuted={muted}
                  useNativeControls={false}
                  // STREAMING CONFIG for instant playback:
                  // progressUpdateIntervalMillis=100 → smooth progress bar (10 updates/sec)
                  // positionMillis=0 → start from beginning
                  // The key to streaming is fl_progressive in the URL (set by cdnVideoUrl)
                  // expo-av streams automatically when the server supports range requests ✅
                  progressUpdateIntervalMillis={100}
                  positionMillis={0}
                  onPlaybackStatusUpdate={handleStatus}
                  onReadyForDisplay={() => {
                    // Video is ready to show first frame — hide loading spinner
                    setVideoReady(true);
                  }}
                  onError={(e: any) => {
                    console.error('[Video onError]', e, 'URI:', videoUri?.slice(0, 80));
                    setVideoError(true);
                  }}
                />

                {/* Play/pause overlay — only visible when not playing */}
                {!isPlaying && !videoError && (
                  <TouchableOpacity
                    style={v.playOverlay} onPress={handlePlayPause} activeOpacity={0.7}>
                    <View style={v.playBtn}>
                      {!videoReady
                        ? <ActivityIndicator size="large" color="#fff"/>
                        : <Ionicons name="play" size={34} color="#fff"/>}
                    </View>
                  </TouchableOpacity>
                )}

                {/* Tap to pause when playing */}
                {isPlaying && (
                  <TouchableOpacity
                    style={v.playOverlay} onPress={handlePlayPause} activeOpacity={0.85}>
                    <View/>
                  </TouchableOpacity>
                )}

                {/* Bottom controls */}
                {videoReady && (
                  <View style={v.controls}>
                    {/* Time */}
                    <Text style={v.timeTxt}>{fmt(position)}</Text>

                    {/* Progress bar — touchable for seeking */}
                    <TouchableOpacity
                      style={v.progressTrack}
                      activeOpacity={1}
                      onPress={(e) => {
                        const x = e.nativeEvent.locationX;
                        handleSeek(x / (SW - 100));
                      }}>
                      <View style={[v.progressFill, { width: `${progress * 100}%` as any }]}/>
                      <View style={[v.progressThumb, { left: `${progress * 100}%` as any }]}/>
                    </TouchableOpacity>

                    <Text style={v.timeTxt}>{fmt(duration)}</Text>

                    {/* Mute toggle */}
                    <TouchableOpacity onPress={() => setMuted(m => !m)} style={{ padding:4 }}>
                      <Ionicons
                        name={muted ? 'volume-mute' : 'volume-medium'}
                        size={18} color="#fff"/>
                    </TouchableOpacity>

                    {/* Play/pause inline */}
                    <TouchableOpacity onPress={handlePlayPause} style={{ padding:4 }}>
                      <Ionicons
                        name={isPlaying ? 'pause' : 'play'}
                        size={20} color="#fff"/>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

            ) : (
              <View style={[v.media, v.fallback]}>
                <Ionicons name="videocam-outline" size={56} color="rgba(255,255,255,0.4)"/>
                <Text style={v.fallbackTxt}>Run: npx expo install expo-av</Text>
              </View>
            )
          ) : (
            // Image
            <Image
              source={{ uri: imageUri ?? uri }}
              style={v.media}
              resizeMode="contain"
            />
          )}
        </Animated.View>

        {/* Backdrop tap to close */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={onClose} activeOpacity={1}/>
      </Animated.View>
    </Modal>
  );
};

export default MediaViewer;

const v = StyleSheet.create({
  backdrop:      { flex:1, backgroundColor:'rgba(0,0,0,0.97)',
                   alignItems:'center', justifyContent:'center' },
  topBar:        { position:'absolute', top:0, left:0, right:0, flexDirection:'row',
                   alignItems:'center', paddingHorizontal:16, paddingBottom:12,
                   zIndex:10, backgroundColor:'rgba(0,0,0,0.5)' },
  iconBtn:       { width:40, height:40, borderRadius:20, alignItems:'center',
                   justifyContent:'center', backgroundColor:'rgba(255,255,255,0.15)' },
  saveBtn:       { flexDirection:'row', alignItems:'center', gap:6,
                   backgroundColor:'rgba(255,255,255,0.2)', paddingHorizontal:14,
                   paddingVertical:8, borderRadius:20 },
  savedBtn:      { backgroundColor:'rgba(34,197,94,0.45)' },
  saveTxt:       { color:'#fff', fontSize:14, fontWeight:'600' },
  mediaWrap:     { width:SW, height:SH*0.82, alignItems:'center', justifyContent:'center' },
  media:         { width:SW, height:SH*0.82 },
  loadingOverlay:{ ...StyleSheet.absoluteFillObject, alignItems:'center',
                   justifyContent:'center', gap:12 },
  loadingTxt:    { color:'rgba(255,255,255,0.7)', fontSize:13 },
  errorOverlay:  { ...StyleSheet.absoluteFillObject, alignItems:'center',
                   justifyContent:'center', gap:8, paddingHorizontal:32 },
  errorTxt:      { color:'rgba(255,255,255,0.7)', fontSize:15, fontWeight:'600' },
  errorSub:      { color:'rgba(255,255,255,0.4)', fontSize:11, textAlign:'center' },
  playOverlay:   { ...StyleSheet.absoluteFillObject, alignItems:'center', justifyContent:'center' },
  playBtn:       { width:68, height:68, borderRadius:34, backgroundColor:'rgba(0,0,0,0.6)',
                   alignItems:'center', justifyContent:'center', paddingLeft:4 },
  controls:      { position:'absolute', bottom:0, left:0, right:0, flexDirection:'row',
                   alignItems:'center', gap:8, paddingHorizontal:14, paddingVertical:12,
                   backgroundColor:'rgba(0,0,0,0.65)' },
  timeTxt:       { color:'#fff', fontSize:11, fontWeight:'500', minWidth:40, textAlign:'center' },
  progressTrack: { flex:1, height:3, backgroundColor:'rgba(255,255,255,0.3)',
                   borderRadius:2, position:'relative' },
  progressFill:  { height:'100%', backgroundColor:'#6D4AFF', borderRadius:2 },
  progressThumb: { position:'absolute', top:-4, width:11, height:11, borderRadius:6,
                   backgroundColor:'#fff', transform:[{ translateX:-5 }] },
  fallback:      { alignItems:'center', justifyContent:'center', gap:12 },
  fallbackTxt:   { color:'rgba(255,255,255,0.4)', fontSize:13 },
});