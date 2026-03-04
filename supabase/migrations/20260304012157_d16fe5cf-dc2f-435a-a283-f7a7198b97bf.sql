
-- Add recurrence column: null = one-time, 'weekly' = repeats every 7 days
ALTER TABLE public.party_scheduled_events 
ADD COLUMN recurrence text DEFAULT NULL;
