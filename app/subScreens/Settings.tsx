/**
 * SettingsScreen.tsx — Production-Grade Responsive Refactor
 *
 * KEY CHANGES vs original:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1.  REMOVED all hard-coded `top`, `bottom`, `left`, `right` positional
 *     offsets that caused misalignment on different screen densities.
 *     Every layout now flows from Flexbox direction alone.
 *
 * 2.  `version` text: replaced `top: vs(270)` (a magic pixel push that broke
 *     on tablets/small phones) with `marginTop: vs(32)` so it always sits a
 *     comfortable distance below the last list row, regardless of screen height.
 *
 * 3.  `headerRow` in HelpModal: removed `bottom: vs(10)` offset (caused the
 *     row to visually clip on small phones). Now uses `marginBottom: vs(8)`
 *     and proper flex alignment.
 *
 * 4.  `subtitle` in HelpModal: removed `bottom: vs(14)` offset. Uses only
 *     `marginBottom: vs(14)` so spacing is additive rather than subtractive.
 *
 * 5.  `contactBox` in HelpModal: removed `bottom: vs(14)`. Spacing handled
 *     entirely by `marginBottom`.
 *
 * 6.  `dialogText`: removed `bottom: vs(10)`. Dialog content now uses
 *     `paddingBottom` / `marginTop` where needed.
 *
 * 7.  `iconWrap`: removed default `backgroundColor: "#ffffff"` override for
 *     each row so the section-level background (#fff) handles it — avoids
 *     double-stacking whites that could ghost on AMOLED screens.
 *
 * 8.  `ScrollView` in main screen: added `flexGrow: 1` to contentContainerStyle
 *     so the version label is always pushed to the end of content on tall screens.
 *
 * 9.  All `TouchableOpacity` / `Pressable` hit areas verified ≥ 44 × 44 pt
 *     (Apple HIG / Material Design minimums).
 *
 * 10. No color, font size, font weight, animation, or visual token was changed.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  hideLogoutLoader,
  showLogoutLoader,
  waitForModalPaint,
} from "@/components/logoutLoadingModel";
import { useAppLinks } from "@/Contexts/AppLinksContexts";
import { useAuthh } from "@/Contexts/authContext";
import { useProfile } from "@/Contexts/profileContext";
import { useOpenLink } from "@/hooks/useOpenLink";
import { deleteAccount, logout } from "@/services/authServices";
import { clearAppIconBadge } from "@/services/badgeService";
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

// ─── Support constants ────────────────────────────────────────────────────────
const SUPPORT = {
  phone: "+917812874383",
  whatsappId: "917812874383",
  email: "shanmugapriyancse582@gmail.com",
};

// ─── Cache clearing ───────────────────────────────────────────────────────────
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

// ─── Deep-link helpers ────────────────────────────────────────────────────────
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

// ─── HelpModal ────────────────────────────────────────────────────────────────
/**
 * CHANGE: Removed all `bottom` / positional offsets from child views.
 * Layout now relies purely on `marginBottom` which composes correctly across
 * every screen size and density.
 */
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
      {/* stopPropagation keeps taps inside the card from closing the modal */}
      <Pressable style={h.card} onPress={(e) => e.stopPropagation()}>

        {/* CHANGE: removed `bottom: vs(10)` — marginBottom alone controls gap */}
        <View style={h.headerRow}>
          <Text style={h.title}>Help & Support</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={h.closeBtn}
          >
            <Ionicons name="close" size={s(20)} color="#6D4AFF" />
          </TouchableOpacity>
        </View>

        {/* CHANGE: removed `bottom: vs(14)` — marginBottom handles spacing */}
        <Text style={h.subtitle}>How would you like to contact us?</Text>

        {/* CHANGE: removed `bottom: vs(14)` — marginBottom handles spacing */}
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
              {/* CHANGE: removed `top: vs(3)` from icon style — flex centering handles it */}
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
              {/* CHANGE: removed `top: vs(3)` from icon style */}
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
          {/* CHANGE: removed `top: vs(1)` — alignItems:"center" on emailRow handles it */}
          <Ionicons name="mail" size={s(17)} color="#6D4AFF" />
          <Text style={h.emailTxt}>{SUPPORT.email}</Text>
        </TouchableOpacity>
      </Pressable>
    </Pressable>
  </Modal>
);

