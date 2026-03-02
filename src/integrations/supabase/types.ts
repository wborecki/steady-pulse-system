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
      alerts: {
        Row: {
          acknowledged: boolean
          created_at: string
          id: string
          message: string
          service_id: string
          type: Database["public"]["Enums"]["alert_type"]
        }
        Insert: {
          acknowledged?: boolean
          created_at?: string
          id?: string
          message: string
          service_id: string
          type?: Database["public"]["Enums"]["alert_type"]
        }
        Update: {
          acknowledged?: boolean
          created_at?: string
          id?: string
          message?: string
          service_id?: string
          type?: Database["public"]["Enums"]["alert_type"]
        }
        Relationships: [
          {
            foreignKeyName: "alerts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      health_checks: {
        Row: {
          checked_at: string
          cpu: number | null
          disk: number | null
          error_message: string | null
          id: string
          memory: number | null
          response_time: number | null
          service_id: string
          status: Database["public"]["Enums"]["service_status"]
          status_code: number | null
        }
        Insert: {
          checked_at?: string
          cpu?: number | null
          disk?: number | null
          error_message?: string | null
          id?: string
          memory?: number | null
          response_time?: number | null
          service_id: string
          status: Database["public"]["Enums"]["service_status"]
          status_code?: number | null
        }
        Update: {
          checked_at?: string
          cpu?: number | null
          disk?: number | null
          error_message?: string | null
          id?: string
          memory?: number | null
          response_time?: number | null
          service_id?: string
          status?: Database["public"]["Enums"]["service_status"]
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "health_checks_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: Database["public"]["Enums"]["service_category"]
          check_config: Json | null
          check_interval_seconds: number
          check_type: Database["public"]["Enums"]["check_type"]
          cpu: number
          created_at: string
          description: string
          disk: number
          enabled: boolean
          id: string
          last_check: string | null
          memory: number
          name: string
          region: string | null
          response_time: number
          status: Database["public"]["Enums"]["service_status"]
          updated_at: string
          uptime: number
          url: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["service_category"]
          check_config?: Json | null
          check_interval_seconds?: number
          check_type?: Database["public"]["Enums"]["check_type"]
          cpu?: number
          created_at?: string
          description?: string
          disk?: number
          enabled?: boolean
          id?: string
          last_check?: string | null
          memory?: number
          name: string
          region?: string | null
          response_time?: number
          status?: Database["public"]["Enums"]["service_status"]
          updated_at?: string
          uptime?: number
          url?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["service_category"]
          check_config?: Json | null
          check_interval_seconds?: number
          check_type?: Database["public"]["Enums"]["check_type"]
          cpu?: number
          created_at?: string
          description?: string
          disk?: number
          enabled?: boolean
          id?: string
          last_check?: string | null
          memory?: number
          name?: string
          region?: string | null
          response_time?: number
          status?: Database["public"]["Enums"]["service_status"]
          updated_at?: string
          uptime?: number
          url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_uptime: { Args: { p_service_id: string }; Returns: number }
    }
    Enums: {
      alert_type: "critical" | "warning" | "info"
      check_type:
        | "http"
        | "tcp"
        | "process"
        | "sql_query"
        | "custom"
        | "postgresql"
        | "mongodb"
        | "cloudwatch"
        | "s3"
      service_category:
        | "aws"
        | "database"
        | "airflow"
        | "server"
        | "process"
        | "api"
      service_status: "online" | "offline" | "warning" | "maintenance"
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
      alert_type: ["critical", "warning", "info"],
      check_type: [
        "http",
        "tcp",
        "process",
        "sql_query",
        "custom",
        "postgresql",
        "mongodb",
        "cloudwatch",
        "s3",
      ],
      service_category: [
        "aws",
        "database",
        "airflow",
        "server",
        "process",
        "api",
      ],
      service_status: ["online", "offline", "warning", "maintenance"],
    },
  },
} as const
