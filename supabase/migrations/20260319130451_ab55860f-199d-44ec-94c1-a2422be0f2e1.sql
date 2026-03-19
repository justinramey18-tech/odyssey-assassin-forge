
-- Create scheduled_telegram_jobs table
CREATE TABLE public.scheduled_telegram_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_name text NOT NULL,
  ai_prompt text,
  static_message text,
  party_id uuid,
  include_campaign_context boolean NOT NULL DEFAULT true,
  target_user_ids uuid[],
  run_at timestamptz NOT NULL,
  repeat_daily boolean NOT NULL DEFAULT false,
  run_time text,
  timezone text NOT NULL DEFAULT 'America/New_York',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  last_run_at timestamptz,
  last_result text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient polling of pending jobs
CREATE INDEX idx_scheduled_telegram_pending ON public.scheduled_telegram_jobs (run_at) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.scheduled_telegram_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can manage their own rows
CREATE POLICY "Users can view own scheduled jobs"
  ON public.scheduled_telegram_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own scheduled jobs"
  ON public.scheduled_telegram_jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scheduled jobs"
  ON public.scheduled_telegram_jobs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scheduled jobs"
  ON public.scheduled_telegram_jobs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Schedule pg_cron job to invoke the dispatch edge function every minute
-- NOTE: If the vault approach fails, you must call this manually:
--   SELECT cron.schedule('telegram-dispatch-every-60s', '* * * * *',
--     format('SELECT net.http_post(url := %L, headers := %L::jsonb, body := ''{}''::jsonb)',
--       'https://sqvcszzbkyzidigsdqgk.supabase.co/functions/v1/telegram-scheduled-dispatch',
--       json_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer YOUR_SERVICE_ROLE_KEY'')::text));
SELECT cron.schedule(
  'telegram-dispatch-every-60s',
  '* * * * *',
  format(
    'SELECT net.http_post(url := %L, headers := %L::jsonb, body := ''{}''::jsonb)',
    'https://sqvcszzbkyzidigsdqgk.supabase.co/functions/v1/telegram-scheduled-dispatch',
    json_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true))::text
  )
);
