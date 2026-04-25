
// // app/subScreens/chatScreen.tsx
// import React, { useState, useEffect, useCallback, useRef, RefObject } from 'react';
// import {
//   View, Text, FlatList, TextInput, TouchableOpacity,
//   StyleSheet, StatusBar, KeyboardAvoidingView, Platform,
//   ActivityIndicator, Alert, Dimensions, Animated, PanResponder,
// } from 'react-native';
// let CachedImage: any;
// try { CachedImage = require('expo-image').Image; }
// catch { CachedImage = require('react-native').Image; }
// import * as Clipboard                   from 'expo-clipboard';
// import { SafeAreaView }                 from 'react-native-safe-area-context';
// import { router, useLocalSearchParams } from 'expo-router';
// import { Ionicons }                     from '@expo/vector-icons';
// import { ProfileAvatar }                from '@/components/Profileavatar';
// import { useAuth }                      from '@/Contexts/authContext';
// import { useMessages, findChat, getChatId, ChatMessage } from '@/hooks/useChat';
// import { supabase }                     from '@/lib/supabase';
// import { MessageActionSheet, ActionMessage } from '@/components/messageActionSheet';
// import { ChatMenuSheet }                from '@/components/blockSheet';
// import { cdnChatUrl, cdnVideoUrl, cdnVideoThumbUrl, compressForUpload, uploadToCloudinary } from '@/lib/cloudinaryUpload';
// import ChatInput                        from '@/components/chatInput';
// import MediaViewer                      from '@/components/mediaViewer';
// import MediaPreview                     from '@/components/mediaPreview';

// // ── Media helpers ─────────────────────────────────────────────────
// const IMG_PREFIX = '__IMG__';
// const VID_PREFIX = '__VID__';
// const isImageMsg      = (m: string) => m.startsWith(IMG_PREFIX);
// const isVideoMsg      = (m: string) => m.startsWith(VID_PREFIX);
// const isMediaMsg      = (m: string) => isImageMsg(m) || isVideoMsg(m);
// const extractMediaUrl = (m: string) => m.replace(IMG_PREFIX,'').replace(VID_PREFIX,'').split('\n')[0].trim();
// const extractMediaCaption = (m: string) => m.replace(IMG_PREFIX,'').replace(VID_PREFIX,'').split('\n').slice(1).join('\n').trim();

// // ── Edge function caller with logging ─────────────────────────────
// const callFn = async (body: Record<string, any>) => {
//   console.log('📤 Sending to Edge Fn:', JSON.stringify(body));
//   const { data, error } = await supabase.functions.invoke('mindmates', { body });
//   if (error) {
//     console.error('❌ Supabase invoke error:', error);
//     throw new Error(error.message);
//   }
//   if (data?.error) {
//     console.error('🔥 callFn failed:', data.error);
//     throw new Error(data.error);
//   }
//   return data;
// };

// // ── Retry with exponential back-off ──────────────────────────────
// const withRetry = async <T,>(fn: () => Promise<T>, attempts = 3): Promise<T> => {
//   let last: any;
//   for (let i = 0; i < attempts; i++) {
//     try { return await fn(); } catch (e) {
//       last = e;
//       if (i < attempts - 1) await new Promise(r => setTimeout(r, 300 * 2 ** i));
//     }
//   }
//   throw last;
// };

// const C = {
//   bg:'#F5F5F7', white:'#FFFFFF', purple:'#6D4AFF',
//   purpleMsg:'#6D4AFF', otherMsg:'#FFFFFF',
//   text:'#111827', muted:'#6B7280', border:'#E5E7EB',
//   red:'#EF4444', seen:'#F3CF3E',
// };

// const secToMs    = (ts: number) => ts < 10_000_000_000 ? ts * 1000 : ts;
// const formatTime = (ts: number) =>
//   new Date(secToMs(ts)).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

// const formatLastSeen = (s: string | null) => {
//   if (!s) return '';
//   const diff = Math.floor((Date.now() - new Date(s).getTime()) / 60000);
//   if (diff < 5)  return 'online';
//   if (diff < 60) return `last seen ${diff}m ago`;
//   const d = new Date(s);
//   const tt = d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
//   const today = new Date(), yest = new Date(today);
//   yest.setDate(yest.getDate() - 1);
//   if (d.toDateString() === today.toDateString()) return `last seen today at ${tt}`;
//   if (d.toDateString() === yest.toDateString())  return `last seen yesterday at ${tt}`;
//   return `last seen ${d.toLocaleDateString([], { day:'numeric', month:'short' })} at ${tt}`;
// };

// // ── Sub-components ────────────────────────────────────────────────
// const StatusTick = ({ status }: { status: string }) => {
//   if (status === 'seen') return <Ionicons name="checkmark-done-outline" size={14} color={C.seen} />;
//   if (status === 'sent') return <Ionicons name="checkmark-outline" size={14} color="rgba(255,255,255,0.7)" />;
//   return null;
// };

// const DateDivider = ({ ts }: { ts: number }) => {
//   const d = new Date(secToMs(ts)), today = new Date();
//   const diff = Math.floor((today.getTime() - secToMs(ts)) / 86400000);
//   const label = diff===0 ? 'Today' : diff===1 ? 'Yesterday'
//     : d.toLocaleDateString([], { month:'short', day:'numeric' });
//   return (
//     <View style={t.dateDivider}>
//       <View style={t.dateLine}/><Text style={t.dateText}>{label}</Text><View style={t.dateLine}/>
//     </View>
//   );
// };

// const ReplyQuote = ({ replyToText, replyToSender, myId, otherName }: {
//   replyToText:string; replyToSender:string; myId:string; otherName:string;
// }) => {
//   const isImg = replyToText?.startsWith('__IMG__'), isVid = replyToText?.startsWith('__VID__');
//   const isMedia = isImg || isVid;
//   const mediaUrl = isMedia ? extractMediaUrl(replyToText) : null;
//   const caption  = isMedia ? extractMediaCaption(replyToText) : null;
//   const preview  = isMedia ? (caption || (isVid ? ' Video' : ' Photo')) : replyToText;
//   return (
//     <View style={t.replyQuote}>
//       <Text style={t.replyQuoteName}>{replyToSender === myId ? 'You' : otherName}</Text>
//       <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
//         {isMedia && mediaUrl && (
//           <View style={t.replyThumb}>
//             {isImg
//               ? <CachedImage source={{ uri:mediaUrl }} style={t.replyThumbImg} contentFit="cover"/>
//               : <View style={[t.replyThumbImg,{backgroundColor:'#1C1C1E',alignItems:'center',justifyContent:'center'}]}>
//                   <Ionicons name="play-circle" size={16} color="#fff"/>
//                 </View>}
//           </View>
//         )}
//         <Text style={t.replyQuoteText} numberOfLines={1}>{preview}</Text>
//       </View>
//     </View>
//   );
// };

// const ReactionsRow = ({ reactionsJson, onReact, msg }: {
//   reactionsJson:string; onReact:(m:any, e:string)=>void; msg:any;
// }) => {
//   let rx: { userId:string; emoji:string }[] = [];
//   try { rx = JSON.parse(reactionsJson); } catch {}
//   if (!rx.length) return null;
//   const g: Record<string,number> = {};
//   rx.forEach(r => { g[r.emoji] = (g[r.emoji] || 0) + 1; });
//   return (
//     <View style={t.reactionsRow}>
//       {Object.entries(g).map(([emoji, count]) => (
//         <TouchableOpacity key={emoji} style={t.reactionBadge}
//           onPress={() => onReact(msg, emoji)} activeOpacity={0.7}>
//           <Text style={t.reactionEmoji}>{emoji}</Text>
//           {count > 1 && <Text style={t.reactionCount}>{count}</Text>}
//         </TouchableOpacity>
//       ))}
//     </View>
//   );
// };

// const MSG_IMG_W = Dimensions.get('window').width * 0.62;

// const MediaBubble = React.memo(({ message, isMe, pending, onPress }: {
//   message:string; isMe:boolean; pending:boolean; onPress:()=>void;
// }) => {
//   const [err, setErr] = React.useState(false);
//   const url = extractMediaUrl(message), caption = extractMediaCaption(message);
//   return (
//     <View style={{ borderRadius:12, overflow:'hidden' }}>
//       <TouchableOpacity onPress={onPress} activeOpacity={0.9} disabled={pending}>
//         {isVideoMsg(message)
//           ? (() => {
//               // VIDEO THUMBNAIL: show first-frame poster from Cloudinary
//               // cdnVideoThumbUrl() generates a JPEG of frame 0 — instant load ✅
//               // Play button overlaid on top, exactly like WhatsApp / Instagram
//               const thumbUri = cdnVideoThumbUrl(url, 400, 300);
//               return (
//                 <View style={[t.mediaBubble, { backgroundColor:'#111', position:'relative' }]}>
//                   {thumbUri ? (
//                     <CachedImage
//                       source={{ uri: thumbUri }}
//                       style={{ width:MSG_IMG_W, height:MSG_IMG_W*0.75 }}
//                       contentFit="cover"
//                     />
//                   ) : (
//                     <View style={[t.mediaBubble, { backgroundColor:'#1C1C1E' }]} />
//                   )}
//                   {/* Play button overlay — WhatsApp style */}
//                   <View style={t.videoPlayOverlay}>
//                     <View style={t.videoPlayBtn}>
//                       <Ionicons name="play" size={28} color="#fff" />
//                     </View>
//                   </View>
//                   {/* Duration badge placeholder */}
//                   <View style={t.videoDurationBadge}>
//                     <Ionicons name="videocam" size={11} color="#fff" style={{ marginRight:3 }} />
//                     <Text style={t.videoDurationTxt}>Video</Text>
//                   </View>
//                 </View>
//               );
//             })()
//           : err
//             ? <View style={[t.mediaBubble,{backgroundColor:'#374151'}]}>
//                 <Ionicons name="image-outline" size={36} color="#9CA3AF"/>
//               </View>
//             : <CachedImage source={{ uri:url }} style={{ width:MSG_IMG_W, height:MSG_IMG_W*0.75 }}
//                 contentFit="cover" onError={() => setErr(true)}/>}
//         {pending && (
//           <View style={t.mediaLoadingOverlay}>
//             <ActivityIndicator size="large" color="#fff"/>
//           </View>
//         )}
//       </TouchableOpacity>
//       {!!caption && (
//         <Text style={[t.msgText, isMe?t.myText:t.otherText, { marginTop:6, paddingHorizontal:4 }]}>
//           {caption}
//         </Text>
//       )}
//     </View>
//   );
// });

