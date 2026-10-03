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
      action_logs: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
          target_user_id: string | null
          task_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
          target_user_id?: string | null
          task_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
          target_user_id?: string | null
          task_id?: string | null
        }
        Relationships: []
      }
      boards: {
        Row: {
          created_at: string
          icon: string
          id: string
          name_en: string
          name_ru: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          name_en: string
          name_ru: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          name_en?: string
          name_ru?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      buyer_chat_messages: {
        Row: {
          as_buyer: boolean
          body: string | null
          buyer_id: string
          created_at: string
          designer_id: string
          id: string
          image_url: string | null
          sender_id: string
        }
        Insert: {
          as_buyer?: boolean
          body?: string | null
          buyer_id: string
          created_at?: string
          designer_id: string
          id?: string
          image_url?: string | null
          sender_id: string
        }
        Update: {
          as_buyer?: boolean
          body?: string | null
          buyer_id?: string
          created_at?: string
          designer_id?: string
          id?: string
          image_url?: string | null
          sender_id?: string
        }
        Relationships: []
      }
      buyer_real_names: {
        Row: {
          buyer_id: string
          created_at: string
          real_name: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          real_name?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          real_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_real_names_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: true
            referencedRelation: "profiles"
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
      guide_files: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          guide_id: string
          id: string
          mime_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          guide_id: string
          id?: string
          mime_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          guide_id?: string
          id?: string
          mime_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_files_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
        ]
      }
      guides: {
        Row: {
          category: string | null
          content: string
          created_at: string
          created_by: string
          id: string
          section: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          content?: string
          created_at?: string
          created_by: string
          id?: string
          section?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          section?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned: boolean
          created_at: string
          email: string | null
          id: string
          name: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          banned?: boolean
          created_at?: string
          email?: string | null
          id: string
          name?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          banned?: boolean
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
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
      task_attachments: {
        Row: {
          category: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_chat_messages: {
        Row: {
          as_buyer: boolean
          body: string | null
          created_at: string
          id: string
          image_url: string | null
          sender_id: string
          task_id: string
        }
        Insert: {
          as_buyer?: boolean
          body?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          sender_id: string
          task_id: string
        }
        Update: {
          as_buyer?: boolean
          body?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          sender_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_chat_messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          board: string
          buyer_id: string | null
          completed_at: string | null
          complexity: number | null
          created_at: string
          created_by: string | null
          description: string | null
          direction: string | null
          id: string
          in_progress_at: string | null
          paused_at: string | null
          paused_total_ms: number
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          task_code: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          board?: string
          buyer_id?: string | null
          completed_at?: string | null
          complexity?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction?: string | null
          id?: string
          in_progress_at?: string | null
          paused_at?: string | null
          paused_total_ms?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          task_code?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          board?: string
          buyer_id?: string | null
          completed_at?: string | null
          complexity?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction?: string | null
          id?: string
          in_progress_at?: string | null
          paused_at?: string | null
          paused_total_ms?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          task_code?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_memberships: {
        Row: {
          created_at: string
          id: string
          member_id: string
          teamlead_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          teamlead_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          teamlead_id?: string
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
      telegram_deferred_messages: {
        Row: {
          chat_ids: string[]
          created_at: string
          id: string
          parse_mode: string
          sent_at: string | null
          text: string
        }
        Insert: {
          chat_ids: string[]
          created_at?: string
          id?: string
          parse_mode?: string
          sent_at?: string | null
          text: string
        }
        Update: {
          chat_ids?: string[]
          created_at?: string
          id?: string
          parse_mode?: string
          sent_at?: string | null
          text?: string
        }
        Relationships: []
      }
      telegram_group_chats: {
        Row: {
          chat_id: string
          created_at: string
          id: string
          label: string | null
          user_id: string | null
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: string
          label?: string | null
          user_id?: string | null
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          label?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_group_chats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_last_visits: {
        Row: {
          country: string | null
          ip_address: unknown
          last_seen_at: string
          user_id: string
        }
        Insert: {
          country?: string | null
          ip_address?: unknown
          last_seen_at?: string
          user_id: string
        }
        Update: {
          country?: string | null
          ip_address?: unknown
          last_seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_last_visits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
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
      can_access_task_file: { Args: { _path: string }; Returns: boolean }
      cleanup_expired_submissions: { Args: never; Returns: undefined }
      cleanup_old_chat_images: { Args: never; Returns: undefined }
      cleanup_old_tasks: { Args: never; Returns: number }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_user_stats: {
        Args: { _from: string; _to: string }
        Returns: {
          done_tasks: number
          total_tasks: number
          user_id: string
          user_name: string
          workload_hours: number
        }[]
      }
      log_action: {
        Args: {
          _action: string
          _details?: Json
          _entity_id?: string
          _entity_type: string
          _target_user_id?: string
          _task_id?: string
        }
        Returns: string
      }
      log_actions_batch: { Args: { _events: Json }; Returns: number }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "teamlead" | "buyer"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "review" | "corrections" | "done"
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
      app_role: ["admin", "user", "teamlead", "buyer"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "review", "corrections", "done"],
    },
  },
} as const
