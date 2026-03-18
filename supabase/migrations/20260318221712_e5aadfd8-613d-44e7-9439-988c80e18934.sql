CREATE OR REPLACE FUNCTION public.setup_telegram_cron(base_url text, service_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('telegram-poll-every-60s');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  PERFORM cron.schedule(
    'telegram-poll-every-60s',
    '* * * * *',
    format(
      'SELECT net.http_post(url := %L, headers := %L::jsonb, body := ''{}''::jsonb)',
      base_url || '/functions/v1/telegram-poll',
      json_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key)::text
    )
  );
END;
$$;