// const MessageBubble = React.memo(({
//   item, isMe, onRetry, onLongPress, onReact, onReply, onOpenMedia, otherName, myId,
// }: {
//   item:ChatMessage; isMe:boolean; onRetry:(m:ChatMessage)=>void;
//   onLongPress:(m:ChatMessage)=>void; onReact:(m:any, e:string)=>void;
//   onReply:(m:ChatMessage)=>void; onOpenMedia:(uri:string, type:'image'|'video')=>void;
//   otherName:string; myId:string;
// }) => {
//   const swipeX = React.useRef(new Animated.Value(0)).current;
//   const THRESH = 60, MAX = 80;
//   const pan = React.useRef(PanResponder.create({
//     onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
//     onPanResponderMove: (_, g) => {
//       swipeX.setValue(isMe ? Math.max(-MAX, Math.min(0, g.dx)) : Math.min(MAX, Math.max(0, g.dx)));
//     },
//     onPanResponderRelease: (_, g) => {
//       if (isMe ? g.dx < -THRESH : g.dx > THRESH) {
//         onReply(item);
//         Animated.spring(swipeX, { toValue:0, useNativeDriver:true, friction:5, tension:100 }).start();
//       } else {
//         Animated.spring(swipeX, { toValue:0, useNativeDriver:true, friction:6, tension:150 }).start();
//       }
//     },
//   })).current;

//   const iconOpacity = swipeX.interpolate({
//     inputRange: isMe ? [-THRESH,-20,0] : [0,20,THRESH],
//     outputRange: isMe ? [1,0.4,0] : [0,0.4,1], extrapolate:'clamp',
//   });
//   const iconScale = swipeX.interpolate({
//     inputRange: isMe ? [-THRESH,-20,0] : [0,20,THRESH],
//     outputRange: isMe ? [1,0.7,0.4] : [0.4,0.7,1], extrapolate:'clamp',
//   });

//   return (
//     <View style={[t.msgWrap, isMe ? t.myWrap : t.otherWrap]}>
//       <Animated.View style={[
//         t.swipeReplyIcon, isMe ? t.swipeIconLeft : t.swipeIconRight,
//         { opacity:iconOpacity, transform:[{ scale:iconScale }] },
//       ]}>
//         <Ionicons name="return-down-back-outline" size={18} color={C.muted}/>
//       </Animated.View>

//       <Animated.View style={{ transform:[{ translateX:swipeX }] }} {...pan.panHandlers}>
//         <TouchableOpacity
//           activeOpacity={item._failed ? 0.6 : 0.95}
//           onPress={() => item._failed && onRetry(item)}
//           onLongPress={() => onLongPress(item)}
//           delayLongPress={300}
//           style={[
//             t.bubble, isMe ? t.myBubble : t.otherBubble,
//             item._pending && { opacity:0.6 },
//             item._failed  && t.failedBubble,
//           ]}
//         >
//           {!!(item as any).replyToText && (
//             <ReplyQuote
//               replyToText={(item as any).replyToText}
//               replyToSender={(item as any).replyToSender ?? ''}
//               myId={myId} otherName={otherName}
//             />
//           )}
//           {isMediaMsg(item.message)
//             ? <MediaBubble message={item.message} isMe={isMe} pending={!!item._pending}
//                 onPress={() => onOpenMedia(extractMediaUrl(item.message), isVideoMsg(item.message) ? 'video' : 'image')}/>
//             : <Text style={[t.msgText, isMe ? t.myText : t.otherText]}>{item.message}</Text>}
//           {(item as any).edited && (
//             <Text style={[t.editedLabel, isMe && { color:'rgba(255,255,255,0.6)' }]}>edited</Text>
//           )}
//           <View style={t.metaRow}>
//             <Text style={[t.timeText, isMe && { color:'rgba(255,255,255,0.7)' }]}>
//               {formatTime(item.createdAt)}
//             </Text>
//             {item._pending && <ActivityIndicator size={10} color={isMe?'rgba(255,255,255,0.7)':C.muted} style={{ marginLeft:4 }}/>}
//             {item._failed  && <Text style={t.failedText}> ⚠ Tap to retry</Text>}
//             {isMe && !item._pending && !item._failed && (
//               <View style={{ marginLeft:2 }}><StatusTick status={item.status}/></View>
//             )}
//           </View>
//         </TouchableOpacity>
//         {!!(item as any).reactions && (item as any).reactions !== '[]' && (
//           <ReactionsRow reactionsJson={(item as any).reactions} onReact={onReact} msg={item}/>
//         )}
//       </Animated.View>
//     </View>
//   );
// });

// // ═══════════════════════════════════════════════════════════════
// // MAIN SCREEN
// // ═══════════════════════════════════════════════════════════════
// export default function ChatScreen() {
//   const { user } = useAuth();
//   const params = useLocalSearchParams<{
//     chatId:string; userId:string; name:string; image:string; lastSeen?:string;
//   }>();

//   const paramChatId = params.chatId?.trim() || '';
//   const [chatId,       setChatId]       = useState(paramChatId);
//   const [inputText,    setInputText]    = useState('');
//   const [sending,      setSending]      = useState(false);
//   const [chatState,    setChatState]    = useState<'idle'|'finding'|'ready'|'error'>(
//     paramChatId ? 'idle' : 'finding'
//   );
//   const [actionMsg,    setActionMsg]    = useState<ActionMessage|null>(null);
//   const [replyTo,      setReplyTo]      = useState<ChatMessage|null>(null);
//   const [editingMsg,   setEditingMsg]   = useState<ActionMessage|null>(null);
//   const [menuSheet,    setMenuSheet]    = useState(false);
//   const [isBlocked,    setIsBlocked]    = useState(false);
//   const [iBlockedThem, setIBlockedThem] = useState(false);
//   const [pendingMedia, setPendingMedia] = useState<{ uri:string; type:'image'|'video' }|null>(null);
//   const [sendingMedia, setSendingMedia] = useState(false);
//   const [viewerMedia,  setViewerMedia]  = useState<{ uri:string; type:'image'|'video' }|null>(null);

//   const flatRef  = useRef<FlatList>(null);
//   const inputRef = useRef<TextInput>(null);

//   const {
//     messages, setMessages, loading, loadingOld, hasMore,
//     sendMessage, retryMessage, loadOlderMessages,
//   } = useMessages(chatId);

//   // ── Mark seen ─────────────────────────────────────────────────
//   useEffect(() => {
//     if (!chatId || !user?.id) return;
//     const uid = user.id;
//     supabase.from('messages')
//       .update({ status:'seen' })
//       .eq('chat_id', chatId).neq('sender_id', uid).eq('status','sent')
//       .then(() => {}, () => {});
//     supabase.from('chats')
//       .update({ last_message_status:'seen' })
//       .eq('id', chatId)
//       .then(() => {}, () => {});
//   }, [chatId, user?.id]);

//   // ── Check block status ────────────────────────────────────────
//   useEffect(() => {
//     if (!params.userId || !user?.id) return;
//     callFn({ action:'check_block', otherUserId:params.userId })
//       .then(r => {
//         setIsBlocked(r.isBlocked ?? false);
//         setIBlockedThem(r.iBlockedThem ?? false);
//       })
//       .catch(() => {});
//   }, [params.userId, user?.id]);

//   // ── Find chat if no chatId ────────────────────────────────────
//   useEffect(() => {
//     if (paramChatId || !params.userId || !user?.id) return;
//     let cancelled = false, attempts = 0;
//     const tryFind = async () => {
//       if (cancelled) return;
//       attempts++;
//       // findChat works even for hidden chats — RLS only checks participants[]
//       const chat = await findChat(user.id, params.userId).catch(() => null);
//       if (chat) { setChatId(chat.$id); setChatState('ready'); return; }

//       // Fallback: use edge fn get_chat_id (service_role, bypasses all RLS)
//       if (attempts === 2) {
//         const chatId = await getChatId(params.userId).catch(() => null);
//         if (chatId) { setChatId(chatId); setChatState('ready'); return; }
//       }

//       if (!cancelled && attempts < 8) setTimeout(tryFind, 1000);
//       else if (!cancelled) setChatState('error');
//     };
//     tryFind();
//     return () => { cancelled = true; };
//   }, [params.userId, user?.id, paramChatId]);

//   // ── Auto-scroll to bottom on new message ──────────────────────
//   useEffect(() => {
//     if (messages.length > 0)
//       setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
//   }, [messages.length]);

