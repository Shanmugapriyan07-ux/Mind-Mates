import React, { useCallback, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity,
  StyleSheet, Dimensions, Platform,
  TextInput, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SW, height: SH } = Dimensions.get('window');

// ── Lazy import expo-av only on native ──────────────────────────
// expo-av is not needed on web (we use HTML <video>)
// Importing it conditionally avoids web bundle issues
let VideoComponent: any = null;
if (Platform.OS !== 'web') {
  try {
    // Dynamic import so web doesn't bundle expo-av
    const av = require('expo-av');
    VideoComponent = av.Video;
    console.log('✅ expo-av loaded for native video');
  } catch {
    console.warn('⚠️ expo-av not installed — run: npx expo install expo-av');
  }
}

interface Props {
  uri:       string | null;
  type:      'image' | 'video';
  onSend:    (caption: string) => void;
  onClose:   () => void;
  sending:   boolean;
  otherName: string;
}

export const MediaPreview = ({
  uri, type, onSend, onClose, sending, otherName,
}: Props) => {
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = React.useState('');

  // ── ALL hooks at top — Rules of Hooks ────────────────────────
  const slideAnim = useSharedValue(SH);
  const fadeAnim  = useSharedValue(0);

  useEffect(() => {
    if (uri) {
      fadeAnim.value  = withTiming(1,  { duration: 5 });
      slideAnim.value = withSpring(0,  { damping: 280, stiffness: 280, mass:0.08 });
    } else {
      fadeAnim.value  = withTiming(0,  { duration: 1 });
      slideAnim.value = withTiming(SH, { duration: 1 });
      setCaption('');
    }
  }, [uri]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideAnim.value }],
  }));
  const bgStyle = useAnimatedStyle(() => ({ opacity: fadeAnim.value }));

  const handleSend = useCallback(() => {
    if (sending) return;
    onSend(caption.trim());
  }, [caption, onSend, sending]);

  // ── Conditional render AFTER hooks ───────────────────────────
  if (!uri) return null;

  const isVideo = type === 'video';

  return (
    <Animated.View style={[mp.backdrop, bgStyle]}>
      <Animated.View style={[mp.container, containerStyle]}>

        {/* Header */}
        <View style={[mp.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={mp.closeBtn} activeOpacity={0.8}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={mp.headerTitle}>Send to {otherName}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* ── Media area ─────────────────────────────────────── */}
        <View style={mp.mediaArea}>
          {isVideo ? (
            <VideoPreview uri={uri} />
          ) : (
            // Image: blob:// on web, file:// on native — both work
            <Image
              source={{ uri }}
              style={mp.mediaFill}
              resizeMode="contain"
            />
          )}
        </View>

        {/* Caption + Send */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={mp.bottomArea}
        >
          <View style={[mp.inputRow, { paddingBottom: insets.bottom + 12 }]}>
            <View style={mp.captionWrap}>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Add a caption..."
                placeholderTextColor="rgba(255,255,255,0.45)"
                style={mp.captionInput}
                multiline maxLength={500}
                selectionColor="#6D4AFF"
                keyboardAppearance="dark"
              />
            </View>
            <TouchableOpacity
              style={[mp.sendBtn, sending && { opacity: 0.6 }]}
              onPress={handleSend}
              disabled={sending}
              activeOpacity={0.85}
            >
              {sending
                ? <ActivityIndicator size="small" color="#000" />
                : <Ionicons name="send" size={20} color="#6D4AFF" />
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Animated.View>
  );
};

// ════════════════════════════════════════════════════════════════
// VIDEO PREVIEW — platform-specific
// TEACHING:
//   Web:    HTML <video> element — handles blob: URIs natively
//   Native: expo-av <Video>    — handles file:// URIs natively
//   Why different?
//     React Native <Image> only decodes image formats
//     Video requires a native decoder (AVPlayer/ExoPlayer)
//     expo-av bridges to those native decoders ✅
// ════════════════════════════════════════════════════════════════
const VideoPreview = ({ uri }: { uri: string }) => {

  if (Platform.OS === 'web') {
    // ── WEB: native HTML video element ───────────────────────
    // React.createElement used because JSX <video> not valid in RN
    return (
      <View style={mp.mediaFill}>
        {React.createElement('video', {
          src:         uri,
          controls:    true,
          autoPlay:    false,
          playsInline: true,
          style: {
            width:           '100%',
            height:          '100%',
            objectFit:       'contain',
            backgroundColor: '#000',
          },
        })}
      </View>
    );
  }

  // ── NATIVE: expo-av Video ─────────────────────────────────
  if (VideoComponent) {
    return (
      <VideoComponent
        source={{ uri }}
        style={mp.mediaFill}
        useNativeControls
        resizeMode="contain"
        shouldPlay={false}
        isLooping={false}
      />
    );
  }

  // ── Fallback: expo-av not installed ───────────────────────
  return (
    <View style={[mp.mediaFill, mp.videoFallback]}>
      <Ionicons name="videocam-outline" size={56} color="rgba(255,255,255,0.6)" />
      <Text style={mp.fallbackText}>Video ready to send</Text>
      <Text style={mp.fallbackSub}>Install expo-av for preview</Text>
      <Text style={mp.fallbackCmd}>npx expo install expo-av</Text>
    </View>
  );
};

export default MediaPreview;

const mp = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 999,
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 10,
    top:10
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },

  mediaArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  mediaFill: {
    width: SW,
    flex: 1,
  },

  // Fallback when expo-av missing
  videoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  fallbackText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  fallbackSub:  { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  fallbackCmd:  {
    backgroundColor: '#1C1C1E', color: '#34D399',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 6, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  bottomArea: {
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingTop: 12, gap: 10,
  },
  captionWrap: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  captionInput: {
    fontSize: 15, color: '#fff', maxHeight: 80, lineHeight: 20,
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
});