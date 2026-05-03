
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ScrollView, StyleSheet, StatusBar, Animated,
  Dimensions, ListRenderItem, ActivityIndicator,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router }         from 'expo-router';
import { useProfile }     from '@/Contexts/profileContext';
import { Ionicons }       from '@expo/vector-icons';
import { useAuthh }        from '@/Contexts/authContext';

type Category = 'Tech' | 'Design' | 'Business' | 'Sports' | 'Passion' | 'Fun';
interface Skill { id: number; name: string; category: Category; icon: string; }

const CATEGORIES: Category[] = ['Tech', 'Design', 'Business', 'Sports', 'Passion', 'Fun'];

const SKILLS: Skill[] = [
  { id: 1,  name: 'Art',             category: 'Passion',  icon: 'color-palette-outline'    },
  { id: 2,  name: 'Painting',        category: 'Passion',  icon: 'brush-outline'            },
  { id: 3,  name: 'Photography',     category: 'Passion',  icon: 'camera-outline'           },
  { id: 4,  name: 'Videography',     category: 'Passion',  icon: 'videocam-outline'         },
  { id: 5,  name: 'Acting',          category: 'Passion',  icon: 'theater-outline'          },
  { id: 6,  name: 'Singing',         category: 'Passion',  icon: 'mic-outline'              },
  { id: 7,  name: 'Freefire',        category: 'Fun',      icon: 'game-controller-outline'  },
  { id: 8,  name: 'BGMI',            category: 'Fun',      icon: 'game-controller-outline'  },
  { id: 9,  name: 'Freelancing',     category: 'Business', icon: 'laptop-outline'           },
  { id: 10, name: 'Gym',             category: 'Sports',   icon: 'barbell-outline'          },
  { id: 11, name: 'Yoga',            category: 'Sports',   icon: 'body-outline'             },
  { id: 12, name: 'Running',         category: 'Sports',   icon: 'walk-outline'             },
  { id: 13, name: 'Cycling',         category: 'Sports',   icon: 'bicycle-outline'          },
  { id: 14, name: 'Swimming',        category: 'Sports',   icon: 'water-outline'            },
  { id: 15, name: 'Boxing',          category: 'Sports',   icon: 'fitness-outline'          },
  { id: 16, name: 'Bulking',         category: 'Sports',   icon: 'fitness-outline'          },
  { id: 17, name: 'Weight Loss',     category: 'Sports',   icon: 'scale-outline'            },
  { id: 18, name: 'PowerLifter',     category: 'Sports',   icon: 'barbell-outline'          },
  { id: 19, name: 'Bodybuilding',    category: 'Sports',   icon: 'body-outline'             },
  { id: 20, name: 'Programming',     category: 'Tech',     icon: 'code-slash-outline'       },
  { id: 21, name: 'App Development', category: 'Tech',     icon: 'phone-portrait-outline'   },
  { id: 22, name: 'Web Development', category: 'Tech',     icon: 'globe-outline'            },
  { id: 23, name: 'AI / ML',         category: 'Tech',     icon: 'hardware-chip-outline'    },
  { id: 24, name: 'Cybersecurity',   category: 'Tech',     icon: 'shield-checkmark-outline' },
  { id: 25, name: 'UI/UX Design',    category: 'Design',   icon: 'color-wand-outline'       },
  { id: 26, name: 'Python',          category: 'Tech',     icon: 'code-slash-outline'       },
  { id: 27, name: 'Java',            category: 'Tech',     icon: 'code-slash-outline'       },
  { id: 28, name: 'Govt Prep',       category: 'Passion',  icon: 'book-outline'             },
  { id: 29, name: 'Business',        category: 'Business', icon: 'briefcase-outline'        },
  { id: 30, name: 'Short Films',     category: 'Passion',  icon: 'film-outline'             },
  { id: 31, name: 'Football',        category: 'Sports',   icon: 'football-outline'         },
  { id: 32, name: 'Cricket',         category: 'Sports',   icon: 'baseball-outline'         },
  { id: 33, name: 'Basketball',      category: 'Sports',   icon: 'basketball-outline'       },
  { id: 34, name: 'Tennis',          category: 'Sports',   icon: 'tennisball-outline'       },
  { id: 35, name: 'Kabaddi',         category: 'Sports',   icon: 'people-outline'           },
  { id: 36, name: 'Athletics',       category: 'Sports',   icon: 'timer-outline'            },
  { id: 37, name: 'Startups',        category: 'Business', icon: 'rocket-outline'           },
  { id: 38, name: 'Content Creator', category: 'Passion',  icon: 'create-outline'           },
];

const { width } = Dimensions.get('window');
const CARD_SIZE  = (width - 52) / 2;