//   // ── Handlers ──────────────────────────────────────────────────
//   const handleReact = useCallback(async (msg: ChatMessage, emoji: string) => {
//     if (!user?.id) return;
//     setMessages(prev => prev.map(m => {
//       if (m.$id !== msg.$id) return m;
//       let rx: { userId:string; emoji:string }[] = [];
//       try { rx = JSON.parse((m as any).reactions || '[]'); } catch {}
//       const idx = rx.findIndex(r => r.userId === user.id);
//       if (idx >= 0) {
//         rx = rx[idx].emoji === emoji
//           ? rx.filter(r => r.userId !== user.id)
//           : rx.map(r => r.userId === user.id ? { ...r, emoji } : r);
//       } else { rx = [...rx, { userId:user.id, emoji }]; }
//       return { ...m, reactions:JSON.stringify(rx) };
//     }));
//     callFn({ action:'react_message', messageId:msg.$id, emoji }).catch(() => {});
//   }, [user?.id, setMessages]);

//   const handleReply = useCallback((msg: ChatMessage) => {
//     setReplyTo(msg);
//     setTimeout(() => inputRef.current?.focus(), 100);
//   }, []);

//   const handleEdit = useCallback((msg: ActionMessage) => {
//     setEditingMsg(msg);
//     setInputText(msg.message);
//     setReplyTo(null);
//     setTimeout(() => inputRef.current?.focus(), 100);
//   }, []);

//   // ── Delete — WhatsApp strategy ────────────────────────────────
//   // delete_message     = soft delete (deleted_for[]) — any user, persists after refresh ✅
//   // delete_for_everyone = hard delete from DB — sender only, within 60 s ✅
//   const handleDelete = useCallback((msg: ActionMessage) => {
//     const isMine     = msg.sender_id === user?.id;
//     const ageMs      = Date.now() - new Date(msg.created_at).getTime();
//     const canUnsend  = isMine && ageMs < 60_000;

//     const doSoftDelete = () => {
//       setMessages(prev => prev.filter(m => m.$id !== msg.$id));
//       withRetry(() => callFn({ action:'delete_message', messageId:msg.$id })).catch(() => {});
//     };
//     const doHardDelete = () => {
//       setMessages(prev => prev.filter(m => m.$id !== msg.$id));
//       withRetry(() => callFn({ action:'delete_for_everyone', messageId:msg.$id })).catch(() => {});
//     };

//     if (isMine && canUnsend) {
//       Alert.alert('Delete message', undefined, [
//         { text:'Cancel', style:'cancel' },
//         { text:'Delete for me',         onPress: doSoftDelete },
//         { text:'Delete for everyone', style:'destructive', onPress: doHardDelete },
//       ]);
//     } else if (isMine) {
//       Alert.alert('Delete message', undefined, [
//         { text:'Cancel', style:'cancel' },
//         { text:'Delete for me', style:'destructive', onPress: doSoftDelete },
//       ]);
//     } else {
//       Alert.alert('Delete message', 'Removed from your view only.', [
//         { text:'Cancel', style:'cancel' },
//         { text:'Delete for me', style:'destructive', onPress: doSoftDelete },
//       ]);
//     }
//   }, [user?.id, setMessages]);

//   // ── Clear chat ────────────────────────────────────────────────
//   // Uses edge fn → service_role bypasses RLS → marks deleted_for[uid] on all messages
//   const handleClearChat = useCallback(async () => {
//     if (!chatId) return;
//     Alert.alert('Clear Chat', 'Delete all messages for you only?', [
//       { text:'Cancel', style:'cancel' },
//       { text:'Clear', style:'destructive', onPress: async () => {
//         setMessages([]);
//         try {
//           await withRetry(() => callFn({ action:'clear_chat', chatId }));
//         } catch (e: any) {
//           console.error('clear_chat failed:', e?.message);
//         }
//       }},
//     ]);
//   }, [chatId, setMessages]);

//   const handleBlock = useCallback(async () => {
//     setMenuSheet(false);
//     await callFn({ action:'block_user', blockedId:params.userId }).catch(() => {});
//     setIsBlocked(true); setIBlockedThem(true);
//     Alert.alert('Blocked', `You blocked ${params.name}.`);
//   }, [params.userId, params.name]);

//   const handleUnblock = useCallback(async () => {
//     setMenuSheet(false);
//     await callFn({ action:'unblock_user', blockedId:params.userId }).catch(() => {});
//     setIsBlocked(false); setIBlockedThem(false);
//   }, [params.userId]);

//   const handleMediaConfirm = useCallback(async (caption: string) => {
//     if (!pendingMedia || !chatId) return;
//     setSendingMedia(true);
//     try {
//       let uploadUri = pendingMedia.uri;
//       if (pendingMedia.type === 'image') uploadUri = await compressForUpload(pendingMedia.uri, 'chat');
//       const result  = await uploadToCloudinary(uploadUri, { type: pendingMedia.type, uploadType: 'chat' });
//       const fileUrl = pendingMedia.type === 'image' ? cdnChatUrl(result.secureUrl) : result.secureUrl;
//       const msgText = `${pendingMedia.type==='video'?VID_PREFIX:IMG_PREFIX}${fileUrl}${caption?`\n${caption}`:''}`;
//       setPendingMedia(null); setSendingMedia(false);
//       await sendMessage(msgText, {});
//     } catch (e: any) {
//       Alert.alert('Upload failed', e?.message ?? 'Please try again');
//       setSendingMedia(false);
//     }
//   }, [pendingMedia, chatId, sendMessage]);

//   const handleSend = useCallback(async () => {
//     const text = inputText.trim();
//     if (!text || sending || !chatId || isBlocked) return;
//     if (editingMsg) {
//       const msgId = editingMsg.$id;
//       setInputText(''); setSending(true); setEditingMsg(null);
//       setMessages(prev => prev.map(m => m.$id === msgId ? { ...m, message:text, edited:true } : m));
//       callFn({ action:'edit_message', messageId:msgId, newText:text })
//         .catch(() => {
//           setMessages(prev => prev.map(m => m.$id === msgId ? { ...m, message:editingMsg.message } : m));
//         });
//       setSending(false); return;
//     }
//     setInputText(''); setSending(true);
//     const reply = replyTo; setReplyTo(null);
//     await sendMessage(text, {
//       replyToId:     reply?.$id    ?? null,
//       replyToText:   reply?.message ?? null,
//       replyToSender: reply?.senderId ?? null,
//     });
//     setSending(false);
//   }, [inputText, sending, chatId, isBlocked, replyTo, editingMsg, sendMessage, setMessages]);

//   // ── Render message ────────────────────────────────────────────
//   const renderItem = useCallback(({ item, index }: { item:ChatMessage; index:number }) => {
//     // Skip soft-deleted messages (deleted_for includes my uid)
//     // This runs client-side for instant UI; the server-side .not() filter
//     // ensures they're also excluded after refresh ✅
//     if (user?.id && item.deletedFor?.includes(user.id)) return null;

//     const isMe  = item.senderId === user?.id;
//     const prev  = messages[index - 1];
//     const showD = !prev
//       || new Date(secToMs(item.createdAt)).toDateString()
//       !== new Date(secToMs(prev.createdAt)).toDateString();

//     return (
//       <>
//         {showD && <DateDivider ts={item.createdAt}/>}
//         <MessageBubble
//           item={item} isMe={isMe} myId={user?.id ?? ''} otherName={params.name ?? ''}
//           onRetry={retryMessage}
//           onLongPress={msg => setActionMsg({
//             $id:        msg.$id,
//             sender_id:  msg.senderId,
//             message:    msg.message,
//             created_at: msg.createdAt,
//           })}
//           onReact={handleReact} onReply={handleReply}
//           onOpenMedia={(uri, type) => setViewerMedia({ uri, type })}
//         />
//       </>
//     );
//   }, [messages, user?.id, retryMessage, handleReact, handleReply, params.name]);

//   // ── Chat finding state ────────────────────────────────────────
//   if (chatState === 'finding') return (
//     <SafeAreaView style={ch.safe} edges={['top']}>
//       <ChatHeader name={params.name} image={params.image} lastSeen={params.lastSeen}
//         onMenuPress={() => setMenuSheet(true)} userId={params.userId}/>
//       <View style={ch.center}><ActivityIndicator size="large" color={C.purple}/></View>
//     </SafeAreaView>
//   );
//   if (chatState === 'error') return (
//     <SafeAreaView style={ch.safe} edges={['top']}>
//       <ChatHeader name={params.name} image={params.image} lastSeen={params.lastSeen}
//         onMenuPress={() => setMenuSheet(true)} userId={params.userId}/>
//       <View style={ch.center}>
//         <Text style={ch.errorTitle}>Chat not available</Text>
//         <Text style={ch.centerText}>Accept the connection request first</Text>
//       </View>
//     </SafeAreaView>
//   );

//   // ── Main UI ───────────────────────────────────────────────────
//   return (
//     <SafeAreaView style={ch.safe} edges={['top','bottom']}>
//       <StatusBar barStyle="dark-content"/>
//       <ChatHeader name={params.name} image={params.image} lastSeen={params.lastSeen}
//         onMenuPress={() => setMenuSheet(true)} userId={params.userId}/>

