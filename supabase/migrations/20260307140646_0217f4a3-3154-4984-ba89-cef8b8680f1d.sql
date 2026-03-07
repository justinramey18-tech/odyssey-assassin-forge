-- Drop and recreate FK constraints with ON DELETE CASCADE for all tables referencing parties

ALTER TABLE party_members DROP CONSTRAINT party_members_party_id_fkey;
ALTER TABLE party_members ADD CONSTRAINT party_members_party_id_fkey 
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE;

ALTER TABLE party_shared_state DROP CONSTRAINT party_shared_state_party_id_fkey;
ALTER TABLE party_shared_state ADD CONSTRAINT party_shared_state_party_id_fkey 
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE;

ALTER TABLE party_dm_messages DROP CONSTRAINT party_dm_messages_party_id_fkey;
ALTER TABLE party_dm_messages ADD CONSTRAINT party_dm_messages_party_id_fkey 
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE;

ALTER TABLE party_combat_log DROP CONSTRAINT party_combat_log_party_id_fkey;
ALTER TABLE party_combat_log ADD CONSTRAINT party_combat_log_party_id_fkey 
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE;

ALTER TABLE party_dice_rolls DROP CONSTRAINT party_dice_rolls_party_id_fkey;
ALTER TABLE party_dice_rolls ADD CONSTRAINT party_dice_rolls_party_id_fkey 
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE;

ALTER TABLE party_loot_queue DROP CONSTRAINT party_loot_queue_party_id_fkey;
ALTER TABLE party_loot_queue ADD CONSTRAINT party_loot_queue_party_id_fkey 
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE;

ALTER TABLE party_pings DROP CONSTRAINT party_pings_party_id_fkey;
ALTER TABLE party_pings ADD CONSTRAINT party_pings_party_id_fkey 
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE;

ALTER TABLE party_actions DROP CONSTRAINT party_actions_party_id_fkey;
ALTER TABLE party_actions ADD CONSTRAINT party_actions_party_id_fkey 
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE;

ALTER TABLE party_dm_prompts DROP CONSTRAINT party_dm_prompts_party_id_fkey;
ALTER TABLE party_dm_prompts ADD CONSTRAINT party_dm_prompts_party_id_fkey 
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE;

ALTER TABLE party_messages DROP CONSTRAINT party_messages_party_id_fkey;
ALTER TABLE party_messages ADD CONSTRAINT party_messages_party_id_fkey 
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE;

ALTER TABLE party_scheduled_events DROP CONSTRAINT party_scheduled_events_party_id_fkey;
ALTER TABLE party_scheduled_events ADD CONSTRAINT party_scheduled_events_party_id_fkey 
  FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE;

-- Also add DELETE policy for parties so the service role isn't the only way
-- (service role bypasses RLS, but this is good practice)
CREATE POLICY "Creator can delete own party"
ON parties FOR DELETE
TO authenticated
USING (auth.uid() = created_by);