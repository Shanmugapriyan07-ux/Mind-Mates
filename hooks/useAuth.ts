import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  provider: string;
}
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState('initializing');
  const [isSigningIn] = useState(false);
  const [error, setError] = useState(null);
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    initAuth();
    return () => {
      isMounted.current = false;
    };
  }, []);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted.current) return;
        if (session?.user) {
          setUser(mapUser(session.user));
          setStatus('authenticated');
        } else {
          setUser(null);
          setStatus('unauthenticated');
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);
  async function initAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      if (isMounted.current) {
        setUser(mapUser(session.user));
        setStatus('authenticated');
      }
      return;
    }
    const { data: { session: silentSession } } = await supabase.auth.getSession();
    if (silentSession?.user && isMounted.current) {
      setUser(mapUser(silentSession.user));
      setStatus('authenticated');
      return;
    }
    if (isMounted.current) {
      setStatus('unauthenticated');
    }
  }
  return {
    user,
    status,         
    isSigningIn,     
    error,
    clearError: () => setError(null),
  };
}
function mapUser(supabaseUser: any) {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    name: supabaseUser.user_metadata?.full_name ?? supabaseUser.user_metadata?.name ?? null,
    avatar: supabaseUser.user_metadata?.avatar_url ?? supabaseUser.user_metadata?.picture ?? null,
    provider: 'google',
  };
}