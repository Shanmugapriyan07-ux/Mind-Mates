import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  StatusBar,
  Animated,
  Dimensions,
  ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import SkillCardSkeleton from '@/components/features/SkillCardSkeleton';
import { useProfile } from '@/Contexts/profileContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BasicInfo from './BasicInfo';

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Category = 'Tech' | 'Design' | 'Marketing' | 'Business';

interface Skill {
  id: any;
  name: string;
  category: Category;
  emoji: string;
}

interface SkillCardProps {
  skill: Skill;
  isSelected: boolean;
  isDisabled: boolean;
  onToggle: (id: number) => void;
}

interface CardContentProps {
  skill: Skill;
  isSelected: boolean;
}

// ─── DATA ─────────────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = ['Tech', 'Design', 'Marketing', 'Business'];

const SKILLS: Skill[] = [
  { id: 1,  name: 'React Native',     category: 'Tech',      emoji: '⚛️' },
  { id: 2,  name: 'UI/UX Design',     category: 'Design',    emoji: '🎨' },
  { id: 3,  name: 'Java',             category: 'Tech',      emoji: '☕' },
  { id: 4,  name: 'Photography',      category: 'Design',    emoji: '📷' },
  { id: 5,  name: 'Public Speaking',  category: 'Marketing', emoji: '📢' },
  { id: 6,  name: 'Fitness Training', category: 'Business',  emoji: '🏋️' },
  { id: 7,  name: 'Python',           category: 'Tech',      emoji: '🐍' },
  { id: 8,  name: 'SEO',              category: 'Marketing', emoji: '🔍' },
  { id: 9,  name: 'Branding',         category: 'Design',    emoji: '✨' },
  { id: 10, name: 'Excel',            category: 'Business',  emoji: '📊' },
  { id: 11, name: 'Node.js',          category: 'Tech',      emoji: '🟢' },
  { id: 12, name: 'Content Writing',  category: 'Marketing', emoji: '✍️' },
];

const { width } = Dimensions.get('window');
const CARD_SIZE: number = (width - 52) / 2;

// ─── CARD CONTENT ─────────────────────────────────────────────────────────────

const CardContent: React.FC<CardContentProps> = ({ skill, isSelected }) => (
  <>
    {isSelected ? (
      <LinearGradient
        colors={['#703de7','#7b4ce5', '#7b4ce5']}
        style={styles.checkCircle}
      >
        <Text style={styles.checkMark}>✓</Text>
      </LinearGradient>
    ) : (
      <View style={[styles.checkCircle, styles.checkUnchecked]} />
    )}

    {/* Swap this Text with <Image> when you have your own assets */}
    <Text style={styles.skillEmoji}>{skill.emoji}</Text>
    <Text style={styles.skillName}>{skill.name}</Text>
  </>
);

// ─── SKILL CARD ───────────────────────────────────────────────────────────────

