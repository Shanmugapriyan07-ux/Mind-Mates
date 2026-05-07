import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Pressable, StatusBar,
  Modal, Linking, Platform, Alert,
} from 'react-native';
import { SafeAreaView }             from 'react-native-safe-area-context';
import { router }                   from 'expo-router';
import { Button, Dialog, Portal, TextInput } from 'react-native-paper';
import { useAuthh }                  from '@/Contexts/authContext';
import { useProfile }               from '@/Contexts/profileContext';
import { supabase }         from '@/lib/supabase';
import Toast                        from 'react-native-toast-message';
import { Ionicons }                 from '@expo/vector-icons';

import { useOpenLink } from "@/hooks/useOpenLink";
import { useAppLinks } from "@/Contexts/AppLinksContexts";

const SUPPORT = {
  phone:      '+917812874383',
  whatsappId: '917812874383',
  email:      'shanmugapriyancse582@gmail.com',
};

const clearCache = async (userId: string) => {
  const keys = [
    `profile_cache_${userId}`, `matches_v1_${userId}`,
    `matches_${userId}`, `friends_v3_${userId}`,
    `friends_v5_${userId}`, `friends_v6_${userId}`,
  ];
  try {
    if (Platform.OS === 'web') keys.forEach(k => localStorage.removeItem(k));
    else {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.multiRemove(keys);
    }
  } catch {}
};

const openCall = async () => {
  const url = Platform.OS === 'ios' ? `telprompt:${SUPPORT.phone}` : `tel:${SUPPORT.phone}`;
  try { await Linking.openURL(url); }
  catch { Alert.alert('Cannot open dialler', `Call us at ${SUPPORT.phone}`); }
};

const openWhatsApp = async () => {
  const msg    = encodeURIComponent('Hi! I need help with MindMates.😊');
  const appUrl = `whatsapp://send?phone=${SUPPORT.whatsappId}&text=${msg}`;
  const webUrl = `https://wa.me/${SUPPORT.whatsappId}?text=${msg}`;
  try {
    const ok = await Linking.canOpenURL(appUrl);
    await Linking.openURL(ok ? appUrl : webUrl);
  } catch { Alert.alert('Cannot open WhatsApp', `Message us at ${SUPPORT.phone}`); }
};


const openEmail = () => {
  const sub  = encodeURIComponent('MindMates Support Request');
  const body = encodeURIComponent('Hi MindMates Team,\n\nI need help with:\n\n');
  Linking.openURL(`mailto:${SUPPORT.email}?subject=${sub}&body=${body}`)
    .catch(() => Alert.alert('Cannot open mail app', `Email: ${SUPPORT.email}`));
};


// ─── Help Modal (original design preserved) ───────────────────────────
const HelpModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => ( 
<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
   <Pressable style={h.backdrop} onPress={onClose} > 
    <Pressable style={h.card} onPress={() => {}}>
       <View style={h.headerRow}>
         <Text style={h.title}>Help & Support</Text> 
         <TouchableOpacity onPress={onClose} hitSlop={{ top:12, bottom:12, left:12, right:12 }} style={h.closeBtn}>
           <Ionicons name="close" size={20} color="#6D4AFF" /> </TouchableOpacity> 
           </View> 
           <Text style={h.subtitle}>How would you like to contact us?</Text> 
           <View style={h.contactBox}> <Text style={h.contactTitle}>MindMates Support – 24/7</Text> 
           <Text style={h.contactPhone}>{SUPPORT.phone}</Text> <View style={h.btnRow}>
             <TouchableOpacity style={h.bigBtn} onPress={() => { onClose(); setTimeout(openCall, 300); }} activeOpacity={0.85}>
               <Ionicons name="call" size={26} color="#fff" style={{top:3}} /> <Text style={h.bigBtnTxt}>Call</Text>
                </TouchableOpacity>
                 <TouchableOpacity style={h.bigBtn} onPress={() => { onClose(); setTimeout(openWhatsApp, 300); }} activeOpacity={0.85}> 
                  <Ionicons name="logo-whatsapp" size={26} color="#fff" style={{top:3}}/> <Text style={h.bigBtnTxt}>WhatsApp</Text> 
                  </TouchableOpacity> 
                  </View>
                   </View>
                    <TouchableOpacity style={h.emailRow} onPress={() => { onClose(); setTimeout(openEmail, 300); }} activeOpacity={0.75}> 
                      <Ionicons name="mail" size={17} color="#6D4AFF" style={{top:1}} /> <Text style={h.emailTxt}>{SUPPORT.email}</Text> 
                      </TouchableOpacity> 
                      </Pressable>
                       </Pressable>
                        </Modal>
);

