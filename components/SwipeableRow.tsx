import React, { useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, PanResponder,
} from 'react-native';
import { router }          from 'expo-router';
import { Ionicons }        from '@expo/vector-icons';
import { ProfileAvatar }   from '@/components/Profileavatar';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { s, vs, ms } from '@/utils/scale';

export interface Friend {
  connection_id:         string;
  user_id:               string;
  full_name:             string;
  profile_image:         string | null;
  location:              string;
  skills:                string;
  chat_id?:              string;
  last_message?:         string | null;
  last_message_at?:      string | null;
  last_message_is_mine?: boolean;
  last_message_status?:  'sent' | 'seen';
  last_seen?:            string | null;
  unread_count?:         number;
  is_hidden?:            boolean;
  cleared_at_p1?:        string | null;   // ← ADD
  cleared_at_p2?:        string | null;
}

const DELETE_W         = s(80);
const CLEAR_W          = s(10);
const DELETE_THRESHOLD = -(DELETE_W * 0.55);
const CLEAR_THRESHOLD  = CLEAR_W * 0.1;

const C = {
  white:'#FFFFFF', purple:'#6D4AFF', blue:'#3B82F6',
  text:'#111827', muted:'#6B7280', border:'#F3F4F6',
  red:'#6D4AFF', yellow:'#FBC234', green:'#6D4AFF', skeleton:'#E9EAEC',
};


const formatPreview = (msg?: string | null): string => {
  if (msg == null || msg === '') return 'Tap to say hello';
  if (msg.startsWith('__IMG__')) return 'Photo';
  if (msg.startsWith('__VID__')) return 'Video';
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
  onMarkRead:       (chatId: string) => void;
}

export const SwipeableRow = React.memo(({
  item, onDelete, onClear, onSwipeLeftOpen, onSwipeLeftClose, registerClose, onAnyPress, onMarkRead,
}: Props) => {
  const tx = useRef(new Animated.Value(0)).current;

  // ── FIX 1: rename destructured value so it doesn't clash ─────────────────
  const { isOnline: userIsOnline } = useOnlineStatus(item.user_id);

  const restingX = useRef(0);
  const dragging = useRef(false);

  const unread = item.unread_count ?? 0;  // ← FIX 2: read unread count

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

  useEffect(() => {
    registerClose(item.connection_id, close);
  }, [close, item.connection_id, registerClose]);

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
      } else {
        close();
      }
    },
    onPanResponderTerminate: () => { dragging.current = false; close(); },
  })).current;
  const deleteOpacity = tx.interpolate({
    inputRange: [-DELETE_W, -DELETE_W * 0.2, 0], outputRange: [1, 0.6, 0], extrapolate: 'clamp',
  });
  const deleteScale = tx.interpolate({
    inputRange: [-DELETE_W, -DELETE_W * 0.5], outputRange: [1, 0.72], extrapolate: 'clamp',
  });
  const handlePress = () => {
    onAnyPress(item.connection_id);
    if (Math.abs(restingX.current) > 5) { close(); return; }
    if (item.chat_id) onMarkRead(item.chat_id);
    router.push({
      pathname: '/subScreens/chatScreen/[chatId]',
      params: {
        chatId:   item.chat_id        ?? '',
        userId:   item.user_id,
        name:     item.full_name,
        image:    item.profile_image  ?? '',
        lastSeen: item.last_seen      ?? '',
      },
    });
  };

  return (
    <View style={sw.wrapper}>
      {/* Delete panel */}
      <Animated.View style={[sw.rightPanel, { opacity: deleteOpacity }]}>
        <TouchableOpacity style={sw.panelBtn} activeOpacity={0.85}
          onPress={() => { close(); setTimeout(() => onDelete(item), 180); }}>
          <Animated.View style={{ transform: [{ scale: deleteScale }] }}>
            <Ionicons name="trash" size={20} color="#fff" style={{ top: 2 }} />
          </Animated.View>
          <Text style={sw.deleteTxt}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Swipeable card */}
      <Animated.View
        style={[sw.card, { transform: [{ translateX: tx }] }]}
        {...pan.panHandlers}
      >
        <TouchableOpacity
          style={sw.row} activeOpacity={0.78}
          onPress={handlePress}
          onLongPress={() => Math.abs(restingX.current) < 5 && item.chat_id && onClear(item)}
          delayLongPress={450}
        >
          <View>
            <ProfileAvatar uri={item.profile_image} name={item.full_name} size={52} />
            {userIsOnline && <View style={sw.onlineDot} />}
          </View>
          {/* Chat info */}
          <View style={sw.info}>
            <View style={sw.topRow}>
              <Text
                style={[sw.name, unread > 0 && sw.nameBold]}
                numberOfLines={1}
              >
                {item.full_name}
              </Text>
              <View style={sw.topRight}>
                {!!item.last_message_at && (
                  <Text style={[sw.time, unread > 0 && sw.timeUnread]}>
                    {timeAgo(item.last_message_at)}
                  </Text>
                )}
              </View>
            </View>

            <View style={sw.previewRow}>
              <Text
                style={[sw.preview, unread > 0 && sw.previewBold]}
                numberOfLines={1}
              >
                {formatPreview(item.last_message)}
              </Text>
              {unread > 0 && (
                <View style={sw.badge}>
                  <Text style={sw.badgeTxt}>
                    {unread > 99 ? '99+' : unread}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
});
const sw = StyleSheet.create({
  wrapper:      { position:'relative', overflow:'hidden', backgroundColor:C.white },
  rightPanel:   { position:'absolute', right:0, top:0, bottom:0, width:DELETE_W,
                  backgroundColor:C.red, justifyContent:'center', alignItems:'center' },
  panelBtn:     { flex:1, width:'100%', alignItems:'center', justifyContent:'center', gap:s(5) },
  deleteTxt:    { fontSize:ms(12), fontWeight:'700', color:'#fff', top:vs(1) },
  card:         { backgroundColor:C.white },
  row:          { flexDirection:'row', alignItems:'center', paddingHorizontal:s(15),
                  paddingVertical:vs(8), backgroundColor:C.white, gap:s(12), minHeight:vs(72) },
  onlineDot:    { position:'absolute', bottom:1, right:1, width:s(14), height:s(14),
                  borderRadius:s(14), borderWidth:s(2),
                  backgroundColor:'#6D4AFF',
                  borderColor:C.white },
  info:         { flex:1 },
  topRow:       { flexDirection:'row', justifyContent:'space-between',
                  alignItems:'center', marginBottom:vs(4) },
  topRight:     { flexDirection:'row', alignItems:'center', gap:s(6) },
  name:         { fontSize:ms(15), fontWeight:'500', color:C.text, flex:1, marginRight:s(8) },
  nameBold:     { fontWeight:'700', color:'#111827' },   // bold name when unread
  time:         { fontSize:ms(11), color:C.muted },
  timeUnread:   { color:C.purple, fontWeight:'700' },

  previewRow:   { flexDirection:'row', alignItems:'center', gap:s(6) },
  preview:      { fontSize:ms(13), color:C.muted, flex:1 },
  previewBold:  { color:'#111827', fontWeight:'600' },
  badge:        { minWidth:s(20), height:s(20), borderRadius:s(10),
                  backgroundColor:C.purple,
                  paddingHorizontal:s(5),
                  alignItems:'center', justifyContent:'center' },
  badgeTxt:     { fontSize:ms(11), fontWeight:'700', color:'#fff', lineHeight:vs(14) },
});

export default SwipeableRow;