const SkillCard: React.FC<SkillCardProps> = React.memo(({ skill, isSelected, isDisabled, onToggle }) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePress = useCallback((): void => {
    if (isDisabled) {
      // Shake animation when trying to select while at limit
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.05, duration: 50, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.95, duration: 50, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.02, duration: 50, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
      ]).start();
      return;
    }
    
    // Normal bounce animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.93,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();
    onToggle(skill.id);
  }, [skill.id, onToggle, scaleAnim, isDisabled]);

  

  return (
    <TouchableOpacity
      activeOpacity={isDisabled ? 1 : 0.85}
      onPress={handlePress}
      style={{ width: CARD_SIZE }}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: isDisabled ? 0.4 : 1 }}>
        {isSelected ? (
          <LinearGradient
            colors={['#703de7','#7b4ce5', '#7b4ce5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientBorder}
          >
            <View style={styles.cardInner}>
              <CardContent skill={skill} isSelected={isSelected} />
            </View>
          </LinearGradient>
        ) : (
          <View style={[styles.card, styles.cardUnselected]}>
            <CardContent skill={skill} isSelected={isSelected} />
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
});


function SkillSelectionSkeleton() {
  const [loading, setLoading] = React.useState(true);
  return (
    <View style={{ flex: 1, backgroundColor: '#fff', paddingHorizontal: 20 }}>
      {/* Header Skeleton */}
      <View style={{ alignItems: 'center', marginTop: 60, marginBottom: 40 }}>
         <View style={{ width: 100, height: 100, backgroundColor: '#F5F5F5', borderRadius: 20 }} />
         <View style={{ width: 200, height: 30, backgroundColor: '#F5F5F5', marginTop: 20, borderRadius: 10 }} />
      </View>

      {/* Grid Skeleton */}
      {loading && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
          <SkillCardSkeleton />
          <SkillCardSkeleton />
          <SkillCardSkeleton />
          <SkillCardSkeleton />
          <SkillCardSkeleton />
          <SkillCardSkeleton />
        </View>
      )}
      
      {/* Continue Button Skeleton */}
      <View style={{ position: 'absolute', bottom: 40, width: '100%', alignSelf: 'center' }}>
          <View style={{ height: 60, backgroundColor: '#F5F5F5', borderRadius: 30 }} />
      </View>
    </View>
  );
}


// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

const Matchscreen: React.FC<{ onNext: () => void; onBack: () => void }> = ({ onNext, onBack }) => {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set([]));
  const [activeCategory, setActiveCategory] = useState<Category>('Tech');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showLimitMessage, setShowLimitMessage] = useState<boolean>(false);
  const { profile, updateProfile, completeProfile } = useProfile();

  // Toggle skill selection with 3-skill limit
  const toggleSkill = useCallback((id: number): void => {
    setSelectedIds((prev: Set<number>) => {
      const next = new Set(prev);
      
      // If already selected, allow deselecting
      if (next.has(id)) {
        next.delete(id);
        setShowLimitMessage(false);
      } else {
        // Only allow adding if under 3 skills
        if (next.size < 3) {
          next.add(id);
          setShowLimitMessage(false);
        } else {
          // Show limit message when trying to select 4th skill
          setShowLimitMessage(true);
          setTimeout(() => setShowLimitMessage(false), 2500);
        }
      }
      return next;
    });
  }, []);

  // Filter skills by category or search
  const filteredSkills: Skill[] = SKILLS.filter((skill: Skill) => {
    if (searchQuery.trim()) {
      return skill.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return skill.category === activeCategory;
  });

  const selectedCount: number = selectedIds.size;

  const handleContinue = useCallback(async (): Promise<void> => {
    if (selectedCount === 0) return;
    const chosen: Skill[] = SKILLS
      .filter((s: Skill) => selectedIds.has(s.id)); 

    // Save to profile
    await updateProfile({ skills: chosen, profileImage: profile?.profileImage,isProfileComplete: true });
      await new Promise(resolve => setTimeout(resolve, 200));

     router.replace('/(tabs)/home')
  }, [selectedIds, selectedCount, updateProfile, completeProfile]);

  // Typed render function for FlatList
  const renderSkill: ListRenderItem<Skill> = useCallback(
    ({ item }) => {
      const isSelected = selectedIds.has(item.id);
      const isDisabled = !isSelected && selectedIds.size >= 3;
      
      return (
        <SkillCard
          skill={item}
          isSelected={isSelected}
          isDisabled={isDisabled}
          onToggle={toggleSkill}
        />
      );
    },
    [selectedIds, toggleSkill]
  );

  const keyExtractor = useCallback(
    (item: Skill): string => String(item.id),
    []
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f4f4f8" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.logoIcon}>🤝</Text>
        <Text style={styles.title}>Select your skills</Text>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={20} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search skills..."
            placeholderTextColor="#bbb"
            value={searchQuery}
            onChangeText={(text: string) => setSearchQuery(text)}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
        </View>

        {/* Category tabs – hidden while searching */}
        {!searchQuery.trim() && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabs}
            contentContainerStyle={styles.tabsContent}
          >
            {CATEGORIES.map((cat: Category) => {
              const isActive: boolean = activeCategory === cat;
              return isActive ? (
                <LinearGradient
                  key={cat}
                  colors={['#703de7','#7b4ce5', '#7b4ce5']}
                  start={{ x: 0, y: 1 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.tabActive}
                >
                  <TouchableOpacity onPress={() => setActiveCategory(cat)}>
                    <Text style={styles.tabTextActive}>{cat}</Text>
                  </TouchableOpacity>
                </LinearGradient>
              ) : (
                <TouchableOpacity
                  key={cat}
                  style={styles.tabInactive}
                  onPress={() => setActiveCategory(cat)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.tabTextInactive}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* ── Skills Grid ── */}
      <FlatList<Skill>
        data={filteredSkills}
        renderItem={renderSkill}
        keyExtractor={keyExtractor}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No skills found 🔎</Text>
          </View>
        }
      />

      {/* ── Bottom area ── */}
      <View style={styles.bottomArea}>
        {/* Limit reached warning */}
        {showLimitMessage && (
          <View style={styles.limitWarning}>
            <Text style={styles.limitWarningText}>
              ⚠️ Maximum 3 skills allowed. Deselect one to choose another.
            </Text>
          </View>
        )}
        
        <Text style={[styles.countText, selectedCount > 0 && styles.countTextActive]}>
          {selectedCount === 0
            ? 'Select up to 3 skills'
            : selectedCount === 3
            ? '3/3 skills selected (maximum reached)'
            : `${selectedCount}/3 skill${selectedCount > 1 ? 's' : ''} selected`}
        </Text>

        <TouchableOpacity
          onPress={handleContinue}
          disabled={selectedCount === 0}
          activeOpacity={0.85}
        >
          {selectedCount > 0 ? (
            <LinearGradient
              colors={['#6c36ea', '#701be7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.continueBtn}
            >
              <Text style={styles.continueBtnText}>Continue</Text>
            </LinearGradient>
          ) : (
            <View style={[styles.continueBtn, styles.continueBtnDisabled]}>
              <Text style={styles.continueBtnText}>Continue</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default Matchscreen;

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  logoIcon: {
    fontSize: 52,
    textAlign: 'center',
    marginTop: 6,
  },
  title: {
    fontSize: 25,
    fontWeight: '700',
    color: '#1a1a2e',
    textAlign: 'center',
    marginVertical: 8,
    letterSpacing: -0.5,
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 50,
    paddingHorizontal: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
    color: '#838383',
  
  },
  searchInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: '#333',
  },

  // Tabs
  tabs: {
    marginBottom: 14,
    borderRadius:8,
    paddingVertical: 4,
  },
  tabsContent: {
    gap: 8,
    paddingRight: 4,
  },
  tabActive: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 50,
  },
  tabInactive: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 50,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tabTextActive: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  tabTextInactive: {
    fontSize: 14,
    fontWeight: '700',
    color: '#888',
  },

  // Grid
  gridContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,                        

  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  // Cards
  gradientBorder: {
    borderRadius: 22,
    padding: 2.5,
  },
  cardInner: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    paddingTop: 18,
    minHeight: 130,
  },
  card: {
    borderRadius: 20,
    padding: 14,
    paddingTop: 16,
    minHeight: 130,
    position:'relative'
    
  },
  cardUnselected: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.11,
    shadowRadius: 8,
    elevation: 3,
  },

  // Check circle
  checkCircle: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkUnchecked: {
    backgroundColor: '#f0f0f5',
    borderWidth: 2,
    borderColor: '#e5e5eb',
  },
  checkMark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // Skill content
  skillEmoji: {
    fontSize: 38,
    marginTop: 8,
    marginBottom: 8,
  },
  skillName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1a1a2e',
    letterSpacing: -0.2,
    marginTop: 2,
  },

  // Empty state
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#aaa',
  },

  // Bottom
  bottomArea: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    backgroundColor: '#ffffff',
  },
  limitWarning: {
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f5a623',
  },
  limitWarningText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#856404',
    textAlign: 'center',
  },
  countText: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#aaa',
    marginBottom: 10,
  },
  countTextActive: {
    color: '#7b4ce5',
  },
  continueBtn: {
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnDisabled: {
    backgroundColor: '#d0d0dc',
  },
  continueBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});