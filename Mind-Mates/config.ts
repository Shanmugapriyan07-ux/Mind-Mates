import { Platform } from 'react-native';

// --- Backend API Configuration ---
// Use 10.0.2.2 for Android emulator to connect to host's localhost.
// For iOS simulator, you can use localhost.
// For physical devices, use your computer's LAN IP address.
const API_URL_ANDROID_EMULATOR = 'http://10.0.2.2:8080/api';
const API_URL_IOS_SIMULATOR = 'http://localhost:8080/api';

// In a real app, you might have a more sophisticated way to set this
  export const API_BASE_URL = Platform.OS === 'android' ? API_URL_ANDROID_EMULATOR : API_URL_IOS_SIMULATOR;

