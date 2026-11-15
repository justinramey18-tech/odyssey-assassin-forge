CREATE SCHEMA reset_backup_20261115;
REVOKE ALL ON SCHEMA reset_backup_20261115 FROM PUBLIC, anon, authenticated;
COMMENT ON SCHEMA reset_backup_20261115 IS 'Private player-data hard-reset backup. Retain until 2026-12-15; remove only through a later authorized migration. Not exposed to the app.';
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ai_dm_campaigns', 'arena_rooms', 'bridge_campaign_installs', 'campaign_analytics',
    'character_perks', 'character_saves', 'chronicle_campaign_sessions', 'chronicle_campaigns',
    'chronicle_sessions', 'crossover_requests', 'dm_game_state', 'empyrean_dragon_events',
    'empyrean_dragons', 'gm_guide_presets', 'gm_guides', 'linked_universes', 'notifications_log',
    'npc_templates', 'parties', 'party_actions', 'party_character_deaths', 'party_combat_log',
    'party_creation_contexts', 'party_creation_sessions', 'party_dice_rolls',
    'party_director_escalations', 'party_director_messages', 'party_dm_messages',
    'party_dm_prompts', 'party_fight_combatants', 'party_fight_events', 'party_fights',
    'party_location_guides', 'party_loot_queue', 'party_members', 'party_message_audio',
    'party_message_reactions', 'party_messages', 'party_npc_attitudes', 'party_npc_guides',
    'party_npc_memories', 'party_npc_memory_log', 'party_npc_replies', 'party_npcs',
    'party_onboarding_rate_events', 'party_onboarding_requests', 'party_pings',
    'party_push_subscriptions', 'party_round_chat', 'party_round_chat_reactions',
    'party_round_locks', 'party_scheduled_events', 'party_shared_state', 'party_travel_events',
    'personality_profiles', 'personality_test_progress', 'player_chat_avatars',
    'push_delivery_log', 'scheduled_telegram_jobs', 'telegram_link_codes', 'telegram_messages',
    'telegram_user_links', 'telegram_yo_history', 'universe_events', 'universe_members',
    'universe_relationships'
  ] LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('CREATE TABLE reset_backup_20261115.%I AS TABLE public.%I WITH NO DATA', t, t);
      EXECUTE format('REVOKE ALL ON TABLE reset_backup_20261115.%I FROM PUBLIC, anon, authenticated', t);
    END IF;
  END LOOP;
END $$;