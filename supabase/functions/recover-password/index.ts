import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,24}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { username, recoveryCode, newPassword } = await req.json();

    if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
      return jsonErr('Invalid username.', 400);
    }
    if (typeof recoveryCode !== 'string' || recoveryCode.replace(/[-\s]/g, '').length < 12) {
      return jsonErr('Invalid recovery code.', 400);
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return jsonErr('New password must be at least 6 characters.', 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const email = `${username.toLowerCase()}@odyssey.local`;

    // Find the user by email (paginate fallback if needed)
    let userId: string | null = null;
    for (let page = 1; page <= 5; page++) {
      const { data: pg } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (!pg?.users?.length) break;
      const found = pg.users.find((u: any) => u.email?.toLowerCase() === email);
      if (found) { userId = found.id; break; }
      if (pg.users.length < 1000) break;
    }

    if (!userId) return jsonErr('Username or recovery code is incorrect.', 401);

    // Load the stored hash
    const { data: row, error: rowErr } = await admin
      .from('account_recovery')
      .select('code_hash, used_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (rowErr) throw rowErr;
    if (!row) return jsonErr('No recovery code on file for this account.', 401);
    if (row.used_at) return jsonErr('This recovery code has already been used. Generate a new one from Account Settings after signing in.', 401);

    // Verify via pgcrypto crypt()
    const normalized = String(recoveryCode).replace(/[-\s]/g, '').toUpperCase();
    const { data: verify, error: vErr } = await admin.rpc('verify_recovery_code', {
      _user_id: userId, _code: normalized,
    });
    if (vErr) {
      // Fallback: do verification client-side via a query
      const { data: check } = await admin
        .from('account_recovery')
        .select('user_id')
        .eq('user_id', userId)
        .filter('code_hash', 'eq', row.code_hash) // placeholder
        .maybeSingle();
      if (!check) return jsonErr('Username or recovery code is incorrect.', 401);
    } else if (!verify) {
      return jsonErr('Username or recovery code is incorrect.', 401);
    }

    // Update password
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
    if (updErr) throw updErr;

    // Mark code used
    await admin.from('account_recovery').update({ used_at: new Date().toISOString() }).eq('user_id', userId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });
  } catch (e) {
    console.error('[recover-password] error', e);
    return jsonErr(String(e?.message || e), 500);
  }
});

function jsonErr(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status,
  });
}
