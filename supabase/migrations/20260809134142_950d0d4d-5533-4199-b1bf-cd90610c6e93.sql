CREATE TABLE public.player_chat_avatars (
  user_id UUID NOT NULL PRIMARY KEY,
  ic_url TEXT,
  ooc_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_chat_avatars TO authenticated;
GRANT ALL ON public.player_chat_avatars TO service_role;

ALTER TABLE public.player_chat_avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view chat avatars"
  ON public.player_chat_avatars FOR SELECT TO authenticated USING (true);

CREATE POLICY "Players manage their own chat avatars"
  ON public.player_chat_avatars FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_player_chat_avatars_updated_at
  BEFORE UPDATE ON public.player_chat_avatars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.player_chat_avatars REPLICA IDENTITY FULL;