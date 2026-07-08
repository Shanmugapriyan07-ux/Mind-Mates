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
const TAMILNADU_DISTRICTS = [
  "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore",
  "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kancheepuram",
  "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam",
  "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram",
  "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni",
  "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur",
  "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram",
  "Virudhunagar",
  "Bangalore Bagalkot", "Ballari", "Belagavi", "Bengaluru Rural",
  "Bengaluru Urban", "Bidar", "Chamarajanagar", "Chikballapur",
  "Chikkamagaluru", "Chitradurga", "Dakshina Kannada", "Davanagere",
  "Dharwad", "Gadag", "Hassan", "Haveri", "Kalaburagi", "Kodagu", "Kolar",
  "Koppal", "Mandya", "Mysuru", "Raichur", "Ramanagara", "Shivamogga",
  "Tumakuru", "Udupi", "Uttara Kannada", "Vijayapura", "Vijayanagara",
  "Yadgir",
];
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
      <TouchableOpacity
        style={st.selectButton}
        onPress={openModal}
        activeOpacity={0.7}
      >
        <Text style={[st.selectText, !value && st.placeholder]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
      </TouchableOpacity>
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={st.modal}>
          <View style={st.header}>
            <TouchableOpacity onPress={closeModal} style={st.closeBtn}>
              <Ionicons name="close" size={18} color="#111827" />
            </TouchableOpacity>
            <Text style={st.headerTitle}>Select District</Text>
            <View style={{ width: s(40) }} />
          </View>
          <View style={st.searchContainer}>
            <Ionicons name="search" size={18} color="#9CA3AF" />
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
const st = StyleSheet.create({
  selectButton: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",         
    marginLeft:     s(3),
    marginRight:    s(16),
  },
  selectText:  { fontSize: ms(14), color: "#1F2937" },
  placeholder: { color: "#9CA3AF" },
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
    minHeight:         vs(44),
    margin:            s(16),
    gap:               s(3),
  },
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