//       <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
//         {loading
//           ? <View style={ch.center}><ActivityIndicator color={C.purple} size="large"/></View>
//           : <FlatList
//               ref={flatRef}
//               data={messages}
//               renderItem={renderItem}
//               keyExtractor={item => item.$id}
//               contentContainerStyle={ch.listContent}
//               showsVerticalScrollIndicator={false}
//               onScrollBeginDrag={({ nativeEvent }) => {
//                 if (nativeEvent.contentOffset.y < 60 && hasMore && !loadingOld)
//                   loadOlderMessages();
//               }}
//               ListHeaderComponent={
//                 loadingOld
//                   ? <ActivityIndicator color={C.purple} style={{ padding:12 }}/>
//                   : hasMore
//                     ? <TouchableOpacity style={ch.loadMoreBtn} onPress={loadOlderMessages}>
//                         <Text style={ch.loadMoreText}>Load older messages</Text>
//                       </TouchableOpacity>
//                     : null
//               }
//               ListEmptyComponent={
//                 <View style={ch.emptyChat}>
//                   <Text style={ch.emptyChatText}>Say hello to {params.name}!</Text>
//                 </View>
//               }
//               initialNumToRender={20} maxToRenderPerBatch={10}
//               windowSize={10} removeClippedSubviews
//             />
//         }
//         <ChatInput
//           value={inputText} onChangeText={setInputText} onSend={handleSend}
//           sending={sending} disabled={!chatId}
//           inputRef={inputRef as RefObject<TextInput>}
//           chatId={chatId}
//           replyTo={replyTo as any} editingMsg={editingMsg as any}
//           onCancelReply={() => setReplyTo(null)}
//           onCancelEdit={() => { setEditingMsg(null); setInputText(''); }}
//           myId={user?.id ?? ''} otherName={params.name ?? ''}
//           isBlocked={isBlocked} iBlockedThem={iBlockedThem}
//           onUnblock={handleUnblock} blockedName={params.name}
//           onMediaSend={(uri, type) => setPendingMedia({ uri, type })}
//         />
//       </KeyboardAvoidingView>

//       <MediaViewer
//         uri={viewerMedia?.uri ?? null} type={viewerMedia?.type ?? 'image'}
//         onClose={() => setViewerMedia(null)}/>
//       <MediaPreview
//         uri={pendingMedia?.uri ?? null} type={pendingMedia?.type ?? 'image'}
//         onSend={handleMediaConfirm} onClose={() => setPendingMedia(null)}
//         sending={sendingMedia} otherName={params.name ?? 'them'}/>

//       <MessageActionSheet
//         visible={!!actionMsg} message={actionMsg}
//         isMine={actionMsg?.sender_id === user?.id}
//         onClose={() => setActionMsg(null)}
//         onCopy={async text => { await Clipboard.setStringAsync(text); }}
//         onReact={(msg, emoji) => handleReact(msg as unknown as ChatMessage, emoji)}
//         onReply={msg => handleReply(msg as unknown as ChatMessage)}
//         onEdit={handleEdit} onDelete={handleDelete}
//       />

//       <ChatMenuSheet visible={menuSheet} onClose={() => setMenuSheet(false)} items={[
//         { icon:'trash-outline', label:'Clear Chat', onPress:handleClearChat },
//         {
//           icon: iBlockedThem ? 'checkmark-circle-outline' : 'ban-outline',
//           label: iBlockedThem ? 'Unblock User' : 'Block User',
//           onPress: iBlockedThem ? handleUnblock : handleBlock,
//         },
//         {
//           icon:'flag-outline', label:'Report User',
//           onPress: () => {
//             setMenuSheet(false);
//             Alert.alert('Report User', `Report ${params.name} for inappropriate content?`, [
//               { text:'Cancel', style:'cancel' },
//               { text:'Report', style:'destructive',
//                 onPress: () => Alert.alert('Reported ✓', 'Thank you. Our team will review this.') },
//             ]);
//           },
//         },
//       ]}/>
//     </SafeAreaView>
//   );
// }

// // ── Chat header ───────────────────────────────────────────────────
// const ChatHeader = ({
//   name, image, lastSeen, onMenuPress, userId,
// }: {
//   name?:string; image?:string; lastSeen?:string|null;
//   onMenuPress:()=>void; userId:string;
// }) => {
//   const st = formatLastSeen(lastSeen ?? null), online = st === 'online';
//   return (
//     <View style={ch.header}>
//       <TouchableOpacity onPress={() => router.back()} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
//         <Ionicons name="arrow-back" size={20} color={C.text}/>
//       </TouchableOpacity>
//       <View style={{ position:'relative' }}>
//         <TouchableOpacity
//           onPress={() => router.push({ pathname:'/subScreens/userProfile', params:{ userId } })}
//           activeOpacity={0.8}>
//           <ProfileAvatar uri={image || null} name={name ?? '?'} size={38}/>
//         </TouchableOpacity>
//         {online && <View style={ch.onlineDot}/>}
//       </View>
//       <View style={{ flex:1 }}>
//         <Text style={ch.headerName} numberOfLines={1}>{name ?? 'Chat'}</Text>
//         {!!st && <Text style={[ch.headerStatus, online && { color:'#16A34A' }]}>{st}</Text>}
//       </View>
//       <TouchableOpacity onPress={onMenuPress}
//         hitSlop={{ top:10, bottom:10, left:10, right:10 }} style={{ padding:4 }}>
//         <Ionicons name="ellipsis-vertical" size={20} color={C.text}/>
//       </TouchableOpacity>
//     </View>
//   );
// };

// // ── Styles ────────────────────────────────────────────────────────
// const ch = StyleSheet.create({
//   safe:         { flex:1, backgroundColor:C.white },
//   header:       { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:16,
//                   paddingVertical:10, backgroundColor:C.white,
//                   borderBottomColor:C.border },
//   headerName:   { fontSize:16, fontWeight:'700', color:C.text },
//   headerStatus: { fontSize:12, color:C.muted, marginTop:1 },
//   onlineDot:    { position:'absolute', bottom:0, right:0, width:11, height:11, borderRadius:6,
//                   backgroundColor:'#16A34A', borderWidth:2, borderColor:C.white },
//   center:       { flex:1, alignItems:'center', justifyContent:'center', padding:40 },
//   centerText:   { fontSize:14, color:C.muted, textAlign:'center', marginTop:12 },
//   errorTitle:   { fontSize:18, fontWeight:'800', color:C.text, marginBottom:6 },
//   listContent:  { paddingHorizontal:12, paddingVertical:12, paddingBottom:8 },
//   loadMoreBtn:  { alignSelf:'center', padding:8 },
//   loadMoreText: { color:C.purple, fontSize:13, fontWeight:'600' },
//   emptyChat:    { alignItems:'center', paddingTop:80 },
//   emptyChatText:{ fontSize:15, color:C.muted },
// });

// const t = StyleSheet.create({
//   msgWrap:    { marginVertical:2, maxWidth:'80%' },
//   myWrap:     { alignSelf:'flex-end' },
//   otherWrap:  { alignSelf:'flex-start' },
//   bubble:     { borderRadius:18, paddingHorizontal:12, paddingVertical:8,
//                 paddingBottom:6, elevation:1 },
//   myBubble:   { backgroundColor:C.purpleMsg, borderBottomRightRadius:4 },
//   otherBubble:{ backgroundColor:C.otherMsg, borderBottomLeftRadius:4,
//                 borderWidth:1, borderColor:C.border },
//   failedBubble:{ borderWidth:1, borderColor:C.red },
//   msgText:    { fontSize:15, lineHeight:21 },
//   myText:     { color:'#fff' },
//   otherText:  { color:C.text },
//   editedLabel:{ fontSize:10, color:C.muted, marginTop:1 },
//   metaRow:    { flexDirection:'row', alignItems:'center',
//                 justifyContent:'flex-end', marginTop:3, gap:2 },
//   timeText:   { fontSize:10, color:C.muted },
//   failedText: { fontSize:10, color:C.red },
//   replyQuote: { borderLeftWidth:2, borderLeftColor:'rgba(255,255,255,0.5)',
//                 paddingLeft:8, marginBottom:6, backgroundColor:'rgba(0,0,0,0.1)',
//                 borderRadius:6, padding:6 },
//   replyQuoteName: { fontSize:11, color:'rgba(255,255,255,0.8)',
//                     fontWeight:'700', marginBottom:2 },
//   replyQuoteText: { fontSize:12, color:'rgba(255,255,255,0.7)' },
//   mediaBubble:    { width:MSG_IMG_W, height:MSG_IMG_W*0.75,
//                     alignItems:'center', justifyContent:'center', borderRadius:12 },
//   mediaLabel:     { color:'#9CA3AF', fontSize:12, marginTop:6 },
//   mediaLoadingOverlay: { ...StyleSheet.absoluteFillObject,
//                          backgroundColor:'rgba(0,0,0,0.45)', alignItems:'center',
//                          justifyContent:'center', borderRadius:12 },
//   reactionsRow: { flexDirection:'row', flexWrap:'wrap', gap:4, marginTop:4, marginLeft:4 },
//   swipeReplyIcon: { position:'absolute', top:'50%' as any, marginTop:-12, zIndex:0 },
//   swipeIconLeft:  { left:-28 },
//   swipeIconRight: { right:-28 },
//   replyThumb:     { borderRadius:4, overflow:'hidden' },
//   replyThumbImg:  { width:32, height:32, borderRadius:4 },
//   reactionBadge:  { flexDirection:'row', alignItems:'center', gap:3,
//                     backgroundColor:'#ffffff', borderRadius:12, paddingHorizontal:5,
//                     paddingVertical:2, borderColor:C.border, elevation:5, bottom:6, right:5 },
//   reactionEmoji:  { fontSize:13 },
//   reactionCount:  { fontSize:11, color:C.muted, fontWeight:'600' },
//   dateDivider:    { flexDirection:'row', alignItems:'center', marginVertical:16, gap:10 },
//   dateLine:       { flex:1, height:1, backgroundColor:C.border },
//   dateText:       { fontSize:11, color:C.muted, fontWeight:'600' },
//   // Video thumbnail overlay styles
//   videoPlayOverlay: {
//     ...StyleSheet.absoluteFillObject,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   videoPlayBtn: {
//     width: 52, height: 52, borderRadius: 26,
//     backgroundColor: 'rgba(0,0,0,0.55)',
//     alignItems: 'center', justifyContent: 'center',
//     paddingLeft: 4, // optical centre for play triangle
//   },
//   videoDurationBadge: {
//     position: 'absolute', bottom: 8, right: 8,
//     flexDirection: 'row', alignItems: 'center',
//     backgroundColor: 'rgba(0,0,0,0.55)',
//     paddingHorizontal: 6, paddingVertical: 3,
//     borderRadius: 6,
//   },
//   videoDurationTxt: { color: '#fff', fontSize: 11, fontWeight: '600' },
// });


