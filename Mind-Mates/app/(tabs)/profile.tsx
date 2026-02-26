
import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaProvider} from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useProfile } from '@/Contexts/profileContext';
import Entypo from '@expo/vector-icons/Entypo';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';

const ProfileScreen = () => {
  const { profile } = useProfile();

  return (
    <SafeAreaProvider style={s.safe}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => router.push('/subScreens/Settings')}>
          <Entypo name="dots-three-vertical" size={24} color="black" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* Profile Card */}
        <View style={s.profileCard}>
          
          {/* Profile Image with edit badge */}
          <View style={s.imageContainer}>
            {profile.profileImage ? (
              <Image source={{ uri: profile.profileImage }} style={s.image} />
            ) : (
              <View style={s.imagePlaceholder}>
                <Text style={s.imagePlaceholderText}>
                  {profile.fullName?.charAt(0) || '?'}
                </Text>
              </View>
            )}
            <View style={s.editBadge}>
            <TouchableOpacity>
              <Text style={s.editIcon} onPress={()=> router.replace('/subScreens/imageEdit')}>✏️</Text>
          </TouchableOpacity>
          </View>
          </View>

          {/* Name & Title */}
          <Text style={s.name}>{profile.fullName || 'Your Name'}</Text>
          <Text style={s.title}>{profile.title || 'Your Title'}</Text>

          {/* Location */}
          {profile.location && (
            <View style={s.locationRow}>
              <Text style={s.locationIcon}>📍</Text>
              <Text style={s.locationText}>{profile.location}</Text>
            </View>
          )}

          {/* Stats Row */}
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statValue}>{profile.connections}</Text>
              <Text style={s.statLabel}>Connections</Text>
            </View>
          
            <View style={s.statItem}>
              <Text style={s.statValue}>{profile.matchins}</Text>
              <Text style={s.statLabel}>Matchings</Text>
            </View>
            {/* <View style={s.statItem}>
              <Text style={s.statValue}>{profile.likes}</Text>
              <Text style={s.statLabel}>likes</Text>
            </View>
          

          {/* Tech Stack Pills */}
          </View>
    

        </View>

        {/* Skills Section */}
        {profile.skills && profile.skills.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Skills</Text>
            
            <View style={s.skillsGrid}>
              {profile.skills.map((skill) => (
                <View key={skill.id} style={s.skillCard}>
                  <View style={[
                    s.skillIcon,
                    { backgroundColor: getSkillColor(skill.name) }
                  ]}>
                    <Text style={s.skillEmoji}>{skill.icon || '💡'}</Text>
                  </View>
                  <Text style={s.skillName}>{skill.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Bio Section */}
        {profile.bio && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>About</Text>
            <Text style={s.bioText}>{profile.bio}</Text>
          </View>
        )}

        {/* Edit Profile Button */}
        <TouchableOpacity style={s.editButton} onPress={()=> router.replace('/subScreens/editProfile')}>
          <FontAwesome5 name="user-edit" size={24} color="black" />
          <Text style={s.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Bottom Navigation */}
    
    </SafeAreaProvider>
  );
};

// Helper function for skill colors
const getSkillColor = (skillName: string) => {
  const colors: Record<string, string> = {
    'React Native': '#7C3AED',
    'JavaScript': '#F59E0B',
    'UI/UX Design': '#8B5CF6',
    'Node.js': '#22C55E',
    'Python': '#3B82F6',
  };
  return colors[skillName] || '#6B7280';
};

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  headerIcon: {
    fontSize: 22,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    padding:8
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  imagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIcon: {
    fontSize: 14,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#6B7280',
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
 
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  skillCard: {
    alignItems: 'center',
    width: '30%',
  },
  skillIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  skillEmoji: {
    fontSize: 28,
  },
  skillName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  bioText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  editIcon2: {
    fontSize: 18,
    marginRight: 8,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  navItemActive: {
    // Active state styling
  },
  navIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  navLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  navLabelActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },
});

export default ProfileScreen;




  // <View style={s.bottomNav}>
  //       <TouchableOpacity style={s.navItem}>
  //         <Text style={s.navIcon}>🏠</Text>
  //         <Text style={s.navLabel} onPress={()=> router.replace('/(tabs)/home')}>Home</Text>
  //       </TouchableOpacity>
  //       <TouchableOpacity style={s.navItem}>
  //         <Text style={s.navIcon}>🔍</Text>
  //         <Text style={s.navLabel} onPress={()=> router.replace('/(tabs)/search')}>Search</Text>
  //       </TouchableOpacity>
  //       <TouchableOpacity style={s.navItem}>
  //         <Text style={s.navIcon}>💬</Text>
  //         <Text style={s.navLabel} onPress={()=> router.replace('/(tabs)/chat')}>Chat</Text>
  //       </TouchableOpacity>
  //       <TouchableOpacity style={[s.navItem, s.navItemActive]}>
  //         <Text style={s.navIcon}>👤</Text>
  //         <Text style={[s.navLabel, s.navLabelActive]} onPress={()=> router.replace('/(tabs)/profile')}>Profile</Text>
  //       </TouchableOpacity>