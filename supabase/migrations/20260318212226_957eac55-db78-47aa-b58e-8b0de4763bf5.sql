CREATE POLICY "Users can insert own telegram link"
  ON public.telegram_user_links FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());