// app/subScreens/chatScreen.tsx
// All Alert.alert replaced with ConfirmModal ✅

import React, { useState, useEffect, useCallback, useRef, RefObject } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Dimensions, Animated, PanResponder,
} from 'react-native';
let CachedImage: any;
try { CachedImage = require('expo-image').Image; }
catch { CachedImage = require('react-native').Image; }
import * as Clipboard                   from 'expo-clipboard';
import { SafeAreaView }                 from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons }                     from '@expo/vector-icons';
import { ProfileAvatar }                from '@/components/Profileavatar';
import { useAuth }                      from '@/Contexts/authContext';
import { useMessages, findChat, getChatId, ChatMessage } from '@/hooks/useChat';
import { supabase }                     from '@/lib/supabase';
import { MessageActionSheet, ActionMessage } from '@/components/messageActionSheet';
import { ChatMenuSheet }                from '@/components/blockSheet';
import { cdnChatUrl, cdnVideoUrl, cdnVideoThumbUrl, compressForUpload, uploadToCloudinary } from '@/lib/cloudinaryUpload';
import ChatInput                        from '@/components/chatInput';
import MediaViewer                      from '@/components/mediaViewer';
import MediaPreview                     from '@/components/mediaPreview';
import ConfirmModal                     from '@/components/confirmModel'; // ← NEW

// ── Media helpers ─────────────────────────────────────────────────
const IMG_PREFIX = '__IMG__';
const VID_PREFIX = '__VID__';
const isImageMsg      = (m: string) => m.startsWith(IMG_PREFIX);
const isVideoMsg      = (m: string) => m.startsWith(VID_PREFIX);
const isMediaMsg      = (m: string) => isImageMsg(m) || isVideoMsg(m);
const extractMediaUrl = (m: string) => m.replace(IMG_PREFIX,'').replace(VID_PREFIX,'').split('\n')[0].trim();
const extractMediaCaption = (m: string) => m.replace(IMG_PREFIX,'').replace(VID_PREFIX,'').split('\n').slice(1).join('\n').trim();

// ── Edge function caller ──────────────────────────────────────────
const callFn = async (body: Record<string, any>) => {
  console.log('📤 Sending to Edge Fn:', JSON.stringify(body));
  const { data, error } = await supabase.functions.invoke('mindmates', { body });
  if (error) { console.error('❌ Supabase invoke error:', error); throw new Error(error.message); }
  if (data?.error) { console.error('🔥 callFn failed:', data.error); throw new Error(data.error); }
  return data;
};

// ── Retry with exponential back-off ──────────────────────────────
const withRetry = async <T,>(fn: () => Promise<T>, attempts = 3): Promise<T> => {
  let last: any;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, 300 * 2 ** i));
    }
  }
  throw last;
};

const C = {
  bg:'#F5F5F7', white:'#FFFFFF', purple:'#6D4AFF',
  purpleMsg:'#6D4AFF', otherMsg:'#FFFFFF',
  text:'#111827', muted:'#6B7280', border:'#E5E7EB',
  red:'#EF4444', seen:'#F3CF3E',
};

const secToMs    = (ts: number) => ts < 10_000_000_000 ? ts * 1000 : ts;
const formatTime = (ts: number) =>
  new Date(secToMs(ts)).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

const formatLastSeen = (s: string | null) => {
  if (!s) return '';
  const diff = Math.floor((Date.now() - new Date(s).getTime()) / 60000);
  if (diff < 5)  return 'online';
  if (diff < 60) return `last seen ${diff}m ago`;
  const d = new Date(s);
  const tt = d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  const today = new Date(), yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return `last seen today at ${tt}`;
  if (d.toDateString() === yest.toDateString())  return `last seen yesterday at ${tt}`;
  return `last seen ${d.toLocaleDateString([], { day:'numeric', month:'short' })} at ${tt}`;
};

// ── Sub-components (unchanged) ────────────────────────────────────
const StatusTick = ({ status }: { status: string }) => {
  if (status === 'seen') return <Ionicons name="checkmark-done-outline" size={14} color={C.seen} />;
  if (status === 'sent') return <Ionicons name="checkmark-outline" size={14} color="rgba(255,255,255,0.7)" />;
  return null;
};

const DateDivider = ({ ts }: { ts: number }) => {
  const d = new Date(secToMs(ts)), today = new Date();
  const diff = Math.floor((today.getTime() - secToMs(ts)) / 86400000);
  const label = diff===0 ? 'Today' : diff===1 ? 'Yesterday'
    : d.toLocaleDateString([], { month:'short', day:'numeric' });
  return (
    <View style={t.dateDivider}>
      <View style={t.dateLine}/><Text style={t.dateText}>{label}</Text><View style={t.dateLine}/>
    </View>
  );
};

const ReplyQuote = ({ replyToText, replyToSender, myId, otherName }: {
  replyToText:string; replyToSender:string; myId:string; otherName:string;
}) => {
  const isImg = replyToText?.startsWith('__IMG__'), isVid = replyToText?.startsWith('__VID__');
  const isMedia = isImg || isVid;
  const mediaUrl = isMedia ? extractMediaUrl(replyToText) : null;
  const caption  = isMedia ? extractMediaCaption(replyToText) : null;
  const preview  = isMedia ? (caption || (isVid ? ' Video' : ' Photo')) : replyToText;
  return (
    <View style={t.replyQuote}>
      <Text style={t.replyQuoteName}>{replyToSender === myId ? 'You' : otherName}</Text>
      <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
        {isMedia && mediaUrl && (
          <View style={t.replyThumb}>
            {isImg
              ? <CachedImage source={{ uri:mediaUrl }} style={t.replyThumbImg} contentFit="cover"/>
              : <View style={[t.replyThumbImg,{backgroundColor:'#1C1C1E',alignItems:'center',justifyContent:'center'}]}>
                  <Ionicons name="play-circle" size={16} color="#fff"/>
                </View>}
          </View>
        )}
        <Text style={t.replyQuoteText} numberOfLines={1}>{preview}</Text>
      </View>
    </View>
  );
};

