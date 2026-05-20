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
      sub: 'Choose from your photos', iconColor: '#6D4AFF', iconBg: '#363738',
      onPress: onImage,
    },
    {
      key: 'video', icon: 'videocam-outline', label: 'Video',
      sub: 'Choose a video clip', iconColor: '#6D4AFF', iconBg: '#363738',
      onPress: onVideo,
    },
    ...(Platform.OS !== 'web' ? [{
      key: 'camera', icon: 'camera-outline', label: 'Camera',
      sub: 'Take a photo or video', iconColor: '#6D4AFF', iconBg: '#363738',
      onPress: onCamera,
    }] : []),
  ];
  return (
    <Modal transparent animationType="none" visible={visible}
      onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[ms.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[ms.sheet, sheetStyle]}>
        <View style={ms.handle} />
        {opts.map((opt, i) => (
          <View key={opt.key}>
            <TouchableOpacity style={ms.row} activeOpacity={0.7}
              onPress={() => { onClose(); setTimeout(opt.onPress, 80); }}>
              <View style={[ms.iconBox, { backgroundColor: opt.iconBg }]}>
                <Ionicons name={opt.icon as any} size={22} color={opt.iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ms.rowLabel}>{opt.label}</Text>
                <Text style={ms.rowSub}>{opt.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={T.grey} />
            </TouchableOpacity>
            {i < opts.length - 1 && <View style={ms.divider} />}
          </View>
        ))}
        <TouchableOpacity style={ms.cancelBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={ms.cancelText}>Cancel</Text>
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
        mediaTypes:    ImagePicker.MediaTypeOptions.Images, // ✅ fixed: not MediaTypeOptions
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
      <View style={s.blockedWrap}>
        <Text style={s.blockedText}>
          {iBlockedThem
            ? `You blocked ${blockedName ?? 'this person'}. Unblock to message.`
            : `You can't message this person.`}
        </Text>
        {iBlockedThem && (
          <TouchableOpacity onPress={onUnblock} style={{ marginTop: 6 }}>
            <Text style={s.unblockText}>Tap to Unblock</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }
  return (
    <View style={s.wrapper}>
      {editingMsg && (
        <View style={[s.contextBar, { borderLeftColor: T.amber }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.ctxName, { color: T.amber }]}> Editing</Text>
            <Text style={s.ctxText} numberOfLines={1}>{editingMsg.message}</Text>
          </View>
          <TouchableOpacity onPress={onCancelEdit}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={18} color={T.grey} />
          </TouchableOpacity>
        </View>
      )}
      {replyTo && !editingMsg && (
        <View style={[s.contextBar, { borderLeftColor: T.purple }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.ctxName, { color: T.purple }]}>
              {replyTo.senderId === myId ? 'You' : otherName}
            </Text>
            <Text style={s.ctxText} numberOfLines={1}>{replyTo.message}</Text>
          </View>
          <TouchableOpacity onPress={onCancelReply}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={18} color={T.grey} />
          </TouchableOpacity>
        </View>
      )}
      <View style={s.row}>
        <Animated.View style={[s.plusCircle, plusStyle]}>
          <TouchableOpacity
            style={s.plusTouch}
            onPress={() => setShowMedia(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color={T.white} />
          </TouchableOpacity>
        </Animated.View>
        <View style={s.pill}>
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
            style={[s.input, { maxHeight: 120 }]}
            blurOnSubmit={false}
            selectionColor={T.purple}
            keyboardAppearance="dark"
          />
          <Animated.View style={[s.iconSlot, sendStyle]}>
            <TouchableOpacity
              style={s.sendBtn}
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

const s = StyleSheet.create({
  wrapper: {
    backgroundColor: T.white,
    paddingHorizontal: 12,
    paddingTop: 5,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },

  contextBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12, paddingVertical: 8,
    borderLeftWidth: 3, borderRadius: 8,
    marginBottom: 8, gap: 8,
  },
  ctxName: { fontSize: 11, fontWeight: '700', marginBottom: 1 },
  ctxText: { fontSize: 12, color: T.grey },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },

  // + standalone circle
  plusCircle: {
    width: 44, height: 44,
    borderRadius: 42,
    backgroundColor: T.circle,
    alignItems: 'center',
    justifyContent: 'center',
    bottom:2
    
  },
  plusTouch: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: T.pill,
    borderRadius: 26,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    minHeight: 46,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: T.white,
    paddingVertical: 4,
    lineHeight: 22,
    alignItems:'center',
    justifyContent:'center',
    bottom:4
  },
  iconSlot: {
    height: 34,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendBtn: {
    width: 33, height: 33,
    borderRadius: 17,
    backgroundColor: T.white,
    alignItems: 'center',
    justifyContent: 'center',
    right:1
  },
  blockedWrap: {
    backgroundColor: '#2C1B1B', padding: 14, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#3D2020',
  },
  blockedText: { color: T.red, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  unblockText: { color: T.red, fontWeight: '700', fontSize: 13, marginTop: 4 },
});
const ms = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: T.sheetBg,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingBottom: 40,
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 24, elevation: 24,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#3A3A3C',
    alignSelf: 'center', marginTop: 10, marginBottom: 8,
  },
  title: { fontSize: 17, fontWeight: '600', color: T.white, paddingHorizontal: 20, paddingVertical: 12 },
  divider: { height: 1, backgroundColor: '#2C2C2E', marginHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16 },
  iconBox: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 16, fontWeight: '500', color: T.white },
  rowSub:   { fontSize: 12, color: T.grey, marginTop: 2 },
  cancelBtn: {
    marginHorizontal: 16, marginTop: 14, paddingVertical: 16,
    borderRadius: 14, backgroundColor: '#2C2C2E', alignItems: 'center',
  },
  cancelText: { fontSize: 16, fontWeight: '600', color: T.white },
});