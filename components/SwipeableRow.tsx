import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, PanResponder, Pressable,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import AsyncStorage                from '@react-native-async-storage/async-storage';
import { router }                  from 'expo-router';
import { Ionicons }                from '@expo/vector-icons';
import { ProfileAvatar }           from '@/components/Profileavatar';
import { useOnlineStatus }         from '@/hooks/useOnlineStatus';
import { s, vs, ms }               from '@/utils/scale';

// ─── Types ────────────────────────────────────────────────────────────────────
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
  cleared_at_p1?:        string | null;
  cleared_at_p2?:        string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const DELETE_W         = s(80);
const CLEAR_W          = s(10);
const DELETE_THRESHOLD = -(DELETE_W * 0.55);
const CLEAR_THRESHOLD  = CLEAR_W * 0.1;
const HINT_NUDGE       = -s(25);
const HINT_STORAGE_KEY = 'swipe_hint_seen_v1';

const C = {
  white:'#FFFFFF', purple:'#6D4AFF', blue:'#3B82F6',
  text:'#111827', muted:'#6B7280', border:'#F3F4F6',
  red:'#6D4AFF', yellow:'#FBC234', green:'#6D4AFF', skeleton:'#E9EAEC',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatPreview = (msg?: string | null): string => {
  if (msg == null) return 'Tap to say hello';
  if (msg === '')  return 'Tap to say hello';
  if (msg.startsWith('__IMG__')) return '📷 Photo';
  if (msg.startsWith('__VID__')) return '🎥 Video';
  if (msg === '🎤 Voice message') return '🎤 Voice message';
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

// ─── SwipeHintManager ─────────────────────────────────────────────────────────
const SwipeHintManager = (() => {
  let _checked   = false;
  let _seen      = false;
  let _fired     = false;
  let _pending: (() => void) | null = null;

  const _init = async () => {
    try {
      const val = await AsyncStorage.getItem(HINT_STORAGE_KEY);
      _seen = val === 'true';
    } catch {
      _seen = false;
    }
    _checked = true;
    if (!_seen && _pending) {
      const cb = _pending;
      _pending = null;
      cb();
    }
  };

  const tryRegister = (onHint: () => void) => {
    if (_fired || _seen) return;
    if (!_checked) {
      if (!_pending) {
        _pending = () => {
          if (!_fired && !_seen) { _fired = true; onHint(); }
        };
        _init();
      }
      return;
    }
    if (!_fired && !_seen) {
      _fired = true;
      onHint();
    }
  };

  const markSeen = () => {
    _seen = true;
    AsyncStorage.setItem(HINT_STORAGE_KEY, 'true').catch(() => {});
  };

  return { tryRegister, markSeen };
})();

// ─── Props ────────────────────────────────────────────────────────────────────
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

// ─── SwipeableRow ─────────────────────────────────────────────────────────────
export const SwipeableRow = React.memo(({
  item, onDelete, onClear, onSwipeLeftOpen, onSwipeLeftClose,
  registerClose, onAnyPress, onMarkRead,
}: Props) => {

  const cardX           = useSharedValue(0);
  const hintPeekOpacity = useSharedValue(0);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cardX.value }],
  }));

  const hintPanelStyle = useAnimatedStyle(() => ({
    opacity: hintPeekOpacity.value,
  }));

  const tx          = useRef(new Animated.Value(0)).current;
  const restingX    = useRef(0);
  const dragging    = useRef(false);
  const hintPlaying = useRef(false);
  // FIX: track whether the delete panel is open so the TouchableOpacity
  // press actually registers — we need to know if we're in open state.
  const [panelOpen, setPanelOpen] = useState(false);

  const { isOnline: userIsOnline } = useOnlineStatus(item.user_id);
  const unread = item.unread_count ?? 0;

  useEffect(() => {
    const id = tx.addListener(({ value }) => {
      restingX.current = value;
      // FIX: track open state via listener so delete button knows it's visible
      setPanelOpen(value < -DELETE_W * 0.4);
    });
    return () => tx.removeListener(id);
  }, []);

  // FIX: deleteOpacity now correctly covers the full swipe range
  // Old: inputRange [-DELETE_W, -DELETE_W * 0.2, 0] caused the panel to be
  // invisible at exactly -DELETE_W (fully open), making the button untappable.
  const deleteOpacity = tx.interpolate({
    inputRange:  [-DELETE_W, -DELETE_W * 0.5, 0],
    outputRange: [1, 0.85, 0],
    extrapolate: 'clamp',
  });

  const deleteScale = tx.interpolate({
    inputRange:  [-DELETE_W, -DELETE_W * 0.5],
    outputRange: [1, 0.72],
    extrapolate: 'clamp',
  });

  const spring = useCallback((v: number, cb?: () => void) =>
    Animated.spring(tx, {
      toValue: v, useNativeDriver: true, damping: 22, stiffness: 220, mass: 0.75,
    }).start(cb), []);

  const close = useCallback(() => {
    spring(0);
    setPanelOpen(false);
    if (restingX.current < -10) onSwipeLeftClose(item.connection_id);
    setTimeout(() => { restingX.current = 0; }, 300);
  }, [item.connection_id, onSwipeLeftClose, spring]);

  useEffect(() => {
    registerClose(item.connection_id, close);
  }, [close, item.connection_id, registerClose]);

  const playHint = useCallback(() => {
    if (hintPlaying.current) return;
    hintPlaying.current = true;
    cardX.value = withDelay(
      2000,
      withSequence(
        withSpring(HINT_NUDGE, { damping: 18, stiffness: 260, mass: 0.6 }),
        withDelay(
          350,
          withSpring(0, { damping: 20, stiffness: 240, mass: 0.7 },
            (finished) => {
              if (finished) runOnJS(SwipeHintManager.markSeen)();
              hintPlaying.current = false;
            }
          )
        )
      )
    );
    hintPeekOpacity.value = withDelay(
      2000,
      withSequence(
        withTiming(0.38, { duration: 280 }),
        withDelay(350, withTiming(0, { duration: 220 }))
      )
    );
  }, [cardX, hintPeekOpacity]);

  useEffect(() => {
    SwipeHintManager.tryRegister(playHint);
  }, [playHint]);

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      !dragging.current && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 2.2,
    onPanResponderGrant: () => {
      dragging.current = true;
      tx.stopAnimation();
      cardX.value = 0;
      hintPeekOpacity.value = 0;
    },
    onPanResponderMove: (_, g) => {
      tx.setValue(Math.max(-DELETE_W * 1.1, Math.min(CLEAR_W * 1.1, restingX.current + g.dx)));
    },
    onPanResponderRelease: (_, g) => {
      dragging.current = false;
      const cur = restingX.current + g.dx;
      if (cur < DELETE_THRESHOLD) {
        spring(-DELETE_W);
        setPanelOpen(true);
        onSwipeLeftOpen(item.connection_id);
        restingX.current = -DELETE_W;
      } else if (cur > CLEAR_THRESHOLD) {
        spring(CLEAR_W);
        onSwipeLeftClose(item.connection_id);
        restingX.current = CLEAR_W;
        setTimeout(close, 1500);
      } else {
        close();
      }
    },
    onPanResponderTerminate: () => { dragging.current = false; close(); },
  })).current;

  const handlePress = () => {
    onAnyPress(item.connection_id);
    if (Math.abs(restingX.current) > 5) { close(); return; }
    if (item.chat_id) onMarkRead(item.chat_id);
    router.push({
      pathname: '/subScreens/chatScreen/[chatId]',
      params: {
        chatId:   item.chat_id       ?? '',
        userId:   item.user_id,
        name:     item.full_name,
        image:    item.profile_image ?? '',
        lastSeen: item.last_seen     ?? '',
      },
    });
  };
  const handleDeletePress = useCallback(() => {
    close();
    setTimeout(() => onDelete(item), 200);
  }, [close, item, onDelete]);
  return (
    <View style={sw.wrapper}>
      <Reanimated.View
        style={[sw.rightPanel, hintPanelStyle]}
        pointerEvents="none" 
      >
        <View style={sw.panelBtn}>
          <Ionicons name="trash" size={20} color="#fff" style={{ top: 2 }} />
          <Text style={sw.deleteTxt}>Delete</Text>
        </View>
      </Reanimated.View>
      <Animated.View style={[sw.rightPanel, { opacity: deleteOpacity }]}>
        <TouchableOpacity
          style={sw.panelBtn}
          activeOpacity={0.75}
          onPress={handleDeletePress}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <Animated.View style={{ transform: [{ scale: deleteScale }] }}>
            <Ionicons name="trash" size={s(22)} color="#fff" />
          </Animated.View>
          <Text style={sw.deleteTxt}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
      <Reanimated.View style={cardStyle} pointerEvents={panelOpen ? 'box-none' : 'auto'}>
        <Animated.View
          style={[sw.card, { transform: [{ translateX: tx }] }]}
          {...pan.panHandlers}
          pointerEvents={panelOpen ? 'box-none' : 'auto'}
        >
          <TouchableOpacity
            style={sw.row}
            activeOpacity={0.78}
            onPress={handlePress}
            onLongPress={() => Math.abs(restingX.current) < 5 && item.chat_id && onClear(item)}
            delayLongPress={450}
          >
            <View>
              <ProfileAvatar uri={item.profile_image} name={item.full_name} size={52} />
              {userIsOnline && <View style={sw.onlineDot} />}
            </View>
            <View style={sw.info}>
              <View style={sw.topRow}>
                <Text
                  style={[sw.name, unread > 0 && sw.nameBold]}
                  numberOfLines={1}
                >
                  {item.full_name}
                </Text>
                <View style={sw.topRight}>
                  {!!item.last_message && !!item.last_message_at && (
                    <Text style={[sw.time, unread > 0 && sw.timeUnread]}>
                      {timeAgo(item.last_message_at)}
                    </Text>
                  )}
                </View>
              </View>
              <View style={sw.previewRow}>
                <Text
                  style={[
                    sw.preview,
                    unread > 0 && sw.previewBold,
                    !item.last_message && sw.previewPlaceholder,
                  ]}
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
      </Reanimated.View>
    </View>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const sw = StyleSheet.create({
  wrapper:    { position:'relative', backgroundColor:C.white },
  rightPanel: {
    position:'absolute', right:0, top:0, bottom:0, width:DELETE_W,
    backgroundColor:C.red, justifyContent:'center', alignItems:'center',
  },
  panelBtn: {
    flex:1, width:'100%',
    alignItems:'center', justifyContent:'center', gap:s(5),
  },
  deleteTxt:          { fontSize:ms(12), fontWeight:'700', color:'#fff', top:vs(1) },
  card:               { backgroundColor:C.white },
  row:                {
    flexDirection:'row', alignItems:'center', paddingHorizontal:s(15),
    paddingVertical:vs(6), backgroundColor:C.white, gap:s(12), minHeight:vs(69),
  },
  onlineDot:          {
    position:'absolute', bottom:1, right:1, width:s(14), height:s(14),
    borderRadius:s(14), borderWidth:s(2),
    backgroundColor:'#6D4AFF', borderColor:C.white,
  },
  info:               { flex:1 },
  topRow:             { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:vs(4) },
  topRight:           { flexDirection:'row', alignItems:'center', gap:s(6) },
  name:               { fontSize:ms(15), fontWeight:'500', color:C.text, flex:1, marginRight:s(8) },
  nameBold:           { fontWeight:'700', color:'#111827' },
  time:               { fontSize:ms(11), color:C.muted },
  timeUnread:         { color:C.purple, fontWeight:'700' },
  previewRow:         { flexDirection:'row', alignItems:'center', gap:s(6) },
  preview:            { fontSize:ms(13), color:C.muted, flex:1 },
  previewBold:        { color:'#111827', fontWeight:'600' },
  previewPlaceholder: { color:C.muted},
  badge:              {
    minWidth:s(18), height:s(18), borderRadius:s(10),
    backgroundColor:C.purple, paddingHorizontal:s(5),
    alignItems:'center', justifyContent:'center',
  },
  badgeTxt:           { fontSize:ms(11), fontWeight:'700', color:'#fff', lineHeight:vs(14) },
});
export default SwipeableRow;