const ReactionsRow = ({ reactionsJson, onReact, msg }: {
  reactionsJson:string; onReact:(m:any, e:string)=>void; msg:any;
}) => {
  let rx: { userId:string; emoji:string }[] = [];
  try { rx = JSON.parse(reactionsJson); } catch {}
  if (!rx.length) return null;
  const g: Record<string,number> = {};
  rx.forEach(r => { g[r.emoji] = (g[r.emoji] || 0) + 1; });
  return (
    <View style={t.reactionsRow}>
      {Object.entries(g).map(([emoji, count]) => (
        <TouchableOpacity key={emoji} style={t.reactionBadge}
          onPress={() => onReact(msg, emoji)} activeOpacity={0.7}>
          <Text style={t.reactionEmoji}>{emoji}</Text>
          {count > 1 && <Text style={t.reactionCount}>{count}</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
};

const MSG_IMG_W = Dimensions.get('window').width * 0.62;

const MediaBubble = React.memo(({ message, isMe, pending, onPress }: {
  message:string; isMe:boolean; pending:boolean; onPress:()=>void;
}) => {
  const [err, setErr] = React.useState(false);
  const url = extractMediaUrl(message), caption = extractMediaCaption(message);
  return (
    <View style={{ borderRadius:12, overflow:'hidden' }}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.9} disabled={pending}>
        {isVideoMsg(message)
          ? (() => {
              const thumbUri = cdnVideoThumbUrl(url, 400, 300);
              return (
                <View style={[t.mediaBubble, { backgroundColor:'#111', position:'relative' }]}>
                  {thumbUri
                    ? <CachedImage source={{ uri: thumbUri }} style={{ width:MSG_IMG_W, height:MSG_IMG_W*0.75 }} contentFit="cover"/>
                    : <View style={[t.mediaBubble, { backgroundColor:'#1C1C1E' }]} />}
                  <View style={t.videoPlayOverlay}>
                    <View style={t.videoPlayBtn}><Ionicons name="play" size={28} color="#fff" /></View>
                  </View>
                  <View style={t.videoDurationBadge}>
                    <Ionicons name="videocam" size={11} color="#fff" style={{ marginRight:3 }} />
                    <Text style={t.videoDurationTxt}>Video</Text>
                  </View>
                </View>
              );
            })()
          : err
            ? <View style={[t.mediaBubble,{backgroundColor:'#374151'}]}>
                <Ionicons name="image-outline" size={36} color="#9CA3AF"/>
              </View>
            : <CachedImage source={{ uri:url }} style={{ width:MSG_IMG_W, height:MSG_IMG_W*0.75 }}
                contentFit="cover" onError={() => setErr(true)}/>}
        {pending && (
          <View style={t.mediaLoadingOverlay}>
            <ActivityIndicator size="large" color="#fff"/>
          </View>
        )}
      </TouchableOpacity>
      {!!caption && (
        <Text style={[t.msgText, isMe?t.myText:t.otherText, { marginTop:6, paddingHorizontal:4 }]}>
          {caption}
        </Text>
      )}
    </View>
  );
});

const MessageBubble = React.memo(({
  item, isMe, onRetry, onLongPress, onReact, onReply, onOpenMedia, otherName, myId,
}: {
  item:ChatMessage; isMe:boolean; onRetry:(m:ChatMessage)=>void;
  onLongPress:(m:ChatMessage)=>void; onReact:(m:any, e:string)=>void;
  onReply:(m:ChatMessage)=>void; onOpenMedia:(uri:string, type:'image'|'video')=>void;
  otherName:string; myId:string;
}) => {
  const swipeX = React.useRef(new Animated.Value(0)).current;
  const THRESH = 60, MAX = 80;
  const pan = React.useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_, g) => {
      swipeX.setValue(isMe ? Math.max(-MAX, Math.min(0, g.dx)) : Math.min(MAX, Math.max(0, g.dx)));
    },
    onPanResponderRelease: (_, g) => {
      if (isMe ? g.dx < -THRESH : g.dx > THRESH) {
        onReply(item);
        Animated.spring(swipeX, { toValue:0, useNativeDriver:true, friction:5, tension:100 }).start();
      } else {
        Animated.spring(swipeX, { toValue:0, useNativeDriver:true, friction:6, tension:150 }).start();
      }
    },
  })).current;

  const iconOpacity = swipeX.interpolate({
    inputRange: isMe ? [-THRESH,-20,0] : [0,20,THRESH],
    outputRange: isMe ? [1,0.4,0] : [0,0.4,1], extrapolate:'clamp',
  });
  const iconScale = swipeX.interpolate({
    inputRange: isMe ? [-THRESH,-20,0] : [0,20,THRESH],
    outputRange: isMe ? [1,0.7,0.4] : [0.4,0.7,1], extrapolate:'clamp',
  });

  return (
    <View style={[t.msgWrap, isMe ? t.myWrap : t.otherWrap]}>
      <Animated.View style={[
        t.swipeReplyIcon, isMe ? t.swipeIconLeft : t.swipeIconRight,
        { opacity:iconOpacity, transform:[{ scale:iconScale }] },
      ]}>
        <Ionicons name="return-down-back-outline" size={18} color={C.muted}/>
      </Animated.View>
      <Animated.View style={{ transform:[{ translateX:swipeX }] }} {...pan.panHandlers}>
        <TouchableOpacity
          activeOpacity={item._failed ? 0.6 : 0.95}
          onPress={() => item._failed && onRetry(item)}
          onLongPress={() => onLongPress(item)}
          delayLongPress={300}
          style={[
            t.bubble, isMe ? t.myBubble : t.otherBubble,
            item._pending && { opacity:0.6 },
            item._failed  && t.failedBubble,
          ]}
        >
          {!!(item as any).replyToText && (
            <ReplyQuote
              replyToText={(item as any).replyToText}
              replyToSender={(item as any).replyToSender ?? ''}
              myId={myId} otherName={otherName}
            />
          )}
          {isMediaMsg(item.message)
            ? <MediaBubble message={item.message} isMe={isMe} pending={!!item._pending}
                onPress={() => onOpenMedia(extractMediaUrl(item.message), isVideoMsg(item.message) ? 'video' : 'image')}/>
            : <Text style={[t.msgText, isMe ? t.myText : t.otherText]}>{item.message}</Text>}
          {(item as any).edited && (
            <Text style={[t.editedLabel, isMe && { color:'rgba(255,255,255,0.6)' }]}>edited</Text>
          )}
          <View style={t.metaRow}>
            <Text style={[t.timeText, isMe && { color:'rgba(255,255,255,0.7)' }]}>
              {formatTime(item.createdAt)}
            </Text>
            {item._pending && <ActivityIndicator size={10} color={isMe?'rgba(255,255,255,0.7)':C.muted} style={{ marginLeft:4 }}/>}
            {item._failed  && <Text style={t.failedText}> ⚠ Tap to retry</Text>}
            {isMe && !item._pending && !item._failed && (
              <View style={{ marginLeft:2 }}><StatusTick status={item.status}/></View>
            )}
          </View>
        </TouchableOpacity>
        {!!(item as any).reactions && (item as any).reactions !== '[]' && (
          <ReactionsRow reactionsJson={(item as any).reactions} onReact={onReact} msg={item}/>
        )}
      </Animated.View>
    </View>
  );
});

