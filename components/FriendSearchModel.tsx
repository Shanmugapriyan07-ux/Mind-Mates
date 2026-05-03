// components/FriendsSearchModal.tsx
// Instagram-style inline search — filters connected friends in memory (instant, no network)
// Triggered by search icon in chat list header

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, Modal, Animated, Keyboard, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router }       from 'expo-router';
import { Ionicons }     from '@expo/vector-icons';
import { ProfileAvatar } from '@/components/Profileavatar';

export interface SearchFriend {
  connection_id:  string;
  user_id:        string;
  full_name:      string;
  profile_image:  string | null;
  last_message?:  string;
  last_seen?:     string | null;
  chat_id?:       string;
}
  

interface Props {
  visible:  boolean;
  friends:  SearchFriend[];
  onClose:  () => void;
}

const C = {
  white:  '#FFFFFF', purple: '#6D4AFF', text: '#111827',
  muted:  '#6B7280', border: '#F0F0F5', bg: '#F7F7FA',
  green:  '#16A34A',
};

const isOnline = (ts?: string | null) =>
  !!ts && (Date.now() - new Date(ts).getTime()) < 5 * 60 * 1000;

const formatPreview = (msg?: string): string => {
  if (!msg) return 'Tap to say hello ';
  if (msg.startsWith('__IMG__')) return ' Photo';
  if (msg.startsWith('__VID__')) return ' Video';
  const f = msg.split('\n')[0];
  return f.length > 40 ? f.slice(0, 40) + '…' : f;
};

export const FriendsSearchModal: React.FC<Props> = ({ visible, friends, onClose }) => {
  const [query,    setQuery]    = useState('');
  const inputRef = useRef<TextInput>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  // Animate in/out
  useEffect(() => {
    if (visible) {
      setQuery('');
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, damping: 400, stiffness: 400, mass:0.8 }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 10, useNativeDriver: true }),
      ]).start(() => { setTimeout(() => inputRef.current?.focus(), 50); });
    } else {
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 1, duration: 10, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1,   duration: 10, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const filteredResults = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return friends;
    return friends.filter(f => f.full_name.toLowerCase().includes(q));
  }, [friends, query]);

  const handleSelect = useCallback((f: SearchFriend) => {
    onClose();
    setTimeout(() => {
      router.push({
        pathname: '/subScreens/chatScreen',
        params: { chatId: f.chat_id ?? '', userId: f.user_id, name: f.full_name, image: f.profile_image ?? '', lastSeen: f.last_seen ?? '' },
      });
    }, 200);
  }, [onClose]);

  const renderItem = useCallback(({ item }: { item: SearchFriend }) => {
    const online = isOnline(item.last_seen);
    return (
      <TouchableOpacity style={sr.row} onPress={() => handleSelect(item)} activeOpacity={0.75}>
        <View style={{ position: 'relative' }}>
          <ProfileAvatar uri={item.profile_image} name={item.full_name} size={50} />
          {online && <View style={sr.onlineDot} />}
        </View>
        <View style={sr.info}>
          <Text style={sr.name} numberOfLines={1}>{item.full_name}</Text>
          <Text style={sr.preview} numberOfLines={1}>{formatPreview(item.last_message)}</Text>
        </View>
      </TouchableOpacity>
    );
  }, [handleSelect]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[sr.backdrop, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

        <SafeAreaView style={sr.container}>
        {/* Search bar — slides down from top */}
        <Animated.View style={[sr.searchBar, { transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity onPress={onClose} style={{ padding: 1 }} hitSlop={{ top:8,bottom:8,left:4,right:10 }}>
            <Ionicons name="arrow-back" size={18} color={C.text} />
          </TouchableOpacity>
          <View style={sr.inputWrap}>
            <Ionicons name="search" size={20} color={C.muted} style={{ marginLeft: 10,left:3 }} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder="Search connections..."
              placeholderTextColor={C.muted}
              style={sr.input}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {query.length > 0 && Platform.OS !== 'ios' && (
              <TouchableOpacity onPress={() => setQuery('')} style={{ padding: 8 }}>
                <Ionicons name="close-circle" size={18} color={C.muted} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Results list */}
        <Animated.View style={[sr.resultsContainer, { opacity: fadeAnim }]}>
          {filteredResults.length === 0 && query.length > 0 ? (
            <View style={sr.empty}>
              <Ionicons name="search-outline" size={40} color={C.muted} style={{ marginBottom: 12 }} />
              <Text style={sr.emptyTitle}>No results for "{query}"</Text>
              <Text style={sr.emptySub}>Try a different name</Text>
            </View>
          ) : (
            <FlatList
              data={filteredResults}
              keyExtractor={item => item.connection_id}
              renderItem={renderItem}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 120 }}
              ListEmptyComponent={
                <View style={sr.empty}>
                  <Text style={sr.emptySub}>No Mindmates found</Text>
                </View>
              }
            />
          )}
        </Animated.View>
     </SafeAreaView>
    </Modal>
  );
};

const sr = StyleSheet.create({
  backdrop:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  container:  { flex: 1, backgroundColor:'white' },
  searchBar:  { flexDirection: 'row',borderTopColor: '#fff',alignItems: 'center', backgroundColor: C.white, paddingHorizontal: 14, paddingVertical: 10, gap: 10, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, width:'100%' },
  inputWrap:  { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 22, height: 42, gap: 6 },
  input:      { flex: 1, fontSize: 15, color: C.text, paddingVertical: 0, paddingRight: 12,paddingHorizontal:3 },
  resultsContainer: { flex: 1, backgroundColor: C.white },
  listHeader: { fontSize: 14, color: C.muted, fontWeight: '600', paddingHorizontal: 16, paddingVertical: 5, backgroundColor: C.bg },
  row:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12, backgroundColor: C.white },
  onlineDot:  { position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: 5, backgroundColor: C.green, borderWidth: 2, borderColor: C.white },
  info:       { flex: 1 },
  name:       { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 2 },
  preview:    { fontSize: 13, color: C.muted },
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 6 },
  emptySub:   { fontSize: 14, color: C.muted },
});

export default FriendsSearchModal;