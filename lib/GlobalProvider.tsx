import React, { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { supabase } from "./supabase";
import type { Session } from '@supabase/supabase-js';
interface User {
  $id: string;
  name: string;
  email: string;
  Avatar: String;
}
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
    let unsubscribe: (() => void) | null = null;
    const setupAuth = async () => {
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
export default GlobalProvider;