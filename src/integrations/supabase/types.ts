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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          on_behalf_of: string | null
          project_id: string | null
          text: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          on_behalf_of?: string | null
          project_id?: string | null
          text: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          on_behalf_of?: string | null
          project_id?: string | null
          text?: string
        }
        Relationships: []
      }
      ai_actions: {
        Row: {
          created_at: string
          id: string
          input: Json
          member_id: string | null
          resolved_at: string | null
          result: Json | null
          status: string
          summary: string
          thread_id: string | null
          tool: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input?: Json
          member_id?: string | null
          resolved_at?: string | null
          result?: Json | null
          status: string
          summary?: string
          thread_id?: string | null
          tool: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          input?: Json
          member_id?: string | null
          resolved_at?: string | null
          result?: Json | null
          status?: string
          summary?: string
          thread_id?: string | null
          tool?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          created_at: string
          id: string
          message: Json
          thread_id: string
          ui_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: Json
          thread_id: string
          ui_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: Json
          thread_id?: string
          ui_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ai_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      docs: {
        Row: {
          author_id: string | null
          id: string
          project_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          id?: string
          project_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          id?: string
          project_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "docs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          availability: string
          color: string
          created_at: string
          email: string | null
          id: string
          initials: string
          name: string
          role: string
          user_id: string | null
        }
        Insert: {
          availability?: string
          color?: string
          created_at?: string
          email?: string | null
          id?: string
          initials?: string
          name: string
          role?: string
          user_id?: string | null
        }
        Update: {
          availability?: string
          color?: string
          created_at?: string
          email?: string | null
          id?: string
          initials?: string
          name?: string
          role?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          kind: string
          project_id: string | null
          read: boolean
          recipient_id: string | null
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          project_id?: string | null
          read?: boolean
          recipient_id?: string | null
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          project_id?: string | null
          read?: boolean
          recipient_id?: string | null
          text?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          color: string
          created_at: string
          deadline: string
          description: string
          id: string
          member_ids: string[]
          milestones: Json
          name: string
          owner_id: string | null
          priority: string
          start_date: string
          status: string
        }
        Insert: {
          color?: string
          created_at?: string
          deadline?: string
          description?: string
          id?: string
          member_ids?: string[]
          milestones?: Json
          name: string
          owner_id?: string | null
          priority?: string
          start_date?: string
          status?: string
        }
        Update: {
          color?: string
          created_at?: string
          deadline?: string
          description?: string
          id?: string
          member_ids?: string[]
          milestones?: Json
          name?: string
          owner_id?: string | null
          priority?: string
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          comments: Json
          created_at: string
          depends_on: string[]
          description: string
          due_date: string
          id: string
          labels: string[]
          priority: string
          project_id: string
          reporter_id: string | null
          start_date: string
          status: string
          subtasks: Json
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          comments?: Json
          created_at?: string
          depends_on?: string[]
          description?: string
          due_date?: string
          id?: string
          labels?: string[]
          priority?: string
          project_id: string
          reporter_id?: string | null
          start_date?: string
          status?: string
          subtasks?: Json
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          comments?: Json
          created_at?: string
          depends_on?: string[]
          description?: string
          due_date?: string
          id?: string
          labels?: string[]
          priority?: string
          project_id?: string
          reporter_id?: string | null
          start_date?: string
          status?: string
          subtasks?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      current_member_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "manager" | "member"
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
      app_role: ["admin", "manager", "member"],
    },
  },
} as const
