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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_results: {
        Row: {
          client_id: string | null
          client_name: string | null
          confidence: number | null
          created_at: string
          created_by: string
          event_code: string
          expires_at: string | null
          id: string
          kind: string
          match_label: string | null
          payload: Json
          summary: string
          team_number: number | null
          title: string
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          confidence?: number | null
          created_at?: string
          created_by: string
          event_code: string
          expires_at?: string | null
          id?: string
          kind?: string
          match_label?: string | null
          payload?: Json
          summary: string
          team_number?: number | null
          title: string
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          confidence?: number | null
          created_at?: string
          created_by?: string
          event_code?: string
          expires_at?: string | null
          id?: string
          kind?: string
          match_label?: string | null
          payload?: Json
          summary?: string
          team_number?: number | null
          title?: string
        }
        Relationships: []
      }
      bug_reports: {
        Row: {
          created_at: string
          description: string
          id: string
          page_url: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          page_url: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          page_url?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      dashboard_configs: {
        Row: {
          config_index: number
          event_code: string
          id: string
          list_name: string
          team_number: number
          updated_at: string
          updated_by: string | null
          weights: Json
        }
        Insert: {
          config_index?: number
          event_code: string
          id?: string
          list_name?: string
          team_number: number
          updated_at?: string
          updated_by?: string | null
          weights?: Json
        }
        Update: {
          config_index?: number
          event_code?: string
          id?: string
          list_name?: string
          team_number?: number
          updated_at?: string
          updated_by?: string | null
          weights?: Json
        }
        Relationships: []
      }
      events: {
        Row: {
          archived: boolean
          code: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          season_id: string
        }
        Insert: {
          archived?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          season_id?: string
        }
        Update: {
          archived?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          season_id?: string
        }
        Relationships: []
      }
      ftc_events_cache: {
        Row: {
          city: string | null
          code: string
          country: string | null
          date_end: string
          date_start: string
          last_synced: string
          name: string
          season: number
          state_prov: string | null
          team_numbers: Json
        }
        Insert: {
          city?: string | null
          code: string
          country?: string | null
          date_end: string
          date_start: string
          last_synced?: string
          name: string
          season: number
          state_prov?: string | null
          team_numbers?: Json
        }
        Update: {
          city?: string | null
          code?: string
          country?: string | null
          date_end?: string
          date_start?: string
          last_synced?: string
          name?: string
          season?: number
          state_prov?: string | null
          team_numbers?: Json
        }
        Relationships: []
      }
      maintenance_log: {
        Row: {
          details: Json
          id: string
          job: string
          ran_at: string
          rows_affected: number
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          details?: Json
          id?: string
          job: string
          ran_at?: string
          rows_affected?: number
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          details?: Json
          id?: string
          job?: string
          ran_at?: string
          rows_affected?: number
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: []
      }
      match_entries: {
        Row: {
          auto_fouls_major: number
          auto_fouls_minor: number
          auto_hive_tips: number
          auto_leave: boolean
          auto_park: boolean
          auto_pattern_matches: number
          auto_scored_close: number
          auto_scored_far: number
          created_at: string
          defense_rating: number
          endgame_return: Database["public"]["Enums"]["endgame_return_status"]
          event_code: string
          id: string
          match_number: number
          motif: string
          notes: string
          on_launch_line: boolean
          penalty_status: Database["public"]["Enums"]["penalty_status"]
          scouter_id: string
          team_number: number
          teleop_bottom_nectar: number
          teleop_cell_remaining: number
          teleop_depot: number
          teleop_flower_scored: number
          teleop_garden: number
          teleop_hive_tips: number
          teleop_park: boolean
          teleop_pattern_matches: number
          teleop_scored_close: number
          teleop_scored_far: number
        }
        Insert: {
          auto_fouls_major?: number
          auto_fouls_minor?: number
          auto_hive_tips?: number
          auto_leave?: boolean
          auto_park?: boolean
          auto_pattern_matches?: number
          auto_scored_close?: number
          auto_scored_far?: number
          created_at?: string
          defense_rating?: number
          endgame_return?: Database["public"]["Enums"]["endgame_return_status"]
          event_code: string
          id?: string
          match_number: number
          motif?: string
          notes?: string
          on_launch_line?: boolean
          penalty_status?: Database["public"]["Enums"]["penalty_status"]
          scouter_id: string
          team_number: number
          teleop_bottom_nectar?: number
          teleop_cell_remaining?: number
          teleop_depot?: number
          teleop_flower_scored?: number
          teleop_garden?: number
          teleop_hive_tips?: number
          teleop_park?: boolean
          teleop_pattern_matches?: number
          teleop_scored_close?: number
          teleop_scored_far?: number
        }
        Update: {
          auto_fouls_major?: number
          auto_fouls_minor?: number
          auto_hive_tips?: number
          auto_leave?: boolean
          auto_park?: boolean
          auto_pattern_matches?: number
          auto_scored_close?: number
          auto_scored_far?: number
          created_at?: string
          defense_rating?: number
          endgame_return?: Database["public"]["Enums"]["endgame_return_status"]
          event_code?: string
          id?: string
          match_number?: number
          motif?: string
          notes?: string
          on_launch_line?: boolean
          penalty_status?: Database["public"]["Enums"]["penalty_status"]
          scouter_id?: string
          team_number?: number
          teleop_bottom_nectar?: number
          teleop_cell_remaining?: number
          teleop_depot?: number
          teleop_flower_scored?: number
          teleop_garden?: number
          teleop_hive_tips?: number
          teleop_park?: boolean
          teleop_pattern_matches?: number
          teleop_scored_close?: number
          teleop_scored_far?: number
        }
        Relationships: []
      }
      match_entries_archive: {
        Row: {
          archive_reason: string
          archived_at: string
          auto_fouls_major: number
          auto_fouls_minor: number
          auto_hive_tips: number
          auto_leave: boolean
          auto_park: boolean
          auto_pattern_matches: number
          auto_scored_close: number
          auto_scored_far: number
          created_at: string
          defense_rating: number
          endgame_return: Database["public"]["Enums"]["endgame_return_status"]
          event_code: string
          id: string
          match_number: number
          motif: string
          notes: string
          on_launch_line: boolean
          penalty_status: Database["public"]["Enums"]["penalty_status"]
          scouter_id: string
          team_number: number
          teleop_bottom_nectar: number
          teleop_cell_remaining: number
          teleop_depot: number
          teleop_flower_scored: number
          teleop_garden: number
          teleop_hive_tips: number
          teleop_park: boolean
          teleop_pattern_matches: number
          teleop_scored_close: number
          teleop_scored_far: number
        }
        Insert: {
          archive_reason?: string
          archived_at?: string
          auto_fouls_major?: number
          auto_fouls_minor?: number
          auto_hive_tips?: number
          auto_leave?: boolean
          auto_park?: boolean
          auto_pattern_matches?: number
          auto_scored_close?: number
          auto_scored_far?: number
          created_at?: string
          defense_rating?: number
          endgame_return?: Database["public"]["Enums"]["endgame_return_status"]
          event_code: string
          id?: string
          match_number: number
          motif?: string
          notes?: string
          on_launch_line?: boolean
          penalty_status?: Database["public"]["Enums"]["penalty_status"]
          scouter_id: string
          team_number: number
          teleop_bottom_nectar?: number
          teleop_cell_remaining?: number
          teleop_depot?: number
          teleop_flower_scored?: number
          teleop_garden?: number
          teleop_hive_tips?: number
          teleop_park?: boolean
          teleop_pattern_matches?: number
          teleop_scored_close?: number
          teleop_scored_far?: number
        }
        Update: {
          archive_reason?: string
          archived_at?: string
          auto_fouls_major?: number
          auto_fouls_minor?: number
          auto_hive_tips?: number
          auto_leave?: boolean
          auto_park?: boolean
          auto_pattern_matches?: number
          auto_scored_close?: number
          auto_scored_far?: number
          created_at?: string
          defense_rating?: number
          endgame_return?: Database["public"]["Enums"]["endgame_return_status"]
          event_code?: string
          id?: string
          match_number?: number
          motif?: string
          notes?: string
          on_launch_line?: boolean
          penalty_status?: Database["public"]["Enums"]["penalty_status"]
          scouter_id?: string
          team_number?: number
          teleop_bottom_nectar?: number
          teleop_cell_remaining?: number
          teleop_depot?: number
          teleop_flower_scored?: number
          teleop_garden?: number
          teleop_hive_tips?: number
          teleop_park?: boolean
          teleop_pattern_matches?: number
          teleop_scored_close?: number
          teleop_scored_far?: number
        }
        Relationships: []
      }
      mcp_auth_codes: {
        Row: {
          client_id: string
          code_challenge: string
          code_challenge_method: string
          code_hash: string
          created_at: string
          expires_at: string
          redirect_uri: string
          resource: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          code_challenge: string
          code_challenge_method?: string
          code_hash: string
          created_at?: string
          expires_at: string
          redirect_uri: string
          resource?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          code_challenge?: string
          code_challenge_method?: string
          code_hash?: string
          created_at?: string
          expires_at?: string
          redirect_uri?: string
          resource?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_auth_codes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "mcp_clients"
            referencedColumns: ["client_id"]
          },
        ]
      }
      mcp_clients: {
        Row: {
          client_id: string
          client_name: string
          client_secret_hash: string | null
          client_uri: string | null
          created_at: string
          grant_types: Json
          last_used_at: string | null
          logo_uri: string | null
          redirect_uris: Json
          token_endpoint_auth_method: string
        }
        Insert: {
          client_id: string
          client_name: string
          client_secret_hash?: string | null
          client_uri?: string | null
          created_at?: string
          grant_types?: Json
          last_used_at?: string | null
          logo_uri?: string | null
          redirect_uris?: Json
          token_endpoint_auth_method?: string
        }
        Update: {
          client_id?: string
          client_name?: string
          client_secret_hash?: string | null
          client_uri?: string | null
          created_at?: string
          grant_types?: Json
          last_used_at?: string | null
          logo_uri?: string | null
          redirect_uris?: Json
          token_endpoint_auth_method?: string
        }
        Relationships: []
      }
      mcp_grants: {
        Row: {
          client_id: string
          created_at: string
          id: string
          last_used_at: string | null
          refresh_token_hash: string | null
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          last_used_at?: string | null
          refresh_token_hash?: string | null
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          last_used_at?: string | null
          refresh_token_hash?: string | null
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_grants_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "mcp_clients"
            referencedColumns: ["client_id"]
          },
        ]
      }
      pit_entries: {
        Row: {
          auto_consistency: Database["public"]["Enums"]["consistency_level"]
          auto_paths: Json
          can_tip_hive: boolean
          drive_type: Database["public"]["Enums"]["drive_type"]
          endgame_consistency: Database["public"]["Enums"]["consistency_level"]
          event_code: string
          has_autonomous: boolean
          id: string
          last_edited_at: string
          last_edited_by: string | null
          preferred_start: string
          reliable_auto_leave: Database["public"]["Enums"]["auto_leave_status"]
          robot_photo_url: string | null
          scores_artifacts: boolean
          scores_depot: boolean
          scores_flower: boolean
          scores_garden: boolean
          scores_motifs: boolean
          scores_nectar: boolean
          scores_pollen: boolean
          team_name: string
          team_number: number
        }
        Insert: {
          auto_consistency?: Database["public"]["Enums"]["consistency_level"]
          auto_paths?: Json
          can_tip_hive?: boolean
          drive_type?: Database["public"]["Enums"]["drive_type"]
          endgame_consistency?: Database["public"]["Enums"]["consistency_level"]
          event_code: string
          has_autonomous?: boolean
          id?: string
          last_edited_at?: string
          last_edited_by?: string | null
          preferred_start?: string
          reliable_auto_leave?: Database["public"]["Enums"]["auto_leave_status"]
          robot_photo_url?: string | null
          scores_artifacts?: boolean
          scores_depot?: boolean
          scores_flower?: boolean
          scores_garden?: boolean
          scores_motifs?: boolean
          scores_nectar?: boolean
          scores_pollen?: boolean
          team_name: string
          team_number: number
        }
        Update: {
          auto_consistency?: Database["public"]["Enums"]["consistency_level"]
          auto_paths?: Json
          can_tip_hive?: boolean
          drive_type?: Database["public"]["Enums"]["drive_type"]
          endgame_consistency?: Database["public"]["Enums"]["consistency_level"]
          event_code?: string
          has_autonomous?: boolean
          id?: string
          last_edited_at?: string
          last_edited_by?: string | null
          preferred_start?: string
          reliable_auto_leave?: Database["public"]["Enums"]["auto_leave_status"]
          robot_photo_url?: string | null
          scores_artifacts?: boolean
          scores_depot?: boolean
          scores_flower?: boolean
          scores_garden?: boolean
          scores_motifs?: boolean
          scores_nectar?: boolean
          scores_pollen?: boolean
          team_name?: string
          team_number?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          event_code: string | null
          id: string
          name: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["user_status"]
          team_number: number | null
          team_number_changed_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_code?: string | null
          id: string
          name: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["user_status"]
          team_number?: number | null
          team_number_changed_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_code?: string | null
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["user_status"]
          team_number?: number | null
          team_number_changed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scouter_assignments: {
        Row: {
          created_at: string
          created_by: string
          event_code: string
          id: string
          match_number: number
          position: string
          scouter_id: string
          team_number: number
        }
        Insert: {
          created_at?: string
          created_by: string
          event_code: string
          id?: string
          match_number: number
          position: string
          scouter_id: string
          team_number: number
        }
        Update: {
          created_at?: string
          created_by?: string
          event_code?: string
          id?: string
          match_number?: number
          position?: string
          scouter_id?: string
          team_number?: number
        }
        Relationships: []
      }
      team_change_requests: {
        Row: {
          created_at: string
          current_team_number: number
          id: string
          reason: string
          requested_team_number: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_team_number: number
          id?: string
          reason: string
          requested_team_number: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_team_number?: number
          id?: string
          reason?: string
          requested_team_number?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_agent_results: { Args: never; Returns: number }
      cleanup_expired_mcp_codes: { Args: never; Returns: number }
      cleanup_last_week_matches: {
        Args: { _dry_run?: boolean }
        Returns: number
      }
      create_profile_for_signup: {
        Args: { _name: string; _team_number: number; _user_id: string }
        Returns: undefined
      }
      get_my_team_number: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_allied_team: {
        Args: { team_a: number; team_b: number }
        Returns: boolean
      }
      is_privileged_team: { Args: { _user_id: string }; Returns: boolean }
      mcp_create_auth_code: {
        Args: {
          _client_id: string
          _code_challenge: string
          _code_challenge_method?: string
          _redirect_uri: string
          _resource?: string
        }
        Returns: string
      }
      mcp_get_client: {
        Args: { _client_id: string }
        Returns: {
          client_id: string
          client_name: string
          client_uri: string
          logo_uri: string
          redirect_uris: Json
        }[]
      }
      mcp_list_my_connections: {
        Args: never
        Returns: {
          client_id: string
          client_name: string
          created_at: string
          id: string
          last_used_at: string
        }[]
      }
      mcp_revoke_connection: {
        Args: { _client_id?: string; _grant_id?: string }
        Returns: number
      }
      restore_archived_matches: {
        Args: { _event_code: string; _team_number?: number }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "scout"
      auto_leave_status: "yes" | "sometimes" | "no"
      consistency_level: "low" | "medium" | "high"
      drive_type: "tank" | "mecanum" | "swerve" | "other"
      endgame_return_status: "not_returned" | "partial" | "full" | "lift"
      motif_type: "PPG" | "PGP" | "GPP"
      park_status: "none" | "partial" | "full"
      penalty_status: "none" | "dead" | "yellow_card" | "red_card"
      user_status: "pending" | "approved" | "rejected"
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
    Enums: {
      app_role: ["admin", "scout"],
      auto_leave_status: ["yes", "sometimes", "no"],
      consistency_level: ["low", "medium", "high"],
      drive_type: ["tank", "mecanum", "swerve", "other"],
      endgame_return_status: ["not_returned", "partial", "full", "lift"],
      motif_type: ["PPG", "PGP", "GPP"],
      park_status: ["none", "partial", "full"],
      penalty_status: ["none", "dead", "yellow_card", "red_card"],
      user_status: ["pending", "approved", "rejected"],
    },
  },
} as const