// ═══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════
export default function ChatScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    chatId:string; userId:string; name:string; image:string; lastSeen?:string;
  }>();

  const paramChatId = params.chatId?.trim() || '';
  const [chatId,       setChatId]       = useState(paramChatId);
  const [inputText,    setInputText]    = useState('');
  const [sending,      setSending]      = useState(false);
  const [chatState,    setChatState]    = useState<'idle'|'finding'|'ready'|'error'>(
    paramChatId ? 'idle' : 'finding'
  );
  const [actionMsg,    setActionMsg]    = useState<ActionMessage|null>(null);
  const [replyTo,      setReplyTo]      = useState<ChatMessage|null>(null);
  const [editingMsg,   setEditingMsg]   = useState<ActionMessage|null>(null);
  const [menuSheet,    setMenuSheet]    = useState(false);
  const [isBlocked,    setIsBlocked]    = useState(false);
  const [iBlockedThem, setIBlockedThem] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{ uri:string; type:'image'|'video' }|null>(null);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [viewerMedia,  setViewerMedia]  = useState<{ uri:string; type:'image'|'video' }|null>(null);

  // ── Modal state (replaces all Alert.alert calls) ──────────────
  //
  // deleteModal:
  //   'soft'   = "Delete for me" only (older msg, or not mine)
  //   'choose' = sender + within 60s → show both options
  //   null     = closed
  const [deleteModal,    setDeleteModal]    = useState<{ msg: ActionMessage; mode: 'soft' | 'choose' } | null>(null);
  const [clearChatModal, setClearChatModal] = useState(false);
  const [reportModal,    setReportModal]    = useState(false);

  const flatRef  = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const {
    messages, setMessages, loading, loadingOld, hasMore,
    sendMessage, retryMessage, loadOlderMessages,
  } = useMessages(chatId);

  // ── Mark seen ─────────────────────────────────────────────────
  useEffect(() => {
    if (!chatId || !user?.id) return;
    const uid = user.id;
    supabase.from('messages')
      .update({ status:'seen' })
      .eq('chat_id', chatId).neq('sender_id', uid).eq('status','sent')
      .then(() => {}, () => {});
    supabase.from('chats')
      .update({ last_message_status:'seen' })
      .eq('id', chatId)
      .then(() => {}, () => {});
  }, [chatId, user?.id]);

  // ── Check block status ────────────────────────────────────────
  useEffect(() => {
    if (!params.userId || !user?.id) return;
    callFn({ action:'check_block', otherUserId:params.userId })
      .then(r => { setIsBlocked(r.isBlocked ?? false); setIBlockedThem(r.iBlockedThem ?? false); })
      .catch(() => {});
  }, [params.userId, user?.id]);

  // ── Find chat if no chatId ────────────────────────────────────
  useEffect(() => {
    if (paramChatId || !params.userId || !user?.id) return;
    let cancelled = false, attempts = 0;
    const tryFind = async () => {
      if (cancelled) return;
      attempts++;
      const chat = await findChat(user.id, params.userId).catch(() => null);
      if (chat) { setChatId(chat.$id); setChatState('ready'); return; }
      if (attempts === 2) {
        const chatId = await getChatId(params.userId).catch(() => null);
        if (chatId) { setChatId(chatId); setChatState('ready'); return; }
      }
      if (!cancelled && attempts < 8) setTimeout(tryFind, 1000);
      else if (!cancelled) setChatState('error');
    };
    tryFind();
    return () => { cancelled = true; };
  }, [params.userId, user?.id, paramChatId]);

  // ── Auto-scroll ───────────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0)
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length]);

  // ── Handlers ──────────────────────────────────────────────────
  const handleReact = useCallback(async (msg: ChatMessage, emoji: string) => {
    if (!user?.id) return;
    setMessages(prev => prev.map(m => {
      if (m.$id !== msg.$id) return m;
      let rx: { userId:string; emoji:string }[] = [];
      try { rx = JSON.parse((m as any).reactions || '[]'); } catch {}
      const idx = rx.findIndex(r => r.userId === user.id);
      if (idx >= 0) {
        rx = rx[idx].emoji === emoji
          ? rx.filter(r => r.userId !== user.id)
          : rx.map(r => r.userId === user.id ? { ...r, emoji } : r);
      } else { rx = [...rx, { userId:user.id, emoji }]; }
      return { ...m, reactions:JSON.stringify(rx) };
    }));
    callFn({ action:'react_message', messageId:msg.$id, emoji }).catch(() => {});
  }, [user?.id, setMessages]);

  const handleReply = useCallback((msg: ChatMessage) => {
    setReplyTo(msg);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleEdit = useCallback((msg: ActionMessage) => {
    setEditingMsg(msg);
    setInputText(msg.message);
    setReplyTo(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // ── Delete message — opens ConfirmModal ───────────────────────
  // OLD: three nested Alert.alert calls, UI-blocking
  // NEW: sets deleteModal state → ConfirmModal handles UI
  //
  // 'choose' mode: sender + within 60s → two destructive actions
  //   • Cancel button  = "Delete for Me"  (soft)
  //   • Confirm button = "Delete for Everyone" (hard)
  //   This avoids needing a 3-button layout.
  //
  // 'soft' mode: older msg or not mine → one action only
  //   • Cancel button  = dismiss
  //   • Confirm button = "Delete for Me" (soft)
  const handleDelete = useCallback((msg: ActionMessage) => {
    const isMine    = msg.sender_id === user?.id;
    const ageMs     = Date.now() - new Date(msg.created_at).getTime();
    const canUnsend = isMine && ageMs < 60_000;
    setDeleteModal({ msg, mode: isMine && canUnsend ? 'choose' : 'soft' });
  }, [user?.id]);

  // Extracted action runners — called by ConfirmModal after close
  const doSoftDelete = useCallback((msg: ActionMessage) => {
    setMessages(prev => prev.filter(m => m.$id !== msg.$id));
    withRetry(() => callFn({ action:'delete_message', messageId:msg.$id })).catch(() => {});
  }, [setMessages]);

  const doHardDelete = useCallback((msg: ActionMessage) => {
    setMessages(prev => prev.filter(m => m.$id !== msg.$id));
    withRetry(() => callFn({ action:'delete_for_everyone', messageId:msg.$id })).catch(() => {});
  }, [setMessages]);

  // ── Clear chat — opens ConfirmModal ──────────────────────────
  // OLD: Alert.alert with nested onPress
  // NEW: setClearChatModal(true) → action runs after modal closes
  const handleClearChat = useCallback(() => {
    if (!chatId) return;
    setClearChatModal(true);
  }, [chatId]);

  const doClearChat = useCallback(async () => {
    setMessages([]);
    try {
      await withRetry(() => callFn({ action:'clear_chat', chatId }));
    } catch (e: any) {
      console.error('clear_chat failed:', e?.message);
    }
  }, [chatId, setMessages]);

  // ── Block / Unblock ───────────────────────────────────────────
  const handleBlock = useCallback(async () => {
    setMenuSheet(false);
    await callFn({ action:'block_user', blockedId:params.userId }).catch(() => {});
    setIsBlocked(true); setIBlockedThem(true);
    Alert.alert('Blocked', `You blocked ${params.name}.`);
  }, [params.userId, params.name]);

  const handleUnblock = useCallback(async () => {
    setMenuSheet(false);
    await callFn({ action:'unblock_user', blockedId:params.userId }).catch(() => {});
    setIsBlocked(false); setIBlockedThem(false);
  }, [params.userId]);

  // ── Report — opens ConfirmModal ───────────────────────────────
  // OLD: two nested Alert.alert calls
  // NEW: setReportModal(true) → action runs after modal closes
  const handleReportPress = useCallback(() => {
    setMenuSheet(false);
    // Small delay so the bottom sheet animates out before modal opens
    setTimeout(() => setReportModal(true), 250);
  }, []);

  const doReport = useCallback(async () => {
    // Replace with your actual report edge function call if you have one:
    // await callFn({ action: 'report_user', reportedId: params.userId }).catch(() => {});
    console.log('🚩 Reported user:', params.userId);
    Alert.alert('Reported ✓', 'Thank you. Our team will review this.');
  }, [params.userId]);

  // ── Media ─────────────────────────────────────────────────────
  const handleMediaConfirm = useCallback(async (caption: string) => {
    if (!pendingMedia || !chatId) return;
    setSendingMedia(true);
    try {
      let uploadUri = pendingMedia.uri;
      if (pendingMedia.type === 'image') uploadUri = await compressForUpload(pendingMedia.uri, 'chat');
      const result  = await uploadToCloudinary(uploadUri, { type: pendingMedia.type, uploadType: 'chat' });
      const fileUrl = pendingMedia.type === 'image' ? cdnChatUrl(result.secureUrl) : result.secureUrl;
      const msgText = `${pendingMedia.type==='video'?VID_PREFIX:IMG_PREFIX}${fileUrl}${caption?`\n${caption}`:''}`;
      setPendingMedia(null); setSendingMedia(false);
      await sendMessage(msgText, {});
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Please try again');
      setSendingMedia(false);
    }
  }, [pendingMedia, chatId, sendMessage]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending || !chatId || isBlocked) return;
    if (editingMsg) {
      const msgId = editingMsg.$id;
      setInputText(''); setSending(true); setEditingMsg(null);
      setMessages(prev => prev.map(m => m.$id === msgId ? { ...m, message:text, edited:true } : m));
      callFn({ action:'edit_message', messageId:msgId, newText:text })
        .catch(() => {
          setMessages(prev => prev.map(m => m.$id === msgId ? { ...m, message:editingMsg.message } : m));
        });
      setSending(false); return;
    }
    setInputText(''); setSending(true);
    const reply = replyTo; setReplyTo(null);
    await sendMessage(text, {
      replyToId:     reply?.$id    ?? null,
      replyToText:   reply?.message ?? null,
      replyToSender: reply?.senderId ?? null,
    });
    setSending(false);
  }, [inputText, sending, chatId, isBlocked, replyTo, editingMsg, sendMessage, setMessages]);

  // ── Render message ────────────────────────────────────────────
  const renderItem = useCallback(({ item, index }: { item:ChatMessage; index:number }) => {
    if (user?.id && item.deletedFor?.includes(user.id)) return null;
    const isMe  = item.senderId === user?.id;
    const prev  = messages[index - 1];
    const showD = !prev
      || new Date(secToMs(item.createdAt)).toDateString()
      !== new Date(secToMs(prev.createdAt)).toDateString();
    return (
      <>
        {showD && <DateDivider ts={item.createdAt}/>}
        <MessageBubble
          item={item} isMe={isMe} myId={user?.id ?? ''} otherName={params.name ?? ''}
          onRetry={retryMessage}
          onLongPress={msg => setActionMsg({
            $id:        msg.$id,
            sender_id:  msg.senderId,
            message:    msg.message,
            created_at: msg.createdAt,
          })}
          onReact={handleReact} onReply={handleReply}
          onOpenMedia={(uri, type) => setViewerMedia({ uri, type })}
        />
      </>
    );
  }, [messages, user?.id, retryMessage, handleReact, handleReply, params.name]);

  // ── Chat finding states ───────────────────────────────────────
  if (chatState === 'finding') return (
    <SafeAreaView style={ch.safe} edges={['top']}>
      <ChatHeader name={params.name} image={params.image} lastSeen={params.lastSeen}
        onMenuPress={() => setMenuSheet(true)} userId={params.userId}/>
      <View style={ch.center}><ActivityIndicator size="large" color={C.purple}/></View>
    </SafeAreaView>
  );
  if (chatState === 'error') return (
    <SafeAreaView style={ch.safe} edges={['top']}>
      <ChatHeader name={params.name} image={params.image} lastSeen={params.lastSeen}
        onMenuPress={() => setMenuSheet(true)} userId={params.userId}/>
      <View style={ch.center}>
        <Text style={ch.errorTitle}>Chat not available</Text>
        <Text style={ch.centerText}>Accept the connection request first</Text>
      </View>
    </SafeAreaView>
  );

  // ── Main UI ───────────────────────────────────────────────────
  return (
    <SafeAreaView style={ch.safe} edges={['top','bottom']}>
      <StatusBar barStyle="dark-content"/>
      <ChatHeader name={params.name} image={params.image} lastSeen={params.lastSeen}
        onMenuPress={() => setMenuSheet(true)} userId={params.userId}/>

      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':'height'}>
        {loading
          ? <View style={ch.center}><ActivityIndicator color={C.purple} size="large"/></View>
          : <FlatList
              ref={flatRef}
              data={messages}
              renderItem={renderItem}
              keyExtractor={item => item.$id}
              contentContainerStyle={ch.listContent}
              showsVerticalScrollIndicator={false}
              onScrollBeginDrag={({ nativeEvent }) => {
                if (nativeEvent.contentOffset.y < 60 && hasMore && !loadingOld)
                  loadOlderMessages();
              }}
              ListHeaderComponent={
                loadingOld
                  ? <ActivityIndicator color={C.purple} style={{ padding:12 }}/>
                  : hasMore
                    ? <TouchableOpacity style={ch.loadMoreBtn} onPress={loadOlderMessages}>
                        <Text style={ch.loadMoreText}>Load older messages</Text>
                      </TouchableOpacity>
                    : null
              }
              ListEmptyComponent={
                <View style={ch.emptyChat}>
                  <Text style={ch.emptyChatText}>Say hello to {params.name}!</Text>
                </View>
              }
              initialNumToRender={20} maxToRenderPerBatch={10}
              windowSize={10} removeClippedSubviews
            />
        }
        <ChatInput
          value={inputText} onChangeText={setInputText} onSend={handleSend}
          sending={sending} disabled={!chatId}
          inputRef={inputRef as RefObject<TextInput>}
          chatId={chatId}
          replyTo={replyTo as any} editingMsg={editingMsg as any}
          onCancelReply={() => setReplyTo(null)}
          onCancelEdit={() => { setEditingMsg(null); setInputText(''); }}
          myId={user?.id ?? ''} otherName={params.name ?? ''}
          isBlocked={isBlocked} iBlockedThem={iBlockedThem}
          onUnblock={handleUnblock} blockedName={params.name}
          onMediaSend={(uri, type) => setPendingMedia({ uri, type })}
        />
      </KeyboardAvoidingView>

      <MediaViewer
        uri={viewerMedia?.uri ?? null} type={viewerMedia?.type ?? 'image'}
        onClose={() => setViewerMedia(null)}/>
      <MediaPreview
        uri={pendingMedia?.uri ?? null} type={pendingMedia?.type ?? 'image'}
        onSend={handleMediaConfirm} onClose={() => setPendingMedia(null)}
        sending={sendingMedia} otherName={params.name ?? 'them'}/>

      <MessageActionSheet
        visible={!!actionMsg} message={actionMsg}
        isMine={actionMsg?.sender_id === user?.id}
        onClose={() => setActionMsg(null)}
        onCopy={async text => { await Clipboard.setStringAsync(text); }}
        onReact={(msg, emoji) => handleReact(msg as unknown as ChatMessage, emoji)}
        onReply={msg => handleReply(msg as unknown as ChatMessage)}
        onEdit={handleEdit} onDelete={handleDelete}
      />

      {/* ── Updated ChatMenuSheet — report now uses handleReportPress ── */}
      <ChatMenuSheet visible={menuSheet} onClose={() => setMenuSheet(false)} items={[
        { icon:'trash-outline', label:'Clear Chat', onPress:handleClearChat },
        {
          icon:    iBlockedThem ? 'checkmark-circle-outline' : 'ban-outline',
          label:   iBlockedThem ? 'Unblock User' : 'Block User',
          onPress: iBlockedThem ? handleUnblock : handleBlock,
        },
        {
          icon:    'flag-outline',
          label:   'Report User',
          onPress: handleReportPress,   // ← no more Alert.alert inside here
        },
      ]}/>

      {/* ════════════════════════════════════════════════════════
          ConfirmModal instances — one per action
          All modals live here at the bottom of the tree so they
          render above everything else without z-index fights.
      ════════════════════════════════════════════════════════ */}

      {/* ── 1. Delete message — "choose" mode ────────────────── */}
      {/* Appears when: sender taps delete on their own msg < 60s */}
      {/* Cancel = soft delete (for me), Confirm = hard delete (for everyone) */}
      <ConfirmModal
        visible={deleteModal?.mode === 'choose'}
        title="Delete Message?"
        message="Remove this message just for you, or delete it for everyone in the chat?"
        confirmLabel="Delete for Everyone"
        cancelLabel="Delete for Me"
        confirmDestructive={true}
        icon="trash-outline"
        onConfirm={() => {
          const msg = deleteModal!.msg;
          setDeleteModal(null);
          doHardDelete(msg);   // runs after modal closes via InteractionManager ✅
        }}
        onCancel={() => {
          // Cancel here is a real action (soft delete), not a dismiss
          const msg = deleteModal!.msg;
          setDeleteModal(null);
          doSoftDelete(msg);   // runs after modal closes via InteractionManager ✅
        }}
      />

      {/* ── 2. Delete message — "soft" mode ──────────────────── */}
      {/* Appears when: older msg, or deleting someone else's msg  */}
      {/* Only one action available: soft delete for me            */}
      <ConfirmModal
        visible={deleteModal?.mode === 'soft'}
        title="Delete Message?"
        message="This message will be removed from your view only. The other person won't be affected."
        confirmLabel="Delete for Me"
        cancelLabel="Cancel"
        confirmDestructive={true}
        icon="trash-outline"
        onConfirm={() => {
          const msg = deleteModal!.msg;
          setDeleteModal(null);
          doSoftDelete(msg);   // runs after modal closes via InteractionManager ✅
        }}
        onCancel={() => setDeleteModal(null)}
      />

      {/* ── 3. Clear Chat ─────────────────────────────────────── */}
      {/* Triggered from ChatMenuSheet → Clear Chat              */}
      <ConfirmModal
        visible={clearChatModal}
        title="Clear Chat?"
        message={`Delete all messages with ${params.name}? This only clears it for you — they won't be affected.`}
        confirmLabel="Clear"
        cancelLabel="Cancel"
        confirmDestructive={true}
        icon="chatbubble-ellipses-outline"
        onConfirm={() => {
          setClearChatModal(false);
          doClearChat();       // runs after modal closes via InteractionManager ✅
        }}
        onCancel={() => setClearChatModal(false)}
      />

      {/* ── 4. Report User ────────────────────────────────────── */}
      {/* Triggered from ChatMenuSheet → Report User             */}
      <ConfirmModal
        visible={reportModal}
        title="Report User?"
        message={`Report ${params.name} for inappropriate content? Our team will review this within 24 hours.`}
        confirmLabel="Report"
        cancelLabel="Cancel"
        confirmDestructive={true}
        icon="flag-outline"
        onConfirm={() => {
          setReportModal(false);
          doReport();          // runs after modal closes via InteractionManager ✅
        }}
        onCancel={() => setReportModal(false)}
      />

    </SafeAreaView>
  );
}

// ── Chat header ───────────────────────────────────────────────────
const ChatHeader = ({
  name, image, lastSeen, onMenuPress, userId,
}: {
  name?:string; image?:string; lastSeen?:string|null;
  onMenuPress:()=>void; userId:string;
}) => {
  const st = formatLastSeen(lastSeen ?? null), online = st === 'online';
  return (
    <View style={ch.header}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
        <Ionicons name="arrow-back" size={20} color={C.text}/>
      </TouchableOpacity>
      <View style={{ position:'relative' }}>
        <TouchableOpacity
          onPress={() => router.push({ pathname:'/subScreens/userProfile', params:{ userId } })}
          activeOpacity={0.8}>
          <ProfileAvatar uri={image || null} name={name ?? '?'} size={38}/>
        </TouchableOpacity>
        {online && <View style={ch.onlineDot}/>}
      </View>
      <View style={{ flex:1 }}>
        <Text style={ch.headerName} numberOfLines={1}>{name ?? 'Chat'}</Text>
        {!!st && <Text style={[ch.headerStatus, online && { color:'#16A34A' }]}>{st}</Text>}
      </View>
      <TouchableOpacity onPress={onMenuPress}
        hitSlop={{ top:10, bottom:10, left:10, right:10 }} style={{ padding:4 }}>
        <Ionicons name="ellipsis-vertical" size={20} color={C.text}/>
      </TouchableOpacity>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────
const ch = StyleSheet.create({
  safe:         { flex:1, backgroundColor:C.white },
  header:       { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:16,
                  paddingVertical:10, backgroundColor:C.white, borderBottomColor:C.border },
  headerName:   { fontSize:16, fontWeight:'700', color:C.text },
  headerStatus: { fontSize:12, color:C.muted, marginTop:1 },
  onlineDot:    { position:'absolute', bottom:0, right:0, width:11, height:11, borderRadius:6,
                  backgroundColor:'#16A34A', borderWidth:2, borderColor:C.white },
  center:       { flex:1, alignItems:'center', justifyContent:'center', padding:40 },
  centerText:   { fontSize:14, color:C.muted, textAlign:'center', marginTop:12 },
  errorTitle:   { fontSize:18, fontWeight:'800', color:C.text, marginBottom:6 },
  listContent:  { paddingHorizontal:12, paddingVertical:12, paddingBottom:8 },
  loadMoreBtn:  { alignSelf:'center', padding:8 },
  loadMoreText: { color:C.purple, fontSize:13, fontWeight:'600' },
  emptyChat:    { alignItems:'center', paddingTop:80 },
  emptyChatText:{ fontSize:15, color:C.muted },
});

const t = StyleSheet.create({
  msgWrap:    { marginVertical:2, maxWidth:'80%' },
  myWrap:     { alignSelf:'flex-end' },
  otherWrap:  { alignSelf:'flex-start' },
  bubble:     { borderRadius:18, paddingHorizontal:12, paddingVertical:8, paddingBottom:6, elevation:1 },
  myBubble:   { backgroundColor:C.purpleMsg, borderBottomRightRadius:4 },
  otherBubble:{ backgroundColor:C.otherMsg, borderBottomLeftRadius:4, borderWidth:1, borderColor:C.border },
  failedBubble:{ borderWidth:1, borderColor:C.red },
  msgText:    { fontSize:15, lineHeight:21 },
  myText:     { color:'#fff' },
  otherText:  { color:C.text },
  editedLabel:{ fontSize:10, color:C.muted, marginTop:1 },
  metaRow:    { flexDirection:'row', alignItems:'center', justifyContent:'flex-end', marginTop:3, gap:2 },
  timeText:   { fontSize:10, color:C.muted },
  failedText: { fontSize:10, color:C.red },
  replyQuote: { borderLeftWidth:2, borderLeftColor:'rgba(255,255,255,0.5)', paddingLeft:8,
                marginBottom:6, backgroundColor:'rgba(0,0,0,0.1)', borderRadius:6, padding:6 },
  replyQuoteName: { fontSize:11, color:'rgba(255,255,255,0.8)', fontWeight:'700', marginBottom:2 },
  replyQuoteText: { fontSize:12, color:'rgba(255,255,255,0.7)' },
  mediaBubble:    { width:MSG_IMG_W, height:MSG_IMG_W*0.75, alignItems:'center', justifyContent:'center', borderRadius:12 },
  mediaLabel:     { color:'#9CA3AF', fontSize:12, marginTop:6 },
  mediaLoadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.45)',
                         alignItems:'center', justifyContent:'center', borderRadius:12 },
  reactionsRow: { flexDirection:'row', flexWrap:'wrap', gap:4, marginTop:4, marginLeft:4 },
  swipeReplyIcon: { position:'absolute', top:'50%' as any, marginTop:-12, zIndex:0 },
  swipeIconLeft:  { left:-28 },
  swipeIconRight: { right:-28 },
  replyThumb:     { borderRadius:4, overflow:'hidden' },
  replyThumbImg:  { width:32, height:32, borderRadius:4 },
  reactionBadge:  { flexDirection:'row', alignItems:'center', gap:3, backgroundColor:'#ffffff',
                    borderRadius:12, paddingHorizontal:5, paddingVertical:2,
                    borderColor:C.border, elevation:5, bottom:6, right:5 },
  reactionEmoji:  { fontSize:13 },
  reactionCount:  { fontSize:11, color:C.muted, fontWeight:'600' },
  dateDivider:    { flexDirection:'row', alignItems:'center', marginVertical:16, gap:10 },
  dateLine:       { flex:1, height:1, backgroundColor:C.border },
  dateText:       { fontSize:11, color:C.muted, fontWeight:'600' },
  videoPlayOverlay: { ...StyleSheet.absoluteFillObject, alignItems:'center', justifyContent:'center' },
  videoPlayBtn: { width:52, height:52, borderRadius:26, backgroundColor:'rgba(0,0,0,0.55)',
                  alignItems:'center', justifyContent:'center', paddingLeft:4 },
  videoDurationBadge: { position:'absolute', bottom:8, right:8, flexDirection:'row', alignItems:'center',
                        backgroundColor:'rgba(0,0,0,0.55)', paddingHorizontal:6, paddingVertical:3, borderRadius:6 },
  videoDurationTxt: { color:'#fff', fontSize:11, fontWeight:'600' },
});