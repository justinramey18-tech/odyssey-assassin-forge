CREATE POLICY "Users can delete own tutorials"
  ON public.tutorials FOR DELETE
  USING (auth.uid() = created_by);