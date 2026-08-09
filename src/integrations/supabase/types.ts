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
          memory_anchors?: Json
          messages?: Json
          mode?: string
          name?: string
          updated_at?: string
          user_id?: string
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
          consumed_by_dm: boolean
          content: string
          created_at: string
          id: string
          overridden: boolean
          party_id: string
          role: string
          user_id: string
        }
        Insert: {
          category?: string | null
          consumed_by_dm?: boolean
          content: string
          created_at?: string
          id?: string
          overridden?: boolean
          party_id: string
          role: string
          user_id: string
        }
        Update: {
          category?: string | null
          consumed_by_dm?: boolean
          content?: string
          created_at?: string
          id?: string
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
          party_id: string
          round_id: string
          user_id: string
        }
        Insert: {
          character_name?: string
          consumed?: boolean
          content: string
          created_at?: string
          id?: string
          in_character?: boolean
          party_id: string
          round_id: string
          user_id: string
        }
        Update: {
          character_name?: string
          consumed?: boolean
          content?: string
          created_at?: string
          id?: string
          in_character?: boolean
          party_id?: string
          round_id?: string
          user_id?: string
        }
        Relationships: [
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
      party_is_private: { Args: { _party_id: string }; Returns: boolean }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      setup_telegram_cron: {
        Args: { base_url: string; service_key: string }
        Returns: undefined
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