// ── Skill Card ────────────────────────────────────────────────────────────────
const SkillCard = React.memo(({ skill, isSelected, isDisabled, onToggle }: {
  skill: Skill; isSelected: boolean; isDisabled: boolean; onToggle: (id: number) => void;
}) => {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    if (isDisabled) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.05, duration: 50,  useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.95, duration: 50,  useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,    duration: 100, useNativeDriver: true }),
      ]).start();
      return;
    }
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.spring(scale,  { toValue: 1, friction: 15,   useNativeDriver: true }),
    ]).start();
    onToggle(skill.id);
  }, [skill.id, onToggle, scale, isDisabled]);

  const content = (
    <>
      {isSelected
        ? <LinearGradient colors={['#6D4AFF', '#6D4AFF']} style={st.checkCircle}>
            <Ionicons name="checkmark" size={13} color="#fff" />
          </LinearGradient>
        : <View style={[st.checkCircle, st.checkUnch]} />
      }

      {/* ✅ FIX: Ionicons instead of <Text> */}
      <View style={st.iconWrap}>
        <Ionicons
          name={skill.icon as any}
          size={36}
          color={isSelected ? '#6D4AFF' : '#374151'}
        />
      </View>

      <Text style={st.skillName}>{skill.name}</Text>
    </>
  );

  return (
    <TouchableOpacity activeOpacity={isDisabled ? 1 : 0.85} onPress={handlePress} style={{ width: CARD_SIZE }}>
      <Animated.View style={{ transform: [{ scale }], opacity: isDisabled ? 0.4 : 1 }}>
        {isSelected
          ? <LinearGradient colors={['#6D4AFF', '#6543ee']} style={st.gradBorder}>
              <View style={st.cardInner}>{content}</View>
            </LinearGradient>
          : <View style={[st.card, st.cardUnsel]}>{content}</View>
        }
      </Animated.View>
    </TouchableOpacity>
  );
});

