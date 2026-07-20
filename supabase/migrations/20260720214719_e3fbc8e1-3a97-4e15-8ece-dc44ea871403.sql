ALTER TABLE public.universe_members REPLICA IDENTITY FULL;
ALTER TABLE public.universe_events REPLICA IDENTITY FULL;
ALTER TABLE public.crossover_requests REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.universe_members;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.universe_events;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crossover_requests;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;