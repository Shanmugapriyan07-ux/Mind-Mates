import { useAppLinks } from "@/Contexts/AppLinksContexts";
import { useAuthh } from "@/Contexts/authContext";
import { useProfile } from "@/Contexts/profileContext";
import { useOpenLink } from "@/hooks/useOpenLink";
import { deleteAccount, logout } from "@/services/authServices";
import { clearAppIconBadge } from "@/services/badgeService";
import { useAuthStore } from "@/stores/authStore";
import { ms, s, vs } from "@/utils/scale";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Dialog, Portal, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
const SUPPORT = {
  phone: "+917812874383",
  whatsappId: "917812874383",
  email: "shanmugapriyancse582@gmail.com",
};

const clearCache = async (userId: string) => {
  const keys = [
    `profile_cache_${userId}`,
    `matches_v1_${userId}`,
    `matches_v4_${userId}`,
    `matches_${userId}`,
    `friends_v3_${userId}`,
    `friends_v5_${userId}`,
    `friends_v6_${userId}`,
  ];
  try {
    if (Platform.OS === "web") keys.forEach((k) => localStorage.removeItem(k));
    else {
      const AS = require("@react-native-async-storage/async-storage").default;
      await AS.multiRemove(keys);
    }
  } catch {}
};

const openCall = async () => {
  const url =
    Platform.OS === "ios"
      ? `telprompt:${SUPPORT.phone}`
      : `tel:${SUPPORT.phone}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("Cannot open dialler", `Call us at ${SUPPORT.phone}`);
  }
};

const openWhatsApp = async () => {
  const msg = encodeURIComponent("Hi! I need help with MindMates.😊");
  const appUrl = `whatsapp://send?phone=${SUPPORT.whatsappId}&text=${msg}`;
  const webUrl = `https://wa.me/${SUPPORT.whatsappId}?text=${msg}`;
  try {
    const ok = await Linking.canOpenURL(appUrl);
    await Linking.openURL(ok ? appUrl : webUrl);
  } catch {
    Alert.alert("Cannot open WhatsApp", `Message us at ${SUPPORT.phone}`);
  }
};