const h = StyleSheet.create({
  backdrop:     { flex:1, backgroundColor:'rgba(0,0,0,0.5)', alignItems:'center', justifyContent:'center', paddingHorizontal:24 },
  card:         { width:'100%', backgroundColor:'#fff', borderRadius:12, padding:27, elevation:14 },
  headerRow:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:6,bottom:10 },
  title:        { fontSize:21, fontWeight:'700', color:'#6D4AFF',right:3 },
  closeBtn:     { width:32, height:32, borderRadius:16, alignItems:'center', justifyContent:'center',left:10 },
  subtitle:     { fontSize:15, color:'#6B7280', marginBottom:20, bottom:14 },
  contactBox:   { backgroundColor:'#F5F5F7', borderRadius:16, padding:17, marginBottom:2, alignItems:'center',bottom:14 },
  contactTitle: { fontSize:15, fontWeight:'700', color:'#111827', marginBottom:4, textAlign:'center' },
  contactPhone: { fontSize:14, fontWeight:'600', color:'#6D4AFF', marginBottom:18, textAlign:'center' },
  btnRow:       { flexDirection:'row', gap:20, width:'90%' },
  bigBtn:       { flex:1, backgroundColor:'#6D4AFF', borderRadius:14, paddingVertical:10, alignItems:'center', justifyContent:'center', gap:8, elevation:4, minWidth:1 },
  bigBtnTxt:    { color:'#fff', fontSize:15, fontWeight:'700' },
  emailRow:     { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6 },
  emailTxt:     { fontSize:13, color:'#6D4AFF', fontWeight:'500' },
});

