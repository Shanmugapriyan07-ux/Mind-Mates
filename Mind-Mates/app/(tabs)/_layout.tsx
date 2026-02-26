// app/(tabs)/_layout.js
// TABS LAYOUT - Main App Navigation
// ✅ Bottom tab bar like Instagram/Twitter
// ✅ Optimized performance
// ✅ Beautiful icons

import { Tabs } from 'expo-router';
import { Platform, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { size } from 'zod';
import { Ionicons } from '@expo/vector-icons';


export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#7C3AED',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
          height: Platform.OS === 'ios' ? 88 : 60,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
          
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }: { color: string; size: number; focused:Boolean }) => (
            <Ionicons name={focused ? 'home-sharp' : 'home-outline'} color={color} size={size} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size, focused}: {color:string; size: number; focused:boolean})=> (
            <Ionicons name={focused ? 'search-circle' : 'search-outline'} color={color} size={size} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="chat"
        options={{
          title: 'chat',
          tabBarIcon: ({ color, size, focused}: {color:string; size: number; focused:boolean}) => (
            <Ionicons name={focused ? 'people-circle' : 'people-outline'} color={color} size={size} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
         tabBarIcon: ({ color, size, focused}: {color:string; size: number; focused:boolean})=> (
            <Ionicons name={focused ? 'person-circle' : 'person-outline'} color={color} size={size} />
          ),
        }}
      />
      
    </Tabs>
  );
}

// Simple icon component (you can replace with react-native-vector-icons)
interface TabIconProps {
  name: 'home' | 'search' | 'chat' | 'profile';
  color: string;
  size?: number;
}
function TabIcon({ name, color, size = 24 }: TabIconProps) {
  const icons = {
    home: <Ionicons name="home-sharp" color={color} size={size} />,
    search: <Ionicons name="search-sharp" color={color} size={size} />,
    chat: <Ionicons name="chatbubble-ellipses-sharp" color={color} size={size} />,
    profile: <Ionicons name="person-circle-sharp" color={color} size={size} />,
  };
  
  return (
    <SafeAreaProvider>
    <Text style={{ fontSize: size, color }}>
      {icons[name]}
    </Text>
    </SafeAreaProvider>
  );
}