const openEmail = () => {
  const sub = encodeURIComponent("MindMates Support Request");
  const body = encodeURIComponent("Hi MindMates,\n\nI need help with:\n\n");
  Linking.openURL(`mailto:${SUPPORT.email}?subject=${sub}&body=${body}`).catch(
    () => Alert.alert("Cannot open mail app", `Email: ${SUPPORT.email}`),
  );
};
const HelpModal = ({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}
    statusBarTranslucent
  >
    <Pressable style={h.backdrop} onPress={onClose}>
      <Pressable style={h.card} onPress={(e) => e.stopPropagation()}>
        <View style={h.headerRow}>
          <Text style={h.title}>Help & Support</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={h.closeBtn}
          >
            <View style={{ alignItems: "center", justifyContent: "center" ,height:25,width:25, borderRadius:25,backgroundColor:"#F5F5F7"}}>
            <Ionicons name="close" size={s(19)} color="#6D4AFF" />
            </View>
          </TouchableOpacity>
        </View>
        <Text style={h.subtitle}>How would you like to contact us?</Text>
        <View style={h.contactBox}>
          <Text style={h.contactTitle}>MindMates Support – 24/7</Text>
          <Text style={h.contactPhone}>{SUPPORT.phone}</Text>
          <View style={h.btnRow}>
            <TouchableOpacity
              style={h.bigBtn}
              onPress={() => {
                onClose();
                setTimeout(openCall, 300);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="call" size={s(26)} color="#fff" />
              <Text style={h.bigBtnTxt}>Call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={h.bigBtn}
              onPress={() => {
                onClose();
                setTimeout(openWhatsApp, 300);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-whatsapp" size={s(26)} color="#fff" />
              <Text style={h.bigBtnTxt}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={h.emailRow}
          onPress={() => {
            onClose();
            setTimeout(openEmail, 300);
          }}
          activeOpacity={0.75}
        >
          <Ionicons name="mail" size={s(17)} color="#6D4AFF" />
          <Text style={h.emailTxt}>{SUPPORT.email}</Text>
        </TouchableOpacity>
      </Pressable>
    </Pressable>
  </Modal>
);

const h = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: s(24),
  },
  card: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: s(12),
    padding: s(27),
    elevation: 14,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: vs(3),
    bottom:vs(2)
  },
  title: {
    fontSize: ms(19),
    fontWeight: "700",
    color: "#6D4AFF",
  },
  closeBtn: {
    width: s(30),
    height: s(30),
    borderRadius: s(15),
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: {
    fontSize: ms(13),
    color: "#6B7280",
    marginBottom: vs(14),
  },
  contactBox: {
    backgroundColor: "#F5F5F7",
    borderRadius: s(16),
    padding: s(15),
    marginBottom: vs(14),
    alignItems: "center",
  },
  contactTitle: {
    fontSize: ms(14),
    fontWeight: "700",
    color: "#111827",
    marginBottom: vs(4),
    textAlign: "center",
  },
  contactPhone: {
    fontSize: ms(13),
    fontWeight: "600",
    color: "#6D4AFF",
    marginBottom: vs(18),
    textAlign: "center",
  },
  btnRow: {
    flexDirection: "row",
    gap: s(20),
    width: "90%",
  },
  bigBtn: {
    flex: 1,
    backgroundColor: "#6D4AFF",
    borderRadius: s(14),
    paddingVertical: vs(10),
    alignItems: "center",
    justifyContent: "center",
    gap: vs(8),
    elevation: 4,
    minWidth: 1,
  },
  bigBtnTxt: {
    color: "#fff",
    fontSize: ms(14),
    fontWeight: "700",
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",         
    justifyContent: "center",
    gap: s(6),
  },
  emailTxt: {
    fontSize: ms(12),
    color: "#6D4AFF",
    fontWeight: "500",
  },
});
export default function SettingsScreen() {
  const { user } = useAuthh();
  const { clearProfile } = useProfile();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [helpVisible, setHelpVisible] = useState(false);
  const { openByKey } = useOpenLink();
  useAppLinks();
  const tap = useCallback(
    (key: any, name: any) => () => openByKey(key, name),
    [openByKey],
  );
  const T = { text: "#111827", sub: "#6B7280", icon: "#6D4AFF" };
const handleLogout = useCallback(async () => {
  setShowLogout(false);
  useAuthStore.getState().beginLogout();
  const uid = user?.id;
  if (uid) clearCache(uid).catch(() => {});
  clearAppIconBadge().catch(() => {});
  clearProfile();
  try {
    await logout();
  } catch (e: any) {
    console.warn('logout failed:', e);
    useAuthStore.getState().setPhase('unauthenticated');
  } finally {
    setLogoutLoading(false);
  }
}, [user?.id, clearProfile]);
const handleDelete = useCallback(async () => {
  if (confirmText.toLowerCase() !== 'delete') {
    Toast.show({ type: 'error', text1: 'Type DELETE to confirm' });
    return;
  }
  setShowDelete(false);
  useAuthStore.getState().beginDelete();
  const uid = user?.id;
  if (uid) clearCache(uid).catch(() => {});
  clearAppIconBadge().catch(() => {});
  clearProfile();
  try {
    await deleteAccount();
  } catch (e: any) {
    console.error('[handleDelete] error:', e?.message);
    useAuthStore.getState().setPhase('unauthenticated');
    Toast.show({
      type: 'error',
      text1: 'Something went wrong',
      text2: 'Please try again',
    });
  } finally {
    setDeleteLoading(false);
    setConfirmText('');
  }
}, [confirmText, clearProfile]);
  const rows = [
    {
      icon: <Ionicons name="person-outline" size={s(24)} color={T.icon} />,
      label: "Edit Profile",
      sub: "Name, bio, location, skills",
      onPress: () => router.push("/subScreens/editProfile"),
    },
    {
      icon: <Ionicons name="help-circle-outline" size={s(24)} color={T.icon} />,
      label: "Help & Support",
      sub: "Call, WhatsApp or Email us",
      onPress: () => setHelpVisible(true),
    },
    {
      icon: (
        <Ionicons name="shield-checkmark-outline" size={s(24)} color={T.icon} />
      ),
      label: "Privacy Policy",
      sub: undefined,
      onPress: tap("PRIVACY_POLICY", "Privacy Policy"),
    },
    {
      icon: (
        <Ionicons name="document-text-outline" size={s(24)} color={T.icon} />
      ),
      label: "Terms & Conditions",
      sub: undefined,
      onPress: tap("TERMS_OF_SERVICE", "Terms of Service"),
    },
  ];
  return (
    <SafeAreaView style={st.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={st.header}>
        <Pressable onPress={() => router.back()} style={st.headerBack}>
          {/* CHANGE: removed `top: vs(1)` — alignItems:"center" on header handles it */}
          <Ionicons name="chevron-back" size={s(18)} color={T.text} />
        </Pressable>
        <Text style={st.headerTitle}>Settings</Text>
        <View style={{ width: s(36) }} />
      </View>
      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={st.section}>
          {rows.map((row) => (
            <React.Fragment key={row.label}>
              <TouchableOpacity
                style={st.row}
                onPress={row.onPress}
                activeOpacity={0.6}
              >
                <View style={st.iconWrap}>{row.icon}</View>
                <View style={st.rowText}>
                  <Text style={st.rowLabel}>{row.label}</Text>
                  {!!row.sub && <Text style={st.rowSub}>{row.sub}</Text>}
                </View>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
        <View style={st.section}>
          <TouchableOpacity
            style={st.row}
            onPress={() => setShowLogout(true)}
            disabled={logoutLoading}
            activeOpacity={0.6}
          >
            <View style={[st.iconWrap, { backgroundColor: "#f4f1fe" }]}>
              <Ionicons name="log-out-outline" size={s(24)} color="#6D4AFF" />
            </View>
            <View style={st.rowText}>
              <Text style={st.rowLabel}>Logout</Text>
              <Text style={st.rowSub}>Sign out of your account</Text>
            </View>
            {logoutLoading && (
              <ActivityIndicator size="small" color="#6D4AFF" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={st.row}
            onPress={() => setShowDelete(true)}
            disabled={deleteLoading}
            activeOpacity={0.6}
          >
            <View style={[st.iconWrap, { backgroundColor: "#fef2f2" }]}>
              <Ionicons name="trash-outline" size={s(24)} color="#EF4444" />
            </View>
            <View style={st.rowText}>
              <Text style={[st.rowLabel, { color: "#EF4444" }]}>
                Delete Account
              </Text>
              <Text style={st.rowSub}>Permanently remove your account</Text>
            </View>
            {deleteLoading && (
              <ActivityIndicator size="small" color="#EF4444" />
            )}
          </TouchableOpacity>
        </View>
        <Text style={st.version}>MindMates V.11.33</Text>
      </ScrollView>
      <HelpModal visible={helpVisible} onClose={() => setHelpVisible(false)} />
      <Portal>
        <Dialog
          visible={showLogout}
          onDismiss={() => setShowLogout(false)}
          style={st.dialog}
        >
          <Dialog.Icon icon="logout" size={s(40)} color="#6D4AFF" />
          <Dialog.Title style={st.dialogTitle}>Logout</Dialog.Title>
          <Dialog.Content>
            <Text style={st.dialogText}>Are you sure you want to logout?</Text>
          </Dialog.Content>
          <Dialog.Actions style={st.dialogActions}>
            <Button
              onPress={() => setShowLogout(false)}
              textColor={T.sub}
              style={st.dialogBtn}
            >
              Cancel
            </Button>
            <Button
              onPress={handleLogout}
              mode="contained"
              buttonColor="#6D4AFF"
              style={st.dialogBtn}
              loading={logoutLoading}
            >
              Logout
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Portal>
        <Dialog
          visible={showDelete}
          onDismiss={() => setShowDelete(false)}
          style={st.dialog}
        >
          <Dialog.Icon icon="alert" size={s(40)} color="#EF4444" />
          <Dialog.Title style={[st.dialogTitle, { color: "#EF4444" }]}>
            Delete Account?
          </Dialog.Title>
          <Dialog.Content>
            <Text style={st.dialogText}>
              This is <Text style={{ fontWeight: "700" }}>permanent</Text>. All
              your data, connections and chats will be deleted.
            </Text>
            <Text style={[st.dialogText, { marginTop: vs(12) }]}>
              Type <Text style={{ fontWeight: "700" }}>DELETE</Text> to confirm:
            </Text>
            <TextInput
              mode="outlined"
              placeholder="Type DELETE here"
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="characters"
              style={{
                marginTop: vs(8),
                backgroundColor: "#ffffff",
                color: "#000000",
                fontSize: ms(14),
              }}
              outlineColor="#ffffff"
              activeOutlineColor={
                confirmText.toLowerCase() === "delete" ? "#EF4444" : "#7c51fd"
              }
              dense
            />
          </Dialog.Content>
          <Dialog.Actions style={st.dialogActions}>
            <Button
              onPress={() => setShowDelete(false)}
              textColor={T.sub}
              style={st.dialogBtn}
            >
              Cancel
            </Button>
            <Button
              onPress={handleDelete}
              mode="contained"
              buttonColor="#ee3c3c"
              style={st.dialogBtn}
              disabled={confirmText.toLowerCase() !== "delete" || deleteLoading}
              loading={deleteLoading}
            >
              Delete Forever
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}
const st = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",          
    justifyContent: "space-between",
    paddingHorizontal: s(16),
    paddingVertical: vs(14),
  },
  headerBack: {
    width: s(36),
    height: s(36),
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: ms(18),
    fontWeight: "500",
    color: "#111827",
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: vs(40),
  },
  section: {
    marginBottom: vs(8),
    backgroundColor: "#fff",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s(20),
    paddingVertical: vs(16),
    minHeight: vs(64),             
  },
  iconWrap: {
    width: s(38),
    height: s(38),
    borderRadius: s(10),
    alignItems: "center",
    justifyContent: "center",
    marginRight: s(16),
  },
  rowText: { flex: 1 },
  rowLabel: {
    fontSize: ms(14),
    fontWeight: "500",
    color: "#111827",
    marginBottom: vs(2),
  },
  rowSub: {
    fontSize: ms(11),
    color: "#6B7280",
  },
  version: {
    textAlign: "center",
    fontSize: ms(12),
    marginTop: vs(50),
    color: "#6D4AFF",
    fontWeight: "500",
  },

  dialog: {
    borderRadius: s(18),
    marginHorizontal: s(24),
    backgroundColor: "#fff",
  },
  dialogTitle: {
    textAlign: "center",
    fontWeight: "700",
    fontSize: ms(18),
    color: "#201f1f",
  },
  dialogText: {
    fontSize: ms(14),
    lineHeight: ms(22),
    textAlign: "center",
    color: "#000000",
  },
  dialogActions: {
    justifyContent: "space-between",
    paddingHorizontal: s(8),
    paddingBottom: vs(8),
  },
  dialogBtn: {
    flex: 1,
    marginHorizontal: s(4),
    fontSize: ms(14),
  },
});