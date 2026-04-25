// components/NotificationActionSheet.tsx
//
// TEACHING NOTES — How this pattern works:
//
// 1. SHEET = dumb UI only
//    - receives item data as props
//    - calls onDelete() or onViewProfile() when user taps
//    - knows nothing about Appwrite or state
//
// 2. PARENT (NotificationsScreen) = smart, owns data
//    - passes the selected notification to sheet
//    - handles actual delete logic
//    - removes card from list optimistically
//
// 3. OPTIMISTIC UI = instant feel
//    - remove card from list FIRST (0ms)
//    - call API in background
//    - if API fails → put card back (rollback)
//
// Usage in NotificationsScreen:
//   const [sheetItem, setSheetItem] = useState<NotifItem | null>(null);
//
//   // On long press of notification card:
//   onLongPress={() => setSheetItem(item)}
//
//   <NotificationActionSheet
//     item={sheetItem}
//     visible={!!sheetItem}
//     onClose={() => setSheetItem(null)}
//     onDelete={(item) => {
//       setSheetItem(null);           // close sheet
//       handleDeleteNotif(item);      // parent's delete function
//     }}
//     onViewProfile={(userId) => {
//       setSheetItem(null);           // close sheet
//       router.push({ pathname: '/subScreens/userProfile', params: { userId } });
//     }}
//   />

import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Modal, Pressable, Dimensions,
} from 'react-native';
import { Ionicons }    from '@expo/vector-icons';
import { ProfileAvatar } from '@/components/Profileavatar';

const { height: SCREEN_H } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────
interface NotifItem {
  $id:           string;
  fromUserId:    string;
  fromUserName:  string;
  fromUserImage: string;
  type:          string;
  connectionId:  string;
}

interface Props {
  visible:       boolean;
  item:          NotifItem | null;
  onClose:       () => void;
  onDelete:      (item: NotifItem) => void;
  onViewProfile: (userId: string) => void;
}

// ─── Colours ──────────────────────────────────────────────────────
const C = {
  card:   '#1C1C1E',   // iOS dark sheet
  border: '#2C2C2E',
  white:  '#FFFFFF',
  muted:  '#8E8E93',
  red:    '#FF3B30',
  purple: '#6D4AFF',
};

// ─── Component ────────────────────────────────────────────────────
export const NotificationActionSheet = ({
  visible, item, onClose, onDelete, onViewProfile,
}: Props) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  // ── Animate in/out ────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      // Slide up + fade backdrop together
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue:         0,
          damping:         300,
          stiffness:       300,
          mass:            0.08,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue:         1,
          duration:        100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide down + fade out
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue:         SCREEN_H,
          duration:        220,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue:         0,
          duration:        180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible || !item) return null;

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Dimmed backdrop — tap to close */}
      <Animated.View style={[s.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet slides up from bottom */}
      <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>

        {/* Drag handle */}
        <View style={s.handle} />

        {/* Who sent the notification */}
      


        {/* ── ACTION: View Profile ──────────────────────────────
            Navigates to sender's profile
            Sheet closes first (parent handles navigation)        */}
        <TouchableOpacity
          style={s.option}
          onPress={() => onViewProfile(item.fromUserId)}
          activeOpacity={0.7}
        >
          <View style={[s.optionIcon, { backgroundColor: '#2C2C2E' }]}>
            <Ionicons name="person" size={20} color="#6D4AFF" />
          </View>
          <Text style={s.optionText}>View Profile</Text>
          <Ionicons name="chevron-forward" size={16} color={C.muted} />
        </TouchableOpacity>

        <View style={s.divider} />

        {/* ── ACTION: Delete Notification ───────────────────────
            Removes notification card instantly (optimistic)
            Parent deletes from Appwrite in background           */}
        <TouchableOpacity
          style={s.option}
          onPress={() => onDelete(item)}
          activeOpacity={0.7}
        >
          <View style={[s.optionIcon, { backgroundColor: '#2C2C2E' }]}>
            <Ionicons name="trash-outline" size={20} color={C.purple} />
          </View>
          <Text style={[s.optionText, { color: C.white }]}>Delete Notification</Text>
        </TouchableOpacity>

        <View style={s.divider} />

        {/* Cancel */}
        <TouchableOpacity
          style={s.cancelBtn}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Text style={s.cancelText}>Cancel</Text>
        </TouchableOpacity>

      </Animated.View>
    </Modal>
  );
};
export default NotificationActionSheet;

// ─── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  sheet: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    backgroundColor:      C.card,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    paddingBottom:        36,
    shadowColor:          '#000',
    shadowOpacity:        0.5,
    shadowRadius:         20,
    shadowOffset:         { width: 0, height: -4 },
    elevation:            20,
  },

  handle: {
    width:           36,
    height:          4,
    borderRadius:    2,
    backgroundColor: C.border,
    alignSelf:       'center',
    marginTop:       10,
    marginBottom:    6,
  },

  // Who triggered this notification
  userRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            12,
    paddingHorizontal: 20,
    paddingVertical:   14,
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '600', color: C.white },
  userSub:  { fontSize: 13, color: C.muted, marginTop: 2 },

  divider: { height: 1, backgroundColor: C.border },

  // Each action row
  option: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               14,
    paddingHorizontal: 20,
    paddingVertical:   16,
  },
  optionIcon: {
    width:        40,
    height:       40,
    borderRadius: 12,
    alignItems:   'center',
    justifyContent: 'center',
  },
  optionText: {
    flex:       1,
    fontSize:   16,
    fontWeight: '500',
    color:      C.white,
  },

  cancelBtn: {
    marginHorizontal: 16,
    marginTop:        10,
    paddingVertical:  15,
    borderRadius:     14,
    backgroundColor:  C.border,
    alignItems:       'center',
    bottom:-10
  },
  cancelText: { fontSize: 16, fontWeight: '600', color: C.white },
});
