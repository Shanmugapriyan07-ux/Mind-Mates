import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_URL_ANDROID_EMULATOR = 'http://10.0.2.2:8080/api';
const API_URL_IOS_SIMULATOR = 'http://localhost:8080/api';
const debuggerHost = Constants.expoConfig?.hostUri?.split(':')[0];
const API_URL_PHYSICAL = `http://${debuggerHost}:8080/api`;

export const API_BASE_URL = Platform.select({
  android: __DEV__ ? API_URL_ANDROID_EMULATOR : API_URL_PHYSICAL,
  ios: __DEV__ ? API_URL_IOS_SIMULATOR : API_URL_PHYSICAL,
});
