import React, { createContext, useContext, ReactNode, useState } from "react";
import { supabase } from "./supabase";
interface User {
  $id: string;
  name: string;
  email: string;
  Avatar: string;
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
  const [loading] = useState(true);
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