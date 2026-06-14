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
import { s, vs, ms } from '@/utils/scale';
const { width: SW, height: SH } = Dimensions.get('window');
let VideoComponent: any = null;
if (Platform.OS !== 'web') {
  try {
    const av = require('expo-av');
    VideoComponent = av.Video;
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
  if (!uri) return null;
  const isVideo = type === 'video';
  return (
    <Animated.View style={[mp.backdrop, bgStyle]}>
      <Animated.View style={[mp.container, containerStyle]}>
        <View style={[mp.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={mp.closeBtn} activeOpacity={0.8}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={mp.headerTitle}>Send to {otherName}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={mp.mediaArea}>
          {isVideo ? (
            <VideoPreview uri={uri} />
          ) : (
            <Image
              source={{ uri }}
              style={mp.mediaFill}
              resizeMode="contain"
            />
          )}
        </View>
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
const VideoPreview = ({ uri }: { uri: string }) => {

  if (Platform.OS === 'web') {
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
  return (
    <View style={[mp.mediaFill, mp.videoFallback]}>
      <Ionicons name="videocam-outline" size={56} color="rgba(255,255,255,0.6)" />
      <Text style={mp.fallbackText}>Video ready to send</Text>
    </View>
  );
};
export default MediaPreview;
const mp = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 10,
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(16),
    paddingBottom: vs(12),
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 10,
    top:vs(10)
  },
  closeBtn: {
    width: s(40), height: s(40), borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: ms(16), fontWeight: '600', color: '#fff' },

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
  videoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(10),
  },
  fallbackText: { color: '#fff', fontSize: ms(16), fontWeight: '600' },
  fallbackSub:  { color: 'rgba(255,255,255,0.5)', fontSize: ms(13) },
  fallbackCmd:  {
    backgroundColor: '#1C1C1E', color: '#34D399',
    paddingHorizontal: s(12), paddingVertical: vs(6),
    borderRadius: 6, fontSize: ms(12), fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  bottomArea: {
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: s(12), paddingTop: vs(12), gap: s(10),
  },
  captionWrap: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 22,
    paddingHorizontal: s(16), paddingVertical: vs(8),
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  captionInput: {
    fontSize: ms(15), color: '#fff', maxHeight: s(80), lineHeight: vs(20),
  },
  sendBtn: {
    width: s(46), height: s(46), borderRadius: s(23),
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: vs(2),
  },
});