// lib/supabase.ts — Web-safe Supabase client
// FIX: window is not defined → use localStorage on web, AsyncStorage on native

import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL  = process.env.EXPO_PUBLIC_SUPABASE_URL  ?? '';
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// ── Storage adapter for session + token persistence ──────────────────
// CRITICAL: Without this, refresh tokens won't persist and users 
// get logged out after app restart ❌
const getStorage = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    return {
      getItem:    (key: string) => Promise.resolve(localStorage.getItem(key)),
      setItem:    (key: string, value: string) => Promise.resolve(localStorage.setItem(key, value)),
      removeItem: (key: string) => Promise.resolve(localStorage.removeItem(key)),
    };
  }

  if (Platform.OS !== 'web') {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return AsyncStorage;
  }

  return undefined;
};

const authOptions: any = {
  autoRefreshToken:   true,
  persistSession:     true,
  detectSessionInUrl: Platform.OS === 'web',
};

const authStorage = getStorage();
if (authStorage) authOptions.storage = authStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: authOptions,
});

// Named exports for backward compatibility
export const databases = supabase;
export const client    = supabase;
export const account   = supabase.auth;
export const storage   = supabase.storage;
export const functions = supabase.functions;

// Stub Query class so old code that imports Query still compiles
// Replace Query.equal('field', val) with .eq('field', val) in each file
export class Query {
  static equal   = (f: string, v: any) => ({ type: 'eq',  field: f, value: v });
  static notEqual = (f: string, v: any) => ({ type: 'neq', field: f, value: v });
  static limit   = (n: number)          => ({ type: 'limit', value: n });
  static orderDesc = (f: string)        => ({ type: 'order', field: f, asc: false });
  static greaterThan = (f: string, v: any) => ({ type: 'gt', field: f, value: v });
  static search  = (f: string, v: string) => ({ type: 'search', field: f, value: v });
  static offset  = (n: number)          => ({ type: 'offset', value: n });
  static cursorAfter = (id: string)     => ({ type: 'cursor', value: id });
}

// Stub ID for old code
export const ID = {
  unique: () => crypto.randomUUID(),
};

// Config (same shape as Appwrite)
export const config = {
  supabaseUrl:               SUPABASE_URL,
  supabaseAnonKey:           SUPABASE_ANON,
  databaseId:                'public',
  projectId:                 SUPABASE_URL,
  usersCollectionId:         'users',
  connectionsCollectionId:   'connections',
  chatsCollectionId:         'chats',
  messagesCollectionId:      'messages',
  notificationsCollectionId: 'notifications',
  blocksCollectionId:        'blocks',
  connectionFunctionId:      'mindmates',
  getMatchesFnId:            'mindmates',
};

export const TABLES = {
  users:         'users',
  connections:   'connections',
  chats:         'chats',
  messages:      'messages',
  notifications: 'notifications',
  blocks:        'blocks',
};

// Auth helpers
export const signUp = async (email: string, password: string, name: string) => {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: name } },
  });
  if (error) throw new Error(error.message);
  return data;
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
};

export const googleLogin = async (): Promise<any> => {
  const redirectUrl = Platform.OS === 'web'
    ? `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/auth-callback`
    : 'mindmates://auth-callback';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectUrl },
  });
  if (error) throw new Error(error.message);
  return data;
};

export const prewarmGoogleOAuth = () => {};

export const subscribeToTable = (
  table:    string,
  event:    'INSERT' | 'UPDATE' | 'DELETE' | '*',
  filter:   string | undefined,
  callback: (payload: any) => void,
): (() => void) => {
  const channel = supabase
    .channel(`rt_${table}_${Date.now()}`)
    .on('postgres_changes' as any,
      { event, schema: 'public', table, ...(filter ? { filter } : {}) },
      callback)
    .subscribe();
  return () => supabase.removeChannel(channel);
};

export default supabase;