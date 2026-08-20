// ⚠️  ЗГЕНЕРОВАНИЙ ФАЙЛ — не редагувати руками.
//
// Baseline типів CORE-схеми SimplyCMS: снапшот `supabase/types.ts`, знятий
// на еталонній dev-БД БЕЗ плагінів. Проти нього типізуються пакети ядра.
// Магазин зі своїми (плагінними) таблицями підставляє власний `Database`
// у фабрики клієнтів — див. README пакета, розділ «Generic-місток».
//
// Оновлення: `pnpm types:baseline` (після кожної core-міграції).

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
      banners: {
        Row: {
          animation_duration: number
          animation_type: string
          buttons: Json | null
          created_at: string
          date_from: string | null
          date_to: string | null
          desktop_image_url: string | null
          id: string
          image_url: string
          is_active: boolean
          mobile_image_url: string | null
          overlay_color: string | null
          placement: string
          schedule_days: number[] | null
          schedule_time_from: string | null
          schedule_time_to: string | null
          section_id: string | null
          slide_duration: number
          sort_order: number
          subtitle: string | null
          text_position: string
          title: string
          updated_at: string
        }
        Insert: {
          animation_duration?: number
          animation_type?: string
          buttons?: Json | null
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          desktop_image_url?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          mobile_image_url?: string | null
          overlay_color?: string | null
          placement?: string
          schedule_days?: number[] | null
          schedule_time_from?: string | null
          schedule_time_to?: string | null
          section_id?: string | null
          slide_duration?: number
          sort_order?: number
          subtitle?: string | null
          text_position?: string
          title: string
          updated_at?: string
        }
        Update: {
          animation_duration?: number
          animation_type?: string
          buttons?: Json | null
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          desktop_image_url?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          mobile_image_url?: string | null
          overlay_color?: string | null
          placement?: string
          schedule_days?: number[] | null
          schedule_time_from?: string | null
          schedule_time_to?: string | null
          section_id?: string | null
          slide_duration?: number
          sort_order?: number
          subtitle?: string | null
          text_position?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "banners_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      category_rules: {
        Row: {
          conditions: Json
          created_at: string
          description: string | null
          from_category_id: string | null
          id: string
          is_active: boolean
          name: string
          priority: number
          to_category_id: string
        }
        Insert: {
          conditions?: Json
          created_at?: string
          description?: string | null
          from_category_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          to_category_id: string
        }
        Update: {
          conditions?: Json
          created_at?: string
          description?: string | null
          from_category_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          to_category_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_rules_from_category_id_fkey"
            columns: ["from_category_id"]
            isOneToOne: false
            referencedRelation: "user_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_rules_to_category_id_fkey"
            columns: ["to_category_id"]
            isOneToOne: false
            referencedRelation: "user_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      comparisons: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comparisons_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_conditions: {
        Row: {
          condition_type: string
          created_at: string
          discount_id: string
          id: string
          operator: string
          value: Json
        }
        Insert: {
          condition_type: string
          created_at?: string
          discount_id: string
          id?: string
          operator?: string
          value?: Json
        }
        Update: {
          condition_type?: string
          created_at?: string
          discount_id?: string
          id?: string
          operator?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "discount_conditions_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_groups: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          name: string
          operator: Database["public"]["Enums"]["discount_group_operator"]
          parent_group_id: string | null
          priority: number
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          operator?: Database["public"]["Enums"]["discount_group_operator"]
          parent_group_id?: string | null
          priority?: number
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          operator?: Database["public"]["Enums"]["discount_group_operator"]
          parent_group_id?: string | null
          priority?: number
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_groups_parent_group_id_fkey"
            columns: ["parent_group_id"]
            isOneToOne: false
            referencedRelation: "discount_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_targets: {
        Row: {
          created_at: string
          discount_id: string
          id: string
          target_id: string | null
          target_type: Database["public"]["Enums"]["discount_target_type"]
        }
        Insert: {
          created_at?: string
          discount_id: string
          id?: string
          target_id?: string | null
          target_type?: Database["public"]["Enums"]["discount_target_type"]
        }
        Update: {
          created_at?: string
          discount_id?: string
          id?: string
          target_id?: string | null
          target_type?: Database["public"]["Enums"]["discount_target_type"]
        }
        Relationships: [
          {
            foreignKeyName: "discount_targets_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
        ]
      }
      discounts: {
        Row: {
          created_at: string
          description: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          ends_at: string | null
          group_id: string
          id: string
          is_active: boolean
          name: string
          price_type_id: string
          priority: number
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          ends_at?: string | null
          group_id: string
          id?: string
          is_active?: boolean
          name: string
          price_type_id: string
          priority?: number
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          ends_at?: string | null
          group_id?: string
          id?: string
          is_active?: boolean
          name?: string
          price_type_id?: string
          priority?: number
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discounts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "discount_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discounts_price_type_id_fkey"
            columns: ["price_type_id"]
            isOneToOne: false
            referencedRelation: "price_types"
            referencedColumns: ["id"]
          },
        ]
      }
      languages: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
        }
        Relationships: []
      }
      modification_property_values: {
        Row: {
          created_at: string
          id: string
          modification_id: string
          numeric_value: number | null
          option_id: string | null
          property_id: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          modification_id: string
          numeric_value?: number | null
          option_id?: string | null
          property_id: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          modification_id?: string
          numeric_value?: number | null
          option_id?: string | null
          property_id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modification_property_values_modification_id_fkey"
            columns: ["modification_id"]
            isOneToOne: false
            referencedRelation: "product_modifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modification_property_values_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "property_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modification_property_values_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "section_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          base_price: number | null
          created_at: string
          discount_data: Json | null
          id: string
          modification_id: string | null
          name: string
          order_id: string
          price: number
          product_id: string | null
          quantity: number
          service_id: string | null
          total: number
        }
        Insert: {
          base_price?: number | null
          created_at?: string
          discount_data?: Json | null
          id?: string
          modification_id?: string | null
          name: string
          order_id: string
          price: number
          product_id?: string | null
          quantity?: number
          service_id?: string | null
          total: number
        }
        Update: {
          base_price?: number | null
          created_at?: string
          discount_data?: Json | null
          id?: string
          modification_id?: string | null
          name?: string
          order_id?: string
          price?: number
          product_id?: string | null
          quantity?: number
          service_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_modification_id_fkey"
            columns: ["modification_id"]
            isOneToOne: false
            referencedRelation: "product_modifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      order_statuses: {
        Row: {
          code: string
          color: string | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      orders: {
        Row: {
          access_token: string | null
          created_at: string
          delivery_address: string | null
          delivery_city: string | null
          delivery_method: string | null
          email: string
          first_name: string
          has_different_recipient: boolean
          id: string
          last_name: string
          notes: string | null
          order_number: string
          payment_method: string
          phone: string
          pickup_point_id: string | null
          recipient_email: string | null
          recipient_first_name: string | null
          recipient_last_name: string | null
          recipient_phone: string | null
          saved_address_id: string | null
          saved_recipient_id: string | null
          shipping_cost: number | null
          shipping_data: Json | null
          shipping_method_id: string | null
          shipping_rate_id: string | null
          shipping_zone_id: string | null
          status_id: string | null
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_method?: string | null
          email: string
          first_name: string
          has_different_recipient?: boolean
          id?: string
          last_name: string
          notes?: string | null
          order_number: string
          payment_method: string
          phone: string
          pickup_point_id?: string | null
          recipient_email?: string | null
          recipient_first_name?: string | null
          recipient_last_name?: string | null
          recipient_phone?: string | null
          saved_address_id?: string | null
          saved_recipient_id?: string | null
          shipping_cost?: number | null
          shipping_data?: Json | null
          shipping_method_id?: string | null
          shipping_rate_id?: string | null
          shipping_zone_id?: string | null
          status_id?: string | null
          subtotal: number
          total: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_method?: string | null
          email?: string
          first_name?: string
          has_different_recipient?: boolean
          id?: string
          last_name?: string
          notes?: string | null
          order_number?: string
          payment_method?: string
          phone?: string
          pickup_point_id?: string | null
          recipient_email?: string | null
          recipient_first_name?: string | null
          recipient_last_name?: string | null
          recipient_phone?: string | null
          saved_address_id?: string | null
          saved_recipient_id?: string | null
          shipping_cost?: number | null
          shipping_data?: Json | null
          shipping_method_id?: string | null
          shipping_rate_id?: string | null
          shipping_zone_id?: string | null
          status_id?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_pickup_point_id_fkey"
            columns: ["pickup_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_saved_address_id_fkey"
            columns: ["saved_address_id"]
            isOneToOne: false
            referencedRelation: "user_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_saved_recipient_id_fkey"
            columns: ["saved_recipient_id"]
            isOneToOne: false
            referencedRelation: "user_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shipping_method_id_fkey"
            columns: ["shipping_method_id"]
            isOneToOne: false
            referencedRelation: "shipping_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shipping_rate_id_fkey"
            columns: ["shipping_rate_id"]
            isOneToOne: false
            referencedRelation: "shipping_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shipping_zone_id_fkey"
            columns: ["shipping_zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "order_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_points: {
        Row: {
          address: string
          city: string
          coordinates: Json | null
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          method_id: string
          name: string
          phone: string | null
          sort_order: number
          working_hours: Json | null
          zone_id: string | null
        }
        Insert: {
          address: string
          city: string
          coordinates?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          method_id: string
          name: string
          phone?: string | null
          sort_order?: number
          working_hours?: Json | null
          zone_id?: string | null
        }
        Update: {
          address?: string
          city?: string
          coordinates?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          method_id?: string
          name?: string
          phone?: string | null
          sort_order?: number
          working_hours?: Json | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pickup_points_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "shipping_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickup_points_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      plugin_events: {
        Row: {
          error: string | null
          executed_at: string | null
          hook_name: string
          id: string
          payload: Json | null
          plugin_name: string
          result: Json | null
        }
        Insert: {
          error?: string | null
          executed_at?: string | null
          hook_name: string
          id?: string
          payload?: Json | null
          plugin_name: string
          result?: Json | null
        }
        Update: {
          error?: string | null
          executed_at?: string | null
          hook_name?: string
          id?: string
          payload?: Json | null
          plugin_name?: string
          result?: Json | null
        }
        Relationships: []
      }
      plugins: {
        Row: {
          author: string | null
          config: Json | null
          description: string | null
          display_name: string
          hooks: Json | null
          id: string
          installed_at: string | null
          is_active: boolean | null
          migrations_applied: Json | null
          name: string
          updated_at: string | null
          version: string
        }
        Insert: {
          author?: string | null
          config?: Json | null
          description?: string | null
          display_name: string
          hooks?: Json | null
          id?: string
          installed_at?: string | null
          is_active?: boolean | null
          migrations_applied?: Json | null
          name: string
          updated_at?: string | null
          version?: string
        }
        Update: {
          author?: string | null
          config?: Json | null
          description?: string | null
          display_name?: string
          hooks?: Json | null
          id?: string
          installed_at?: string | null
          is_active?: boolean | null
          migrations_applied?: Json | null
          name?: string
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      price_types: {
        Row: {
          code: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      product_modifications: {
        Row: {
          created_at: string
          id: string
          images: Json | null
          is_default: boolean
          name: string
          product_id: string
          sku: string | null
          slug: string
          sort_order: number
          stock_status: Database["public"]["Enums"]["stock_status"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          images?: Json | null
          is_default?: boolean
          name: string
          product_id: string
          sku?: string | null
          slug: string
          sort_order?: number
          stock_status?: Database["public"]["Enums"]["stock_status"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          images?: Json | null
          is_default?: boolean
          name?: string
          product_id?: string
          sku?: string | null
          slug?: string
          sort_order?: number
          stock_status?: Database["public"]["Enums"]["stock_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_modifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_prices: {
        Row: {
          created_at: string
          id: string
          modification_id: string | null
          old_price: number | null
          price: number
          price_type_id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          modification_id?: string | null
          old_price?: number | null
          price: number
          price_type_id: string
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          modification_id?: string | null
          old_price?: number | null
          price?: number
          price_type_id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_modification_id_fkey"
            columns: ["modification_id"]
            isOneToOne: false
            referencedRelation: "product_modifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_price_type_id_fkey"
            columns: ["price_type_id"]
            isOneToOne: false
            referencedRelation: "price_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_property_values: {
        Row: {
          created_at: string
          id: string
          numeric_value: number | null
          option_id: string | null
          product_id: string
          property_id: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          numeric_value?: number | null
          option_id?: string | null
          product_id: string
          property_id: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          numeric_value?: number | null
          option_id?: string | null
          product_id?: string
          property_id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_property_values_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "property_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_property_values_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_property_values_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "section_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          admin_comment: string | null
          content: string | null
          created_at: string
          id: string
          images: Json | null
          product_id: string
          rating: number
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_comment?: string | null
          content?: string | null
          created_at?: string
          id?: string
          images?: Json | null
          product_id: string
          rating: number
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_comment?: string | null
          content?: string | null
          created_at?: string
          id?: string
          images?: Json | null
          product_id?: string
          rating?: number
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          has_modifications: boolean | null
          id: string
          images: Json | null
          is_active: boolean
          is_featured: boolean
          meta_description: string | null
          meta_title: string | null
          name: string
          section_id: string | null
          short_description: string | null
          sku: string | null
          slug: string
          stock_status: Database["public"]["Enums"]["stock_status"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          has_modifications?: boolean | null
          id?: string
          images?: Json | null
          is_active?: boolean
          is_featured?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name: string
          section_id?: string | null
          short_description?: string | null
          sku?: string | null
          slug: string
          stock_status?: Database["public"]["Enums"]["stock_status"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          has_modifications?: boolean | null
          id?: string
          images?: Json | null
          is_active?: boolean
          is_featured?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          section_id?: string | null
          short_description?: string | null
          sku?: string | null
          slug?: string
          stock_status?: Database["public"]["Enums"]["stock_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_provider: string | null
          avatar_url: string | null
          category_id: string | null
          created_at: string
          default_pickup_point_id: string | null
          default_shipping_method_id: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          registration_utm: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_provider?: string | null
          avatar_url?: string | null
          category_id?: string | null
          created_at?: string
          default_pickup_point_id?: string | null
          default_shipping_method_id?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          registration_utm?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_provider?: string | null
          avatar_url?: string | null
          category_id?: string | null
          created_at?: string
          default_pickup_point_id?: string | null
          default_shipping_method_id?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          registration_utm?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "user_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_default_pickup_point_id_fkey"
            columns: ["default_pickup_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_default_shipping_method_id_fkey"
            columns: ["default_shipping_method_id"]
            isOneToOne: false
            referencedRelation: "shipping_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      property_options: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          meta_description: string | null
          meta_title: string | null
          name: string
          property_id: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          property_id: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          property_id?: string
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_options_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "section_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      section_properties: {
        Row: {
          created_at: string
          has_page: boolean
          id: string
          is_filterable: boolean
          is_required: boolean
          name: string
          options: Json | null
          property_type: Database["public"]["Enums"]["property_type"]
          section_id: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          has_page?: boolean
          id?: string
          is_filterable?: boolean
          is_required?: boolean
          name: string
          options?: Json | null
          property_type?: Database["public"]["Enums"]["property_type"]
          section_id?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          has_page?: boolean
          id?: string
          is_filterable?: boolean
          is_required?: boolean
          name?: string
          options?: Json | null
          property_type?: Database["public"]["Enums"]["property_type"]
          section_id?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "section_properties_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      section_property_assignments: {
        Row: {
          applies_to: string
          created_at: string
          id: string
          property_id: string
          section_id: string
          sort_order: number
        }
        Insert: {
          applies_to?: string
          created_at?: string
          id?: string
          property_id: string
          section_id: string
          sort_order?: number
        }
        Update: {
          applies_to?: string
          created_at?: string
          id?: string
          property_id?: string
          section_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "section_property_assignments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "section_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_property_assignments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          meta_description: string | null
          meta_title: string | null
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          phone: string | null
          service_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          phone?: string | null
          service_id?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
          service_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price?: number | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      shipping_methods: {
        Row: {
          code: string
          config: Json | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          plugin_name: string | null
          sort_order: number
          type: Database["public"]["Enums"]["shipping_method_type"]
          updated_at: string
        }
        Insert: {
          code: string
          config?: Json | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          plugin_name?: string | null
          sort_order?: number
          type?: Database["public"]["Enums"]["shipping_method_type"]
          updated_at?: string
        }
        Update: {
          code?: string
          config?: Json | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          plugin_name?: string | null
          sort_order?: number
          type?: Database["public"]["Enums"]["shipping_method_type"]
          updated_at?: string
        }
        Relationships: []
      }
      shipping_rates: {
        Row: {
          base_cost: number
          calculation_type: Database["public"]["Enums"]["shipping_calculation_type"]
          config: Json | null
          created_at: string
          estimated_days: string | null
          free_from_amount: number | null
          id: string
          is_active: boolean
          max_order_amount: number | null
          method_id: string
          min_order_amount: number | null
          min_weight: number | null
          name: string
          per_kg_cost: number | null
          sort_order: number
          zone_id: string
        }
        Insert: {
          base_cost?: number
          calculation_type?: Database["public"]["Enums"]["shipping_calculation_type"]
          config?: Json | null
          created_at?: string
          estimated_days?: string | null
          free_from_amount?: number | null
          id?: string
          is_active?: boolean
          max_order_amount?: number | null
          method_id: string
          min_order_amount?: number | null
          min_weight?: number | null
          name: string
          per_kg_cost?: number | null
          sort_order?: number
          zone_id: string
        }
        Update: {
          base_cost?: number
          calculation_type?: Database["public"]["Enums"]["shipping_calculation_type"]
          config?: Json | null
          created_at?: string
          estimated_days?: string | null
          free_from_amount?: number | null
          id?: string
          is_active?: boolean
          max_order_amount?: number | null
          method_id?: string
          min_order_amount?: number | null
          min_weight?: number | null
          name?: string
          per_kg_cost?: number | null
          sort_order?: number
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rates_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "shipping_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_rates_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_zones: {
        Row: {
          cities: string[] | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          regions: string[] | null
          sort_order: number
        }
        Insert: {
          cities?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          regions?: string[] | null
          sort_order?: number
        }
        Update: {
          cities?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          regions?: string[] | null
          sort_order?: number
        }
        Relationships: []
      }
      stock_by_pickup_point: {
        Row: {
          created_at: string | null
          id: string
          modification_id: string | null
          pickup_point_id: string
          product_id: string | null
          quantity: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          modification_id?: string | null
          pickup_point_id: string
          product_id?: string | null
          quantity?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          modification_id?: string | null
          pickup_point_id?: string
          product_id?: string | null
          quantity?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_by_pickup_point_modification_id_fkey"
            columns: ["modification_id"]
            isOneToOne: false
            referencedRelation: "product_modifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_by_pickup_point_pickup_point_id_fkey"
            columns: ["pickup_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_by_pickup_point_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value?: Json
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      themes: {
        Row: {
          author: string | null
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          is_active: boolean
          name: string
          preview_image: string | null
          settings: Json | null
          updated_at: string | null
          version: string
        }
        Insert: {
          author?: string | null
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          name: string
          preview_image?: string | null
          settings?: Json | null
          updated_at?: string | null
          version?: string
        }
        Update: {
          author?: string | null
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          name?: string
          preview_image?: string | null
          settings?: Json | null
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      user_addresses: {
        Row: {
          address: string
          city: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          user_id: string
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          user_id: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_categories: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          price_type_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          price_type_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          price_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_categories_price_type_id_fkey"
            columns: ["price_type_id"]
            isOneToOne: false
            referencedRelation: "price_types"
            referencedColumns: ["id"]
          },
        ]
      }
      user_category_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_category_id: string | null
          id: string
          reason: string | null
          rule_id: string | null
          to_category_id: string
          user_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_category_id?: string | null
          id?: string
          reason?: string | null
          rule_id?: string | null
          to_category_id: string
          user_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_category_id?: string | null
          id?: string
          reason?: string | null
          rule_id?: string | null
          to_category_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_category_history_from_category_id_fkey"
            columns: ["from_category_id"]
            isOneToOne: false
            referencedRelation: "user_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_category_history_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "category_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_category_history_to_category_id_fkey"
            columns: ["to_category_id"]
            isOneToOne: false
            referencedRelation: "user_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_recipients: {
        Row: {
          address: string
          city: string
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_default: boolean
          last_name: string
          notes: string | null
          phone: string
          user_id: string
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          is_default?: boolean
          last_name: string
          notes?: string | null
          phone: string
          user_id: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_default?: boolean
          last_name?: string
          notes?: string | null
          phone?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_update_user_category: {
        Args: { new_category_id: string; target_user_id: string }
        Returns: undefined
      }
      check_all_users_category_rules: { Args: never; Returns: number }
      check_category_rules: { Args: { p_user_id: string }; Returns: boolean }
      get_active_pickup_points_count: { Args: never; Returns: number }
      get_product_ratings: {
        Args: { product_ids: string[] }
        Returns: {
          avg_rating: number
          product_id: string
          review_count: number
        }[]
      }
      get_stock_info: {
        Args: { p_modification_id?: string; p_product_id?: string }
        Returns: {
          by_point: Json
          is_available: boolean
          stock_status: Database["public"]["Enums"]["stock_status"]
          total_quantity: number
        }[]
      }
      get_user_stats: {
        Args: { p_user_id: string }
        Returns: {
          auth_provider: string
          email_domain: string
          orders_count: number
          registration_days: number
          total_purchases: number
          utm_campaign: string
          utm_source: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      toggle_user_admin: {
        Args: { p_is_admin: boolean; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      discount_group_operator: "and" | "or" | "not" | "min" | "max"
      discount_target_type: "product" | "modification" | "section" | "all"
      discount_type: "percent" | "fixed_amount" | "fixed_price"
      property_type:
        | "text"
        | "number"
        | "select"
        | "multiselect"
        | "range"
        | "color"
        | "boolean"
      shipping_calculation_type:
        | "flat"
        | "weight"
        | "order_total"
        | "free_from"
        | "plugin"
      shipping_method_type: "system" | "manual" | "plugin"
      stock_status: "in_stock" | "out_of_stock" | "on_order"
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
      app_role: ["admin", "user"],
      discount_group_operator: ["and", "or", "not", "min", "max"],
      discount_target_type: ["product", "modification", "section", "all"],
      discount_type: ["percent", "fixed_amount", "fixed_price"],
      property_type: [
        "text",
        "number",
        "select",
        "multiselect",
        "range",
        "color",
        "boolean",
      ],
      shipping_calculation_type: [
        "flat",
        "weight",
        "order_total",
        "free_from",
        "plugin",
      ],
      shipping_method_type: ["system", "manual", "plugin"],
      stock_status: ["in_stock", "out_of_stock", "on_order"],
    },
  },
} as const
