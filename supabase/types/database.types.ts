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
      market_assets: {
        Row: {
          collection_id: string
          created_at: string
          created_by: string | null
          description: string | null
          gift_type_id: string | null
          id: string
          image_url: string | null
          initial_price: number
          max_supply: number
          metadata: Json
          model_format: string | null
          model_size_bytes: number | null
          model_url: string | null
          name: string
          published_at: string | null
          rarity: string | null
          status: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          gift_type_id?: string | null
          id?: string
          image_url?: string | null
          initial_price?: number
          max_supply: number
          metadata?: Json
          model_format?: string | null
          model_size_bytes?: number | null
          model_url?: string | null
          name: string
          published_at?: string | null
          rarity?: string | null
          status?: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          gift_type_id?: string | null
          id?: string
          image_url?: string | null
          initial_price?: number
          max_supply?: number
          metadata?: Json
          model_format?: string | null
          model_size_bytes?: number | null
          model_url?: string | null
          name?: string
          published_at?: string | null
          rarity?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_assets_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "market_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_assets_gift_type_id_fkey"
            columns: ["gift_type_id"]
            isOneToOne: false
            referencedRelation: "market_gift_types"
            referencedColumns: ["id"]
          },
        ]
      }
      market_collectibles: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          minted_at: string
          owner_id: string | null
          serial_number: number
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          minted_at?: string
          owner_id?: string | null
          serial_number: number
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          minted_at?: string
          owner_id?: string | null
          serial_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "market_collectibles_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "market_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      market_collections: {
        Row: {
          cover_url: string | null
          created_at: string
          creator_id: string | null
          description: string | null
          id: string
          name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          creator_id?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          creator_id?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      market_events: {
        Row: {
          body: string | null
          created_at: string
          ends_at: string | null
          id: string
          starts_at: string | null
          status: string
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          starts_at?: string | null
          status?: string
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          starts_at?: string | null
          status?: string
          title?: string
        }
        Relationships: []
      }
      market_exchange_rates: {
        Row: {
          base_currency: string
          fetched_at: string
          quote_currency: string
          rate: number
          source: string
          source_date: string | null
        }
        Insert: {
          base_currency: string
          fetched_at?: string
          quote_currency: string
          rate: number
          source: string
          source_date?: string | null
        }
        Update: {
          base_currency?: string
          fetched_at?: string
          quote_currency?: string
          rate?: number
          source?: string
          source_date?: string | null
        }
        Relationships: []
      }
      market_favorites: {
        Row: {
          asset_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_favorites_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "market_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      market_gift_types: {
        Row: {
          collection_id: string
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          collection_id: string
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          collection_id?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_gift_types_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "market_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      market_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          notification_type: string
          payload: Json
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          notification_type: string
          payload?: Json
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          notification_type?: string
          payload?: Json
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      market_orders: {
        Row: {
          asset_id: string
          collectible_id: string
          created_at: string
          expires_at: string | null
          id: string
          idempotency_key: string | null
          price: number
          reserved_amount: number
          scope: string
          side: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_id: string
          collectible_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          price: number
          reserved_amount?: number
          scope?: string
          side: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_id?: string
          collectible_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          price?: number
          reserved_amount?: number
          scope?: string
          side?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_orders_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "market_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_orders_collectible_id_fkey"
            columns: ["collectible_id"]
            isOneToOne: false
            referencedRelation: "market_collectibles"
            referencedColumns: ["id"]
          },
        ]
      }
      market_price_candles: {
        Row: {
          asset_id: string
          bucket: string
          close_price: number
          high_price: number
          id: number
          low_price: number
          open_price: number
          timeframe: string
          trade_count: number
          volume: number
        }
        Insert: {
          asset_id: string
          bucket: string
          close_price: number
          high_price: number
          id?: never
          low_price: number
          open_price: number
          timeframe: string
          trade_count?: number
          volume?: number
        }
        Update: {
          asset_id?: string
          bucket?: string
          close_price?: number
          high_price?: number
          id?: never
          low_price?: number
          open_price?: number
          timeframe?: string
          trade_count?: number
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "market_price_candles_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "market_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      market_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          handle: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          handle: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          handle?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      market_telegram_accounts: {
        Row: {
          created_at: string
          first_name: string
          last_name: string | null
          photo_url: string | null
          telegram_id: string
          telegram_username: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          first_name: string
          last_name?: string | null
          photo_url?: string | null
          telegram_id: string
          telegram_username?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          first_name?: string
          last_name?: string | null
          photo_url?: string | null
          telegram_id?: string
          telegram_username?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      market_telegram_auth_nonces: {
        Row: {
          auth_hash: string
          created_at: string
          expires_at: string
        }
        Insert: {
          auth_hash: string
          created_at?: string
          expires_at: string
        }
        Update: {
          auth_hash?: string
          created_at?: string
          expires_at?: string
        }
        Relationships: []
      }
      market_trades: {
        Row: {
          buy_order_id: string
          buyer_id: string
          collectible_id: string
          created_at: string
          fee: number
          id: string
          price: number
          sell_order_id: string
          seller_id: string
        }
        Insert: {
          buy_order_id: string
          buyer_id: string
          collectible_id: string
          created_at?: string
          fee?: number
          id?: string
          price: number
          sell_order_id: string
          seller_id: string
        }
        Update: {
          buy_order_id?: string
          buyer_id?: string
          collectible_id?: string
          created_at?: string
          fee?: number
          id?: string
          price?: number
          sell_order_id?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_trades_buy_order_id_fkey"
            columns: ["buy_order_id"]
            isOneToOne: true
            referencedRelation: "market_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_trades_collectible_id_fkey"
            columns: ["collectible_id"]
            isOneToOne: false
            referencedRelation: "market_collectibles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_trades_sell_order_id_fkey"
            columns: ["sell_order_id"]
            isOneToOne: true
            referencedRelation: "market_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      market_user_preferences: {
        Row: {
          display_currency: string
          language: string
          notifications_enabled: boolean
          price_alerts_enabled: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          display_currency?: string
          language?: string
          notifications_enabled?: boolean
          price_alerts_enabled?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          display_currency?: string
          language?: string
          notifications_enabled?: boolean
          price_alerts_enabled?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      market_wallet_ledger: {
        Row: {
          actor_id: string | null
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          entry_type: string
          id: string
          reason: string | null
          reference_id: string | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          amount: number
          balance_after: number
          created_at?: string
          description?: string | null
          entry_type: string
          id?: string
          reason?: string | null
          reference_id?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          entry_type?: string
          id?: string
          reason?: string | null
          reference_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      market_wallets: {
        Row: {
          balance: number
          currency_code: string
          reserved_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          currency_code?: string
          reserved_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          currency_code?: string
          reserved_balance?: number
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
      market_admin_adjust_balance: {
        Args: {
          p_actor_id: string
          p_amount: number
          p_reason: string
          p_user_id: string
        }
        Returns: Json
      }
      market_admin_create_collection: {
        Args: {
          p_actor_id: string
          p_cover_url: string
          p_description: string
          p_name: string
          p_slug: string
          p_status: string
        }
        Returns: Json
      }
      market_admin_create_gift_type: {
        Args: {
          p_actor_id: string
          p_collection_id: string
          p_cover_url: string
          p_description: string
          p_name: string
          p_slug: string
          p_status: string
        }
        Returns: Json
      }
      market_admin_create_variant: {
        Args: {
          p_actor_id: string
          p_description: string
          p_gift_type_id: string
          p_image_url: string
          p_initial_price: number
          p_max_supply: number
          p_mint_quantity: number
          p_model_size_bytes: number
          p_model_url: string
          p_name: string
          p_rarity: string
          p_status: string
        }
        Returns: Json
      }
      market_admin_is_authorized: {
        Args: { p_actor_id: string }
        Returns: boolean
      }
      market_admin_lift_restrictions: {
        Args: {
          p_actor_id: string
          p_restriction_type?: string
          p_user_id: string
        }
        Returns: Json
      }
      market_admin_mint_collectibles: {
        Args: { p_actor_id: string; p_asset_id: string; p_quantity: number }
        Returns: Json
      }
      market_admin_overview: { Args: { p_actor_id: string }; Returns: Json }
      market_admin_recent_audit: {
        Args: { p_actor_id: string; p_limit?: number }
        Returns: Json
      }
      market_admin_search_users: {
        Args: { p_actor_id: string; p_search: string }
        Returns: Json
      }
      market_admin_set_catalog_status: {
        Args: {
          p_actor_id: string
          p_status: string
          p_target_id: string
          p_target_type: string
        }
        Returns: Json
      }
      market_admin_set_restriction: {
        Args: {
          p_actor_id: string
          p_duration_minutes?: number
          p_reason: string
          p_restriction_type: string
          p_user_id: string
        }
        Returns: Json
      }
      market_admin_update_settings: {
        Args: {
          p_actor_id: string
          p_commission_bps: number
          p_trading_enabled: boolean
        }
        Returns: Json
      }
      market_admin_user_details: {
        Args: { p_actor_id: string; p_user_id: string }
        Returns: Json
      }
      market_cancel_order: {
        Args: { p_actor_id: string; p_order_id: string }
        Returns: Json
      }
      market_get_market_status: { Args: never; Returns: Json }
      market_mark_notification_read: {
        Args: { p_actor_id: string; p_notification_id: string }
        Returns: boolean
      }
      market_submit_order: {
        Args: {
          p_actor_id: string
          p_collectible_id: string
          p_idempotency_key: string
          p_price: number
          p_side: string
        }
        Returns: Json
      }
      market_submit_order_v2: {
        Args: {
          p_actor_id: string
          p_collectible_id: string
          p_idempotency_key: string
          p_price: number
          p_scope?: string
          p_side: string
        }
        Returns: Json
      }
      market_user_access_status: { Args: { p_actor_id: string }; Returns: Json }
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
    Enums: {},
  },
} as const