// ── Main Screen (logic 100% unchanged) ───────────────────────────────────────
export default function SkillSelection() {
  const [selectedIds,    setSelectedIds]    = useState<Set<number>>(new Set());
  const [activeCategory, setActiveCategory] = useState<Category>('Tech');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [showLimit,      setShowLimit]      = useState(false);
  const [saving,         setSaving]         = useState(false);

  const { user }                   = useAuthh();
  const { profile, updateProfile } = useProfile();

  useEffect(() => { router.prefetch('/(tabs)/home'); }, []);

  const toggleSkill = useCallback((id: number) => {
    setSelectedIds((prev: any) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); setShowLimit(false); }
      else if (next.size < 3) { next.add(id); setShowLimit(false); }
      else { setShowLimit(true); setTimeout(() => setShowLimit(false), 2500); }
      return next;
    });
  }, []);

  const filtered = SKILLS.filter(s =>
    searchQuery.trim()
      ? s.name.toLowerCase().includes(searchQuery.toLowerCase())
      : s.category === activeCategory
  );

  const handleContinue = useCallback(() => {
    if (!user?.id || saving) return;
    const names = Array.from(selectedIds)
      .map(id => SKILLS.find(s => s.id === id)?.name ?? '').filter(Boolean);
    if (!names.length) return;
    setSaving(true);
    updateProfile({
      skillsArray:       names,
      profileImage:      profile?.profileImage ?? null,
      isProfileComplete: true,
    });
    setTimeout(() => { setSaving(false); router.replace('/(tabs)/home'); }, 100);
  }, [user?.id, saving, selectedIds, profile?.profileImage, updateProfile]);

  const renderSkill: ListRenderItem<Skill> = useCallback(({ item }: { item: Skill }) => (
    <SkillCard
      skill={item}
      isSelected={selectedIds.has(item.id)}
      isDisabled={!selectedIds.has(item.id) && selectedIds.size >= 3}
      onToggle={toggleSkill}
    />
  ), [selectedIds, toggleSkill]);

  return (
    <SafeAreaView style={st.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={st.header}>
        <View style={st.searchWrap}>
          <Ionicons name="search" size={20} color="#575757" style={{ marginRight: 8 }} />
          <TextInput
            style={st.searchInput} placeholder="Search skills..."
            placeholderTextColor="#575757" value={searchQuery}
            onChangeText={setSearchQuery} returnKeyType="search" autoCorrect={false}
          />
        </View>
        {!searchQuery.trim() && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={st.tabs} contentContainerStyle={st.tabsContent}>
            {CATEGORIES.map(cat => cat === activeCategory
              ? <LinearGradient key={cat} colors={['#6D4AFF', '#6340f0']} style={st.tabActive}>
                  <TouchableOpacity onPress={() => setActiveCategory(cat)}>
                    <Text style={st.tabTextActive}>{cat}</Text>
                  </TouchableOpacity>
                </LinearGradient>
              : <TouchableOpacity key={cat} style={st.tabInactive}
                  onPress={() => setActiveCategory(cat)} activeOpacity={0.7}>
                  <Text style={st.tabTextInactive}>{cat}</Text>
                </TouchableOpacity>
            )}
          </ScrollView>
        )}
      </View>

      <FlatList
        data={filtered} renderItem={renderSkill}
        keyExtractor={item => `${item.id}_${item.name}`}
        numColumns={2} columnWrapperStyle={st.row}
        contentContainerStyle={st.gridContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled" removeClippedSubviews
        ListEmptyComponent={
          <View style={st.emptyWrap}><Text style={st.emptyText}>No skills found 🔎</Text></View>
        }
      />

      <View style={st.bottomArea}>
        {showLimit && (
          <View style={st.limitWarn}>
            <Text style={st.limitWarnText}>⚠️ Max 3 skills. Deselect one to choose another.</Text>
          </View>
        )}
        <Text style={[st.countText, selectedIds.size > 0 && st.countActive]}>
          {selectedIds.size === 0 ? 'Select up to 3 skills'
           : selectedIds.size === 3 ? '3/3 selected (max)'
           : `${selectedIds.size}/3 selected`}
        </Text>
        <TouchableOpacity onPress={handleContinue} disabled={selectedIds.size === 0 || saving} activeOpacity={0.85}>
          {selectedIds.size > 0
            ? <LinearGradient colors={['#6D4AFF', '#603dea']} start={{ x:0,y:0 }} end={{ x:1,y:0 }} style={st.continueBtn}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={st.continueBtnText}>Continue</Text>}
              </LinearGradient>
            : <View style={[st.continueBtn, st.continueBtnOff]}>
                <Text style={st.continueBtnText}>Continue</Text>
              </View>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safeArea:        { flex: 1, backgroundColor: '#fff' },
  header:          { paddingHorizontal: 20, paddingBottom: 4 },
  searchWrap:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F8FA', borderRadius: 50, paddingHorizontal: 16, marginBottom: 14, marginTop: 15, elevation: 0 },
  searchInput:     { flex: 1, paddingVertical: 13, fontSize: 15, color: '#1c1b1b' },
  tabs:            { marginBottom: 5, paddingVertical: 4, width:'120%'},
  tabsContent:     { gap: 8, paddingRight: 4 },
  tabActive:       { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 50 },
  tabInactive:     { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 50, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width:0, height:2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  tabTextActive:   { fontSize: 14, fontWeight: '700', color: '#fff' },
  tabTextInactive: { fontSize: 14, fontWeight: '700', color: '#888' },
  gridContent:     { paddingHorizontal: 16, paddingBottom: 12 },
  row:             { justifyContent: 'space-between', marginBottom: 10,top:5, },
  gradBorder:      { borderRadius: 22, padding: 2.5 },
  cardInner:       { backgroundColor: '#fff', borderRadius: 20, padding: 22, paddingTop: 12, minHeight: 120 },
  card:            { borderRadius: 20, padding: 22, paddingTop: 14, minHeight: 125, position: 'relative', },
  cardUnsel:       { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width:2, height:3 }, shadowOpacity: 0.11, shadowRadius: 8, elevation: 3 },
  checkCircle:     { position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  checkUnch:       { backgroundColor: '#f0f0f5', borderWidth: 2, borderColor: '#e5e5eb' },
  // ✅ icon wrapper replaces skillEmoji text style
  iconWrap:        { marginTop: 10, marginBottom: 10, alignItems: 'flex-start' },
  skillName:       { fontSize: 13, fontWeight: '800', color: '#1a1a2e', letterSpacing: -0.2 },
  emptyWrap:       { alignItems: 'center', paddingVertical: 40 },
  emptyText:       { fontSize: 15, fontWeight: '600', color: '#aaa' },
  bottomArea:      { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, backgroundColor: '#fff' },
  limitWarn:       { backgroundColor: '#fff3cd', borderRadius: 12, padding: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#f5a623' },
  limitWarnText:   { fontSize: 13, fontWeight: '600', color: '#856404', textAlign: 'center' },
  countText:       { textAlign: 'center', fontSize: 13, fontWeight: '700', color: '#aaa', marginBottom: 10 },
  countActive:     { color: '#6D4AFF' },
  continueBtn:     { borderRadius: 50, paddingVertical: 17, alignItems: 'center', justifyContent: 'center' },
  continueBtnOff:  { backgroundColor: '#d0d0dc' },
  continueBtnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
});