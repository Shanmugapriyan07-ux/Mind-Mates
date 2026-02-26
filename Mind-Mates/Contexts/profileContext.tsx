// context/ProfileContext.js
// Global state management for user profile

import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Profile {
  fullName: string;
  title: string;
  location: string;
  bio: string;
  profileImage: string | null;
  skills: any[];
  connections: number;
  matchins: number;
  rating: number;
  isProfileComplete: boolean;
}

interface ProfileContextType {
  profile: Profile;
  loading: boolean;
  updateProfile: (updates: Partial<Profile>) => Promise<boolean>;
  completeProfile: () => Promise<void>;
  addSkill: (skill: any) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider = ({ children }: { children: React.ReactNode }) => {
  const [profile, setProfile] = useState<Profile>({
    // Basic Info
    fullName: '',
    title: '',
    location: '',
    bio: '',
    
    // Profile Image
    profileImage: null,
    
    // Skills (array of objects)
    skills: [],
    
    // Tech Stack (array of strings)
 
    
    // Stats
    connections: 0,
  
    matchins: 0,
    rating: 0,
    
    // Setup status
    isProfileComplete: false,
  });

  const [loading, setLoading] = useState(true);

  // Load profile from AsyncStorage on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const savedProfile = await AsyncStorage.getItem('userProfile');
      if (savedProfile) {
        setProfile(JSON.parse(savedProfile));
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update profile data
  const updateProfile = async (updates: Partial<Profile>): Promise<boolean> => {
    try {
      const updatedProfile = { ...profile, ...updates };
      setProfile(updatedProfile);
      
      // Save to AsyncStorage
      await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));
      
      return true;
    } catch (error) {
      console.error('Error updating profile:', error);
      return false;
    }
  };

  // Mark profile as complete
  const completeProfile = async (): Promise<void> => {
    await updateProfile({ isProfileComplete: true });
  };

  // Reset profile (useful for testing)
 

  // Add skill
  const addSkill = async (skill: any): Promise<void> => {
    const updatedSkills = [...profile.skills, skill];
    await updateProfile({ skills: updatedSkills });
  };

  // Remove skill


  // Add tech to stack
  

  // Remove tech from stack


  const value: ProfileContextType = {
    profile,
    loading,
    updateProfile,
    completeProfile,
    addSkill,
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};

// Custom hook to use profile context
export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return context;
};

export default ProfileContext;