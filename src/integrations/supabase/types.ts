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
      activity_log: {
        Row: {
          action: string
          created_at: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      banned_users: {
        Row: {
          banned_by: string | null
          created_at: string
          reason: string | null
          user_id: string
        }
        Insert: {
          banned_by?: string | null
          created_at?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          banned_by?: string | null
          created_at?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      banned_words: {
        Row: {
          created_at: string
          id: string
          word: string
        }
        Insert: {
          created_at?: string
          id?: string
          word: string
        }
        Update: {
          created_at?: string
          id?: string
          word?: string
        }
        Relationships: []
      }
      character_abilities: {
        Row: {
          ability_key: string
          created_at: string
          entity_id: string
          id: string
          level: number
          note: string | null
          season_number: number | null
          series_id: string | null
        }
        Insert: {
          ability_key: string
          created_at?: string
          entity_id: string
          id?: string
          level?: number
          note?: string | null
          season_number?: number | null
          series_id?: string | null
        }
        Update: {
          ability_key?: string
          created_at?: string
          entity_id?: string
          id?: string
          level?: number
          note?: string | null
          season_number?: number | null
          series_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "character_abilities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_abilities_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      character_relationships: {
        Row: {
          character_id_1: string
          character_id_2: string
          created_at: string
          id: string
          relationship_type: string
        }
        Insert: {
          character_id_1: string
          character_id_2: string
          created_at?: string
          id?: string
          relationship_type: string
        }
        Update: {
          character_id_1?: string
          character_id_2?: string
          created_at?: string
          id?: string
          relationship_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_relationships_character_id_1_fkey"
            columns: ["character_id_1"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_relationships_character_id_2_fkey"
            columns: ["character_id_2"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          author_name: string | null
          body: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
        }
        Insert: {
          author_id?: string
          author_name?: string | null
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
        }
        Update: {
          author_id?: string
          author_name?: string | null
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          abilities: string[]
          accent_glow: string | null
          alias: string | null
          animation_style: string | null
          beast_traits: string[]
          card_theme: string | null
          category: string | null
          character_tier: string | null
          created_at: string
          description: string
          id: string
          image_url: string | null
          kind: Database["public"]["Enums"]["entity_kind"]
          locked_fields: string[]
          name: string
          parent_id: string | null
          role: string | null
          sketches: string[]
          stats: Json
          status: string
          theme_color: string | null
          theme_song_url: string | null
          updated_at: string
        }
        Insert: {
          abilities?: string[]
          accent_glow?: string | null
          alias?: string | null
          animation_style?: string | null
          beast_traits?: string[]
          card_theme?: string | null
          category?: string | null
          character_tier?: string | null
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          kind: Database["public"]["Enums"]["entity_kind"]
          locked_fields?: string[]
          name: string
          parent_id?: string | null
          role?: string | null
          sketches?: string[]
          stats?: Json
          status?: string
          theme_color?: string | null
          theme_song_url?: string | null
          updated_at?: string
        }
        Update: {
          abilities?: string[]
          accent_glow?: string | null
          alias?: string | null
          animation_style?: string | null
          beast_traits?: string[]
          card_theme?: string | null
          category?: string | null
          character_tier?: string | null
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          kind?: Database["public"]["Enums"]["entity_kind"]
          locked_fields?: string[]
          name?: string
          parent_id?: string | null
          role?: string | null
          sketches?: string[]
          stats?: Json
          status?: string
          theme_color?: string | null
          theme_song_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entities_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_memberships: {
        Row: {
          character_id: string
          created_at: string
          group_id: string
          id: string
          status: string
        }
        Insert: {
          character_id: string
          created_at?: string
          group_id: string
          id?: string
          status?: string
        }
        Update: {
          character_id?: string
          created_at?: string
          group_id?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_memberships_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_relations: {
        Row: {
          created_at: string
          id: string
          label: string | null
          rel: string
          source_id: string
          target_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          rel: string
          source_id: string
          target_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          rel?: string
          source_id?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_relations_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_relations_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      episodes: {
        Row: {
          body: string
          created_at: string
          id: string
          series: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          series?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          series?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ingest_jobs: {
        Row: {
          created_at: string
          filename: string
          id: string
          summary: Json
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          summary?: Json
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          summary?: Json
        }
        Relationships: []
      }
      lore_notes: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          source: string | null
          text: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          source?: string | null
          text: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          source?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "lore_notes_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      map_locations: {
        Row: {
          battles: string
          created_at: string
          era: string | null
          faction: string | null
          id: string
          name: string
          pos_x: number
          pos_y: number
          report: string
          sentinels: string
          updated_at: string
        }
        Insert: {
          battles?: string
          created_at?: string
          era?: string | null
          faction?: string | null
          id?: string
          name: string
          pos_x?: number
          pos_y?: number
          report?: string
          sentinels?: string
          updated_at?: string
        }
        Update: {
          battles?: string
          created_at?: string
          era?: string | null
          faction?: string | null
          id?: string
          name?: string
          pos_x?: number
          pos_y?: number
          report?: string
          sentinels?: string
          updated_at?: string
        }
        Relationships: []
      }
      pdf_chunks: {
        Row: {
          chunk_index: number
          content_text: string
          created_at: string
          embedding: string | null
          id: string
          pdf_id: string
        }
        Insert: {
          chunk_index: number
          content_text: string
          created_at?: string
          embedding?: string | null
          id?: string
          pdf_id: string
        }
        Update: {
          chunk_index?: number
          content_text?: string
          created_at?: string
          embedding?: string | null
          id?: string
          pdf_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdf_chunks_pdf_id_fkey"
            columns: ["pdf_id"]
            isOneToOne: false
            referencedRelation: "pdf_vault"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_vault: {
        Row: {
          chunk_count: number
          file_name: string
          id: string
          status: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          chunk_count?: number
          file_name: string
          id?: string
          status?: string
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          chunk_count?: number
          file_name?: string
          id?: string
          status?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      post_votes: {
        Row: {
          post_id: string
          user_id: string
        }
        Insert: {
          post_id: string
          user_id?: string
        }
        Update: {
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          author_name: string | null
          body: string
          created_at: string
          id: string
          title: string
        }
        Insert: {
          author_id?: string
          author_name?: string | null
          body: string
          created_at?: string
          id?: string
          title: string
        }
        Update: {
          author_id?: string
          author_name?: string | null
          body?: string
          created_at?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      series: {
        Row: {
          cover_image_url: string | null
          description: string
          genres: string[]
          id: string
          season_count: number | null
          season_names: string[]
          timeline_note: string | null
          title: string
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          description?: string
          genres?: string[]
          id?: string
          season_count?: number | null
          season_names?: string[]
          timeline_note?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          description?: string
          genres?: string[]
          id?: string
          season_count?: number | null
          season_names?: string[]
          timeline_note?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      series_characters: {
        Row: {
          arc_role: string | null
          card_theme: string | null
          character_id: string
          created_at: string
          id: string
          role_in_series: string | null
          series_id: string
          status: string
        }
        Insert: {
          arc_role?: string | null
          card_theme?: string | null
          character_id: string
          created_at?: string
          id?: string
          role_in_series?: string | null
          series_id: string
          status?: string
        }
        Update: {
          arc_role?: string | null
          card_theme?: string | null
          character_id?: string
          created_at?: string
          id?: string
          role_in_series?: string | null
          series_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_characters_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_characters_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_events: {
        Row: {
          created_at: string
          description: string
          era: string | null
          id: string
          impact: number
          series: string | null
          sort_order: number
          source: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string
          era?: string | null
          id?: string
          impact?: number
          series?: string | null
          sort_order?: number
          source?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          era?: string | null
          id?: string
          impact?: number
          series?: string | null
          sort_order?: number
          source?: string | null
          title?: string
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
      vault_documents: {
        Row: {
          created_at: string
          downloadable: boolean
          file_path: string
          id: string
          is_public: boolean
          title: string
        }
        Insert: {
          created_at?: string
          downloadable?: boolean
          file_path: string
          id?: string
          is_public?: boolean
          title: string
        }
        Update: {
          created_at?: string
          downloadable?: boolean
          file_path?: string
          id?: string
          is_public?: boolean
          title?: string
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
      is_banned: { Args: { _uid: string }; Returns: boolean }
      is_staff: { Args: { _uid: string }; Returns: boolean }
      lookup_login_email: { Args: { p_username: string }; Returns: string }
      match_pdf_chunks: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          chunk_index: number
          content_text: string
          file_name: string
          pdf_id: string
          similarity: number
        }[]
      }
      merge_entities: {
        Args: { primary_id: string; secondary_id: string }
        Returns: Json
      }
      remap_series_characters: {
        Args: { p_primary: string; p_secondary: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      entity_kind:
        | "character"
        | "organization"
        | "clan"
        | "bloodline"
        | "faction"
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
      app_role: ["admin", "moderator", "user"],
      entity_kind: [
        "character",
        "organization",
        "clan",
        "bloodline",
        "faction",
      ],
    },
  },
} as const
