
import React, { useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, PanResponder,
} from 'react-native';
import { router }        from 'expo-router';
import { Ionicons }      from '@expo/vector-icons';
import { ProfileAvatar } from '@/components/Profileavatar';

export interface Friend {
  connection_id:         string;
  user_id:               string;
  full_name:             string;
  profile_image:         string | null;
  location:              string;
  skills:                string;
  chat_id?:              string;
  last_message?:         string;
  last_message_at?:      string | null;
  last_message_is_mine?: boolean;
  last_message_status?:  'sent' | 'seen';
  last_seen?:            string | null;
}

const DELETE_W         = 80;
const CLEAR_W          = 350;
const DELETE_THRESHOLD = -(DELETE_W * 0.55);
const CLEAR_THRESHOLD  = CLEAR_W * 0.350;

const C = {
  white:'#FFFFFF', purple:'#6D4AFF', blue:'#3B82F6',
  text:'#111827', muted:'#6B7280', border:'#F3F4F6',
  red:'#6D4AFF', yellow:'#FBC234', green:'#16A34A', skeleton:'#E9EAEC',
};

const isOnline = (ts?: string | null) =>
  !!ts && (Date.now() - new Date(ts).getTime()) < 5 * 60 * 1000;

// FIX 1: Use msg == null instead of !msg
// TEACHING:
//   !msg → true for: null, undefined, '', 0, false
//   msg == null → true ONLY for: null, undefined
//   Empty string '' should show as blank, not "Tap to say hello" ✅
const formatPreview = (msg?: string | null): string => {
  if (msg == null) return 'Tap to say hello';      // null or undefined → placeholder
  if (msg === '')  return 'Tap to say hello';      // empty string → placeholder
  if (msg.startsWith('__IMG__')) return ' Photo';
  if (msg.startsWith('__VID__')) return ' Video';
  const f = msg.split('\n')[0];
  return f.length > 38 ? f.slice(0, 38) + '…' : f;
};

