CREATE OR REPLACE FUNCTION public.notify_live_chat()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.content IS NULL OR btrim(NEW.content) = '' THEN
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := 'https://sqvcszzbkyzidigsdqgk.supabase.co/functions/v1/notify-live-chat',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Trigger-Secret', '7vN9xR2mK4pL8qW6tY3sB5nF1gH0jD4cM7vX9zA2eR5uT8wQ6yP3kJ1hG4fC7bN0'
    ),
    body := jsonb_build_object(
      'partyId', NEW.party_id::text,
      'senderUserId', NEW.user_id::text,
      'characterName', NEW.character_name,
      'content', left(NEW.content, 400)
    )
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_live_chat_message ON public.party_round_chat;
CREATE TRIGGER on_live_chat_message AFTER INSERT ON public.party_round_chat FOR EACH ROW EXECUTE FUNCTION public.notify_live_chat();