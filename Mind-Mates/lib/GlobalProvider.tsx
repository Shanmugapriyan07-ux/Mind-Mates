import React, { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { account, getUser } from "./appwrite";
import { useAppwrite } from "./useAppwrite";

// 1. Define the User Type clearly
interface User {
  $id: string;
  name: string;
  email: string;
  avatar: string;
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
  // Use your custom hook to fetch the user. 
  // It handles the loading state and the initial fetch automatically.
  const {
    data: user,
    loading,
    refetch,
  } = useAppwrite({
    fn: getUser,
  });

  // Calculate isLogged based on whether user data exists
  const isLogged = !!user;

  return (
    <GlobalContext.Provider
      value={{
        isLogged,
        user: user as User | null,
        loading,
        refetch: (newParams?: Record<string, string | number>) => refetch(newParams || {}),
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
};

// 3. Export the hook separately (This was mixed up in your code)


export default GlobalProvider;