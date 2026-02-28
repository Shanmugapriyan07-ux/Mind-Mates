import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  FlatList,
} from 'react-native';
import { SafeAreaProvider} from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useProfile } from '@/Contexts/profileContext';
import Entypo from '@expo/vector-icons/Entypo';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AntDesign } from '@expo/vector-icons';
import profileContext from '@/Contexts/profileContext';
import { Item } from 'react-native-paper/lib/typescript/components/Drawer/Drawer';



const ProfileScreen = () => {
  const { profile } = useProfile();

  if (!profile) {
    return (
      <SafeAreaProvider style={s.safe}>
        <View style={[s.safe, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text>Loading profile...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider style={s.safe}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={()=> router.push('/(tabs)/chat')}>
         <AntDesign name="arrow-left" size={20} color='#232529' />
         </TouchableOpacity>
        <Text style={s.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => router.push('/subScreens/Settings')}>
          <Entypo name="dots-three-vertical" size={18} style={{color:'#232529'}} />

        </TouchableOpacity>
      </View>
       <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        
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
            <TouchableOpacity  onPress={()=> router.replace('/subScreens/imageEdit')}>
                       <FontAwesome5 name="user-edit" size={16} style={s.icon}/>
          </TouchableOpacity>
          </View>
          </View>

          {/* Name & Title */}
          <Text style={s.name}>{profile.fullName || 'Your Name'}</Text>
          <Text style={s.title}>{profile.title || 'Your Title'}</Text>

          {/* Location */}
          {profile.location && (
            <View style={s.locationRow}>
              <Ionicons name="location" size={18} color="#000000" style={s.locationIcon} />
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

            <View style={s.statItem}>
              <Text style={s.statValue}>{profile.likes}</Text>
              <Text style={s.statLabel}>Likes</Text>
            </View>
          </View>

        </View> {/* end profileCard */}

        {/* Skills Section */}
        {profile.skills && profile.skills.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Skills</Text>
            <FlatList 
            data={profile.skills}
            keyExtractor={(item)=>item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal:4}}
            renderItem={({item})=>(
            // <View style={s.skillsGrid}>
            //   {profile.skills.map((skill) => (
            //     <View key={skill.id} >
                
                    <View style={[s.card,s.checkUnchecked,{marginRight:12}]} >
                    <Text style={s.skillEmoji}>{item.emoji}</Text>
                    <Text style={s.skillName}>{item.name}</Text>
                  </View>
                // </View>
              )}
              />
            </View>
          // </View>
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
          
          <Text style={s.editButtonText}>Edit Profile</Text>
          
        </TouchableOpacity>

      </ScrollView>

      {/* Bottom Navigation */}
    
    </SafeAreaProvider>
  );
};

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fffefe',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#f3f5f6',
    borderBottomWidth: 1,
  
  },
  headerIcon: {
    fontSize: 22,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#17191b',
    padding:8,
  
    letterSpacing:0.15

  },
  scroll: {
    paddingBottom: 100,
    flexGrow:1,
    marginBottom:200,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 15,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
   card: {
    borderRadius: 20,
    padding: 2,
    paddingTop: 4,
    minHeight: 100,
    position:'relative',
    justifyContent:'space-between',
    alignItems:'center',
  },
  icon:{
    color:'#111827', 
    marginLeft:5,
    marginTop:-3,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 5,
    marginTop:1
  },
  image: {
    width: 115,
    height: 115,
    borderRadius: 65,
  },
  imagePlaceholder: {
    width: 100,
    height: 60,
    borderRadius: 50,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#111827',
  
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIcon: {
    fontSize: 17,
  },
  name: {
    fontSize: 17,
     fontWeight: '500',
    color: '#17191b',
    marginBottom: 4,
    fontFamily:'system'
  },
  title: {
    fontSize: 16,
       fontWeight: '500',
    color: '#17191b',
    marginBottom: 8,
      fontFamily:'system'
   
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginRight:10
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  locationText: {
    fontSize: 14,
       fontWeight: '500',
    color: '#6B7285',
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    fontSize: 18,
      fontWeight: '700',
    color: '#17191b',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
        fontWeight: '500',
    color: '#6B7285',
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
    fontSize: 17,
         fontWeight: '500',
    color: '#17191b',
    marginBottom: 16,
    
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1,
  },
  skillCard: {
    alignItems: 'center',
    width: '30%',
    gap: 19,
    flexDirection:'row',
  },
  skillIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  checkUnchecked: {
    backgroundColor: '#fff',
    justifyContent:'space-between',
    alignItems:'center',
     shadowColor: '#000',
    shadowOffset: { width: 5, height: 9 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderRadius:10,
    borderColor:'#f4f1f1',
    borderWidth:2,
    borderBottomWidth:8,
    borderTopColor:'#f5f3f3'
  },
 

  // Skill content
  skillEmoji: {
    fontSize: 38,
    marginBottom: 6,
    padding:15
  },
  skillName: {
    letterSpacing: -0.2,
  marginTop:-14,
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 10,
   fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft:6,
    marginRight:6
  },

  bioText: {
    lineHeight: 22,
      fontSize: 14,
    fontWeight: '400',
   color: '#1F2937',
    
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
    fontWeight: '500',
    color: '#1F2937',
  
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
