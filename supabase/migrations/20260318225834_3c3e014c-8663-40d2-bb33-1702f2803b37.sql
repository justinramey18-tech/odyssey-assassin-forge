
-- Fix notify_party_ready() with correct project URL
CREATE OR REPLACE FUNCTION public.notify_party_ready()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_ready = true AND (OLD.is_ready = false OR OLD.is_ready IS NULL) THEN
    PERFORM net.http_post(
      url := 'https://sqvcszzbkyzidigsdqgk.supabase.co/functions/v1/send-party-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Trigger-Secret', '7vN9xR2mK4pL8qW6tY3sB5nF1gH0jD4cM7vX9zA2eR5uT8wQ6yP3kJ1hG4fC7bN0'
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

-- Drop duplicate trigger
DROP TRIGGER IF EXISTS on_ready_up ON public.party_dm_prompts;