const timeAgo = (ts?: string | null): string => {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d`;
  return new Date(ts).toLocaleDateString();
};


interface Props {
  item:             Friend;
  onDelete:         (f: Friend) => void;
  onClear:          (f: Friend) => void;
  onSwipeLeftOpen:  (id: string) => void;
  onSwipeLeftClose: (id: string) => void;
  registerClose:    (id: string, fn: () => void) => void;
  onAnyPress:       (id: string) => void;
}

export const SwipeableRow = React.memo(({
  item, onDelete,onClear, onSwipeLeftOpen, onSwipeLeftClose, registerClose, onAnyPress,
}: Props) => {
  const tx       = useRef(new Animated.Value(0)).current;
  const restingX = useRef(0);
  const dragging = useRef(false);
  const online   = isOnline(item.last_seen);

  // Track tx value so press handler knows if open
  useEffect(() => {
    const id = tx.addListener(({ value }) => { restingX.current = value; });
    return () => tx.removeListener(id);
  }, []);

  const spring = useCallback((v: number, cb?: () => void) =>
    Animated.spring(tx, {
      toValue: v, useNativeDriver: true, damping: 22, stiffness: 220, mass: 0.75,
    }).start(cb), []);

  const close = useCallback(() => {
    spring(0);
    if (restingX.current < -10) onSwipeLeftClose(item.connection_id);
    setTimeout(() => { restingX.current = 0; }, 300);
  }, [item.connection_id, onSwipeLeftClose, spring]);

  // Register close fn with parent so other rows/scroll can trigger it
  useEffect(() => { registerClose(item.connection_id, close); }, [close, item.connection_id, registerClose]);

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      !dragging.current && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 2.2,
    onPanResponderGrant: () => { dragging.current = true; tx.stopAnimation(); },
    onPanResponderMove: (_, g) => {
      tx.setValue(Math.max(-DELETE_W * 1.1, Math.min(CLEAR_W * 1.1, restingX.current + g.dx)));
    },
    onPanResponderRelease: (_, g) => {
      dragging.current = false;
      const cur = restingX.current + g.dx;
      if (cur < DELETE_THRESHOLD) {
        spring(-DELETE_W); onSwipeLeftOpen(item.connection_id); restingX.current = -DELETE_W;
      } else if (cur > CLEAR_THRESHOLD) {
         spring(CLEAR_W); onSwipeLeftClose(item.connection_id); restingX.current = CLEAR_W;
        setTimeout(close, 1500);
      }  else {
        close();
      }
    },
    onPanResponderTerminate: () => { dragging.current = false; close(); },
  })).current;

  // Interpolated panel opacity + icon scale
  const deleteOpacity = tx.interpolate({ inputRange: [-DELETE_W, -DELETE_W * 0.2, 0], outputRange: [1, 0.6, 0], extrapolate: 'clamp' });
  const deleteScale   = tx.interpolate({ inputRange: [-DELETE_W, -DELETE_W * 0.5],   outputRange: [1, 0.72],   extrapolate: 'clamp' });
  

  const handlePress = () => {
    onAnyPress(item.connection_id);
    if (Math.abs(restingX.current) > 5) { close(); return; }
    router.push({
      pathname: '/subScreens/chatScreen',
      params: {
        chatId:   item.chat_id   ?? '',
        userId:   item.user_id,
        name:     item.full_name,
        image:    item.profile_image ?? '',
        lastSeen: item.last_seen  ?? '',
      },
    });
  };



  return (
    <View style={sw.wrapper}>
     

      {/* Red Delete panel (swipe left) */}
      <Animated.View style={[sw.rightPanel, { opacity: deleteOpacity }]}>
        <TouchableOpacity style={sw.panelBtn} activeOpacity={0.85}
          onPress={() => { close(); setTimeout(() => onDelete(item), 180); }}>
          <Animated.View style={[{ transform: [{ scale: deleteScale }] }]}>
            <Ionicons name="trash" size={20} color="#fff" style={{marginTop:9}} />
          </Animated.View>
          <Text style={sw.deleteTxt}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Sliding card */}
      <Animated.View style={[sw.card, { transform: [{ translateX: tx }] }]} {...pan.panHandlers}>
        <TouchableOpacity style={sw.row} activeOpacity={0.78} onPress={handlePress}
          onLongPress={() => Math.abs(restingX.current) < 5 && item.chat_id && onClear(item)}
          delayLongPress={450}>
          <View>
            <ProfileAvatar uri={item.profile_image} name={item.full_name} size={52} />
            {online && <View style={sw.onlineDot} />}
          </View>
          <View style={sw.info}>
            <View style={sw.topRow}>
              <Text style={sw.name} numberOfLines={1}>{item.full_name}</Text>
              {!!item.last_message_at && (
                <Text style={sw.time}>{timeAgo(item.last_message_at)}</Text>
              )}
            </View>
            <View style={sw.previewRow}>
             
              {/* FIX 1: formatPreview handles null/undefined/'' correctly */}
              <Text style={sw.preview} numberOfLines={1}>
                {formatPreview(item.last_message)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
});

const sw = StyleSheet.create({
  wrapper:     { position:'relative', overflow:'hidden', backgroundColor:C.white },
  leftPanel:   { position:'absolute', left:0, top:0, bottom:0, width:CLEAR_W, backgroundColor:'#EFF6FF', justifyContent:'center', alignItems:'center', borderRightWidth:1, borderRightColor:'#DBEAFE' },
  rightPanel:  { position:'absolute', right:0, top:0, bottom:0, width:DELETE_W, backgroundColor:C.red, justifyContent:'center', alignItems:'center' },
  panelBtn:    { flex:1, width:'100%', alignItems:'center', justifyContent:'center', gap:5 },
  iconCircle:  { width:40, height:40, borderRadius:20, alignItems:'center', justifyContent:'center' },
  clearTxt:    { fontSize:11, fontWeight:'700', color:C.blue },
  deleteTxt:   { fontSize:12, fontWeight:'700', color:'#fff' },
  card:        { backgroundColor:C.white },
  row:         { flexDirection:'row', alignItems:'center', paddingHorizontal:15, paddingVertical:8, backgroundColor:C.white, gap:12, minHeight:72 },
  onlineDot:   { position:'absolute', bottom:1, right:1, width:11, height:11, borderRadius:6, backgroundColor:C.green, borderWidth:2, borderColor:C.white },
  info:        { flex:1 },
  topRow:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:4 },
  name:        { fontSize:15, fontWeight:'700', color:C.text, flex:1, marginRight:8 },
  time:        { fontSize:11, color:C.muted },
  previewRow:  { flexDirection:'row', alignItems:'center', gap:4 },
  preview:     { fontSize:13, color:C.muted, flex:1 },
});

const st = StyleSheet.create({
  tick: { fontSize:13, fontWeight:'700', lineHeight:16 },
});

export default SwipeableRow;
