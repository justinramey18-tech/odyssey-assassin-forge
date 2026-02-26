import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const IDB_DB_NAME = 'assassins-ledger-auth';
const IDB_STORE_NAME = 'session-flags';
const IDB_KEY = 'was-signed-in';

/**
 * IndexedDB helpers for tracking "was previously signed in" state.
 * IndexedDB is more durable than localStorage on iOS standalone PWAs.
 */
function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function setWasSignedIn(value: boolean): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
    const store = tx.objectStore(IDB_STORE_NAME);
    store.put(value, IDB_KEY);
    db.close();
  } catch {
    // Silent fail — IndexedDB may not be available
  }
}

async function getWasSignedIn(): Promise<boolean> {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const request = store.get(IDB_KEY);
      request.onsuccess = () => {
        db.close();
        resolve(request.result === true);
      };
      request.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (session?.user) {
          // User is signed in — record this in IndexedDB
          setSessionExpired(false);
          await setWasSignedIn(true);
        } else if (event === 'SIGNED_OUT') {
          // Explicit sign-out — clear the flag
          setSessionExpired(false);
          await setWasSignedIn(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (!session) {
        // No session — check if user was previously signed in (iOS PWA session loss)
        const wasSignedIn = await getWasSignedIn();
        if (wasSignedIn) {
          setSessionExpired(true);
        }
      } else {
        await setWasSignedIn(true);
      }

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
    
    if (data?.session) {
      setSessionExpired(false);
      await setWasSignedIn(true);
    }
    
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      await setWasSignedIn(false);
      setSessionExpired(false);
    }
    return { error };
  }, []);

  return {
    user,
    session,
    loading,
    isAuthenticated: !!user,
    sessionExpired,
    signUp,
    signIn,
    signOut,
  };
}
