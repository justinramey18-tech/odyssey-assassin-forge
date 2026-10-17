export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_recovery: {
        Row: {
          code_hash: string
          created_at: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_dm_campaigns: {
        Row: {
          campaign_summary: string | null
          created_at: string
          gm_guide_ids: string[] | null
          id: string
          map_state: Json | null
          memory_anchors: Json
          messages: Json
          mode: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_summary?: string | null
          created_at?: string
          gm_guide_ids?: string[] | null
          id?: string
          map_state?: Json | null
          memory_anchors?: Json
          messages?: Json
          mode?: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_summary?: string | null
          created_at?: string
          gm_guide_ids?: string[] | null
          id?: string
          map_state?: Json | null
          memory_anchors?: Json
          messages?: Json
          mode?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      arena_rooms: {
        Row: {
          created_at: string
          host_user_id: string
          id: string
          party_id: string
          state: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          host_user_id: string
          id?: string
          party_id: string
          state?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          host_user_id?: string
          id?: string
          party_id?: string
          state?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_rooms_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: true
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      bridge_campaign_installs: {
        Row: {
          actor: string
          converted_legacy: boolean
          created_at: string
          guide_ids: string[]
          host_user_id: string
          id: string
          input_digest: string
          installed_map_id: string
          new_revision: number
          new_updated_at: string
          original_state_data: Json
          original_updated_at: string
          parent_location_id: string
          parent_map_id: string
          party_id: string
          payload_digest: string
          request_id: string
          state_row_id: string
        }
        Insert: {
          actor: string
          converted_legacy: boolean
          created_at?: string
          guide_ids?: string[]
          host_user_id: string
          id?: string
          input_digest: string
          installed_map_id: string
          new_revision: number
          new_updated_at: string
          original_state_data: Json
          original_updated_at: string
          parent_location_id: string
          parent_map_id: string
          party_id: string
          payload_digest: string
          request_id: string
          state_row_id: string
        }
        Update: {
          actor?: string
          converted_legacy?: boolean
          created_at?: string
          guide_ids?: string[]
          host_user_id?: string
          id?: string
          input_digest?: string
          installed_map_id?: string
          new_revision?: number
          new_updated_at?: string
          original_state_data?: Json
          original_updated_at?: string
          parent_location_id?: string
          parent_map_id?: string
          party_id?: string
          payload_digest?: string
          request_id?: string
          state_row_id?: string
        }
        Relationships: []
      }
      campaign_analytics: {
        Row: {
          created_at: string
          death_save_failures: number
          death_save_successes: number
          id: string
          spell_slots_used_by_level: Json | null
          total_critical_hits: number
          total_damage_dealt: number
          total_damage_taken: number
          total_deaths: number
          total_gold_earned: number
          total_gold_spent: number
          total_healing_received: number
          total_items_acquired: number
          total_items_consumed: number
          total_kills: number
          total_long_rests: number
          total_sessions_imported: number
          total_short_rests: number
          total_spells_cast: number
          total_xp_earned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          death_save_failures?: number
          death_save_successes?: number
          id?: string
          spell_slots_used_by_level?: Json | null
          total_critical_hits?: number
          total_damage_dealt?: number
          total_damage_taken?: number
          total_deaths?: number
          total_gold_earned?: number
          total_gold_spent?: number
          total_healing_received?: number
          total_items_acquired?: number
          total_items_consumed?: number
          total_kills?: number
          total_long_rests?: number
          total_sessions_imported?: number
          total_short_rests?: number
          total_spells_cast?: number
          total_xp_earned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          death_save_failures?: number
          death_save_successes?: number
          id?: string
          spell_slots_used_by_level?: Json | null
          total_critical_hits?: number
          total_damage_dealt?: number
          total_damage_taken?: number
          total_deaths?: number
          total_gold_earned?: number
          total_gold_spent?: number
          total_healing_received?: number
          total_items_acquired?: number
          total_items_consumed?: number
          total_kills?: number
          total_long_rests?: number
          total_sessions_imported?: number
          total_short_rests?: number
          total_spells_cast?: number
          total_xp_earned?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      character_perks: {
        Row: {
          character_name: string
          created_at: string
          equipped: string[]
          id: string
          owned: string[]
          slots: number
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          character_name: string
          created_at?: string
          equipped?: string[]
          id?: string
          owned?: string[]
          slots?: number
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          character_name?: string
          created_at?: string
          equipped?: string[]
          id?: string
          owned?: string[]
          slots?: number
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      character_saves: {
        Row: {
          achievements_data: Json | null
          character_data: Json
          consumables_data: Json | null
          created_at: string
          equipment_data: Json | null
          extended_data: Json | null
          id: string
          prestige_data: Json | null
          save_name: string
          updated_at: string
          user_id: string
          xp_data: Json | null
        }
        Insert: {
          achievements_data?: Json | null
          character_data: Json
          consumables_data?: Json | null
          created_at?: string
          equipment_data?: Json | null
          extended_data?: Json | null
          id?: string
          prestige_data?: Json | null
          save_name?: string
          updated_at?: string
          user_id: string
          xp_data?: Json | null
        }
        Update: {
          achievements_data?: Json | null
          character_data?: Json
          consumables_data?: Json | null
          created_at?: string
          equipment_data?: Json | null
          extended_data?: Json | null
          id?: string
          prestige_data?: Json | null
          save_name?: string
          updated_at?: string
          user_id?: string
          xp_data?: Json | null
        }
        Relationships: []
      }
      chronicle_campaign_sessions: {
        Row: {
          arc_markers: Json
          campaign_id: string
          created_at: string
          enhanced_patterns: Json | null
          id: string
          input_hash: string
          input_length: number
          input_preview: string
          notes: string | null
          parse_mode: string
          parse_result: Json | null
          parsed_at: string | null
          session_date: string | null
          session_name: string
          session_number: number
          summary: Json | null
          user_id: string
        }
        Insert: {
          arc_markers?: Json
          campaign_id: string
          created_at?: string
          enhanced_patterns?: Json | null
          id?: string
          input_hash?: string
          input_length?: number
          input_preview?: string
          notes?: string | null
          parse_mode?: string
          parse_result?: Json | null
          parsed_at?: string | null
          session_date?: string | null
          session_name?: string
          session_number?: number
          summary?: Json | null
          user_id: string
        }
        Update: {
          arc_markers?: Json
          campaign_id?: string
          created_at?: string
          enhanced_patterns?: Json | null
          id?: string
          input_hash?: string
          input_length?: number
          input_preview?: string
          notes?: string | null
          parse_mode?: string
          parse_result?: Json | null
          parsed_at?: string | null
          session_date?: string | null
          session_name?: string
          session_number?: number
          summary?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chronicle_campaign_sessions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "chronicle_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      chronicle_campaigns: {
        Row: {
          created_at: string
          current_arc: string | null
          description: string | null
          dm_name: string | null
          gm_guide_ids: string[]
          id: string
          last_session_date: string | null
          name: string
          session_count: number
          setting: string | null
          start_date: string | null
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_arc?: string | null
          description?: string | null
          dm_name?: string | null
          gm_guide_ids?: string[]
          id?: string
          last_session_date?: string | null
          name?: string
          session_count?: number
          setting?: string | null
          start_date?: string | null
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_arc?: string | null
          description?: string | null
          dm_name?: string | null
          gm_guide_ids?: string[]
          id?: string
          last_session_date?: string | null
          name?: string
          session_count?: number
          setting?: string | null
          start_date?: string | null
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chronicle_sessions: {
        Row: {
          achievements_triggered: number
          changes_applied: number
          combat_rounds: number
          conditions_applied: string[] | null
          created_at: string
          critical_hits: number
          damage_dealt: number
          damage_taken: number
          death_saves: Json | null
          full_parse_result: Json | null
          gold_gained: number
          gold_spent: number
          healing_received: number
          id: string
          input_hash: string
          input_preview: string
          items_acquired: number
          items_consumed: number
          kills: number
          parse_mode: string
          parsed_at: string
          rests_taken: Json | null
          session_name: string
          spell_slots_used: Json | null
          user_id: string
          xp_total: number
        }
        Insert: {
          achievements_triggered?: number
          changes_applied?: number
          combat_rounds?: number
          conditions_applied?: string[] | null
          created_at?: string
          critical_hits?: number
          damage_dealt?: number
          damage_taken?: number
          death_saves?: Json | null
          full_parse_result?: Json | null
          gold_gained?: number
          gold_spent?: number
          healing_received?: number
          id?: string
          input_hash: string
          input_preview: string
          items_acquired?: number
          items_consumed?: number
          kills?: number
          parse_mode?: string
          parsed_at?: string
          rests_taken?: Json | null
          session_name?: string
          spell_slots_used?: Json | null
          user_id: string
          xp_total?: number
        }
        Update: {
          achievements_triggered?: number
          changes_applied?: number
          combat_rounds?: number
          conditions_applied?: string[] | null
          created_at?: string
          critical_hits?: number
          damage_dealt?: number
          damage_taken?: number
          death_saves?: Json | null
          full_parse_result?: Json | null
          gold_gained?: number
          gold_spent?: number
          healing_received?: number
          id?: string
          input_hash?: string
          input_preview?: string
          items_acquired?: number
          items_consumed?: number
          kills?: number
          parse_mode?: string
          parsed_at?: string
          rests_taken?: Json | null
          session_name?: string
          spell_slots_used?: Json | null
          user_id?: string
          xp_total?: number
        }
        Relationships: []
      }
      crossover_requests: {
        Row: {
          created_at: string
          from_member: string
          id: string
          live_beat_a: string | null
          live_beat_a_at: string | null
          live_beat_b: string | null
          live_beat_b_at: string | null
          narration_a: string | null
          narration_b: string | null
          resolved_at: string | null
          scene_premise: string | null
          status: string
          to_member: string
          universe_id: string
        }
        Insert: {
          created_at?: string
          from_member: string
          id?: string
          live_beat_a?: string | null
          live_beat_a_at?: string | null
          live_beat_b?: string | null
          live_beat_b_at?: string | null
          narration_a?: string | null
          narration_b?: string | null
          resolved_at?: string | null
          scene_premise?: string | null
          status?: string
          to_member: string
          universe_id: string
        }
        Update: {
          created_at?: string
          from_member?: string
          id?: string
          live_beat_a?: string | null
          live_beat_a_at?: string | null
          live_beat_b?: string | null
          live_beat_b_at?: string | null
          narration_a?: string | null
          narration_b?: string | null
          resolved_at?: string | null
          scene_premise?: string | null
          status?: string
          to_member?: string
          universe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crossover_requests_from_member_fkey"
            columns: ["from_member"]
            isOneToOne: false
            referencedRelation: "universe_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crossover_requests_to_member_fkey"
            columns: ["to_member"]
            isOneToOne: false
            referencedRelation: "universe_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crossover_requests_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "linked_universes"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_game_state: {
        Row: {
          campaign_id: string | null
          created_at: string
          current_hp: number
          gold: number
          id: string
          inventory: Json
          max_hp: number
          memory_anchors: Json
          quest_flags: Json
          session_turn: number
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          current_hp?: number
          gold?: number
          id?: string
          inventory?: Json
          max_hp?: number
          memory_anchors?: Json
          quest_flags?: Json
          session_turn?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          current_hp?: number
          gold?: number
          id?: string
          inventory?: Json
          max_hp?: number
          memory_anchors?: Json
          quest_flags?: Json
          session_turn?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_game_state_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ai_dm_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      gm_guide_presets: {
        Row: {
          created_at: string
          guide_ids: string[]
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          guide_ids?: string[]
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          guide_ids?: string[]
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gm_guides: {
        Row: {
          content: string
          created_at: string
          enabled: boolean
          id: string
          mode: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          enabled?: boolean
          id?: string
          mode?: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          enabled?: boolean
          id?: string
          mode?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      linked_universes: {
        Row: {
          created_at: string
          created_by: string
          current_day: number
          id: string
          is_active: boolean
          link_code: string
          max_members: number
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          current_day?: number
          id?: string
          is_active?: boolean
          link_code: string
          max_members?: number
          name?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          current_day?: number
          id?: string
          is_active?: boolean
          link_code?: string
          max_members?: number
          name?: string
        }
        Relationships: []
      }
      notifications_log: {
        Row: {
          created_at: string
          id: string
          notification_type: string
          party_id: string
          ready_count: number
          total_players: number
          triggered_by_name: string
          triggered_by_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notification_type?: string
          party_id: string
          ready_count?: number
          total_players?: number
          triggered_by_name?: string
          triggered_by_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notification_type?: string
          party_id?: string
          ready_count?: number
          total_players?: number
          triggered_by_name?: string
          triggered_by_user_id?: string
        }
        Relationships: []
      }
      npc_templates: {
        Row: {
          created_at: string
          data: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      parties: {
        Row: {
          campaign_started: boolean
          campaign_started_at: string | null
          campaign_type: string | null
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          link_code: string
          private_mode: boolean
        }
        Insert: {
          campaign_started?: boolean
          campaign_started_at?: string | null
          campaign_type?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          link_code: string
          private_mode?: boolean
        }
        Update: {
          campaign_started?: boolean
          campaign_started_at?: string | null
          campaign_type?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          link_code?: string
          private_mode?: boolean
        }
        Relationships: []
      }
      party_actions: {
        Row: {
          action_data: Json
          action_type: string
          applied: boolean
          created_at: string
          id: string
          party_id: string
          sender_user_id: string
          status: string
          target_user_id: string
        }
        Insert: {
          action_data?: Json
          action_type: string
          applied?: boolean
          created_at?: string
          id?: string
          party_id: string
          sender_user_id: string
          status?: string
          target_user_id: string
        }
        Update: {
          action_data?: Json
          action_type?: string
          applied?: boolean
          created_at?: string
          id?: string
          party_id?: string
          sender_user_id?: string
          status?: string
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_actions_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_character_deaths: {
        Row: {
          character_name: string
          died_at: string
          fight_id: string | null
          id: string
          party_id: string
          revived_at: string | null
          revived_by: string | null
          user_id: string
        }
        Insert: {
          character_name: string
          died_at?: string
          fight_id?: string | null
          id?: string
          party_id: string
          revived_at?: string | null
          revived_by?: string | null
          user_id: string
        }
        Update: {
          character_name?: string
          died_at?: string
          fight_id?: string | null
          id?: string
          party_id?: string
          revived_at?: string | null
          revived_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_character_deaths_fight_id_fkey"
            columns: ["fight_id"]
            isOneToOne: false
            referencedRelation: "party_fights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_character_deaths_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_combat_log: {
        Row: {
          action_type: string
          character_name: string
          created_at: string
          description: string
          id: string
          metadata: Json
          party_id: string
          user_id: string
        }
        Insert: {
          action_type: string
          character_name: string
          created_at?: string
          description: string
          id?: string
          metadata?: Json
          party_id: string
          user_id: string
        }
        Update: {
          action_type?: string
          character_name?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json
          party_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_combat_log_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_creation_contexts: {
        Row: {
          build_fingerprint: string | null
          build_lease_id: string | null
          build_lease_until: string | null
          last_error: string | null
          party_id: string
          player_context: Json
          private_source_manifest: Json
          revision: number
          source_fingerprint: string | null
          starting_rules: Json
          status: string
          updated_at: string
        }
        Insert: {
          build_fingerprint?: string | null
          build_lease_id?: string | null
          build_lease_until?: string | null
          last_error?: string | null
          party_id: string
          player_context?: Json
          private_source_manifest?: Json
          revision?: number
          source_fingerprint?: string | null
          starting_rules?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          build_fingerprint?: string | null
          build_lease_id?: string | null
          build_lease_until?: string | null
          last_error?: string | null
          party_id?: string
          player_context?: Json
          private_source_manifest?: Json
          revision?: number
          source_fingerprint?: string | null
          starting_rules?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_creation_contexts_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: true
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_creation_sessions: {
        Row: {
          completed_at: string | null
          completed_member_id: string | null
          completed_save_id: string | null
          context_revision: number
          created_at: string
          draft: Json
          draft_revision: number
          id: string
          party_id: string
          reserved_save_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_member_id?: string | null
          completed_save_id?: string | null
          context_revision?: number
          created_at?: string
          draft?: Json
          draft_revision?: number
          id?: string
          party_id: string
          reserved_save_id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_member_id?: string | null
          completed_save_id?: string | null
          context_revision?: number
          created_at?: string
          draft?: Json
          draft_revision?: number
          id?: string
          party_id?: string
          reserved_save_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_creation_sessions_completed_save_id_fkey"
            columns: ["completed_save_id"]
            isOneToOne: false
            referencedRelation: "character_saves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_creation_sessions_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_dice_rolls: {
        Row: {
          created_at: string
          id: string
          party_id: string
          roll_details: Json | null
          roll_expression: string
          roll_label: string
          roll_result: number
          roller_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          party_id: string
          roll_details?: Json | null
          roll_expression: string
          roll_label?: string
          roll_result: number
          roller_name?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          party_id?: string
          roll_details?: Json | null
          roll_expression?: string
          roll_label?: string
          roll_result?: number
          roller_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_dice_rolls_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_director_escalations: {
        Row: {
          ai_rationale: string | null
          created_at: string
          host_comment: string | null
          id: string
          intent: string | null
          party_id: string
          request_text: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          ai_rationale?: string | null
          created_at?: string
          host_comment?: string | null
          id?: string
          intent?: string | null
          party_id: string
          request_text: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          ai_rationale?: string | null
          created_at?: string
          host_comment?: string | null
          id?: string
          intent?: string | null
          party_id?: string
          request_text?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_director_escalations_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_director_messages: {
        Row: {
          category: string | null
          consumed_at: string | null
          consumed_by_dm: boolean
          content: string
          created_at: string
          fires_remaining: number
          id: string
          intent: string | null
          overridden: boolean
          party_id: string
          role: string
          user_id: string
        }
        Insert: {
          category?: string | null
          consumed_at?: string | null
          consumed_by_dm?: boolean
          content: string
          created_at?: string
          fires_remaining?: number
          id?: string
          intent?: string | null
          overridden?: boolean
          party_id: string
          role: string
          user_id: string
        }
        Update: {
          category?: string | null
          consumed_at?: string | null
          consumed_by_dm?: boolean
          content?: string
          created_at?: string
          fires_remaining?: number
          id?: string
          intent?: string | null
          overridden?: boolean
          party_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_director_messages_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_dm_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_afk_marker: boolean
          party_id: string
          role: string
          scene_image_prompt: string | null
          scene_image_url: string | null
          scene_video_path: string | null
          sender_name: string
          sender_user_id: string | null
          team: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_afk_marker?: boolean
          party_id: string
          role: string
          scene_image_prompt?: string | null
          scene_image_url?: string | null
          scene_video_path?: string | null
          sender_name?: string
          sender_user_id?: string | null
          team?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_afk_marker?: boolean
          party_id?: string
          role?: string
          scene_image_prompt?: string | null
          scene_image_url?: string | null
          scene_video_path?: string | null
          sender_name?: string
          sender_user_id?: string | null
          team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "party_dm_messages_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_dm_prompts: {
        Row: {
          character_name: string
          created_at: string
          id: string
          is_ready: boolean
          party_id: string
          prompt: string
          round_id: string
          signet_intensity: number | null
          team: string | null
          user_id: string
        }
        Insert: {
          character_name: string
          created_at?: string
          id?: string
          is_ready?: boolean
          party_id: string
          prompt: string
          round_id: string
          signet_intensity?: number | null
          team?: string | null
          user_id: string
        }
        Update: {
          character_name?: string
          created_at?: string
          id?: string
          is_ready?: boolean
          party_id?: string
          prompt?: string
          round_id?: string
          signet_intensity?: number | null
          team?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_dm_prompts_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_fight_combatants: {
        Row: {
          ac: number
          act_every_ms: number | null
          action_seq: number
          combat_effects: Json
          cooldowns: Json
          created_at: string
          death_failures: number
          death_successes: number
          duel_charge: number
          fight_id: string
          hp: number
          id: string
          kind: string
          last_action_at: string | null
          last_seen_at: string | null
          last_stand_used: boolean
          max_hp: number
          minigame: Json
          name: string
          next_action_at: string | null
          next_save_at: string | null
          npc_id: string | null
          party_id: string
          pending: Json | null
          perks: string[]
          pinned_until: string | null
          resolve: number | null
          resolve_at: string | null
          resolve_rate: number | null
          second_wind: string | null
          signature_turn: number
          status: string
          strike_at: string | null
          temp_hp: number
          temp_hp_source: string | null
          temp_hp_until: string | null
          threat: Json
          turn_no: number
          updated_at: string
          user_id: string | null
          ward: number
          ward_until: string | null
        }
        Insert: {
          ac: number
          act_every_ms?: number | null
          action_seq?: number
          combat_effects?: Json
          cooldowns?: Json
          created_at?: string
          death_failures?: number
          death_successes?: number
          duel_charge?: number
          fight_id: string
          hp: number
          id?: string
          kind: string
          last_action_at?: string | null
          last_seen_at?: string | null
          last_stand_used?: boolean
          max_hp: number
          minigame?: Json
          name: string
          next_action_at?: string | null
          next_save_at?: string | null
          npc_id?: string | null
          party_id: string
          pending?: Json | null
          perks?: string[]
          pinned_until?: string | null
          resolve?: number | null
          resolve_at?: string | null
          resolve_rate?: number | null
          second_wind?: string | null
          signature_turn?: number
          status?: string
          strike_at?: string | null
          temp_hp?: number
          temp_hp_source?: string | null
          temp_hp_until?: string | null
          threat?: Json
          turn_no?: number
          updated_at?: string
          user_id?: string | null
          ward?: number
          ward_until?: string | null
        }
        Update: {
          ac?: number
          act_every_ms?: number | null
          action_seq?: number
          combat_effects?: Json
          cooldowns?: Json
          created_at?: string
          death_failures?: number
          death_successes?: number
          duel_charge?: number
          fight_id?: string
          hp?: number
          id?: string
          kind?: string
          last_action_at?: string | null
          last_seen_at?: string | null
          last_stand_used?: boolean
          max_hp?: number
          minigame?: Json
          name?: string
          next_action_at?: string | null
          next_save_at?: string | null
          npc_id?: string | null
          party_id?: string
          pending?: Json | null
          perks?: string[]
          pinned_until?: string | null
          resolve?: number | null
          resolve_at?: string | null
          resolve_rate?: number | null
          second_wind?: string | null
          signature_turn?: number
          status?: string
          strike_at?: string | null
          temp_hp?: number
          temp_hp_source?: string | null
          temp_hp_until?: string | null
          threat?: Json
          turn_no?: number
          updated_at?: string
          user_id?: string | null
          ward?: number
          ward_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "party_fight_combatants_fight_id_fkey"
            columns: ["fight_id"]
            isOneToOne: false
            referencedRelation: "party_fights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_fight_combatants_npc_id_fkey"
            columns: ["npc_id"]
            isOneToOne: false
            referencedRelation: "party_npcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_fight_combatants_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_fight_events: {
        Row: {
          actor_name: string
          applied_at: string | null
          created_at: string
          d20: number | null
          detail: string
          fight_id: string
          hp_delta: number
          id: string
          kind: string
          party_id: string
          target_name: string
          target_user_id: string | null
          temp_hp_delta: number
          total: number | null
        }
        Insert: {
          actor_name?: string
          applied_at?: string | null
          created_at?: string
          d20?: number | null
          detail?: string
          fight_id: string
          hp_delta?: number
          id?: string
          kind: string
          party_id: string
          target_name?: string
          target_user_id?: string | null
          temp_hp_delta?: number
          total?: number | null
        }
        Update: {
          actor_name?: string
          applied_at?: string | null
          created_at?: string
          d20?: number | null
          detail?: string
          fight_id?: string
          hp_delta?: number
          id?: string
          kind?: string
          party_id?: string
          target_name?: string
          target_user_id?: string | null
          temp_hp_delta?: number
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "party_fight_events_fight_id_fkey"
            columns: ["fight_id"]
            isOneToOne: false
            referencedRelation: "party_fights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_fight_events_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_fights: {
        Row: {
          ended_at: string | null
          huddles_used: Json
          id: string
          outcome: string | null
          party_id: string
          pause_kind: string | null
          paused_at: string | null
          paused_until: string | null
          started_at: string
          started_by: string
          status: string
          updated_at: string
        }
        Insert: {
          ended_at?: string | null
          huddles_used?: Json
          id?: string
          outcome?: string | null
          party_id: string
          pause_kind?: string | null
          paused_at?: string | null
          paused_until?: string | null
          started_at?: string
          started_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          ended_at?: string | null
          huddles_used?: Json
          id?: string
          outcome?: string | null
          party_id?: string
          pause_kind?: string | null
          paused_at?: string | null
          paused_until?: string | null
          started_at?: string
          started_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_fights_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_location_guides: {
        Row: {
          content: string
          created_at: string
          enabled: boolean
          id: string
          location_id: string | null
          map_id: string
          name: string
          party_id: string
          scope: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          enabled?: boolean
          id?: string
          location_id?: string | null
          map_id: string
          name: string
          party_id: string
          scope: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          enabled?: boolean
          id?: string
          location_id?: string | null
          map_id?: string
          name?: string
          party_id?: string
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_location_guides_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_loot_queue: {
        Row: {
          added_by_name: string
          added_by_user_id: string
          claimed_at: string | null
          claimed_by_name: string | null
          claimed_by_user_id: string | null
          created_at: string
          gold_value: number
          id: string
          item_description: string | null
          item_name: string
          party_id: string
          rarity: string
        }
        Insert: {
          added_by_name?: string
          added_by_user_id: string
          claimed_at?: string | null
          claimed_by_name?: string | null
          claimed_by_user_id?: string | null
          created_at?: string
          gold_value?: number
          id?: string
          item_description?: string | null
          item_name: string
          party_id: string
          rarity?: string
        }
        Update: {
          added_by_name?: string
          added_by_user_id?: string
          claimed_at?: string | null
          claimed_by_name?: string | null
          claimed_by_user_id?: string | null
          created_at?: string
          gold_value?: number
          id?: string
          item_description?: string | null
          item_name?: string
          party_id?: string
          rarity?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_loot_queue_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_members: {
        Row: {
          character_name: string
          character_status: Json
          id: string
          joined_at: string
          onboarding_completed_at: string | null
          onboarding_started_at: string | null
          onboarding_status: string
          party_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          character_name?: string
          character_status?: Json
          id?: string
          joined_at?: string
          onboarding_completed_at?: string | null
          onboarding_started_at?: string | null
          onboarding_status?: string
          party_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          character_name?: string
          character_status?: Json
          id?: string
          joined_at?: string
          onboarding_completed_at?: string | null
          onboarding_started_at?: string | null
          onboarding_status?: string
          party_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_members_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_message_audio: {
        Row: {
          audio_url: string
          created_at: string
          created_by: string
          created_by_name: string | null
          id: string
          message_id: string
          part: string
          party_id: string
          provider: string
          voice_id: string | null
        }
        Insert: {
          audio_url: string
          created_at?: string
          created_by: string
          created_by_name?: string | null
          id?: string
          message_id: string
          part?: string
          party_id: string
          provider?: string
          voice_id?: string | null
        }
        Update: {
          audio_url?: string
          created_at?: string
          created_by?: string
          created_by_name?: string | null
          id?: string
          message_id?: string
          part?: string
          party_id?: string
          provider?: string
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "party_message_audio_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "party_dm_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_message_audio_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          party_id: string
          sender_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          party_id: string
          sender_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          party_id?: string
          sender_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "party_dm_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_message_reactions_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_messages: {
        Row: {
          audio_url: string | null
          created_at: string
          id: string
          image_url: string | null
          is_pinned: boolean
          message: string
          party_id: string
          reply_to_id: string | null
          sender_name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_pinned?: boolean
          message: string
          party_id: string
          reply_to_id?: string | null
          sender_name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_pinned?: boolean
          message?: string
          party_id?: string
          reply_to_id?: string | null
          sender_name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_messages_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "party_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      party_npc_attitudes: {
        Row: {
          character_name: string
          created_at: string
          knows_name: boolean
          last_seen_at: string | null
          npc_id: string
          party_id: string
          reason: string
          score: number
          updated_at: string
          updated_by: string
          user_id: string
        }
        Insert: {
          character_name?: string
          created_at?: string
          knows_name?: boolean
          last_seen_at?: string | null
          npc_id: string
          party_id: string
          reason?: string
          score?: number
          updated_at?: string
          updated_by?: string
          user_id: string
        }
        Update: {
          character_name?: string
          created_at?: string
          knows_name?: boolean
          last_seen_at?: string | null
          npc_id?: string
          party_id?: string
          reason?: string
          score?: number
          updated_at?: string
          updated_by?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_npc_attitudes_npc_fk"
            columns: ["npc_id", "party_id"]
            isOneToOne: false
            referencedRelation: "party_npcs"
            referencedColumns: ["id", "party_id"]
          },
        ]
      }
      party_npc_guides: {
        Row: {
          grudge_style: string
          guide: string
          hard_lines: string
          levers: string
          mood_range: string
          npc_id: string
          party_id: string
          secrets: string
          updated_at: string
          wants: string
        }
        Insert: {
          grudge_style?: string
          guide?: string
          hard_lines?: string
          levers?: string
          mood_range?: string
          npc_id: string
          party_id: string
          secrets?: string
          updated_at?: string
          wants?: string
        }
        Update: {
          grudge_style?: string
          guide?: string
          hard_lines?: string
          levers?: string
          mood_range?: string
          npc_id?: string
          party_id?: string
          secrets?: string
          updated_at?: string
          wants?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_npc_guides_npc_fk"
            columns: ["npc_id", "party_id"]
            isOneToOne: false
            referencedRelation: "party_npcs"
            referencedColumns: ["id", "party_id"]
          },
        ]
      }
      party_npc_memories: {
        Row: {
          created_at: string
          id: string
          kind: string
          note: string
          npc_id: string
          party_id: string
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          note: string
          npc_id: string
          party_id: string
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          note?: string
          npc_id?: string
          party_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_npc_memories_npc_fk"
            columns: ["npc_id", "party_id"]
            isOneToOne: false
            referencedRelation: "party_npcs"
            referencedColumns: ["id", "party_id"]
          },
        ]
      }
      party_npc_memory_log: {
        Row: {
          created_at: string
          line_id: string
          npc_id: string
          party_id: string
        }
        Insert: {
          created_at?: string
          line_id: string
          npc_id: string
          party_id: string
        }
        Update: {
          created_at?: string
          line_id?: string
          npc_id?: string
          party_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_npc_memory_log_npc_fk"
            columns: ["npc_id", "party_id"]
            isOneToOne: false
            referencedRelation: "party_npcs"
            referencedColumns: ["id", "party_id"]
          },
        ]
      }
      party_npc_replies: {
        Row: {
          cost_usd: number | null
          created_at: string
          error: string | null
          fallback_reason: string | null
          fell_back: boolean
          id: string
          kind: string
          latency_ms: number | null
          model_requested: string
          model_used: string | null
          npc_id: string
          party_id: string
          prompt_message_id: string | null
          reply_message_id: string | null
          requested_by: string
          updated_at: string
        }
        Insert: {
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          fallback_reason?: string | null
          fell_back?: boolean
          id?: string
          kind?: string
          latency_ms?: number | null
          model_requested: string
          model_used?: string | null
          npc_id: string
          party_id: string
          prompt_message_id?: string | null
          reply_message_id?: string | null
          requested_by: string
          updated_at?: string
        }
        Update: {
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          fallback_reason?: string | null
          fell_back?: boolean
          id?: string
          kind?: string
          latency_ms?: number | null
          model_requested?: string
          model_used?: string | null
          npc_id?: string
          party_id?: string
          prompt_message_id?: string | null
          reply_message_id?: string | null
          requested_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_npc_replies_npc_fk"
            columns: ["npc_id", "party_id"]
            isOneToOne: false
            referencedRelation: "party_npcs"
            referencedColumns: ["id", "party_id"]
          },
          {
            foreignKeyName: "party_npc_replies_prompt_message_id_fkey"
            columns: ["prompt_message_id"]
            isOneToOne: false
            referencedRelation: "party_round_chat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_npc_replies_reply_message_id_fkey"
            columns: ["reply_message_id"]
            isOneToOne: false
            referencedRelation: "party_round_chat"
            referencedColumns: ["id"]
          },
        ]
      }
      party_npcs: {
        Row: {
          archived: boolean
          combat_state: string | null
          combat_stats: Json | null
          created_at: string
          id: string
          model: string
          mood: string
          name: string
          on_stage: boolean
          on_stage_since: string | null
          party_id: string
          player_user_id: string | null
          portrait_url: string | null
          reacts_to_spells: boolean
          social_stats: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived?: boolean
          combat_state?: string | null
          combat_stats?: Json | null
          created_at?: string
          id?: string
          model?: string
          mood?: string
          name: string
          on_stage?: boolean
          on_stage_since?: string | null
          party_id: string
          player_user_id?: string | null
          portrait_url?: string | null
          reacts_to_spells?: boolean
          social_stats?: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived?: boolean
          combat_state?: string | null
          combat_stats?: Json | null
          created_at?: string
          id?: string
          model?: string
          mood?: string
          name?: string
          on_stage?: boolean
          on_stage_since?: string | null
          party_id?: string
          player_user_id?: string | null
          portrait_url?: string | null
          reacts_to_spells?: boolean
          social_stats?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_npcs_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_onboarding_rate_events: {
        Row: {
          created_at: string
          id: number
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      party_onboarding_requests: {
        Row: {
          created_at: string
          id: string
          party_id: string
          reason: string | null
          resolved_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          party_id: string
          reason?: string | null
          resolved_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          party_id?: string
          reason?: string | null
          resolved_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_onboarding_requests_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_pings: {
        Row: {
          created_at: string
          id: string
          message: string | null
          party_id: string
          ping_type: string
          sender_name: string
          sender_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          party_id: string
          ping_type: string
          sender_name?: string
          sender_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          party_id?: string
          ping_type?: string
          sender_name?: string
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_pings_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          notifications_enabled: boolean
          p256dh: string
          platform: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          notifications_enabled?: boolean
          p256dh: string
          platform?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          notifications_enabled?: boolean
          p256dh?: string
          platform?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      party_round_chat: {
        Row: {
          character_name: string
          consumed: boolean
          content: string
          created_at: string
          id: string
          in_character: boolean
          npc_id: string | null
          npc_mood: string | null
          party_id: string
          round_id: string
          selected: boolean
          user_id: string
        }
        Insert: {
          character_name?: string
          consumed?: boolean
          content: string
          created_at?: string
          id?: string
          in_character?: boolean
          npc_id?: string | null
          npc_mood?: string | null
          party_id: string
          round_id: string
          selected?: boolean
          user_id: string
        }
        Update: {
          character_name?: string
          consumed?: boolean
          content?: string
          created_at?: string
          id?: string
          in_character?: boolean
          npc_id?: string | null
          npc_mood?: string | null
          party_id?: string
          round_id?: string
          selected?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_round_chat_npc_fk"
            columns: ["npc_id", "party_id"]
            isOneToOne: false
            referencedRelation: "party_npcs"
            referencedColumns: ["id", "party_id"]
          },
          {
            foreignKeyName: "party_round_chat_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_round_chat_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          party_id: string
          sender_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          party_id: string
          sender_name?: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          party_id?: string
          sender_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_round_chat_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "party_round_chat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_round_chat_reactions_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_round_locks: {
        Row: {
          completed_at: string | null
          expires_at: string
          holder_user_id: string
          party_id: string
          round_id: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          expires_at?: string
          holder_user_id: string
          party_id: string
          round_id: string
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          expires_at?: string
          holder_user_id?: string
          party_id?: string
          round_id?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      party_scheduled_events: {
        Row: {
          created_at: string
          created_by: string
          event_name: string
          event_prompt: string
          event_type: string
          id: string
          party_id: string
          qstash_message_id: string | null
          recurrence: string | null
          scheduled_at: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by: string
          event_name?: string
          event_prompt?: string
          event_type?: string
          id?: string
          party_id: string
          qstash_message_id?: string | null
          recurrence?: string | null
          scheduled_at: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_name?: string
          event_prompt?: string
          event_type?: string
          id?: string
          party_id?: string
          qstash_message_id?: string | null
          recurrence?: string | null
          scheduled_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_scheduled_events_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_shared_state: {
        Row: {
          created_at: string
          id: string
          party_id: string
          state_data: Json
          state_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          party_id: string
          state_data?: Json
          state_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          party_id?: string
          state_data?: Json
          state_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_shared_state_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_travel_events: {
        Row: {
          attempt_count: number
          created_at: string
          created_by: string
          destination_location_id: string
          dm_message_id: string | null
          event_premise: string | null
          event_type: string | null
          expected_tranche_started_at: number | null
          firing_lease_id: string | null
          firing_lease_until: string | null
          has_event: boolean
          id: string
          journey_plan_hash: string
          last_error: string | null
          map_id: string | null
          party_id: string
          qstash_message_id: string | null
          scheduled_at: string | null
          status: string
          target_campaign_minute: number | null
          target_leg_index: number | null
          target_overall_fraction: number | null
          target_reversed: boolean | null
          target_route_id: string | null
          target_route_progress: number | null
          target_tranche_fraction: number | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          created_by: string
          destination_location_id: string
          dm_message_id?: string | null
          event_premise?: string | null
          event_type?: string | null
          expected_tranche_started_at?: number | null
          firing_lease_id?: string | null
          firing_lease_until?: string | null
          has_event: boolean
          id?: string
          journey_plan_hash: string
          last_error?: string | null
          map_id?: string | null
          party_id: string
          qstash_message_id?: string | null
          scheduled_at?: string | null
          status: string
          target_campaign_minute?: number | null
          target_leg_index?: number | null
          target_overall_fraction?: number | null
          target_reversed?: boolean | null
          target_route_id?: string | null
          target_route_progress?: number | null
          target_tranche_fraction?: number | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          created_by?: string
          destination_location_id?: string
          dm_message_id?: string | null
          event_premise?: string | null
          event_type?: string | null
          expected_tranche_started_at?: number | null
          firing_lease_id?: string | null
          firing_lease_until?: string | null
          has_event?: boolean
          id?: string
          journey_plan_hash?: string
          last_error?: string | null
          map_id?: string | null
          party_id?: string
          qstash_message_id?: string | null
          scheduled_at?: string | null
          status?: string
          target_campaign_minute?: number | null
          target_leg_index?: number | null
          target_overall_fraction?: number | null
          target_reversed?: boolean | null
          target_route_id?: string | null
          target_route_progress?: number | null
          target_tranche_fraction?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_travel_events_dm_message_id_fkey"
            columns: ["dm_message_id"]
            isOneToOne: false
            referencedRelation: "party_dm_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_travel_events_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      personality_profiles: {
        Row: {
          archetype_description: string
          created_at: string
          dm_persona_description: string
          dm_persona_name: string
          dm_system_prompt: string
          id: string
          player_archetype: string
          questions_answered: number
          test_version: string
          user_id: string
        }
        Insert: {
          archetype_description: string
          created_at?: string
          dm_persona_description: string
          dm_persona_name: string
          dm_system_prompt: string
          id?: string
          player_archetype: string
          questions_answered: number
          test_version?: string
          user_id: string
        }
        Update: {
          archetype_description?: string
          created_at?: string
          dm_persona_description?: string
          dm_persona_name?: string
          dm_system_prompt?: string
          id?: string
          player_archetype?: string
          questions_answered?: number
          test_version?: string
          user_id?: string
        }
        Relationships: []
      }
      personality_test_progress: {
        Row: {
          answers: Json
          current_question: number
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          current_question?: number
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          current_question?: number
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      player_chat_avatars: {
        Row: {
          created_at: string
          ic_url: string | null
          ooc_name: string | null
          ooc_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ic_url?: string | null
          ooc_name?: string | null
          ooc_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ic_url?: string | null
          ooc_name?: string | null
          ooc_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_delivery_log: {
        Row: {
          created_at: string
          detail: string | null
          failed: number
          function_name: string
          id: string
          message_id: string | null
          party_id: string | null
          recipients: number
          sent: number
        }
        Insert: {
          created_at?: string
          detail?: string | null
          failed?: number
          function_name: string
          id?: string
          message_id?: string | null
          party_id?: string | null
          recipients?: number
          sent?: number
        }
        Update: {
          created_at?: string
          detail?: string | null
          failed?: number
          function_name?: string
          id?: string
          message_id?: string | null
          party_id?: string | null
          recipients?: number
          sent?: number
        }
        Relationships: []
      }
      scheduled_telegram_jobs: {
        Row: {
          ai_model: string
          ai_prompt: string | null
          created_at: string
          dm_context_mode: string
          dragon_bond: number | null
          dragon_mood: string | null
          dragon_notes: string | null
          dragon_signet: string | null
          error_message: string | null
          id: string
          include_campaign_context: boolean
          job_name: string
          last_result: string | null
          last_run_at: string | null
          party_id: string | null
          repeat_daily: boolean
          run_at: string
          run_time: string | null
          static_message: string | null
          status: string
          target_chat_ids: number[] | null
          target_user_ids: string[] | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_model?: string
          ai_prompt?: string | null
          created_at?: string
          dm_context_mode?: string
          dragon_bond?: number | null
          dragon_mood?: string | null
          dragon_notes?: string | null
          dragon_signet?: string | null
          error_message?: string | null
          id?: string
          include_campaign_context?: boolean
          job_name: string
          last_result?: string | null
          last_run_at?: string | null
          party_id?: string | null
          repeat_daily?: boolean
          run_at: string
          run_time?: string | null
          static_message?: string | null
          status?: string
          target_chat_ids?: number[] | null
          target_user_ids?: string[] | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_model?: string
          ai_prompt?: string | null
          created_at?: string
          dm_context_mode?: string
          dragon_bond?: number | null
          dragon_mood?: string | null
          dragon_notes?: string | null
          dragon_signet?: string | null
          error_message?: string | null
          id?: string
          include_campaign_context?: boolean
          job_name?: string
          last_result?: string | null
          last_run_at?: string | null
          party_id?: string | null
          repeat_daily?: boolean
          run_at?: string
          run_time?: string | null
          static_message?: string | null
          status?: string
          target_chat_ids?: number[] | null
          target_user_ids?: string[] | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      telegram_bot_state: {
        Row: {
          id: number
          update_offset: number
          updated_at: string
        }
        Insert: {
          id: number
          update_offset?: number
          updated_at?: string
        }
        Update: {
          id?: number
          update_offset?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_link_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_messages: {
        Row: {
          chat_id: number
          created_at: string
          raw_update: Json
          text: string | null
          update_id: number
        }
        Insert: {
          chat_id: number
          created_at?: string
          raw_update: Json
          text?: string | null
          update_id: number
        }
        Update: {
          chat_id?: number
          created_at?: string
          raw_update?: Json
          text?: string | null
          update_id?: number
        }
        Relationships: []
      }
      telegram_user_links: {
        Row: {
          chat_id: number
          created_at: string
          id: string
          linked_at: string | null
          nickname: string | null
          notify_combat: boolean
          notify_dragon: boolean
          notify_modes: string[]
          notify_ready_up: boolean
          notify_timer: boolean
          telegram_active_mode: string
          telegram_user_id: number | null
          user_id: string
          username: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string
          id?: string
          linked_at?: string | null
          nickname?: string | null
          notify_combat?: boolean
          notify_dragon?: boolean
          notify_modes?: string[]
          notify_ready_up?: boolean
          notify_timer?: boolean
          telegram_active_mode?: string
          telegram_user_id?: number | null
          user_id: string
          username?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string
          id?: string
          linked_at?: string | null
          nickname?: string | null
          notify_combat?: boolean
          notify_dragon?: boolean
          notify_modes?: string[]
          notify_ready_up?: boolean
          notify_timer?: boolean
          telegram_active_mode?: string
          telegram_user_id?: number | null
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      telegram_yo_history: {
        Row: {
          chat_id: number
          content: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          chat_id: number
          content: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          chat_id?: number
          content?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      tutorials: {
        Row: {
          category: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          sort_order: number
          title: string
          video_url: string
        }
        Insert: {
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          sort_order?: number
          title: string
          video_url: string
        }
        Update: {
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          sort_order?: number
          title?: string
          video_url?: string
        }
        Relationships: []
      }
      universe_events: {
        Row: {
          created_at: string
          created_by_member: string | null
          event_text: string
          event_type: string
          id: string
          importance: number
          is_canon: boolean
          occurred_on_day: number
          universe_id: string
        }
        Insert: {
          created_at?: string
          created_by_member?: string | null
          event_text: string
          event_type?: string
          id?: string
          importance?: number
          is_canon?: boolean
          occurred_on_day?: number
          universe_id: string
        }
        Update: {
          created_at?: string
          created_by_member?: string | null
          event_text?: string
          event_type?: string
          id?: string
          importance?: number
          is_canon?: boolean
          occurred_on_day?: number
          universe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "universe_events_created_by_member_fkey"
            columns: ["created_by_member"]
            isOneToOne: false
            referencedRelation: "universe_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "universe_events_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "linked_universes"
            referencedColumns: ["id"]
          },
        ]
      }
      universe_members: {
        Row: {
          campaign_id: string
          character_card: Json
          character_name: string
          digest_updated_at: string | null
          id: string
          joined_at: string
          region: string | null
          story_day: number
          story_digest: string | null
          universe_id: string
          user_id: string
          visibility: string
        }
        Insert: {
          campaign_id: string
          character_card?: Json
          character_name?: string
          digest_updated_at?: string | null
          id?: string
          joined_at?: string
          region?: string | null
          story_day?: number
          story_digest?: string | null
          universe_id: string
          user_id: string
          visibility?: string
        }
        Update: {
          campaign_id?: string
          character_card?: Json
          character_name?: string
          digest_updated_at?: string | null
          id?: string
          joined_at?: string
          region?: string | null
          story_day?: number
          story_digest?: string | null
          universe_id?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "universe_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ai_dm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "universe_members_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "linked_universes"
            referencedColumns: ["id"]
          },
        ]
      }
      universe_relationships: {
        Row: {
          created_at: string
          id: string
          member_a: string
          member_b: string
          note: string | null
          relation: string
          universe_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_a: string
          member_b: string
          note?: string | null
          relation?: string
          universe_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_a?: string
          member_b?: string
          note?: string | null
          relation?: string
          universe_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "universe_relationships_member_a_fkey"
            columns: ["member_a"]
            isOneToOne: false
            referencedRelation: "universe_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "universe_relationships_member_b_fkey"
            columns: ["member_b"]
            isOneToOne: false
            referencedRelation: "universe_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "universe_relationships_universe_id_fkey"
            columns: ["universe_id"]
            isOneToOne: false
            referencedRelation: "linked_universes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      arm_private_travel_launch: {
        Args: {
          _event_id: string
          _expected_map: Json
          _schedule?: Json
          _started_at: number
        }
        Returns: boolean
      }
      bridge_atlas_location_chain: {
        Args: { _loc: string; _state: Json }
        Returns: Json
      }
      bridge_atlas_validate_full: { Args: { _a: Json }; Returns: undefined }
      bridge_campaign_install_receipt_json: {
        Args: {
          _r: Database["public"]["Tables"]["bridge_campaign_installs"]["Row"]
          _replayed: boolean
        }
        Returns: Json
      }
      bridge_get_campaign_install: {
        Args: { _actor: string; _party_id: string; _request_id: string }
        Returns: Json
      }
      bridge_install_campaign_area: {
        Args: {
          _actor: string
          _area_name: string
          _expected_host_id: string
          _expected_legacy: boolean
          _expected_revision: number
          _expected_updated_at: string
          _guides: Json
          _map_state: Json
          _parent_location_id: string
          _parent_map_id: string
          _party_id: string
          _payload_digest: string
          _request_id: string
        }
        Returns: Json
      }
      campaign_atlas_is_envelope: { Args: { _d: Json }; Returns: boolean }
      campaign_atlas_validate: { Args: { _d: Json }; Returns: undefined }
      can_read_party_location_guides: {
        Args: { _party_id: string }
        Returns: boolean
      }
      claim_travel_event_attempt: { Args: { _event_id: string }; Returns: Json }
      commit_private_travel_plan: {
        Args: {
          _expected_map: Json
          _host_id: string
          _party_id: string
          _plan: Json
        }
        Returns: boolean
      }
      complete_travel_event_post: {
        Args: {
          _content: string
          _event_id: string
          _failed?: boolean
          _lease_id: string
        }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      is_co_host_of: { Args: { _owner_id: string }; Returns: boolean }
      is_party_host: {
        Args: { _party_id: string; _user_id: string }
        Returns: boolean
      }
      is_party_member: {
        Args: { _party_id: string; _user_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      onboarding_begin: {
        Args: { _link_code: string; _user_id: string }
        Returns: Json
      }
      onboarding_context_acquire: {
        Args: { _fingerprint: string; _force: boolean; _party_id: string }
        Returns: Json
      }
      onboarding_context_complete: {
        Args: {
          _expected_revision: number
          _lease_id: string
          _manifest: Json
          _party_id: string
          _player_context: Json
          _source_fingerprint: string
          _starting_rules: Json
        }
        Returns: Json
      }
      onboarding_context_fail: {
        Args: { _error: string; _lease_id: string; _party_id: string }
        Returns: undefined
      }
      onboarding_context_state: { Args: { _party_id: string }; Returns: string }
      onboarding_context_update: {
        Args: {
          _expected_revision: number
          _manifest: Json
          _party_id: string
          _player_context: Json
          _source_fingerprint: string
          _starting_rules: Json
        }
        Returns: Json
      }
      onboarding_finalize: {
        Args: {
          _expected_context_revision: number
          _expected_draft_revision: number
          _payload: Json
          _session_id: string
          _user_id: string
        }
        Returns: Json
      }
      onboarding_finite: { Args: { _v: Json }; Returns: boolean }
      onboarding_gate: {
        Args: { _party_id: string; _user_id: string }
        Returns: string
      }
      onboarding_list: { Args: { _user_id: string }; Returns: Json }
      onboarding_lock: {
        Args: { _party_id: string; _user_id: string }
        Returns: undefined
      }
      onboarding_mark_context_stale: {
        Args: { _party_id: string }
        Returns: undefined
      }
      onboarding_rate_ok: {
        Args: { _kind: string; _max: number; _user_id: string; _window: string }
        Returns: boolean
      }
      onboarding_resume: {
        Args: { _session_id: string; _user_id: string }
        Returns: Json
      }
      onboarding_save_draft: {
        Args: {
          _draft: Json
          _expected_revision: number
          _session_id: string
          _user_id: string
        }
        Returns: Json
      }
      onboarding_session_json: {
        Args: {
          _s: Database["public"]["Tables"]["party_creation_sessions"]["Row"]
          _status: string
        }
        Returns: Json
      }
      party_is_private: { Args: { _party_id: string }; Returns: boolean }
      pause_campaign_travel_for_event: {
        Args: { _event_id: string }
        Returns: Json
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      safe_uuid: { Args: { txt: string }; Returns: string }
      setup_telegram_cron: {
        Args: { base_url: string; service_key: string }
        Returns: undefined
      }
      sync_private_travel_event: {
        Args: {
          _event_id: string
          _expected_map: Json
          _expected_updated_at: string
          _patch: Json
        }
        Returns: boolean
      }
      write_campaign_atlas: {
        Args: {
          _envelope: Json
          _expected_updated_at: string
          _party_id: string
        }
        Returns: {
          id: string
          server_time: string
          state_data: Json
          updated_at: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
