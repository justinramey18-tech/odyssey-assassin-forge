import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,24}$/;
const RESERVED = new Set(['admin', 'support', 'system', 'root', 'odyssey', 'null', 'undefined', 'lovable']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { username } = await req.json();
    if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
      return new Response(JSON.stringify({ available: false, error: 'invalid' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }
    const lower = username.toLowerCase();
    if (RESERVED.has(lower)) {
      return new Response(JSON.stringify({ available: false, error: 'reserved' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const email = `${lower}@odyssey.local`;
    // listUsers with filter by email
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) throw error;
    // Workaround: scan via getUserByEmail-like - use admin filter
    const { data: byEmail } = await (admin.auth.admin as any).listUsers({ filter: `email.eq.${email}` }).catch(() => ({ data: null }));
    let taken = false;
    if (byEmail?.users?.length) {
      taken = byEmail.users.some((u: any) => u.email?.toLowerCase() === email);
    } else {
      // fallback: paginate (small projects). Cap at 5 pages of 1000.
      for (let page = 1; page <= 5; page++) {
        const { data: pg } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (!pg?.users?.length) break;
        if (pg.users.some((u: any) => u.email?.toLowerCase() === email)) { taken = true; break; }
        if (pg.users.length < 1000) break;
      }
    }

    return new Response(JSON.stringify({ available: !taken }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ available: false, error: String(e?.message || e) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });
  }
});
