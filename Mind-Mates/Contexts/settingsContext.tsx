// Contexts/settingsContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useState, useEffect } from 'react';
import { useGlobalContext } from '@/lib/GlobalProvider';
import { userKey } from '@/lib/persistentStorage';

interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notificationsEnabled: boolean;
  emailUpdates: boolean;
  privateProfile: boolean;
  fontSize: 'small' | 'medium' | 'large';
}

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'light',
  language: 'en',
  notificationsEnabled: true,
  emailUpdates: false,
  privateProfile: false,
  fontSize: 'medium',
};

const SettingsContext = createContext<any>(null);

export const SettingsProvider = ({ children }) => {
  const { user } = useGlobalContext();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings when user logs in — their personal settings come back ✅
  useEffect(() => {
    if (!user?.$id) {
      setSettings(DEFAULT_SETTINGS);
      setIsLoading(false);
      return;
    }
    loadSettings();
  }, [user?.$id]);

  const loadSettings = async () => {
    try {
      const key = userKey(user!.$id).settings;
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        // Merge with defaults in case new settings were added in app update
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = async <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    if (!user?.$id) return;

    const updated = { ...settings, [key]: value };
    setSettings(updated); // optimistic update

    // Save forever under user's ID
    await AsyncStorage.setItem(
      userKey(user.$id).settings,
      JSON.stringify(updated)
    );
    console.log(`✅ Setting saved: ${key} = ${value}`);
  };

  return (
    <SettingsContext.Provider value={{ settings, isLoading, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);