
-- Personality test results
CREATE TABLE public.personality_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  player_archetype text NOT NULL,
  archetype_description text NOT NULL,
  dm_persona_name text NOT NULL,
  dm_persona_description text NOT NULL,
  dm_system_prompt text NOT NULL,
  questions_answered integer NOT NULL,
  test_version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.personality_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own personality profile"
  ON public.personality_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own personality profile"
  ON public.personality_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own personality profile"
  ON public.personality_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own personality profile"
  ON public.personality_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- Test progress tracking (resume functionality)
CREATE TABLE public.personality_test_progress (
  user_id uuid PRIMARY KEY NOT NULL,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_question integer NOT NULL DEFAULT 1,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.personality_test_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own test progress"
  ON public.personality_test_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own test progress"
  ON public.personality_test_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own test progress"
  ON public.personality_test_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own test progress"
  ON public.personality_test_progress FOR DELETE
  USING (auth.uid() = user_id);
