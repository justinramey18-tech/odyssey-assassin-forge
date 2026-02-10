
-- Add status column to party_actions (replaces boolean 'applied')
ALTER TABLE public.party_actions ADD COLUMN status text NOT NULL DEFAULT 'pending';

-- Migrate existing data
UPDATE public.party_actions SET status = CASE WHEN applied THEN 'accepted' ELSE 'pending' END;

-- Add policy so sender can read their own sent actions (to get accept/reject notifications)
CREATE POLICY "Sender can read own actions"
ON public.party_actions
FOR SELECT
USING (auth.uid() = sender_user_id);
