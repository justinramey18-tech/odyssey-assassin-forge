import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function hashCode(code: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(saltHex + ':' + code);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { code } = await req.json();
    if (typeof code !== 'string' || code.replace(/[-\s]/g, '').length < 12) {
      return new Response(JSON.stringify({ error: 'Invalid code' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userData?.user) return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const normalized = code.replace(/[-\s]/g, '').toUpperCase();
    const salt = randomSalt();
    const hash = await hashCode(normalized, salt);
    const stored = `${salt}:${hash}`;

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { error } = await admin.from('account_recovery').upsert({
      user_id: userData.user.id,
      code_hash: stored,
      created_at: new Date().toISOString(),
      used_at: null,
    });
    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[set-recovery-code]', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
