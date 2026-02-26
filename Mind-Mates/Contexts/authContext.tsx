import React, { createContext, useState, useContext, useEffect, ReactNode, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { account } from '@/lib/appwrite';
import { AppState, AppStateStatus } from 'react-native';
import Toast from 'react-native-toast-message';
import { router, Router } from 'expo-router';
// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  // State
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setIsLoggedIn: (value: boolean) => void;
  login: (userData: User, token: string, sessionId?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
 // Inside your AuthProvider
const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
const [isLoading, setIsLoading] = useState<boolean>(true);

const checkAuth = async () => {
  try {
    // 1. Check local storage FIRST (This takes ~10ms)
    const savedUser = await AsyncStorage.getItem('userToken');
    
    if (savedUser) {
      // 2. Trust it and show the dashboard immediately
      setIsLoggedIn(true);
      setIsLoading(false); 
      
      // 3. Verify in the background (Silent Check)
      account.get().catch(() => {
        // If the session actually expired, log them out quietly
        logout();
      });
    } else {
      setIsLoggedIn(false);
      setIsLoading(false);
    }
  } catch (e) {
    setIsLoading(false);
  }
};

useEffect(() => {
  checkAuth();
}, []);

  // Login - saves data and updates state
  const login = async (
    userData: User,
    token: string,
    sessionId?: string
  ): Promise<void> => {
    try {
      console.log('🔑 AuthContext: Logging in user:', userData.name);

      const dataToSave: [string, string][] = [
        ['userId', userData.id],
        ['userName', userData.name],
        ['userEmail', userData.email],
        ['userToken', token],
        ['isLoggedIn', 'true'],
      ];

      if (sessionId) {
        dataToSave.push(['sessionId', sessionId]);
      }

       AsyncStorage.multiSet(dataToSave);

      // Update state IMMEDIATELY (this is the key!)
      setUser(userData);
      setIsLoggedIn(true);

      console.log('✅ AuthContext: Login successful');
    } catch (error) {
      console.error('❌ AuthContext: Login error:', error);
      throw error;
    }
  };
  const appState = useRef(AppState.currentState);

//   useEffect(() => {
//   const subscription = AppState.addEventListener('change', nextAppState => {
//     // Check if the app is coming from background to the foreground
//     if (
//       appState.current.match(/inactive|background/) &&
//       nextAppState === 'active'
//     ) {
//       console.log('📱 App has come to the foreground. Refreshing session...');
//       handleSilentRefresh();
//     }

//     appState.current = nextAppState;
//   });

//   return () => {
//     subscription.remove();
//   };
// }, []);

// const handleSilentRefresh = async () => {
//   try {
//     // 1. Quick "Heartbeat" check to see if session is still valid
//     const user = await account.get();
    
//     // 2. If valid, silently generate a new JWT to keep the "pipe" fresh
//     const jwt = await account.createJWT();
    
//     // 3. Update your context/storage with the new JWT
//     // This prevents "Unauthorized" errors on your next API call
//     console.log('✅ Session verified and JWT refreshed');
    
//   } catch (error) {
//     console.error('❌ Session expired during background sleep:', error);
    
//     // 4. Clean Logout: If the session is dead, don't let them stay on the dashboard
//     logout(); // Call your existing logout function
//     router.replace('/Screens/Welcome');
    
//     Toast.show({
//       type: 'info',
//       text1: 'Session Expired',
//       text2: 'Please login again to continue.',
//     });
//   }
// };

  // Logout - clears everything
  const logout = async (): Promise<void> => {
  try {
    console.log('🚪 Logging out...');

    // 1. Delete Appwrite session
    try {
      await account.deleteSession('current');
    } catch (e) {
      console.log('⚠️  No Appwrite session');
    }

    // 2. Clear AsyncStorage
    await AsyncStorage.multiRemove([
      'userId',
      'userName',
      'userEmail',
      'userToken',
      'sessionId',
      'isLoggedIn',
    ]);

    // 3. Clear context state (THIS IS KEY!)
    setUser(null);
    setIsLoggedIn(false);  // ← MUST set to false!

    console.log('✅ Logout complete');
  } catch (error) {
    console.error('❌ Logout error:', error);
    // Even if error, clear state
    setUser(null);
    setIsLoggedIn(false);
  }
};

  const value: AuthContextType = {
    user,
    isLoggedIn,
    isLoading,
    setUser,
    setIsLoggedIn,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const apiRequest = async (requestFn: Function) => {
  try {
    return await requestFn();
  } catch (error: any) {
    if (error.code === 401) {
      // Logic for unauthorized:
      // You can export a 'globalLogout' function to call here
      console.log("Global Interceptor: Token expired, redirecting...");
      triggerGlobalLogout(); 
    }
    throw error;
  }
};
// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

export { AuthContext };
export type { User, AuthContextType };

  function triggerGlobalLogout() {
    throw new Error('Function not implemented.');
  }

