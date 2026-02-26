
CREATE TABLE public.notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL,
  triggered_by_user_id uuid NOT NULL,
  triggered_by_name text NOT NULL DEFAULT 'Adventurer',
  ready_count integer NOT NULL DEFAULT 0,
  total_players integer NOT NULL DEFAULT 0,
  notification_type text NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can insert notifications"
  ON public.notifications_log FOR INSERT
  WITH CHECK (auth.uid() = triggered_by_user_id);

CREATE POLICY "Members can read party notifications"
  ON public.notifications_log FOR SELECT
  USING (is_party_member(auth.uid(), party_id));
