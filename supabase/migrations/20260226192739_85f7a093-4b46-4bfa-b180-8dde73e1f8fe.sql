
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create trigger function that calls the edge function on ready-up
CREATE OR REPLACE FUNCTION public.notify_party_ready()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only fire on false→true transition (or NULL→true)
  IF NEW.is_ready = true AND (OLD.is_ready = false OR OLD.is_ready IS NULL) THEN
    PERFORM net.http_post(
      url := 'https://rkkgmonjfvncpvlzsojw.supabase.co/functions/v1/send-party-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Trigger-Secret', current_setting('app.settings.trigger_secret', true)
      ),
      body := jsonb_build_object(
        'partyId', NEW.party_id::text,
        'userId', NEW.user_id::text,
        'roundId', NEW.round_id::text
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on party_dm_prompts for ready-up events
CREATE TRIGGER party_ready_trigger
  AFTER UPDATE ON public.party_dm_prompts
  FOR EACH ROW
  WHEN (NEW.is_ready = true AND OLD.is_ready IS DISTINCT FROM true)
  EXECUTE FUNCTION public.notify_party_ready();