// ═══════════════════════════════════════════════════════════════════
export default function SettingsScreen() {
  const { user, logout, deleteAccount } = useAuthh();
  const { clearProfile }       = useProfile();

  const [logoutLoading, setLogoutLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showLogout,    setShowLogout]    = useState(false);
  const [showDelete,    setShowDelete]    = useState(false);
  const [confirmText,   setConfirmText]   = useState('');
  const [helpVisible,   setHelpVisible]   = useState(false);

  const { openByKey } = useOpenLink();
  useAppLinks();

  // Dynamic links from Supabase (falls back to static instantly)
  const tap = useCallback(
    (key: any, name: any) => () => openByKey(key, name),
    [openByKey]
  );

  const T = { text:'#111827', sub:'#6B7280', icon:'#6D4AFF' };

  // ── LOGOUT: session removed → login screen (via _layout) ──────
  const handleLogout = useCallback(async () => {
    setShowLogout(false);
    setLogoutLoading(true);
    const uid = user?.id;
    clearProfile();
    if (uid) clearCache(uid).catch(() => {});
    try {
      // Ensure Supabase local storage is wiped
      await supabase.auth.signOut();
      await logout();
      // _layout reads deleteType='logout' → routes to /(auth)/login ✅
      // No router.replace needed here — _layout handles it cleanly
    } catch (e) {
      console.warn('⚠️ logout failed:', e);
    } finally {
      setLogoutLoading(false);
    }
  }, [user?.id, clearProfile, logout]);

  // ── DELETE: destroys everything → onboarding (via _layout) ────
  const handleDelete = useCallback(async () => {
    if (confirmText.toLowerCase() !== 'delete') {
      Toast.show({ type:'error', text1:'Type DELETE to confirm' });
      return;
    }
    setShowDelete(false);
    setDeleteLoading(true);
    try {
      clearProfile();
      await deleteAccount();
      // CRITICAL: After deleting on server, wipe local session to avoid "Refresh Token Not Found"
      await supabase.auth.signOut();
      // _layout reads deleteType='deleted' → routes to /(auth)/onBoarding ✅
      // No router.replace here — _layout handles it without blink ✅
    } catch (e: any) {
      console.error('❌ deleteAccount:', e?.message);
      Toast.show({ type:'error', text1:'Delete failed', text2:e?.message ?? 'Please try again' });
    } finally {
      setDeleteLoading(false);
      setConfirmText('');
    }
  }, [confirmText, clearProfile, deleteAccount]);

  const rows = [
    { icon:<Ionicons name="person-outline"           size={24} color={T.icon}/>, label:'Edit Profile',       sub:'Name, bio, location, skills', onPress:()=>router.push('/subScreens/editProfile') },
    { icon:<Ionicons name="help-circle-outline"      size={24} color={T.icon}/>, label:'Help & Support',     sub:'Call, WhatsApp or Email us',   onPress:()=>setHelpVisible(true) },
    { icon:<Ionicons name="shield-checkmark-outline" size={24} color={T.icon}/>, label:'Privacy Policy',     sub:undefined,                      onPress:tap("PRIVACY_POLICY", "Privacy Policy") },
    { icon:<Ionicons name="document-text-outline"    size={24} color={T.icon}/>, label:'Terms & Conditions', sub:undefined,                      onPress:tap("TERMS_OF_SERVICE", "Terms of Service") },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <Pressable onPress={()=>router.back()} style={s.headerBack}>
          <Ionicons name="chevron-back" size={20} color={T.text} style={{top:3}}/>
        </Pressable>
        <Text style={s.headerTitle}>Settings</Text>
        <View style={{ width:36 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.section}>
          {rows.map((row) => (
            <React.Fragment key={row.label}>
              <TouchableOpacity style={s.row} onPress={row.onPress} activeOpacity={0.6}>
                <View style={s.iconWrap}>{row.icon}</View>
                <View style={s.rowText}>
                  <Text style={s.rowLabel}>{row.label}</Text>
                  {!!row.sub && <Text style={s.rowSub}>{row.sub}</Text>}
                </View>
             
              </TouchableOpacity>
           
            </React.Fragment>
          ))}
        </View>

        <View style={s.section}>
          <TouchableOpacity style={s.row} onPress={()=>setShowLogout(true)} disabled={logoutLoading} activeOpacity={0.6}>
            <View style={[s.iconWrap,{backgroundColor:'#f4f1fe'}]}>
              <Ionicons name="log-out-outline" size={24} color="#6D4AFF" />
            </View>
            <View style={s.rowText}>
              <Text style={s.rowLabel}>Logout</Text>
              <Text style={s.rowSub}>Sign out of your account</Text>
            </View>
            {logoutLoading && <ActivityIndicator size="small" color="#6D4AFF" />}
          </TouchableOpacity>

        

          <TouchableOpacity style={s.row} onPress={()=>setShowDelete(true)} disabled={deleteLoading} activeOpacity={0.6}>
            <View style={[s.iconWrap,{backgroundColor:'#fef2f2'}]}>
              <Ionicons name="trash-outline" size={24} color="#EF4444" />
            </View>
            <View style={s.rowText}>
              <Text style={[s.rowLabel,{color:'#EF4444'}]}>Delete Account</Text>
              <Text style={s.rowSub}>Permanently remove your account</Text>
            </View>
            {deleteLoading && <ActivityIndicator size="small" color="#EF4444" />}
          </TouchableOpacity>
        </View>

        <Text style={s.version}>MindMates V.11.33</Text>
      </ScrollView>

      <HelpModal visible={helpVisible} onClose={()=>setHelpVisible(false)} />

      <Portal>
        <Dialog visible={showLogout} onDismiss={()=>setShowLogout(false)} style={s.dialog}>
          <Dialog.Icon icon="logout" size={40} color="#6D4AFF" />
          <Dialog.Title style={s.dialogTitle}>Logout</Dialog.Title>
          <Dialog.Content><Text style={s.dialogText}>Are you sure you want to logout?</Text></Dialog.Content>
          <Dialog.Actions style={s.dialogActions}>
            <Button onPress={()=>setShowLogout(false)} textColor={T.sub} style={s.dialogBtn}>Cancel</Button>
            <Button onPress={handleLogout} mode="contained" buttonColor="#6D4AFF" style={s.dialogBtn} loading={logoutLoading}>Logout</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={showDelete} onDismiss={()=>setShowDelete(false)} style={s.dialog}>
          <Dialog.Icon icon="alert" size={40} color="#EF4444" />
          <Dialog.Title style={[s.dialogTitle,{color:'#EF4444'}]}>Delete Account?</Dialog.Title>
          <Dialog.Content>
            <Text style={s.dialogText}>This is <Text style={{fontWeight:'700'}}>permanent</Text>. All your data, connections and chats will be deleted.</Text>
            <Text style={[s.dialogText,{marginTop:12}]}>Type <Text style={{fontWeight:'700'}}>DELETE</Text> to confirm:</Text>
            <TextInput mode="outlined" placeholder="Type DELETE here"
              value={confirmText} onChangeText={setConfirmText}
              autoCapitalize="characters"
              style={{marginTop:8,backgroundColor:'#fff'}}
              outlineColor="#E5E7EB"
              activeOutlineColor={confirmText.toLowerCase()==='delete'?'#EF4444':'#6D4AFF'}
              dense />
          </Dialog.Content>
          <Dialog.Actions style={s.dialogActions}>
            <Button onPress={()=>setShowDelete(false)} textColor={T.sub} style={s.dialogBtn}>Cancel</Button>
            <Button onPress={handleDelete} mode="contained" buttonColor="#EF4444" style={s.dialogBtn}
              disabled={confirmText.toLowerCase()!=='delete'||deleteLoading} loading={deleteLoading}>
              Delete Forever
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex:1, backgroundColor:'#fff' },
  header:        { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:14 },
  headerBack:    { width:36, height:36, alignItems:'center', justifyContent:'center' },
  headerTitle:   { fontSize:19, fontWeight:'700', color:'#111827' },
  scroll:        { paddingBottom:40 },
  section:       { marginBottom:8, backgroundColor:'#fff' },
  row:           { flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingVertical:16, minHeight:64 },
  iconWrap:      { width:38, height:38, borderRadius:10, alignItems:'center', justifyContent:'center', marginRight:16, backgroundColor:'#ffffff' },
  rowText:       { flex:1 },
  rowLabel:      { fontSize:15, fontWeight:'500', color:'#111827', marginBottom:2 },
  rowSub:        { fontSize:12, color:'#6B7280' },
  version:       { textAlign:'center', fontSize:12, top:260, color:'#9CA3AF' },
  dialog:        { borderRadius:18, marginHorizontal:24, backgroundColor:'#fff' },
  dialogTitle:   { textAlign:'center', fontWeight:'600', fontSize:17, color:'#201f1f' },
  dialogText:    { fontSize:16, lineHeight:22, textAlign:'center', color:'#201f1f',bottom:10 },
  dialogActions: { justifyContent:'space-between', paddingHorizontal:8, paddingBottom:8 },
  dialogBtn:     { flex:1, marginHorizontal:4, color:'#FFF'},
});