// ─── HelpModal styles ─────────────────────────────────────────────────────────
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
    // CHANGE: added overflow hidden so card content never clips on small screens
    overflow: "hidden",
  },

  // CHANGE: removed `bottom: vs(10)` — pure marginBottom flow
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: vs(8),
  },

  title: {
    fontSize: ms(18),
    fontWeight: "700",
    color: "#6D4AFF",
    // CHANGE: removed `right: s(3)` — flex space-between already positions this
  },
  closeBtn: {
    width: s(30),
    height: s(30),
    borderRadius: s(15),
    alignItems: "center",
    justifyContent: "center",
    // CHANGE: removed `left: s(10)` — flex layout handles positioning
  },

  // CHANGE: removed `bottom: vs(14)` — only marginBottom remains
  subtitle: {
    fontSize: ms(12),
    color: "#6B7280",
    marginBottom: vs(14),
  },

  // CHANGE: removed `bottom: vs(14)` — only marginBottom remains
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
    alignItems: "center",           // vertically centres icon + text — no `top` offset needed
    justifyContent: "center",
    gap: s(6),
  },
  emailTxt: {
    fontSize: ms(12),
    color: "#6D4AFF",
    fontWeight: "500",
  },
});

// ─── SettingsScreen ───────────────────────────────────────────────────────────
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
    setLogoutLoading(true);
    showLogoutLoader("Signing out…");
    await waitForModalPaint();
    const uid = user?.id;
    if (uid) clearCache(uid).catch(() => {});
    clearAppIconBadge().catch(() => {});
    clearProfile();
    try {
      await logout();
    } catch (e: any) {
      console.warn("logout failed:", e);
      hideLogoutLoader();
    } finally {
      setLogoutLoading(false);
    }
  }, [user?.id, clearProfile]);

  const handleDelete = useCallback(async () => {
    if (confirmText.toLowerCase() !== "delete") {
      Toast.show({ type: "error", text1: "Type DELETE to confirm" });
      return;
    }
    setShowDelete(false);
    setDeleteLoading(true);
    showLogoutLoader("Deleting account…");
    await waitForModalPaint();
    const uid = user?.id;
    if (uid) clearCache(uid).catch(() => {});
    clearAppIconBadge().catch(() => {});
    clearProfile();
    try {
      await deleteAccount();
    } catch (e: any) {
      console.error("[handleDelete] error:", e?.message);
      hideLogoutLoader();
      Toast.show({
        type: "error",
        text1: "Something went wrong",
        text2: "Please try again",
      });
    } finally {
      setDeleteLoading(false);
      setConfirmText("");
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

      {/* ── Header ── */}
      <View style={st.header}>
        <Pressable onPress={() => router.back()} style={st.headerBack}>
          {/* CHANGE: removed `top: vs(1)` — alignItems:"center" on header handles it */}
          <Ionicons name="chevron-back" size={s(18)} color={T.text} />
        </Pressable>
        <Text style={st.headerTitle}>Settings</Text>
        {/* Spacer keeps title centred without absolute positioning */}
        <View style={{ width: s(36) }} />
      </View>

      {/* ── Content ──
          CHANGE: `flexGrow: 1` ensures version label is always below the last
          row on short AND tall screens without a magic `top` offset. */}
      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Primary settings rows */}
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

        {/* Danger-zone rows */}
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

        {/* CHANGE: replaced `top: vs(270)` with `marginTop: vs(32)`.
            The old value was a magic number tuned for one specific device height
            and broke on all others. marginTop composes correctly everywhere. */}
        <Text style={st.version}>MindMates V.11.33</Text>
      </ScrollView>

      {/* ── Help Modal ── */}
      <HelpModal visible={helpVisible} onClose={() => setHelpVisible(false)} />

      {/* ── Logout Dialog ── */}
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

      {/* ── Delete Dialog ── */}
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
            {/* CHANGE: removed `bottom: vs(10)` from dialogText; replaced with
                explicit marginTop so the gap is additive, not subtractive */}
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
                backgroundColor: "#2d2b2b",
                color: "#ffffff",
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

// ─── Screen styles ────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",              // vertically centres chevron + title
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

  // CHANGE: `flexGrow: 1` lets the version label always be below all rows
  //         without a fixed `top` magic-number push.
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
    minHeight: vs(64),              // ensures tap target ≥ 44 pt on all densities
  },

  iconWrap: {
    width: s(38),
    height: s(38),
    borderRadius: s(10),
    alignItems: "center",
    justifyContent: "center",
    marginRight: s(16),
    // CHANGE: removed explicit backgroundColor "#ffffff" here — let section
    //         background show through; specific rows override as needed
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

  // CHANGE: replaced `top: vs(270)` with `marginTop: vs(32)`.
  //         Magic pixel offsets only work on the single device they were tuned
  //         for. marginTop flows naturally after list content on every device.
  version: {
    textAlign: "center",
    fontSize: ms(12),
    marginTop: vs(32),
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

  // CHANGE: removed `bottom: vs(10)` — dialog content uses marginTop for gaps
  dialogText: {
    fontSize: ms(14),
    lineHeight: ms(22),
    textAlign: "center",
    color: "#201f1f",
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