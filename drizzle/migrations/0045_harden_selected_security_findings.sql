ALTER FUNCTION public.move_to_dlq(text,text,bigint,jsonb) SET search_path = '';
ALTER FUNCTION public.read_email_batch(text,integer,integer) SET search_path = '';
ALTER FUNCTION public.enqueue_email(text,jsonb) SET search_path = '';
ALTER FUNCTION public.delete_email(text,bigint) SET search_path = '';

DROP POLICY IF EXISTS "Authenticated can read universes" ON public.linked_universes;
CREATE POLICY "Creators and members can read universes" ON public.linked_universes
FOR SELECT TO authenticated
USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.universe_members m WHERE m.universe_id = linked_universes.id AND m.user_id = auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can delete cinematic audio" ON storage.objects;
CREATE POLICY "Authenticated users can delete cinematic audio" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'cinematic-audio' AND owner_id = (select auth.uid()::text));

DROP POLICY IF EXISTS "Anyone can upload gear images" ON storage.objects;
CREATE POLICY "Anyone can upload gear images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'gear-images' AND owner_id = (select auth.uid()::text));

DROP POLICY IF EXISTS "Authenticated users can upload chat audio" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat audio" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'party-chat-audio' AND owner_id = (select auth.uid()::text));

DROP POLICY IF EXISTS "Authenticated users can upload videos" ON storage.objects;
CREATE POLICY "Authenticated users can upload videos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'videos' AND owner_id = (select auth.uid()::text));

DROP POLICY IF EXISTS "Authenticated users can upload cinematic audio" ON storage.objects;
CREATE POLICY "Authenticated users can upload cinematic audio" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cinematic-audio' AND owner_id = (select auth.uid()::text));

DROP POLICY IF EXISTS "Party members can upload chat images" ON storage.objects;
CREATE POLICY "Party members can upload chat images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'party-chat-images' AND owner_id = (select auth.uid()::text));