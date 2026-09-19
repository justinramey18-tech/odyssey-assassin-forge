import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { SCOPED_KEYS } from '@/lib/scoped-keys';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    
    return { data, error };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    // Let the auto-save hook push anything still pending before local data is wiped.
    try {
      const pending: Promise<unknown>[] = [];
      window.dispatchEvent(new CustomEvent('odyssey-flush-cloud-sync', {
        detail: { register: (p: Promise<unknown>) => pending.push(p) },
      }));
      if (pending.length > 0) {
        await Promise.race([
          Promise.allSettled(pending),
          new Promise(resolve => setTimeout(resolve, 5000)),
        ]);
      }
    } catch { /* best effort */ }

    // Clear all character-scoped localStorage to prevent data bleed between accounts
    try {
      const allKeys = Object.keys(localStorage);
      for (const lsKey of allKeys) {
        // Clear scoped keys (e.g., "odyssey-hp-state::saveId") and their unscoped versions
        const isScoped = SCOPED_KEYS.some(sk => lsKey === sk || lsKey.startsWith(`${sk}::`));
        if (isScoped) {
          localStorage.removeItem(lsKey);
        }
      }
      // Clear the active cloud save pointer
      localStorage.removeItem('odyssey-active-cloud-save-id');
      console.log('[Auth] Cleared all character data on sign-out');
    } catch (e) {
      console.error('[Auth] Failed to clear character data on sign-out:', e);
    }

    const { error } = await supabase.auth.signOut();
    return { error };
  }, []);

  return {
    user,
    session,
    loading,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signOut,
  };
}
