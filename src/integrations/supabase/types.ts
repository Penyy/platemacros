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
      daily_burned: {
        Row: {
          burned_kcal: number
          created_at: string
          date: string
          id: string
          user_id: string
        }
        Insert: {
          burned_kcal?: number
          created_at?: string
          date: string
          id?: string
          user_id: string
        }
        Update: {
          burned_kcal?: number
          created_at?: string
          date?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      day_offs: {
        Row: {
          created_at: string
          date: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          app_version: string | null
          created_at: string
          id: string
          message: string
          rating: number | null
          type: string | null
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          id?: string
          message: string
          rating?: number | null
          type?: string | null
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          id?: string
          message?: string
          rating?: number | null
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      food_entries: {
        Row: {
          carbs: number
          created_at: string
          date: string
          fat: number
          fiber_g: number | null
          grams: number | null
          id: string
          kcal: number
          meal: string
          name: string
          protein: number
          saturated_fat_g: number | null
          sodium_mg: number | null
          sub_items: Json | null
          sugars_g: number | null
          user_id: string
        }
        Insert: {
          carbs?: number
          created_at?: string
          date: string
          fat?: number
          fiber_g?: number | null
          grams?: number | null
          id?: string
          kcal?: number
          meal: string
          name: string
          protein?: number
          saturated_fat_g?: number | null
          sodium_mg?: number | null
          sub_items?: Json | null
          sugars_g?: number | null
          user_id: string
        }
        Update: {
          carbs?: number
          created_at?: string
          date?: string
          fat?: number
          fiber_g?: number | null
          grams?: number | null
          id?: string
          kcal?: number
          meal?: string
          name?: string
          protein?: number
          saturated_fat_g?: number | null
          sodium_mg?: number | null
          sub_items?: Json | null
          sugars_g?: number | null
          user_id?: string
        }
        Relationships: []
      }
      foods: {
        Row: {
          carbs_100: number
          created_at: string
          fat_100: number
          fiber_g: number | null
          id: string
          kcal_100: number
          name: string
          protein_100: number
          saturated_fat_g: number | null
          sodium_mg: number | null
          sugars_g: number | null
          user_id: string
        }
        Insert: {
          carbs_100?: number
          created_at?: string
          fat_100?: number
          fiber_g?: number | null
          id?: string
          kcal_100?: number
          name: string
          protein_100?: number
          saturated_fat_g?: number | null
          sodium_mg?: number | null
          sugars_g?: number | null
          user_id: string
        }
        Update: {
          carbs_100?: number
          created_at?: string
          fat_100?: number
          fiber_g?: number | null
          id?: string
          kcal_100?: number
          name?: string
          protein_100?: number
          saturated_fat_g?: number | null
          sodium_mg?: number | null
          sugars_g?: number | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_profile: Json | null
          assistant_settings: Json | null
          consider_burned: boolean
          created_at: string
          goal_carbs: number
          goal_fat: number
          goal_kcal: number
          goal_protein: number
          id: string
          theme: string
          updated_at: string
          weekly_macro_targets: Json | null
          weekly_targets_enabled: boolean
        }
        Insert: {
          activity_profile?: Json | null
          assistant_settings?: Json | null
          consider_burned?: boolean
          created_at?: string
          goal_carbs?: number
          goal_fat?: number
          goal_kcal?: number
          goal_protein?: number
          id: string
          theme?: string
          updated_at?: string
          weekly_macro_targets?: Json | null
          weekly_targets_enabled?: boolean
        }
        Update: {
          activity_profile?: Json | null
          assistant_settings?: Json | null
          consider_burned?: boolean
          created_at?: string
          goal_carbs?: number
          goal_fat?: number
          goal_kcal?: number
          goal_protein?: number
          id?: string
          theme?: string
          updated_at?: string
          weekly_macro_targets?: Json | null
          weekly_targets_enabled?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reset_user_data: { Args: never; Returns: undefined }
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
