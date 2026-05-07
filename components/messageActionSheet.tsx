import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Modal, Pressable, Dimensions,
  ScrollView, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SW } = Dimensions.get('window');

export interface ActionMessage {
  $id:        string;
  sender_id:  string;
  message:    string;
  created_at: number;
}

interface Props {
  visible:   boolean;
  message:   ActionMessage | null;
  isMine:    boolean;
  onClose:   () => void;
  onCopy:    (text: string) => void;
  onReact:   (msg: ActionMessage, emoji: string) => void;
  onReply:   (msg: ActionMessage) => void;
  onEdit:    (msg: ActionMessage) => void;
  onDelete:  (msg: ActionMessage) => void;
}

const QUICK_EMOJIS = ['❤️','😂','😮','😢','😡','👍'];

const EMOJI_CATEGORIES = [
  { label:'😀 Smileys', emojis:['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕'] },
  { label:'❤️ Hearts',  emojis:['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','🫶','♥️','💋','😍','🥰','😘'] },
  { label:'👋 Gestures', emojis:['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💪','🫂'] },
  { label:'🎉 Party',   emojis:['🎉','🎊','🎈','🎁','🎀','🏆','🥇','🥈','🥉','🏅','🥳','🎂','🍰','🧁','🍭','🍬','🍫','🍿','🎠','🎡','🎢','🎪','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🪕','🎻'] },
  { label:'🔥 Popular', emojis:['🔥','✨','⭐','🌟','💫','⚡','🌈','🎯','💯','🏆','👑','💎','🚀','🌙','☀️','🌊','🍀','🦋','🌸','🌺','🌻','🌹','🌷','🫶','🙌','💪','👏','🤝','💡','🎵','🎶'] },
  { label:'🐶 Animals', emojis:['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🦋','🐌','🐞','🐢','🐍','🦎','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈'] },
  { label:'🍕 Food',    emojis:['🍕','🍔','🌮','🌯','🥙','🥪','🍜','🍝','🍛','🍲','🥘','🥗','🥫','🧆','🥚','🍳','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍟','🍣','🍱','🥟','🍤','🍙','🍘','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜'] },
  { label:'🏀 Sports',  emojis:['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🥍','🏏','⛳','🎣','🤿','🎽','🎿','🛷','🥌','⛸️','🥊','🥋','🎯','🎮','🕹️','🎲','♟️'] },
];

const C = {
  dark:'#1A1A1A', darker:'#111111', divider:'#2A2A2A',
  white:'#FFFFFF', muted:'#8E8E93', red:'#FF3B30',
  purple:'#6D4AFF', purpleL:'#EDE9FE', orange:'#FF9500',
};

