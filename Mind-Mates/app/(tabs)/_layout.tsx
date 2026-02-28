import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';

// 🔑 The floating blur tab bar rendered as a custom tabBar prop
function FloatingBlurTabBar({ state, descriptors, navigation }: any) {
  return (
    <View style={styles.outerWrapper} pointerEvents="box-none">
      <BlurView intensity={70} tint="light" style={styles.blurContainer}>
        <View style={styles.tabRow}>
          {state.routes.map((route: any, index: number) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            const iconMap: Record<string, { active: string; inactive: string }> = {
              home:    { active: 'home-sharp',          inactive: 'home-outline' },
              search:  { active: 'search-sharp',       inactive: 'search-outline' },
              chat:    { active: 'people-sharp',       inactive: 'people-outline' },
              profile: { active: 'person-sharp',       inactive: 'person-outline' },
            };

            const icons = iconMap[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline' };
            const label = options.title ?? route.name;
            const color = isFocused ? '#7C3AED' : '#9CA3AF';

            const onPress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <View key={route.key} style={styles.tabItem}>
                {/* Active pill highlight */}
                {isFocused && <View style={styles.activePill} />}

                <Ionicons
                  name={(isFocused ? icons.active : icons.inactive) as any}
                  size={24}
                  color={color}
                  onPress={onPress}
                  style={styles.icon}
                />
              </View>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Hide the default tab bar — we use our custom one
        tabBarStyle: { display: 'none' },
      }}
      tabBar={(props:any) => <FloatingBlurTabBar {...props} />}
    >
      <Tabs.Screen name="home"    options={{ title: 'Home' }} />
      <Tabs.Screen name="search"  options={{ title: 'Search' }} />
      <Tabs.Screen name="chat"    options={{ title: 'Chat' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const BAR_HEIGHT = 64;
const BOTTOM_OFFSET = Platform.OS === 'ios' ? 28 : 16;

const styles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    bottom: BOTTOM_OFFSET,
    left: 24,
    right: 24,
    // Floating shadow
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 20,
    borderRadius: 32,
  },
  blurContainer: {
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.25)', // fallback for Android
  },
  tabRow: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: BAR_HEIGHT,
    position: 'relative',
  },
  activePill: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
  },
  icon: {
    zIndex: 1,
  },
});


