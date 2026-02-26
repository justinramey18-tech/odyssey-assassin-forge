import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Authenticate user
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const adminClient = createClient(supabaseUrl, serviceKey);

  try {
    if (req.method === 'POST') {
      const body = await req.json();
      const { endpoint, p256dh, auth, platform, userAgent } = body;

      if (!endpoint || !p256dh || !auth) {
        return new Response(JSON.stringify({ error: 'Missing subscription fields' }), { status: 400, headers: corsHeaders });
      }

      // Upsert by endpoint (unique constraint)
      const { data, error } = await adminClient
        .from('party_push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint,
          p256dh,
          auth,
          platform: platform || null,
          user_agent: userAgent || null,
          notifications_enabled: true,
          updated_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        }, { onConflict: 'endpoint' })
        .select()
        .single();

      if (error) {
        console.error('Upsert error:', error);
        return new Response(JSON.stringify({ error: 'Failed to save subscription' }), { status: 500, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ subscription: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'DELETE') {
      const body = await req.json();
      const { endpoint } = body;

      if (!endpoint) {
        return new Response(JSON.stringify({ error: 'Missing endpoint' }), { status: 400, headers: corsHeaders });
      }

      await adminClient
        .from('party_push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('endpoint', endpoint);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  } catch (err) {
    console.error('party-push-subscribe error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders });
  }
});
