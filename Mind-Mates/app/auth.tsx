import { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { account } from '@/lib/appwrite';
import { useAuth } from '@/Contexts/authContext';

export default function AuthCallback() {
  const params = useLocalSearchParams();
  const { login: contextLogin } = useAuth();

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      console.log('🔐 OAuth callback starting...');
      
      // Get OAuth credentials from URL
      const { userId, secret } = params;

      if (!userId || !secret) {
        throw new Error('Missing OAuth parameters');
      }

      console.log('✅ OAuth credentials found');

      // Create session
      const session = await account.createSession(
        userId as string,
        secret as string
      );
      console.log('✅ Session created');

      // Get user data
      const [jwtObj, user] = await Promise.all([
        account.createJWT(),
        account.get(),
      ]);
      console.log('✅ User data fetched:', user.name);

      // Update context
      await contextLogin(
        { id: user.$id, name: user.name, email: user.email },
        jwtObj.jwt,
        session.$id
      );
      console.log('✅ Context updated');

      // Wait for state
      await new Promise(resolve => setTimeout(resolve, 300));

      router.replace('/(profileSetUp)/BasicInfo');

    } catch (error: any) {
      console.error('❌ OAuth callback error:', error);
      // Redirect to welcome on error
      router.replace('/(auth)/Welcome');
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#7C3AED" />
      <Text style={styles.text}>Completing sign in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  text: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a2e',
  },
});
