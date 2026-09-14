import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,24}$/;
const RESERVED = new Set(['admin', 'support', 'system', 'root', 'odyssey', 'null', 'undefined', 'lovable']);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'Not authenticated' }, 401);

    const { username, currentPassword } = await req.json();
    if (typeof username !== 'string' || !USERNAME_RE.test(username.trim())) {
      return json({ error: 'Username must be 3-24 characters: letters, numbers, underscore or hyphen.' }, 400);
    }
    const lower = username.trim().toLowerCase();
    if (RESERVED.has(lower)) return json({ error: 'That username is reserved.' }, 400);

    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userData?.user) return json({ error: 'Not authenticated' }, 401);
    const user = userData.user;

    const currentEmail = (user.email || '').toLowerCase();
    if (!currentEmail.endsWith('@odyssey.local')) {
      return json({ error: 'This account signs in with an email address, not a username.' }, 400);
    }

    const newEmail = `${lower}@odyssey.local`;
    if (newEmail === currentEmail) return json({ error: 'That is already your username.' }, 400);

    // Re-authenticate: the caller must prove they know the current password.
    if (typeof currentPassword !== 'string' || !currentPassword) {
      return json({ error: 'Enter your current password.' }, 400);
    }
    const checkClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { error: pwErr } = await checkClient.auth.signInWithPassword({ email: currentEmail, password: currentPassword });
    if (pwErr) return json({ error: 'Current password is incorrect.' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Availability check
    for (let page = 1; page <= 5; page++) {
      const { data: pg, error: lErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (lErr) throw lErr;
      if (!pg?.users?.length) break;
      if (pg.users.some((u: any) => u.email?.toLowerCase() === newEmail)) {
        return json({ error: 'That username is taken.' }, 409);
      }
      if (pg.users.length < 1000) break;
    }

    const { error: upErr } = await admin.auth.admin.updateUserById(user.id, {
      email: newEmail,
      email_confirm: true,
      user_metadata: { ...(user.user_metadata || {}), username: lower },
    });
    if (upErr) throw upErr;

    console.log(`[change-username] ${user.id} ${currentEmail} -> ${newEmail}`);
    return json({ success: true, username: lower });
  } catch (e) {
    console.error('[change-username]', e);
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
