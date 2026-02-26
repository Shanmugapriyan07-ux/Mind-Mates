import { useEffect } from 'react';
import { router } from 'expo-router';
import { useGlobalContext } from '@/lib/GlobalProvider';
import { View, ActivityIndicator } from 'react-native';


export default function Index() {
  const { isLogged, loading } = useGlobalContext();

  useEffect(() => {
    if (loading) return; // Wait for auth check

    if (isLogged) {
      router.replace('/(profileSetUp)/BasicInfo'); // Already logged in
    } else {
      router.replace('/(auth)/Welcome');             // First time / logged out
    }
  }, [isLogged, loading]);

  // Show nothing while deciding
  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
      <ActivityIndicator />
    </View>
  );
}


