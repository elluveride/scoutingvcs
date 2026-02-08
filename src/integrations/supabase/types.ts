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
          code: string
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
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
      match_entries: {
        Row: {
          auto_fouls_major: number
          auto_fouls_minor: number
          auto_scored_close: number
          auto_scored_far: number
          created_at: string
          defense_rating: number
          endgame_return: Database["public"]["Enums"]["endgame_return_status"]
          event_code: string
          id: string
          match_number: number
          notes: string
          on_launch_line: boolean
          penalty_status: Database["public"]["Enums"]["penalty_status"]
          scouter_id: string
          team_number: number
          teleop_scored_close: number
          teleop_scored_far: number
        }
        Insert: {
          auto_fouls_major?: number
          auto_fouls_minor?: number
          auto_scored_close?: number
          auto_scored_far?: number
          created_at?: string
          defense_rating?: number
          endgame_return?: Database["public"]["Enums"]["endgame_return_status"]
          event_code: string
          id?: string
          match_number: number
          notes?: string
          on_launch_line?: boolean
          penalty_status?: Database["public"]["Enums"]["penalty_status"]
          scouter_id: string
          team_number: number
          teleop_scored_close?: number
          teleop_scored_far?: number
        }
        Update: {
          auto_fouls_major?: number
          auto_fouls_minor?: number
          auto_scored_close?: number
          auto_scored_far?: number
          created_at?: string
          defense_rating?: number
          endgame_return?: Database["public"]["Enums"]["endgame_return_status"]
          event_code?: string
          id?: string
          match_number?: number
          notes?: string
          on_launch_line?: boolean
          penalty_status?: Database["public"]["Enums"]["penalty_status"]
          scouter_id?: string
          team_number?: number
          teleop_scored_close?: number
          teleop_scored_far?: number
        }
        Relationships: []
      }
      pit_entries: {
        Row: {
          auto_consistency: Database["public"]["Enums"]["consistency_level"]
          auto_paths: Json
          drive_type: Database["public"]["Enums"]["drive_type"]
          endgame_consistency: Database["public"]["Enums"]["consistency_level"]
          event_code: string
          full_park_capable: boolean
          has_autonomous: boolean
          id: string
          last_edited_at: string
          last_edited_by: string | null
          partial_park_capable: boolean
          reliable_auto_leave: Database["public"]["Enums"]["auto_leave_status"]
          robot_photo_url: string | null
          scores_artifacts: boolean
          scores_motifs: boolean
          team_name: string
          team_number: number
        }
        Insert: {
          auto_consistency?: Database["public"]["Enums"]["consistency_level"]
          auto_paths?: Json
          drive_type?: Database["public"]["Enums"]["drive_type"]
          endgame_consistency?: Database["public"]["Enums"]["consistency_level"]
          event_code: string
          full_park_capable?: boolean
          has_autonomous?: boolean
          id?: string
          last_edited_at?: string
          last_edited_by?: string | null
          partial_park_capable?: boolean
          reliable_auto_leave?: Database["public"]["Enums"]["auto_leave_status"]
          robot_photo_url?: string | null
          scores_artifacts?: boolean
          scores_motifs?: boolean
          team_name: string
          team_number: number
        }
        Update: {
          auto_consistency?: Database["public"]["Enums"]["consistency_level"]
          auto_paths?: Json
          drive_type?: Database["public"]["Enums"]["drive_type"]
          endgame_consistency?: Database["public"]["Enums"]["consistency_level"]
          event_code?: string
          full_park_capable?: boolean
          has_autonomous?: boolean
          id?: string
          last_edited_at?: string
          last_edited_by?: string | null
          partial_park_capable?: boolean
          reliable_auto_leave?: Database["public"]["Enums"]["auto_leave_status"]
          robot_photo_url?: string | null
          scores_artifacts?: boolean
          scores_motifs?: boolean
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
