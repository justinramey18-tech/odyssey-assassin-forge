ALTER TABLE public.party_npcs
  ADD COLUMN IF NOT EXISTS social_stats jsonb NOT NULL
  DEFAULT '{"wisdom":0,"charisma":0,"insight":0,"deception":0,"perception":0,"wisdomSave":0}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'party_npcs_social_stats_valid') THEN
    ALTER TABLE public.party_npcs ADD CONSTRAINT party_npcs_social_stats_valid CHECK (
      jsonb_typeof(social_stats) = 'object'
      AND jsonb_typeof(social_stats->'wisdom') = 'number'
      AND jsonb_typeof(social_stats->'charisma') = 'number'
      AND jsonb_typeof(social_stats->'insight') = 'number'
      AND jsonb_typeof(social_stats->'deception') = 'number'
      AND jsonb_typeof(social_stats->'perception') = 'number'
      AND jsonb_typeof(social_stats->'wisdomSave') = 'number'
      AND (social_stats->>'wisdom')::numeric BETWEEN -10 AND 20
      AND (social_stats->>'charisma')::numeric BETWEEN -10 AND 20
      AND (social_stats->>'insight')::numeric BETWEEN -10 AND 20
      AND (social_stats->>'deception')::numeric BETWEEN -10 AND 20
      AND (social_stats->>'perception')::numeric BETWEEN -10 AND 20
      AND (social_stats->>'wisdomSave')::numeric BETWEEN -10 AND 20
    );
  END IF;
END $$;