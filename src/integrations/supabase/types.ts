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
      ai_dm_campaigns: {
        Row: {
          campaign_summary: string | null
          created_at: string
          gm_guide_ids: string[] | null
          id: string
          messages: Json
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_summary?: string | null
          created_at?: string
          gm_guide_ids?: string[] | null
          id?: string
          messages?: Json
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_summary?: string | null
          created_at?: string
          gm_guide_ids?: string[] | null
          id?: string
          messages?: Json
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
      parties: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          link_code: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          link_code: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          link_code?: string
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
          party_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          character_name?: string
          character_status?: Json
          id?: string
          joined_at?: string
          party_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          character_name?: string
          character_status?: Json
          id?: string
          joined_at?: string
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
            referencedRelation: "party_messages"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_party_member: {
        Args: { _party_id: string; _user_id: string }
        Returns: boolean
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
