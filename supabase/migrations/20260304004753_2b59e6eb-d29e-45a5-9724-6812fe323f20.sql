
-- Create a table for scheduled narrative events
CREATE TABLE public.party_scheduled_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  event_name TEXT NOT NULL DEFAULT 'Scheduled Event',
  event_prompt TEXT NOT NULL DEFAULT '',
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  qstash_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.party_scheduled_events ENABLE ROW LEVEL SECURITY;

-- Party members can view scheduled events
CREATE POLICY "Members can read scheduled events"
ON public.party_scheduled_events
FOR SELECT
USING (is_party_member(auth.uid(), party_id));

-- Only the creator can insert scheduled events
CREATE POLICY "Creator can insert scheduled events"
ON public.party_scheduled_events
FOR INSERT
WITH CHECK (auth.uid() = created_by AND is_party_member(auth.uid(), party_id));

-- Only the creator can update (cancel) scheduled events
CREATE POLICY "Creator can update scheduled events"
ON public.party_scheduled_events
FOR UPDATE
USING (auth.uid() = created_by);

-- Only the creator can delete scheduled events
CREATE POLICY "Creator can delete scheduled events"
ON public.party_scheduled_events
FOR DELETE
USING (auth.uid() = created_by);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_scheduled_events;
