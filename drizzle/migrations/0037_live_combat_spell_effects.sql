ALTER TABLE public.party_fight_combatants
  ADD COLUMN combat_effects jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN temp_hp integer NOT NULL DEFAULT 0,
  ADD COLUMN temp_hp_source text,
  ADD COLUMN temp_hp_until timestamptz;
ALTER TABLE public.party_fight_events ADD COLUMN temp_hp_delta integer NOT NULL DEFAULT 0;
CREATE INDEX party_fight_events_temp_inbox ON public.party_fight_events (target_user_id, created_at) WHERE temp_hp_delta <> 0 AND applied_at IS NULL;
-- Produce the temporary-HP inbox entry in the same transaction as the fighter change.
-- Ordinary damage/healing events and their acknowledgement contract remain unchanged.
CREATE OR REPLACE FUNCTION public.enqueue_combat_temp_hp_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kind = 'player' AND NEW.temp_hp <> OLD.temp_hp AND current_setting('odyssey.sheet_hp_sync', true) IS DISTINCT FROM 'true' THEN
    INSERT INTO public.party_fight_events (fight_id, party_id, kind, actor_name, target_name, target_user_id, hp_delta, temp_hp_delta, detail)
    VALUES (NEW.fight_id, NEW.party_id, 'sync', NEW.name, NEW.name, NEW.user_id, 0, NEW.temp_hp - OLD.temp_hp, 'Temporary HP changed (not ordinary HP)');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER combat_temp_hp_inbox AFTER UPDATE OF temp_hp ON public.party_fight_combatants
FOR EACH ROW EXECUTE FUNCTION public.enqueue_combat_temp_hp_change();
COMMENT ON COLUMN public.party_fight_combatants.combat_effects IS 'Validated fight-only spell modifiers; timed on the existing paused fight clock.';
COMMENT ON COLUMN public.party_fight_events.temp_hp_delta IS 'Signed temporary-HP-only change delivered through the existing applied_at inbox. Never add to hp_delta.';