import React, { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { supabase } from "./supabase";
import type { Session } from '@supabase/supabase-js';


// 1. Define the User Type clearly
interface User {
  $id: string;
  name: string;
  email: string;
  Avatar: String;
}

// 2. Define the Context Shape
interface GlobalContextType {
  isLogged: boolean;
  user: User | null;
  loading: boolean;
  refetch: (newParams?: Record<string, string | number>) => Promise<void>;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

interface GlobalProviderProps {
  children: ReactNode;
}
export const useGlobalContext = (): GlobalContextType => {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error("useGlobalContext must be used within a GlobalProvider");
  }
  return context;
};

export const GlobalProvider = ({ children }: GlobalProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for session to be restored from AsyncStorage first
    let unsubscribe: (() => void) | null = null;
    
    const setupAuth = async () => {
      // First, try to get the session that was restored from storage
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const u = session.user;
        setUser({
          $id: u.id,
          name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email ?? '',
          email: u.email ?? '',
          Avatar: '',
        });
      } else {
        setUser(null);
      }
      setLoading(false);

      // Listen for future auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event, session: Session | null) => {
          if (session?.user) {
            const u = session.user;
            setUser({
              $id: u.id,
              name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email ?? '',
              email: u.email ?? '',
              Avatar: '',
            });
          } else {
            setUser(null);
          }
        }
      );
      unsubscribe = () => subscription.unsubscribe();
    };

    setupAuth();
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const isLogged = !!user;

  return (
    <GlobalContext.Provider
      value={{
        isLogged,
        user: user as User | null,
        loading,
        refetch: async () => {
          const { data: { user: u } } = await supabase.auth.getUser();
          if (u) {
            setUser({
              $id: u.id,
              name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email ?? '',
              email: u.email ?? '',
              Avatar: '',
            });
          }
        },
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
};

// 3. Export the hook separately (This was mixed up in your code)


export default GlobalProvider;