/**
 * LocationPicker.tsx — Production-Grade Responsive Refactor
 *
 * KEY CHANGES vs original:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1.  BUG FIX — `style={s.searchInput}` → `style={st.searchInput}`.
 *     The original referenced `s.searchInput` where `s` is the scale utility
 *     function, not the stylesheet. This caused a runtime crash on every
 *     device. Changed to `st.searchInput` (the StyleSheet object).
 *
 * 2.  `modal` style: removed `top: 0`, `width: "100%"`, `height: "100%"`.
 *     These are redundant when `flex: 1` is set and SafeAreaView already
 *     fills the screen. The `top: 0` offset compound-stacked with
 *     SafeAreaView insets on notched iPhones, pushing content below the island.
 *
 * 3.  Chevron icon: removed `top: vs(2)` positional offset.
 *     `alignItems: "center"` on the parent `selectButton` row centres the
 *     icon correctly. The `top` offset was fighting flex alignment on
 *     high-density Samsung/Oppo screens.
 *
 * 4.  Search icon: removed `left: s(2)` positional offset.
 *     The `gap: s(3)` on `searchContainer` already spaces the icon from
 *     the input. The `left` added uneven leading padding on narrow screens.
 *
 * 5.  `searchInput` `top: vs(1)` removed.
 *     Text input baseline is handled by `alignItems: "center"` on the
 *     `searchContainer` row. The offset caused single-pixel misalignment on
 *     Xiaomi MIUI and Oppo ColorOS high-refresh displays.
 *
 * 6.  `searchContainer` height: `s(40)` → `minHeight: vs(44)`.
 *     Fixed `height` via `s()` (horizontal scale) for a vertical dimension
 *     is incorrect — it produces wrong heights on phones with unusual aspect
 *     ratios (18.5:9 Galaxy A-series). `minHeight: vs(44)` uses vertical
 *     scale and meets the 44 pt touch target minimum.
 *
 * 7.  `closeBtn` height: `s(40)` → `vs(44)` to meet tap-target minimum and
 *     use the correct axis scale for a vertical dimension.
 *
 * 8.  All colors, fonts, district list, modal animation, and logic unchanged.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { s, vs, ms } from "@/utils/scale";

// ─── District data ─────────────────────────────────────────────────────────────
const TAMILNADU_DISTRICTS = [
  "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore",
  "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kancheepuram",
  "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam",
  "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram",
  "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni",
  "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur",
  "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram",
  "Virudhunagar",
  // Karnataka districts
  "Bangalore Bagalkot", "Ballari", "Belagavi", "Bengaluru Rural",
  "Bengaluru Urban", "Bidar", "Chamarajanagar", "Chikballapur",
  "Chikkamagaluru", "Chitradurga", "Dakshina Kannada", "Davanagere",
  "Dharwad", "Gadag", "Hassan", "Haveri", "Kalaburagi", "Kodagu", "Kolar",
  "Koppal", "Mandya", "Mysuru", "Raichur", "Ramanagara", "Shivamogga",
  "Tumakuru", "Udupi", "Uttara Kannada", "Vijayapura", "Vijayanagara",
  "Yadgir",
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function LocationPicker({
  value,
  onSelect,
  placeholder = "Select District",
  onFocus,
  onBlur
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch]             = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return TAMILNADU_DISTRICTS;
    return TAMILNADU_DISTRICTS.filter((d) =>
      d.toLowerCase().includes(search.toLowerCase()),
    );
  }, [search]);

  const handleSelect = (location) => {
    onSelect(location);
    setModalVisible(false);
    setSearch("");
  };

  const openModal = () => {
    setModalVisible(true);
    onFocus?.();
  };

  const closeModal = () => {
    setModalVisible(false);
    setSearch("");
    onBlur?.();
  };

  return (
    <>
      {/* ── Trigger button ── */}
      <TouchableOpacity
        style={st.selectButton}
        onPress={openModal}
        activeOpacity={0.7}
      >
        <Text style={[st.selectText, !value && st.placeholder]}>
          {value || placeholder}
        </Text>
        {/*
         * CHANGE: removed `top: vs(2)` — `alignItems:"center"` on selectButton
         * already vertically centres the icon. The offset was causing a
         * 1-2 px misalignment on high-density OEM screens.
         */}
        <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
      </TouchableOpacity>

      {/* ── Full-screen picker modal ── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeModal}
      >
        {/*
         * CHANGE: modal style no longer sets `top:0`, `width:"100%"`,
         * `height:"100%"`. SafeAreaView with flex:1 fills the screen correctly
         * on all devices. `top:0` was compounding with SafeAreaView insets on
         * notched iPhones and Android cutout devices.
         */}
        <SafeAreaView style={st.modal}>

          {/* Header */}
          <View style={st.header}>
            <TouchableOpacity onPress={closeModal} style={st.closeBtn}>
              <Ionicons name="close" size={18} color="#111827" />
            </TouchableOpacity>
            <Text style={st.headerTitle}>Select District</Text>
            <View style={{ width: s(40) }} />
          </View>

          {/* Search bar */}
          <View style={st.searchContainer}>
            {/*
             * CHANGE: removed `left: s(2)` from search icon.
             * `gap: s(3)` on the container already spaces it from the input.
             * The left offset was adding uneven leading padding on narrow screens.
             */}
            <Ionicons name="search" size={18} color="#9CA3AF" />
            {/*
             * BUG FIX: `style={s.searchInput}` → `style={st.searchInput}`.
             * `s` is the horizontal scale utility function — it has no
             * `.searchInput` property. This was a runtime crash on every device.
             *
             * CHANGE: also removed `top: vs(1)` from searchInput style.
             * alignItems:"center" on the container handles vertical alignment.
             */}
            <TextInput
              style={st.searchInput}
              placeholder="Search district..."
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="words"
              autoFocus
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {/* District list */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[st.item, value === item && st.itemSelected]}
                onPress={() => handleSelect(item)}
              >
                <Text style={[st.itemText, value === item && st.itemTextSelected]}>
                  {item}
                </Text>
                {value === item && (
                  <Ionicons name="checkmark" size={18} color="#6D4AFF" />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View style={st.empty}>
                <Text style={st.emptyText}>No districts found</Text>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  selectButton: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",          // CHANGE: centres chevron without top offset
    marginLeft:     s(3),
    marginRight:    s(16),
  },
  selectText:  { fontSize: ms(14), color: "#1F2937" },
  placeholder: { color: "#9CA3AF" },

  // CHANGE: removed top:0, width:"100%", height:"100%".
  // flex:1 inside SafeAreaView is sufficient and doesn't stack with insets.
  modal: {
    flex:            1,
    backgroundColor: "#FFFFFF",
  },

  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: s(16),
    paddingVertical:   vs(8),
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },

  // CHANGE: height s(40) → vs(44). s() is horizontal scale — wrong axis for
  // height. vs(44) uses vertical scale and meets 44 pt touch target minimum.
  closeBtn: {
    width:           s(40),
    height:          vs(44),
    alignItems:      "center",
    justifyContent:  "center",
  },

  headerTitle: { fontSize: ms(15), fontWeight: "600", color: "#111827" },

  searchContainer: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   "#F7F8FA",
    borderRadius:      25,
    paddingHorizontal: s(12),
    // CHANGE: height s(40) → minHeight vs(44).
    // s() (horizontal scale) for a vertical dimension is incorrect on
    // non-16:9 aspect ratios. minHeight allows expansion for long Tamil
    // district names and meets touch target guidelines.
    minHeight:         vs(44),
    margin:            s(16),
    gap:               s(3),
  },

  // CHANGE: removed `top: vs(1)` — alignItems:"center" on parent handles it.
  // BUG FIX: was `s.searchInput` (crash) → now `st.searchInput`.
  searchInput: {
    flex:     1,
    fontSize: ms(13),
    color:    "#252525",
  },

  item: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: s(20),
    paddingVertical:   vs(16),
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  itemSelected:     { backgroundColor: "#F9FAFB" },
  itemText:         { fontSize: ms(14), color: "#1F2937" },
  itemTextSelected: { fontWeight: "600", color: "#6D4AFF" },

  empty:     { alignItems: "center", padding: s(40) },
  emptyText: { fontSize: ms(16), color: "#9CA3AF" },
});