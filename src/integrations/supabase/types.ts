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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          company_id: string
          content: string
          created_at: string
          created_by: string | null
          date: string
          id: string
          outcome: string | null
          owner_name: string | null
          property_id: string | null
          realtor_id: string | null
          type: string
        }
        Insert: {
          company_id: string
          content?: string
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          outcome?: string | null
          owner_name?: string | null
          property_id?: string | null
          realtor_id?: string | null
          type: string
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          outcome?: string | null
          owner_name?: string | null
          property_id?: string | null
          realtor_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_realtor_id_fkey"
            columns: ["realtor_id"]
            isOneToOne: false
            referencedRelation: "realtors"
            referencedColumns: ["id"]
          },
        ]
      }
      call_list_items: {
        Row: {
          call_count: number | null
          call_list_id: string
          call_outcome: string | null
          callback_date: string | null
          company_id: string
          created_at: string | null
          id: string
          last_called_at: string | null
          notes: string | null
          owner_index: number | null
          phone_index: number | null
          property_id: string
          sort_order: number | null
          status: string | null
        }
        Insert: {
          call_count?: number | null
          call_list_id: string
          call_outcome?: string | null
          callback_date?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          last_called_at?: string | null
          notes?: string | null
          owner_index?: number | null
          phone_index?: number | null
          property_id: string
          sort_order?: number | null
          status?: string | null
        }
        Update: {
          call_count?: number | null
          call_list_id?: string
          call_outcome?: string | null
          callback_date?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          last_called_at?: string | null
          notes?: string | null
          owner_index?: number | null
          phone_index?: number | null
          property_id?: string
          sort_order?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_list_items_call_list_id_fkey"
            columns: ["call_list_id"]
            isOneToOne: false
            referencedRelation: "call_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      call_lists: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string | null
          id: string
          name: string
          subscription_status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          subscription_status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          subscription_status?: string | null
        }
        Relationships: []
      }
      company_api_keys: {
        Row: {
          api_key: string
          company_id: string
          created_at: string
          id: string
          service_name: string
          updated_at: string
        }
        Insert: {
          api_key: string
          company_id: string
          created_at?: string
          id?: string
          service_name: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          company_id?: string
          created_at?: string
          id?: string
          service_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_api_keys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          company_id: string
          contact_email: string | null
          contact_name: string
          contact_phone: string | null
          created_at: string
          created_by: string | null
          deal_value: number | null
          id: string
          notes: string | null
          property_id: string | null
          realtor_id: string | null
          stage_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          deal_value?: number | null
          id?: string
          notes?: string | null
          property_id?: string | null
          realtor_id?: string | null
          stage_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          deal_value?: number | null
          id?: string
          notes?: string | null
          property_id?: string | null
          realtor_id?: string | null
          stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_realtor_id_fkey"
            columns: ["realtor_id"]
            isOneToOne: false
            referencedRelation: "realtors"
            referencedColumns: ["id"]
          },
        ]
      }
      email_attachments: {
        Row: {
          company_id: string
          created_at: string
          filename: string
          gmail_attachment_id: string | null
          id: string
          message_id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          company_id: string
          created_at?: string
          filename: string
          gmail_attachment_id?: string | null
          id?: string
          message_id: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          company_id?: string
          created_at?: string
          filename?: string
          gmail_attachment_id?: string | null
          id?: string
          message_id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: []
      }
      email_messages: {
        Row: {
          body_html: string | null
          body_text: string | null
          cc_emails: Json | null
          company_id: string
          created_at: string
          direction: string
          from_email: string | null
          from_name: string | null
          gmail_account_id: string
          gmail_message_id: string
          id: string
          is_read: boolean
          match_status: string | null
          owner_id: string | null
          property_id: string | null
          realtor_id: string | null
          sent_at: string | null
          snippet: string | null
          subject: string | null
          thread_id: string
          to_emails: Json | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          cc_emails?: Json | null
          company_id: string
          created_at?: string
          direction?: string
          from_email?: string | null
          from_name?: string | null
          gmail_account_id: string
          gmail_message_id: string
          id?: string
          is_read?: boolean
          match_status?: string | null
          owner_id?: string | null
          property_id?: string | null
          realtor_id?: string | null
          sent_at?: string | null
          snippet?: string | null
          subject?: string | null
          thread_id: string
          to_emails?: Json | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          cc_emails?: Json | null
          company_id?: string
          created_at?: string
          direction?: string
          from_email?: string | null
          from_name?: string | null
          gmail_account_id?: string
          gmail_message_id?: string
          id?: string
          is_read?: boolean
          match_status?: string | null
          owner_id?: string | null
          property_id?: string | null
          realtor_id?: string | null
          sent_at?: string | null
          snippet?: string | null
          subject?: string | null
          thread_id?: string
          to_emails?: Json | null
        }
        Relationships: []
      }
      email_threads: {
        Row: {
          company_id: string
          created_at: string
          gmail_account_id: string
          gmail_thread_id: string
          id: string
          is_read: boolean
          last_message_at: string | null
          participants: Json | null
          snippet: string | null
          subject: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          gmail_account_id: string
          gmail_thread_id: string
          id?: string
          is_read?: boolean
          last_message_at?: string | null
          participants?: Json | null
          snippet?: string | null
          subject?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          gmail_account_id?: string
          gmail_thread_id?: string
          id?: string
          is_read?: boolean
          last_message_at?: string | null
          participants?: Json | null
          snippet?: string | null
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      exclusion_list: {
        Row: {
          address: string | null
          city: string | null
          company_id: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          normalized_address: string | null
          notes: string | null
          owner_name: string | null
          phone: string | null
          source: string
          state: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          normalized_address?: string | null
          notes?: string | null
          owner_name?: string | null
          phone?: string | null
          source?: string
          state?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          normalized_address?: string | null
          notes?: string | null
          owner_name?: string | null
          phone?: string | null
          source?: string
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exclusion_list_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      field_definitions: {
        Row: {
          company_id: string
          created_at: string
          field_key: string
          id: string
          is_hidden: boolean
          is_system: boolean
          label: string
          options: Json | null
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          field_key: string
          id?: string
          is_hidden?: boolean
          is_system?: boolean
          label: string
          options?: Json | null
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          field_key?: string
          id?: string
          is_hidden?: boolean
          is_system?: boolean
          label?: string
          options?: Json | null
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      gmail_accounts: {
        Row: {
          access_token: string | null
          company_id: string
          created_at: string
          display_name: string | null
          email_address: string
          id: string
          is_active: boolean
          last_history_id: string | null
          last_synced_at: string | null
          refresh_token: string | null
          signature: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          company_id: string
          created_at?: string
          display_name?: string | null
          email_address: string
          id?: string
          is_active?: boolean
          last_history_id?: string | null
          last_synced_at?: string | null
          refresh_token?: string | null
          signature?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          company_id?: string
          created_at?: string
          display_name?: string | null
          email_address?: string
          id?: string
          is_active?: boolean
          last_history_id?: string | null
          last_synced_at?: string | null
          refresh_token?: string | null
          signature?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mailing_list_items: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          mailing_list_id: string
          property_id: string
          sort_order: number | null
          status: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          mailing_list_id: string
          property_id: string
          sort_order?: number | null
          status?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          mailing_list_id?: string
          property_id?: string
          sort_order?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mailing_list_items_mailing_list_id_fkey"
            columns: ["mailing_list_id"]
            isOneToOne: false
            referencedRelation: "mailing_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      mailing_lists: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          export_count: number | null
          exported_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          export_count?: number | null
          exported_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          export_count?: number | null
          exported_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      owners: {
        Row: {
          age: number | null
          company_id: string
          contact_name: string | null
          created_at: string
          email: string | null
          emails: Json | null
          id: string
          last_verified_date: string | null
          litigator: boolean | null
          mailing_address: string | null
          mailing_city: string | null
          mailing_state: string | null
          mailing_zip: string | null
          name: string
          notes: string | null
          owner_occupied: boolean | null
          owner_type: string | null
          owners: Json | null
          ownership_length_months: number | null
          phone: string | null
          phones: Json | null
          property_id: string
          updated_at: string
        }
        Insert: {
          age?: number | null
          company_id: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          emails?: Json | null
          id?: string
          last_verified_date?: string | null
          litigator?: boolean | null
          mailing_address?: string | null
          mailing_city?: string | null
          mailing_state?: string | null
          mailing_zip?: string | null
          name?: string
          notes?: string | null
          owner_occupied?: boolean | null
          owner_type?: string | null
          owners?: Json | null
          ownership_length_months?: number | null
          phone?: string | null
          phones?: Json | null
          property_id: string
          updated_at?: string
        }
        Update: {
          age?: number | null
          company_id?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          emails?: Json | null
          id?: string
          last_verified_date?: string | null
          litigator?: boolean | null
          mailing_address?: string | null
          mailing_city?: string | null
          mailing_state?: string | null
          mailing_zip?: string | null
          name?: string
          notes?: string | null
          owner_occupied?: boolean | null
          owner_type?: string | null
          owners?: Json | null
          ownership_length_months?: number | null
          phone?: string | null
          phones?: Json | null
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owners_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string
          company_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id: string
          name: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string
          airbnb_listing_id: string | null
          airbnb_url: string | null
          bathrooms: number
          bedrooms: number
          booking_link: string | null
          city: string
          company_id: string
          created_at: string
          custom_fields: Json | null
          guests: number | null
          host: string | null
          id: string
          image: string | null
          latitude: number | null
          listing_title: string | null
          longitude: number | null
          lot_size: number | null
          market_data: Json | null
          property_manager: string | null
          property_type: string | null
          property_url: string | null
          room_type: string | null
          square_feet: number | null
          stage_id: string | null
          state: string
          tags: string[] | null
          updated_at: string
          year_built: number | null
          zillow_url: string | null
          zip: string
        }
        Insert: {
          address: string
          airbnb_listing_id?: string | null
          airbnb_url?: string | null
          bathrooms?: number
          bedrooms?: number
          booking_link?: string | null
          city?: string
          company_id: string
          created_at?: string
          custom_fields?: Json | null
          guests?: number | null
          host?: string | null
          id?: string
          image?: string | null
          latitude?: number | null
          listing_title?: string | null
          longitude?: number | null
          lot_size?: number | null
          market_data?: Json | null
          property_manager?: string | null
          property_type?: string | null
          property_url?: string | null
          room_type?: string | null
          square_feet?: number | null
          stage_id?: string | null
          state?: string
          tags?: string[] | null
          updated_at?: string
          year_built?: number | null
          zillow_url?: string | null
          zip?: string
        }
        Update: {
          address?: string
          airbnb_listing_id?: string | null
          airbnb_url?: string | null
          bathrooms?: number
          bedrooms?: number
          booking_link?: string | null
          city?: string
          company_id?: string
          created_at?: string
          custom_fields?: Json | null
          guests?: number | null
          host?: string | null
          id?: string
          image?: string | null
          latitude?: number | null
          listing_title?: string | null
          longitude?: number | null
          lot_size?: number | null
          market_data?: Json | null
          property_manager?: string | null
          property_type?: string | null
          property_url?: string | null
          room_type?: string | null
          square_feet?: number | null
          stage_id?: string | null
          state?: string
          tags?: string[] | null
          updated_at?: string
          year_built?: number | null
          zillow_url?: string | null
          zip?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      realtors: {
        Row: {
          company_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      saved_lists: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          match_type: string
          name: string
          rules: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          match_type?: string
          name: string
          rules?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          match_type?: string
          name?: string
          rules?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_lists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      get_unique_tags: {
        Args: { p_company_id: string }
        Returns: {
          tag: string
        }[]
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "member"
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
      app_role: ["admin", "member"],
    },
  },
} as const
