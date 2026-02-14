import { supabase } from '@/integrations/supabase/client';

/**
 * Returns the current user's access token for authenticated edge function calls.
 * Falls back to the anon key if no session exists (will be rejected by auth-protected endpoints).
 */
export async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
}
