// components/LocationPicker.js
// ✅ COMPLETE LOCATION SELECT INPUT (Like Google Maps)
// Copy this ENTIRE file to: components/LocationPicker.js

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// ═══════════════════════════════════════════════════════════════
// TAMIL NADU DISTRICTS (You already have this data!)
// ═══════════════════════════════════════════════════════════════

const TAMILNADU_DISTRICTS = [
  "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore",
  "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kancheepuram",
  "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam",
  "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram",
  "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni",
  "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur",
  "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore",
  "Viluppuram", "Virudhunagar"
];

// ═══════════════════════════════════════════════════════════════
// LOCATION PICKER COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function LocationPicker({ 
  value,           // Selected district (e.g., "Chennai")
  onSelect,        // Function called when user selects (district) => {}
  placeholder = "Select District",
  onFocus,         // Optional: Called when picker is opened
  onBlur,          // Optional: Called when picker is closed
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState('');

  // ✅ Filter districts based on search
  const filtered = useMemo(() => {
    if (!search.trim()) {
      return TAMILNADU_DISTRICTS;
    }
    return TAMILNADU_DISTRICTS.filter(d => 
      d.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  // ✅ Handle district selection
  const handleSelect = (location) => {
    onSelect(location);           // Send to parent
    setModalVisible(false);       // Close modal
    setSearch('');                // Clear search
  };

  // ✅ Open modal
  const openModal = () => {
    setModalVisible(true);
    onFocus?.();
  };

  // ✅ Close modal
  const closeModal = () => {
    setModalVisible(false);
    setSearch('');
    onBlur?.();
  };

  return (
    <>
      {/* ═══════════════════════════════════════════════════ */}
      {/* INPUT BUTTON (What user taps to open) */}
      {/* ═══════════════════════════════════════════════════ */}
      
      <TouchableOpacity
        style={s.selectButton}
        onPress={openModal}
        activeOpacity={0.7}
      >
        <Text style={[s.selectText, !value && s.placeholder]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
      </TouchableOpacity>

      {/* ═══════════════════════════════════════════════════ */}
      {/* MODAL (The select dropdown) */}
      {/* ═══════════════════════════════════════════════════ */}
      
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
        onChangeText={setSearch}
        autoCapitalize="words"
        autoFocus
        required
      >
         <SafeAreaProvider style={s.modal}> 
          
          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={closeModal} style={s.closeBtn}>
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Select District</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Search Bar */}
          <View style={s.searchContainer}>
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <TextInput
              style={s.searchInput}
              placeholder="Search district..."
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="words"
              autoFocus
              required
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Districts List */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[s.item, value === item && s.itemSelected]}
                onPress={() => handleSelect(item)}
              >
                <Text style={[s.itemText, value === item && s.itemTextSelected]}>
                  {item}
                </Text>
                {value === item && (
                  <Ionicons name="checkmark" size={24} color="#6D4AFF" />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View style={s.empty}>
                <Text style={s.emptyText}>No districts found</Text>
              </View>
            )}
          />
        </SafeAreaProvider>
      </Modal>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  selectButton: {
    flexDirection: 'row', justifyContent:'space-between',
    marginLeft: 3,
    marginRight: 16,
  },

  selectText: {
    fontSize: 16,
    color: '#1F2937',
  },
  placeholder: {
    color: '#9CA3AF',
  },
  modal: {
  backgroundColor: '#FFFFFF',
    width: '100%',
    height: '100%',

  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',

  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor:'#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    height: 48,
    margin: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#252525',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemSelected: {
    backgroundColor: '#F9FAFB',
  },
  itemText: {
    fontSize: 16,
    color: '#1F2937',
  },
  itemTextSelected: {
    fontWeight: '600',
    color: '#6D4AFF',
  },
  empty: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
});