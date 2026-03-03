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
      alert_thresholds: {
        Row: {
          cooldown_minutes: number
          created_at: string
          enabled: boolean
          id: string
          last_triggered_at: string | null
          metric: string
          operator: string
          service_id: string
          severity: string
          threshold: number
        }
        Insert: {
          cooldown_minutes?: number
          created_at?: string
          enabled?: boolean
          id?: string
          last_triggered_at?: string | null
          metric: string
          operator?: string
          service_id: string
          severity?: string
          threshold: number
        }
        Update: {
          cooldown_minutes?: number
          created_at?: string
          enabled?: boolean
          id?: string
          last_triggered_at?: string | null
          metric?: string
          operator?: string
          service_id?: string
          severity?: string
          threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "alert_thresholds_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
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
      check_type_status_rules: {
        Row: {
          check_type: string
          created_at: string
          id: string
          offline_rules: Json
          updated_at: string
          warning_rules: Json
        }
        Insert: {
          check_type: string
          created_at?: string
          id?: string
          offline_rules?: Json
          updated_at?: string
          warning_rules?: Json
        }
        Update: {
          check_type?: string
          created_at?: string
          id?: string
          offline_rules?: Json
          updated_at?: string
          warning_rules?: Json
        }
        Relationships: []
      }
      credentials: {
        Row: {
          id: string
          name: string
          credential_type: string
          config: Json
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          credential_type: string
          config?: Json
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          credential_type?: string
          config?: Json
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
      notification_settings: {
        Row: {
          alert_email: string | null
          auto_refresh: boolean
          check_interval_seconds: number
          created_at: string
          generic_webhook_url: string | null
          id: string
          notify_critical_only: boolean
          slack_webhook_url: string | null
          sound_alerts: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_email?: string | null
          auto_refresh?: boolean
          check_interval_seconds?: number
          created_at?: string
          generic_webhook_url?: string | null
          id?: string
          notify_critical_only?: boolean
          slack_webhook_url?: string | null
          sound_alerts?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_email?: string | null
          auto_refresh?: boolean
          check_interval_seconds?: number
          created_at?: string
          generic_webhook_url?: string | null
          id?: string
          notify_critical_only?: boolean
          slack_webhook_url?: string | null
          sound_alerts?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      cleanup_old_health_checks: { Args: never; Returns: undefined }
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
        | "airflow"
        | "lambda"
        | "ecs"
        | "cloudwatch_alarms"
        | "systemctl"
        | "container"
      service_category:
        | "aws"
        | "database"
        | "airflow"
        | "server"
        | "process"
        | "api"
        | "container"
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
        "airflow",
        "lambda",
        "ecs",
        "cloudwatch_alarms",
        "systemctl",
        "container",
      ],
      service_category: [
        "aws",
        "database",
        "airflow",
        "server",
        "process",
        "api",
        "container",
      ],
      service_status: ["online", "offline", "warning", "maintenance"],
    },
  },
} as const