// ═══════════════════════════════════════════════════════════════════
export const MessageActionSheet = ({
  visible, message, isMine, onClose,
  onCopy, onReact, onReply, onEdit, onDelete,
}: Props) => {
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [showPicker, setShowPicker] = useState(false);
  const [activeCategory, setCategory] = useState(1);

  useEffect(() => {
    if (visible) {
      setShowPicker(false);
      setCategory(0);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue:1, duration:180, useNativeDriver:true }),
        Animated.spring(scaleAnim, { toValue:1, damping:18, stiffness:300, useNativeDriver:true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue:1, duration:140, useNativeDriver:true }),
        Animated.timing(scaleAnim, { toValue:1, duration:120, useNativeDriver:true }),
      ]).start();
    }
  }, [visible]);

  if (!visible || !message) return null;

  // Check if within 60-second window for "delete for everyone"
  // created_at is unix seconds or ms — handle both
  const createdMs  = message.created_at < 10_000_000_000
    ? message.created_at * 1000 : message.created_at;
  const ageSeconds = Math.floor((Date.now() - createdMs) / 1000);
  const canUnsend  = isMine && ageSeconds < 60;

  const handleEmojiPick = (emoji: string) => { onReact(message, emoji); onClose(); };

  return (
    <Modal transparent animationType="none" visible={visible}
      onRequestClose={onClose} statusBarTranslucent>

      <Animated.View style={[sh.backdrop, { opacity:fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {showPicker ? (
        // ── Full Emoji Picker ─────────────────────────────────────
        <Animated.View style={[sh.picker, { opacity:fadeAnim }]}>
          <View style={sh.pickerHeader}>
            <TouchableOpacity onPress={() => setShowPicker(false)} style={{ padding:4 }}>
              <Ionicons name="arrow-back" size={20} color={C.white} />
            </TouchableOpacity>
            <Text style={sh.pickerTitle}>Choose Reaction</Text>
            <TouchableOpacity onPress={onClose} style={{ padding:4 }}>
              <Ionicons name="close" size={20} color={C.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sh.catScroll}>
            {EMOJI_CATEGORIES.map((cat, i) => (
              <TouchableOpacity key={i} style={[sh.catBtn, activeCategory===i && sh.catBtnActive]} onPress={() => setCategory(i)}>
                <Text style={sh.catEmoji}>{cat.emojis[0]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={sh.catLabel}>{EMOJI_CATEGORIES[activeCategory].label}</Text>
          <FlatList
            data={EMOJI_CATEGORIES[activeCategory].emojis}
            keyExtractor={(_, i) => `${activeCategory}-${i}`}
            numColumns={8}
            renderItem={({ item }) => (
              <TouchableOpacity style={sh.gridBtn} onPress={() => handleEmojiPick(item)} activeOpacity={0.6}>
                <Text style={sh.gridEmoji}>{item}</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={sh.grid}
            showsVerticalScrollIndicator={false}
            initialNumToRender={30} maxToRenderPerBatch={30}
          />
        </Animated.View>

      ) : (
        // ── Floating Action Card ──────────────────────────────────
        <View style={sh.centerWrap} pointerEvents="box-none">
          <Animated.View style={[sh.card, { opacity:fadeAnim, transform:[{scale:scaleAnim}] }]}>

          
            <View style={sh.divider} />

            {/* Copy */}
            <Row icon="copy-outline" label="Copy"
              onPress={() => { onCopy(message.message); onClose(); }} />
            <View style={sh.divider} />

            {/* Reply */}
            <Row icon="return-down-back-outline" label="Reply"
              onPress={() => { onReply(message); onClose(); }} />

            {/* Edit — sender only */}
            {isMine && (
              <>
                <View style={sh.divider} />
                <Row icon="pencil-outline" label="Edit"
                  onPress={() => { onEdit(message); onClose(); }} />
              </>
            )}

            {/* ── DELETE OPTIONS ─────────────────────────────────
                TEACHING:
                  Everyone gets "Delete for me" (soft delete)
                  Sender within 60s also gets "Unsend" (delete for everyone)
                
                "Delete for me"       → hidden_by[] — only you stop seeing it
                "Unsend (for everyone)" → hard delete from DB — both lose it ✅
            */}
            <View style={sh.divider} />

            {/* Delete for me — BOTH sender and receiver can do this */}
            <Row
              icon="eye-off-outline"
              label="Delete for me"
              labelColor={C.purple}
              onPress={() => {
                onDelete(message);  // chatScreen handleDelete checks isMine + age
                onClose();
              }}
            />

            {/* Unsend (delete for everyone) — sender only, within 60s */}
            {canUnsend && (
              <>
                <View style={sh.divider} />
                <Row
                  icon="arrow-undo-circle-outline"
                  label="Unsend (for everyone)"
                  labelColor={C.red}
                  onPress={() => {
                    onDelete(message);
                    onClose();
                  }}
                />
              </>
            )}

            {/* After 60s, sender only gets "Delete for me" (already shown above) */}
            {isMine && !canUnsend && (
              <View style={sh.ageNote}>
                <Text style={sh.ageNoteText}>
                  Can no longer unsend — message was sent over 1 minute ago
                </Text>
              </View>
            )}

          </Animated.View>

          {/* Emoji reaction bar */}
          <Animated.View style={[sh.emojiBar, { opacity:fadeAnim, transform:[{scale:scaleAnim}] }]}>
            {QUICK_EMOJIS.map(emoji => (
              <TouchableOpacity key={emoji} style={sh.emojiBtn} onPress={() => handleEmojiPick(emoji)} activeOpacity={0.7}>
                <Text style={sh.emoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[sh.emojiBtn, sh.plusBtn]} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
              <Ionicons name="add" size={22} color={C.white} />
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
    </Modal>
  );
};

const Row = ({ icon, label, labelColor, onPress }: {
  icon:string; label:string; labelColor?:string; onPress:()=>void;
}) => (
  <TouchableOpacity style={sh.row} onPress={onPress} activeOpacity={0.7}>
    <Text style={[sh.rowLabel, labelColor ? { color:labelColor } : {}]}>{label}</Text>
    <Ionicons name={icon as any} size={20} color={labelColor ?? C.white} />
  </TouchableOpacity>
);

export default MessageActionSheet;

const sh = StyleSheet.create({
  backdrop:   { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.55)' },
  centerWrap: { flex:1, alignItems:'center', justifyContent:'center', gap:12 },
  card: {
    width:SW*0.62, backgroundColor:C.dark, borderRadius:16, overflow:'hidden',
    shadowColor:'#ffffff', shadowOpacity:0.5, shadowRadius:20, elevation:20,
  },
  preview:     { paddingHorizontal:18, paddingVertical:12 },
  previewText: { fontSize:13, color:C.muted, lineHeight:18 },
  divider:     { height:1, backgroundColor:C.divider },
  row:         { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:18, paddingVertical:15 },
  rowLabel:    { fontSize:16, fontWeight:'400', color:C.white },
  ageNote:     { paddingHorizontal:18, paddingVertical:10 },
  ageNoteText: { fontSize:11, color:C.muted, textAlign:'center', lineHeight:16 },
  emojiBar:    { flexDirection:'row', backgroundColor:C.dark, borderRadius:40, paddingHorizontal:10, paddingVertical:6, gap:2, shadowColor:'#000', shadowOpacity:0.4, shadowRadius:12, elevation:12 },
  emojiBtn:    { width:40, height:40, borderRadius:20, alignItems:'center', justifyContent:'center' },
  plusBtn:     { backgroundColor:'#2C2C2E' },
  emoji:       { fontSize:24 },
  picker:      { position:'absolute', bottom:0, left:0, right:0, backgroundColor:C.dark, borderTopLeftRadius:20, borderTopRightRadius:20, paddingBottom:34, maxHeight:'70%', shadowColor:'#000', shadowOpacity:0.5, shadowRadius:20, elevation:20 },
  pickerHeader:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:C.divider },
  pickerTitle: { fontSize:16, fontWeight:'600', color:C.white },
  catScroll:   { paddingHorizontal:12, paddingVertical:8, gap:6 },
  catBtn:      { width:40, height:40, borderRadius:20, alignItems:'center', justifyContent:'center', backgroundColor:'#2C2C2E' },
  catBtnActive:{ backgroundColor:C.purple },
  catEmoji:    { fontSize:20 },
  catLabel:    { fontSize:12, color:C.muted, paddingHorizontal:16, paddingBottom:6 },
  grid:        { paddingHorizontal:8, paddingBottom:20 },
  gridBtn:     { flex:1, aspectRatio:1, alignItems:'center', justifyContent:'center', margin:2 },
  gridEmoji:   { fontSize:28 },
});