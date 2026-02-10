
-- Create party_pings table for tactical ping/chat system
CREATE TABLE public.party_pings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL,
  sender_name TEXT NOT NULL DEFAULT 'Adventurer',
  ping_type TEXT NOT NULL, -- 'need_heal', 'danger', 'focus_target', 'ready', 'help', 'retreat'
  message TEXT, -- optional custom message
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.party_pings ENABLE ROW LEVEL SECURITY;

-- Members can send pings to their party
CREATE POLICY "Members can send pings"
ON public.party_pings FOR INSERT
WITH CHECK (
  auth.uid() = sender_user_id
  AND is_party_member(auth.uid(), party_id)
);

-- Members can read pings in their party
CREATE POLICY "Members can read party pings"
ON public.party_pings FOR SELECT
USING (is_party_member(auth.uid(), party_id));

-- Enable realtime for party_pings
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_pings;

-- Auto-cleanup: delete pings older than 5 minutes to keep table small
-- We'll handle this client-side by only showing recent pings
