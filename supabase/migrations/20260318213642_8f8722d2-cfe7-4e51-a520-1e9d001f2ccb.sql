CREATE TRIGGER on_ready_up
  AFTER UPDATE ON public.party_dm_prompts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_party_ready();