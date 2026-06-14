import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Platform, ActivityIndicator,
  Pressable, Modal, Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { s, vs, ms } from '@/utils/scale';
const { height: SH } = Dimensions.get('window');
const T = {
  pill:      '#2C2C2E',
  white:     '#FFFFFF',
  grey:      '#8E8E93',
  purple:    '#6D4AFF',
  amber:     '#F59E0B',
  red:       '#FF3B30',
  pageBg:    '#000000',
  sheetBg:   '#1C1C1E',
  circle:    '#3A3A3C',
};
const MediaSheet = ({
  visible, onClose, onImage, onVideo, onCamera,
}: {
  visible:  boolean;
  onClose:  () => void;
  onImage:  () => void;
  onVideo:  () => void;
  onCamera: () => void;
}) => {
  const slideAnim = useSharedValue(SH);
  const fadeAnim  = useSharedValue(0);
  React.useEffect(() => {
    if (visible) {
      fadeAnim.value  = withTiming(1,  { duration: 1 });
      slideAnim.value = withSpring(1,  { damping: 200, stiffness: 400,mass: 0.8 });
    } else {
      fadeAnim.value  = withTiming(1,  { duration: 10 });
      slideAnim.value = withTiming(SH, { duration: 20 });
    }
  }, [visible]);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: fadeAnim.value }));
  const sheetStyle    = useAnimatedStyle(() => ({
    transform: [{ translateY: slideAnim.value }],
  }));
  if (!visible) return null;
  const opts = [
    {
      key: 'photo', icon: 'image-outline', label: 'Photo Library',
      sub: 'Choose from your photos', iconColor: '#ffffff', iconBg: '#6D4AFF',
      onPress: onImage,
    },
    {
      key: 'video', icon: 'videocam-outline', label: 'Video',
      sub: 'Choose a video clip', iconColor: '#ffffff', iconBg: '#6D4AFF',
      onPress: onVideo,
    },
    ...(Platform.OS !== 'web' ? [{
      key: 'camera', icon: 'camera-outline', label: 'Camera',
      sub: 'Take a photo or video', iconColor: '#ffffff', iconBg: '#6D4AFF', onCamera,
    }] : []),
  ];
  return (
    <Modal transparent animationType="none" visible={visible}
      onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[stt.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[stt.sheet, sheetStyle]}>
        <View style={stt.handle} />
        {opts.map((opt, i) => (
          <View key={opt.key}>
            <TouchableOpacity style={stt.row} activeOpacity={0.7}
              onPress={() => { onClose(); if (opt.onPress) setTimeout(opt.onPress, 80); }}>
              <View style={[stt.iconBox, { backgroundColor: opt.iconBg }]}>
                <Ionicons name={opt.icon as any} size={22} color={opt.iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={stt.rowLabel}>{opt.label}</Text>
                <Text style={stt.rowSub}>{opt.sub}</Text>
              </View>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={stt.cancelBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={stt.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};
interface ReplyMsg { $id: string; message: string; senderId: string; }
interface EditMsg  { $id: string; message: string; }
export interface Props {
  value:         string;
  onChangeText:  (text: string) => void;
  onSend:        () => void;
  sending:       boolean;
  disabled?:     boolean;
  inputRef?:     React.RefObject<TextInput>;
  chatId?:       string;
  replyTo?:      ReplyMsg | null;
  editingMsg?:   EditMsg  | null;
  onCancelReply: () => void;
  onCancelEdit:  () => void;
  myId:          string;
  otherName:     string;
  isBlocked?:    boolean;
  iBlockedThem?: boolean;
  onUnblock?:    () => void;
  blockedName?:  string;
  onMediaSend?:  (uri: string, type: 'image' | 'video') => void;
}
export const ChatInput = ({
  value, onChangeText, onSend, sending, disabled,
  inputRef,
  replyTo, editingMsg, onCancelReply, onCancelEdit,
  myId, otherName,
  isBlocked, iBlockedThem, onUnblock, blockedName,
  onMediaSend,
}: Props) => {
  const [showMedia, setShowMedia] = useState(false);
  const hasText  = useSharedValue(0);  
  const focused  = useSharedValue(0);  
  const sendStyle = useAnimatedStyle(() => ({
    width:      withTiming(hasText.value ? 36 : 0,  { duration: 10 }),
    opacity:    withTiming(hasText.value ? 1  : 0,  { duration: 10 }),
    marginLeft: withTiming(hasText.value ? 6  : 0,  { duration: 10 }),
    transform:  [{ scale: withSpring(hasText.value ? 1 : 0.4,
   { damping: 200, stiffness: 340 }) }],
  }));
  const plusStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(focused.value ? 0.70 : 1,
      { damping: 200, stiffness: 300 }) }],
    backgroundColor: withTiming(
      focused.value ? '#565658' : T.circle,
      { duration: 0 }
    ),
  }));
  const handleFocus = useCallback(() => { focused.value = 1; }, []);
  const handleBlur  = useCallback(() => { focused.value = 0; }, []);
  const handleChangeText = useCallback((text: string) => {
    onChangeText(text);
    hasText.value = text.trim().length > 0 ? 1 : 0;
  }, [onChangeText]);
  const handleSend = useCallback(() => {
    if (!value.trim() || sending || disabled) return;
    onSend();
    hasText.value = 0;
  }, [value, sending, disabled, onSend]);
  const pickImage = useCallback(async () => {
    try {
      const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!granted) {
        console.warn('❌ Photo library permission denied');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes:    ImagePicker.MediaTypeOptions.Images, 
        allowsEditing: true,
        quality:       0.8,
        aspect:        [4, 3],
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset?.uri) {
          console.log('✅ Image URI:', asset.uri.slice(0, 80));
          onMediaSend?.(asset.uri, 'image');
        }
      }
    } catch (e: any) {
      console.error('❌ pickImage failed:', e?.message);
    }
  }, [onMediaSend]);
  const pickVideo = useCallback(async () => {
    try {
      const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!granted) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes:       ImagePicker.MediaTypeOptions.Videos,
        allowsEditing:    true,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset?.uri) {
          console.log('✅ Video URI:', asset.uri.slice(0, 80));
          onMediaSend?.(asset.uri, 'video');
        }
      }
    } catch (e: any) {
      console.error('❌ pickVideo failed:', e?.message);
    }
  }, [onMediaSend]);
  const openCamera = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      const { granted } = await ImagePicker.requestCameraPermissionsAsync();
      if (!granted) return;

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true, quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset?.uri) {
          const type = asset.type === 'video' ? 'video' : 'image';
          onMediaSend?.(asset.uri, type);
        }
      }
    } catch (e: any) {
      console.error('❌ openCamera failed:', e?.message);
    }
  }, [onMediaSend]);

  if (isBlocked) {
    return (
      <View style={st.blockedWrap}>
        <Text style={st.blockedText}>
          {iBlockedThem
            ? `You blocked ${blockedName ?? 'this person'}. Unblock to message.`
            : `You can't message this person.`}
        </Text>
        {iBlockedThem && (
          <TouchableOpacity onPress={onUnblock} style={{ marginTop: 6 }}>
            <Text style={st.unblockText}>Tap to Unblock</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }
  return (
    <View style={st.wrapper}>
      {editingMsg && (
        <View style={[st.contextBar, { borderLeftColor: T.amber }]}>
          <View style={{ flex: 1 }}>
            <Text style={[st.ctxName, { color: T.amber }]}> Editing</Text>
            <Text style={st.ctxText} numberOfLines={1}>{editingMsg.message}</Text>
          </View>
          <TouchableOpacity onPress={onCancelEdit}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={18} color={T.grey} />
          </TouchableOpacity>
        </View>
      )}
      {replyTo && !editingMsg && (
        <View style={[st.contextBar, { borderLeftColor: T.purple }]}>
          <View style={{ flex: 1 }}>
            <Text style={[st.ctxName, { color: T.purple }]}>
              {replyTo.senderId === myId ? 'You' : otherName}
            </Text>
            <Text style={st.ctxText} numberOfLines={1}>{replyTo.message}</Text>
          </View>
          <TouchableOpacity onPress={onCancelReply}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={18} color={T.grey} />
          </TouchableOpacity>
        </View>
      )}
      <View style={st.row}>
        <Animated.View style={[st.plusCircle, plusStyle]}>
          <TouchableOpacity
            style={st.plusTouch}
            onPress={() => setShowMedia(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color={T.white} />
          </TouchableOpacity>
        </Animated.View>
        <View style={st.pill}>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={handleChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="Type a message..."
            placeholderTextColor={T.grey}
            multiline
            maxLength={1000}
            style={[st.input, { maxHeight: 120 }]}
            blurOnSubmit={false}
            selectionColor={T.purple}
            keyboardAppearance="dark"
          />
          <Animated.View style={[st.iconSlot, sendStyle]}>
            <TouchableOpacity
              style={st.sendBtn}
              onPress={handleSend}
              disabled={!value.trim() || sending || disabled}
              activeOpacity={0.8}
            >
              {sending
                ? <ActivityIndicator size="small" color="#000" />
                : <Ionicons name="send" size={18} color="#6D4AFF" />
              }
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
      <MediaSheet
        visible={showMedia}
        onClose={() => setShowMedia(false)}
        onImage={pickImage}
        onVideo={pickVideo}
        onCamera={openCamera}
      />
    </View>
  );
};

export default ChatInput;

const st = StyleSheet.create({
  wrapper: {
    backgroundColor: T.white,
    paddingHorizontal: s(12),
    paddingTop: vs(5),
    paddingBottom: Platform.OS === 'ios' ? vs(28) : vs(10),
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: s(10),
    shadowOffset: { width: 0, height: 5 },
  },

  contextBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: s(12), paddingVertical: vs(8),
    borderLeftWidth: s(3), borderRadius: s(8),
    marginBottom: vs(8), gap: vs(8),
  },
  ctxName: { fontSize: ms(11), fontWeight: '700', marginBottom: vs(1) },
  ctxText: { fontSize: ms(12), color: T.grey },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: s(8),
  },
  plusCircle: {
    width: s(44), height: s(44),
    borderRadius: s(42),
    backgroundColor: T.circle,
    alignItems: 'center',
    justifyContent: 'center',
    bottom:vs(2)
    
  },
  plusTouch: {
    width: s(44), height: s(44),
    alignItems: 'center', justifyContent: 'center',
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: T.pill,
    borderRadius: s(26),
    paddingLeft: s(16),
    paddingRight: s(6),
    paddingVertical: vs(6),
    minHeight: vs(46),
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: s(8),
    shadowOffset: { width: 0, height: vs(1) },
    elevation: s(4),
  },
  input: {
    flex: 1,
    fontSize: ms(16),
    color: T.white,
    paddingVertical: vs(4),
    lineHeight: vs(22),
    alignItems:'center',
    justifyContent:'center',
    bottom:vs(4)
  },
  iconSlot: {
    height: s(34),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(2),
  },
  sendBtn: {
    width: s(33), height: s(33),
    borderRadius: s(17),
    backgroundColor: T.white,
    alignItems: 'center',
    justifyContent: 'center',
    right:1
  },
  blockedWrap: {
    backgroundColor: '#2C1B1B', padding: s(14), alignItems: 'center',
    borderTopWidth: s(1), borderTopColor: '#3D2020',
  },
  blockedText: { color: T.red, fontSize: ms(13), fontWeight: '600', textAlign: 'center' },
  unblockText: { color: T.red, fontWeight: '700', fontSize: ms(13), marginTop: vs(4) },
});
const stt = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: T.white,
    borderTopLeftRadius: s(22), borderTopRightRadius: s(22),
    paddingBottom: s(40),
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: s(24), elevation: s(24),
  },
  handle: {
    width: s(36), height: s(4), borderRadius: s(2), backgroundColor: '#d6d6d6',
    alignSelf: 'center', marginTop: vs(10), marginBottom: vs(8),
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: s(14), paddingHorizontal: s(20), paddingVertical: vs(15), marginTop: vs(4) },
  iconBox: { width: s(46), height: s(46), borderRadius: s(13), alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: ms(15), fontWeight: '500', color: '#000000' },
  rowSub:   { fontSize: ms(12), color: T.grey, marginTop: vs(2) },
  cancelBtn: {
    marginHorizontal: s(16), marginTop: vs(14), paddingVertical: vs(16),
    borderRadius: s(14), backgroundColor: '#e6e6e6', alignItems: 'center',
  },
  cancelText: { fontSize: ms(16), fontWeight: '600', color: '#555' },
});