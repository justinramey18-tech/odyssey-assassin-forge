-- Enable full replica identity for party_messages so DELETE events include row data
ALTER TABLE public.party_messages REPLICA IDENTITY FULL;