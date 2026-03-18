import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { error } = await supabase.rpc('setup_telegram_cron', {
    base_url: Deno.env.get('SUPABASE_URL')!,
    service_key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, message: 'Telegram cron job scheduled' }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
