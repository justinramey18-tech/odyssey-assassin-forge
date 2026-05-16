import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,24}$/;

async function hashCode(code: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(saltHex + ':' + code);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function jsonErr(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { username, recoveryCode, newPassword } = await req.json();

    if (typeof username !== 'string' || !USERNAME_RE.test(username)) return jsonErr('Invalid username.', 400);
    if (typeof recoveryCode !== 'string' || recoveryCode.replace(/[-\s]/g, '').length < 12) return jsonErr('Invalid recovery code.', 400);
    if (typeof newPassword !== 'string' || newPassword.length < 6) return jsonErr('New password must be at least 6 characters.', 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const email = `${username.toLowerCase()}@odyssey.local`;

    let userId: string | null = null;
    for (let page = 1; page <= 5; page++) {
      const { data: pg } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (!pg?.users?.length) break;
      const found = pg.users.find((u: any) => u.email?.toLowerCase() === email);
      if (found) { userId = found.id; break; }
      if (pg.users.length < 1000) break;
    }
    if (!userId) return jsonErr('Username or recovery code is incorrect.', 401);

    const { data: row, error: rowErr } = await admin
      .from('account_recovery')
      .select('code_hash, used_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (rowErr) throw rowErr;
    if (!row) return jsonErr('No recovery code on file for this account.', 401);
    if (row.used_at) return jsonErr('This recovery code has already been used. Generate a new one from Account Settings after signing in.', 401);

    const [salt, storedHash] = String(row.code_hash).split(':');
    if (!salt || !storedHash) return jsonErr('Recovery data is corrupted. Contact support.', 500);

    const normalized = String(recoveryCode).replace(/[-\s]/g, '').toUpperCase();
    const computed = await hashCode(normalized, salt);
    if (computed !== storedHash) return jsonErr('Username or recovery code is incorrect.', 401);

    const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
    if (updErr) throw updErr;

    await admin.from('account_recovery').update({ used_at: new Date().toISOString() }).eq('user_id', userId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });
  } catch (e) {
    console.error('[recover-password]', e);
    return jsonErr(String(e?.message || e), 500);
  }
});
