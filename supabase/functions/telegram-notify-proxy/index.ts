import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Lightweight proxy that validates a user's JWT and forwards
 * the payload to telegram-notify with the X-Trigger-Secret header.
 * This allows client-side code to trigger Telegram notifications
 * without exposing the trigger secret.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const TRIGGER_SECRET = Deno.env.get('TRIGGER_SECRET');

  if (!TRIGGER_SECRET) {
    return new Response(JSON.stringify({ error: 'TRIGGER_SECRET not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validate the user's JWT
  const authHeader = req.headers.get('Authorization') || '';
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Ensure targetUserIds includes the authenticated user (prevent notifying arbitrary users)
  // For dragon bond, we notify the user themselves
  if (!payload.partyId && !payload.targetUserIds) {
    payload.targetUserIds = [user.id];
  }

  // Forward to telegram-notify
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/telegram-notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Trigger-Secret': TRIGGER_SECRET,
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    return new Response(JSON.stringify(result), {
      status: res.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[telegram-notify-proxy] Forward failed:', err);
    return new Response(JSON.stringify({ error: 'Failed to forward notification' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
