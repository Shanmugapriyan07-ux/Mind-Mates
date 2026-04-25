// components/GoogleAuthSheet.tsx
// Tinder-style account selector bottom sheet — works in Expo Go
// Simulates the native Google account picker with smooth animation
// Flow: tap "Continue with Google" → sheet slides up → user picks account → OAuth opens

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Modal, Pressable, Image, ActivityIndicator, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView }  from 'expo-blur';
import images from '@/constants/images';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────
interface Props {
  visible:    boolean;
  onClose:    () => void;
  onContinue: () => void;   // triggers your Appwrite OAuth
  // Pre-filled account (if user previously logged in)
  savedAccount?: {
    name:  string;
    email: string;
    photo: string | null;
  } | null;
}

// ─── Colours ──────────────────────────────────────────────────────
const C = {
  bg:     '#1E1E1E',
  card:   '#2A2A2A',
  border: '#5f5f5f',
  white:  '#FFFFFF',
  muted:  '#9CA3AF',
  purple: '#6D4AFF',
  google: '#4285F4',
};

// ─── Avatar initials ──────────────────────────────────────────────
const InitialsAvatar = ({ name, size = 44 }: { name: string; size?: number }) => {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={[av.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[av.text, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
};
const av = StyleSheet.create({
  wrap: { backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontWeight: '700' },
});

// ─── Main Component ───────────────────────────────────────────────
export const GoogleAuthSheet = ({ visible, onClose, onContinue, savedAccount }: Props) => {
  const scaleAnim  = useRef(new Animated.Value(0.85)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const [loading, setLoading] = useState(false);

  // ── Animate in/out ────────────────────────────────────────────
   useEffect(() => {
     if (visible) {
       Animated.parallel([
         Animated.timing(fadeAnim,  { toValue: 2,    duration: 50, useNativeDriver: true }),
         Animated.spring(scaleAnim, { toValue: 1,    damping: 100, stiffness: 400,mass: 0.08, useNativeDriver: true }),
       ]).start();
     } else {
       Animated.parallel([
         Animated.timing(fadeAnim,  { toValue: 0,    duration: 140, useNativeDriver: true }),
         Animated.timing(scaleAnim, { toValue: 0.85, duration: 120, useNativeDriver: true }),
       ]).start();
     }
   }, [visible]);

  const handleContinue = async () => {
    setLoading(true);
    // Small delay so user sees loading state
    setTimeout(() => {
      onContinue(); // triggers Appwrite OAuth
    }, 300);
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>

      {/* Backdrop */}
      <Animated.View style={[sh.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[sh.sheet, { transform: [{ scale: scaleAnim }] }]}>

        {/* Handle bar */}
        <View style={sh.handle} >
         <View style={sh.googleIconWrap}>
            {/* Google G logo using coloured squares */}
           <Image source={images.splash} style={{ width: 70, height: 70,right:3 }} />
          </View>
      </View>
        {/* Google logo + title */}
        <View style={sh.headerRow}>
         
          <View>
            <Text style={sh.title}>Choose an account</Text>
            <Text style={sh.subtitle}>to continue to MindMates</Text>
          </View>
        </View>

 

        {/* Saved account row (if exists) */}
        {savedAccount ? (
          <TouchableOpacity
            style={sh.accountRow}
            activeOpacity={0.7}
            onPress={handleContinue}
            disabled={loading}
          >
            {savedAccount.photo ? (
              <Image source={{ uri: savedAccount.photo }} style={sh.accountPhoto} />
            ) : (
              <InitialsAvatar name={savedAccount.name} size={44} />
            )}
            <View style={sh.accountInfo}>
              <Text style={sh.accountName}>{savedAccount.name}</Text>
              <Text style={sh.accountEmail}>{savedAccount.email}</Text>
            </View>
            {loading
              ? <ActivityIndicator color={C.google} size="small" />
              : <Ionicons name="chevron-forward" size={18} color={C.muted} />
            }
          </TouchableOpacity>
        ) : null}

        {/* Add / use another account */}
        <TouchableOpacity
          style={[sh.accountRow, savedAccount && sh.accountRowBorder]}
          activeOpacity={0.7}
          onPress={handleContinue}
          disabled={loading}
        >
          <View style={sh.addIconWrap}>
            <Ionicons name="person-add-outline" size={22} color={C.white} />
          </View>
          <View style={sh.accountInfo}>
            <Text style={sh.accountName}>
              {savedAccount ? 'Use another account' : 'Continue with Google'}
            </Text>
          </View>
          {loading && !savedAccount
            ? <ActivityIndicator color={C.google} size="small" />
            : <Ionicons name="chevron-forward" size={18} color={C.muted} />
          }
        </TouchableOpacity>

 

        {/* Privacy note */}
        <Text style={sh.privacy}>
          To continue, Google will share your name, email address, and profile picture with MindMates.
        </Text>

        {/* Cancel */}
        <TouchableOpacity style={sh.cancelBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={sh.cancelText}>Cancel</Text>
        </TouchableOpacity>

      </Animated.View>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────
const sh = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },

  sheet: {
    position:        'absolute',
    bottom:          250,
    left:            20,
    right:           20,
    backgroundColor: C.white,
    borderTopLeftRadius:  12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius:  12,
    borderBottomRightRadius: 12,
    paddingBottom:   40,
    // Shadow
    shadowColor:    '#000',
    shadowOpacity:  0.4,
    shadowRadius:   20,
    shadowOffset:   { width: 0, height: -4 },
    elevation:      20,
    
  },

  handle: {
    width: 40, height: 4, 
    alignSelf: 'center', marginTop: 18, marginBottom: 70,
  },

  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 14, paddingHorizontal: 24, paddingVertical: 16,bottom:10,marginTop:10
  },

  googleIconWrap: {
    width: 64, height: 64, borderRadius: 17,
    backgroundColor: C.white,
    alignSelf:'center', justifyContent: 'center',
    shadowColor: '#585858', shadowOpacity: 0.2,
    shadowRadius: 8, elevation: 0,
  },
  googleG: {
    fontSize: 24, fontWeight: '800', color: C.google,
    fontFamily: 'serif',alignSelf:'center'
  },

  title:    { fontSize: 20, fontWeight: '700', color: C.card, alignSelf:'center',justifyContent:'center',left:45 },
  subtitle: { fontSize: 13, color: C.muted, marginTop: 2,alignSelf:'center',left:45  },

 
  accountRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16, gap: 14,
  },
  accountRowBorder: {
    borderTopWidth: 1, borderTopColor: C.border,
  },

  accountPhoto: { width: 44, height: 44, borderRadius: 22 },
  addIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },

  accountInfo:  { flex: 1 },
  accountName:  { fontSize: 15, fontWeight: '600', color: C.card, marginBottom: 2 },
  accountEmail: { fontSize: 13, color: C.muted },

  privacy: {
    fontSize: 12, color: C.muted, lineHeight: 18,
    paddingHorizontal: 24, paddingVertical: 16, textAlign: 'center',
  },

  cancelBtn: {
    marginHorizontal: 24, marginTop: 4,
    paddingVertical: 14, borderRadius: 12,
    backgroundColor: C.border,
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: C.white },
});
