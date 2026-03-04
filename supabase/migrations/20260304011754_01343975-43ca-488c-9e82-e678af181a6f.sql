
-- Add event_type column to distinguish narrative events from scheduled rounds
ALTER TABLE public.party_scheduled_events 
ADD COLUMN event_type text NOT NULL DEFAULT 'narrative_event';

-- Update existing events to be narrative_event type
UPDATE public.party_scheduled_events SET event_type = 'narrative_event' WHERE event_type = 'narrative_event';
