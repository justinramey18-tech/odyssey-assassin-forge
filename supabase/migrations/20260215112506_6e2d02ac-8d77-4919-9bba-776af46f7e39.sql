
-- Chronicle Campaigns table
CREATE TABLE public.chronicle_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Untitled Campaign',
  description text,
  dm_name text,
  setting text,
  start_date text,
  current_arc text,
  session_count integer NOT NULL DEFAULT 0,
  last_session_date text,
  tags text[] NOT NULL DEFAULT '{}',
  gm_guide_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chronicle_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chronicle campaigns"
  ON public.chronicle_campaigns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chronicle campaigns"
  ON public.chronicle_campaigns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chronicle campaigns"
  ON public.chronicle_campaigns FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chronicle campaigns"
  ON public.chronicle_campaigns FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_chronicle_campaigns_updated_at
  BEFORE UPDATE ON public.chronicle_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Chronicle Campaign Sessions table
CREATE TABLE public.chronicle_campaign_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.chronicle_campaigns(id) ON DELETE CASCADE,
  session_number integer NOT NULL DEFAULT 1,
  session_name text NOT NULL DEFAULT 'Session',
  session_date text,
  input_preview text NOT NULL DEFAULT '',
  input_hash text NOT NULL DEFAULT '',
  input_length integer NOT NULL DEFAULT 0,
  parse_mode text NOT NULL DEFAULT 'offline',
  parsed_at text,
  parse_result jsonb,
  enhanced_patterns jsonb,
  summary jsonb,
  arc_markers jsonb NOT NULL DEFAULT '[]',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chronicle_campaign_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chronicle campaign sessions"
  ON public.chronicle_campaign_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chronicle campaign sessions"
  ON public.chronicle_campaign_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chronicle campaign sessions"
  ON public.chronicle_campaign_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chronicle campaign sessions"
  ON public.chronicle_campaign_sessions FOR DELETE
  USING (auth.uid() = user_id);
