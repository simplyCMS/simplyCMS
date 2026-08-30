CREATE TYPE "public"."app_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TYPE "public"."discount_group_operator" AS ENUM('and', 'or', 'not', 'min', 'max');--> statement-breakpoint
CREATE TYPE "public"."discount_target_type" AS ENUM('product', 'modification', 'section', 'all');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('percent', 'fixed_amount', 'fixed_price');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('text', 'number', 'select', 'multiselect', 'range', 'color', 'boolean');--> statement-breakpoint
CREATE TYPE "public"."shipping_calculation_type" AS ENUM('flat', 'weight', 'order_total', 'free_from', 'plugin');--> statement-breakpoint
CREATE TYPE "public"."shipping_method_type" AS ENUM('system', 'manual', 'plugin');--> statement-breakpoint
CREATE TYPE "public"."stock_status" AS ENUM('in_stock', 'out_of_stock', 'on_order');--> statement-breakpoint
CREATE TABLE "banners" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"image_url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"placement" text DEFAULT 'home' NOT NULL,
	"section_id" uuid,
	"buttons" jsonb DEFAULT '[]'::jsonb,
	"date_from" timestamp with time zone,
	"date_to" timestamp with time zone,
	"schedule_days" integer[],
	"schedule_time_from" time,
	"schedule_time_to" time,
	"slide_duration" integer DEFAULT 5000 NOT NULL,
	"animation_type" text DEFAULT 'slide' NOT NULL,
	"animation_duration" integer DEFAULT 500 NOT NULL,
	"overlay_color" text DEFAULT 'rgba(0,0,0,0.4)',
	"text_position" text DEFAULT 'left' NOT NULL,
	"desktop_image_url" text,
	"mobile_image_url" text
);
--> statement-breakpoint
CREATE TABLE "category_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"from_category_id" uuid,
	"to_category_id" uuid NOT NULL,
	"conditions" jsonb DEFAULT '{"type":"all","rules":[]}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comparisons" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comparisons_user_id_product_id_key" UNIQUE("user_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "comparisons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "discount_conditions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"discount_id" uuid NOT NULL,
	"condition_type" varchar NOT NULL,
	"operator" varchar DEFAULT '=' NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_groups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"operator" "discount_group_operator" DEFAULT 'and' NOT NULL,
	"parent_group_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_targets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"discount_id" uuid NOT NULL,
	"target_type" "discount_target_type" DEFAULT 'all' NOT NULL,
	"target_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"group_id" uuid NOT NULL,
	"discount_type" "discount_type" DEFAULT 'percent' NOT NULL,
	"discount_value" numeric NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"price_type_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "languages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" varchar(10) NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "languages_code_key" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "modification_property_values" (
	"id" uuid PRIMARY KEY NOT NULL,
	"modification_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"value" text,
	"numeric_value" numeric,
	"option_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "modification_property_values_modification_id_property_id_key" UNIQUE("modification_id","property_id")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"modification_id" uuid,
	"service_id" uuid,
	"name" text NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"base_price" numeric,
	"discount_data" jsonb,
	CONSTRAINT "order_items_positive_quantity" CHECK (quantity > 0)
);
--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_statuses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" varchar(50) NOT NULL,
	"color" varchar(7) DEFAULT '#6B7280',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_statuses_code_key" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"order_number" varchar(50) NOT NULL,
	"status_id" uuid,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"delivery_address" text,
	"delivery_city" text,
	"delivery_method" text,
	"payment_method" text NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"access_token" text,
	"shipping_method_id" uuid,
	"shipping_zone_id" uuid,
	"shipping_rate_id" uuid,
	"shipping_cost" numeric(10, 2) DEFAULT '0',
	"pickup_point_id" uuid,
	"shipping_data" jsonb DEFAULT '{}'::jsonb,
	"has_different_recipient" boolean DEFAULT false NOT NULL,
	"recipient_first_name" text,
	"recipient_last_name" text,
	"recipient_phone" text,
	"recipient_email" text,
	"saved_recipient_id" uuid,
	"saved_address_id" uuid,
	CONSTRAINT "orders_order_number_key" UNIQUE("order_number"),
	CONSTRAINT "orders_name_length" CHECK ((char_length(first_name) <= 100) AND (char_length(last_name) <= 100)),
	CONSTRAINT "orders_notes_length" CHECK ((char_length(notes) <= 5000) OR (notes IS NULL)),
	CONSTRAINT "orders_positive_totals" CHECK ((subtotal >= (0)::numeric) AND (total >= (0)::numeric))
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pickup_points" (
	"id" uuid PRIMARY KEY NOT NULL,
	"method_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"zone_id" uuid,
	"working_hours" jsonb DEFAULT '{}'::jsonb,
	"phone" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"coordinates" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"plugin_name" varchar NOT NULL,
	"hook_name" varchar NOT NULL,
	"payload" jsonb,
	"result" jsonb,
	"error" text,
	"executed_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plugins" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"display_name" text NOT NULL,
	"version" varchar DEFAULT '1.0.0' NOT NULL,
	"description" text,
	"author" text,
	"is_active" boolean DEFAULT false,
	"config" jsonb DEFAULT '{}'::jsonb,
	"hooks" jsonb DEFAULT '[]'::jsonb,
	"migrations_applied" jsonb DEFAULT '[]'::jsonb,
	"installed_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "plugins_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "price_types" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" varchar NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_types_code_key" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "product_modifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"slug" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"sku" varchar(100),
	"is_default" boolean DEFAULT false NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stock_status" "stock_status" DEFAULT 'in_stock',
	CONSTRAINT "product_modifications_product_slug_unique" UNIQUE("product_id","slug")
);
--> statement-breakpoint
CREATE TABLE "product_prices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"price_type_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"modification_id" uuid,
	"price" numeric NOT NULL,
	"old_price" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_property_values" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"value" text,
	"numeric_value" numeric(15, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"option_id" uuid,
	CONSTRAINT "product_property_values_product_id_property_id_key" UNIQUE("product_id","property_id")
);
--> statement-breakpoint
CREATE TABLE "product_reviews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"title" text,
	"content" text,
	"images" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_reviews_product_id_user_id_key" UNIQUE("product_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "product_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"section_id" uuid,
	"slug" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"short_description" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb,
	"has_modifications" boolean DEFAULT true,
	"sku" varchar,
	"stock_status" "stock_status" DEFAULT 'in_stock',
	"return_policy" jsonb,
	"shipping_details" jsonb,
	CONSTRAINT "products_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text,
	"first_name" text,
	"last_name" text,
	"phone" text,
	"category_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"avatar_url" text,
	"default_shipping_method_id" uuid,
	"default_pickup_point_id" uuid,
	"auth_provider" text,
	"registration_utm" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "profiles_user_id_key" UNIQUE("user_id"),
	CONSTRAINT "profiles_name_length" CHECK (((char_length(first_name) <= 100) OR (first_name IS NULL)) AND ((char_length(last_name) <= 100) OR (last_name IS NULL)))
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "property_options" (
	"id" uuid PRIMARY KEY NOT NULL,
	"property_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(255) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"description" text,
	"image_url" text,
	"meta_title" text,
	"meta_description" text,
	CONSTRAINT "property_options_property_id_slug_key" UNIQUE("property_id","slug")
);
--> statement-breakpoint
CREATE TABLE "section_properties" (
	"id" uuid PRIMARY KEY NOT NULL,
	"section_id" uuid,
	"name" text NOT NULL,
	"slug" varchar(100) NOT NULL,
	"property_type" "property_type" DEFAULT 'text' NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"is_filterable" boolean DEFAULT false NOT NULL,
	"has_page" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"options" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "section_properties_section_id_code_key" UNIQUE("section_id","slug")
);
--> statement-breakpoint
CREATE TABLE "section_property_assignments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"section_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applies_to" text DEFAULT 'product' NOT NULL,
	CONSTRAINT "section_property_assignments_section_id_property_id_key" UNIQUE("section_id","property_id"),
	CONSTRAINT "section_property_assignments_applies_to_check" CHECK (applies_to = ANY (ARRAY['product'::text, 'modification'::text]))
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_url" text,
	"parent_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sections_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"service_id" uuid,
	"user_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"message" text,
	"status" varchar(50) DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_requests_message_length" CHECK ((char_length(message) <= 10000) OR (message IS NULL))
);
--> statement-breakpoint
ALTER TABLE "service_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(12, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_slug_key" UNIQUE("slug"),
	CONSTRAINT "services_positive_price" CHECK ((price IS NULL) OR (price >= (0)::numeric))
);
--> statement-breakpoint
CREATE TABLE "shipping_methods" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "shipping_method_type" DEFAULT 'manual' NOT NULL,
	"plugin_name" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"icon" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipping_methods_code_key" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "shipping_rates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"method_id" uuid NOT NULL,
	"zone_id" uuid NOT NULL,
	"name" text NOT NULL,
	"calculation_type" "shipping_calculation_type" DEFAULT 'flat' NOT NULL,
	"base_cost" numeric(10, 2) DEFAULT '0' NOT NULL,
	"per_kg_cost" numeric(10, 2),
	"min_weight" numeric(10, 2),
	"free_from_amount" numeric(10, 2),
	"min_order_amount" numeric(10, 2),
	"max_order_amount" numeric(10, 2),
	"estimated_days" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_zones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cities" text[] DEFAULT '{""}',
	"regions" text[] DEFAULT '{""}'
);
--> statement-breakpoint
CREATE TABLE "stock_by_pickup_point" (
	"id" uuid PRIMARY KEY NOT NULL,
	"pickup_point_id" uuid NOT NULL,
	"product_id" uuid,
	"modification_id" uuid,
	"quantity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "stock_product_or_modification" CHECK (((product_id IS NOT NULL) AND (modification_id IS NULL)) OR ((product_id IS NULL) AND (modification_id IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "system_settings_key_key" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "themes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"display_name" text NOT NULL,
	"version" varchar(20) DEFAULT '1.0.0' NOT NULL,
	"description" text,
	"author" text,
	"preview_image" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "themes_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_addresses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"address" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_addresses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" varchar(50) NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"price_type_id" uuid,
	CONSTRAINT "user_categories_code_key" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user_category_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"from_category_id" uuid,
	"to_category_id" uuid NOT NULL,
	"reason" text,
	"rule_id" uuid,
	"changed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_category_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_recipients" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"city" text NOT NULL,
	"address" text NOT NULL,
	"notes" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_recipients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "app_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_key" UNIQUE("user_id","role")
);
--> statement-breakpoint
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "wishlists" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlists_user_id_product_id_key" UNIQUE("user_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "wishlists" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issuer" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "sessions_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_key" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"storage_key" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"mime_type" text NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_storage_key_key" UNIQUE("storage_key"),
	CONSTRAINT "media_size_bytes_non_negative" CHECK (size_bytes >= 0)
);
--> statement-breakpoint
ALTER TABLE "banners" ADD CONSTRAINT "banners_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_from_category_id_fkey" FOREIGN KEY ("from_category_id") REFERENCES "public"."user_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_to_category_id_fkey" FOREIGN KEY ("to_category_id") REFERENCES "public"."user_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_conditions" ADD CONSTRAINT "discount_conditions_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_groups" ADD CONSTRAINT "discount_groups_parent_group_id_fkey" FOREIGN KEY ("parent_group_id") REFERENCES "public"."discount_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_targets" ADD CONSTRAINT "discount_targets_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."discount_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_price_type_id_fkey" FOREIGN KEY ("price_type_id") REFERENCES "public"."price_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modification_property_values" ADD CONSTRAINT "modification_property_values_modification_id_fkey" FOREIGN KEY ("modification_id") REFERENCES "public"."product_modifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modification_property_values" ADD CONSTRAINT "modification_property_values_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "public"."property_options"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modification_property_values" ADD CONSTRAINT "modification_property_values_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."section_properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_modification_id_fkey" FOREIGN KEY ("modification_id") REFERENCES "public"."product_modifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_pickup_point_id_fkey" FOREIGN KEY ("pickup_point_id") REFERENCES "public"."pickup_points"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_saved_address_id_fkey" FOREIGN KEY ("saved_address_id") REFERENCES "public"."user_addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_saved_recipient_id_fkey" FOREIGN KEY ("saved_recipient_id") REFERENCES "public"."user_recipients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_method_id_fkey" FOREIGN KEY ("shipping_method_id") REFERENCES "public"."shipping_methods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_rate_id_fkey" FOREIGN KEY ("shipping_rate_id") REFERENCES "public"."shipping_rates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_zone_id_fkey" FOREIGN KEY ("shipping_zone_id") REFERENCES "public"."shipping_zones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "public"."order_statuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_points" ADD CONSTRAINT "pickup_points_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "public"."shipping_methods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_points" ADD CONSTRAINT "pickup_points_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."shipping_zones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_modifications" ADD CONSTRAINT "product_modifications_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_modification_id_fkey" FOREIGN KEY ("modification_id") REFERENCES "public"."product_modifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_price_type_id_fkey" FOREIGN KEY ("price_type_id") REFERENCES "public"."price_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_property_values" ADD CONSTRAINT "product_property_values_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "public"."property_options"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_property_values" ADD CONSTRAINT "product_property_values_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_property_values" ADD CONSTRAINT "product_property_values_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."section_properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."user_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_default_pickup_point_id_fkey" FOREIGN KEY ("default_pickup_point_id") REFERENCES "public"."pickup_points"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_default_shipping_method_id_fkey" FOREIGN KEY ("default_shipping_method_id") REFERENCES "public"."shipping_methods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_options" ADD CONSTRAINT "property_options_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."section_properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_properties" ADD CONSTRAINT "section_properties_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_property_assignments" ADD CONSTRAINT "section_property_assignments_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."section_properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_property_assignments" ADD CONSTRAINT "section_property_assignments_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_rates" ADD CONSTRAINT "shipping_rates_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "public"."shipping_methods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_rates" ADD CONSTRAINT "shipping_rates_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."shipping_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_by_pickup_point" ADD CONSTRAINT "stock_by_pickup_point_modification_id_fkey" FOREIGN KEY ("modification_id") REFERENCES "public"."product_modifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_by_pickup_point" ADD CONSTRAINT "stock_by_pickup_point_pickup_point_id_fkey" FOREIGN KEY ("pickup_point_id") REFERENCES "public"."pickup_points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_by_pickup_point" ADD CONSTRAINT "stock_by_pickup_point_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_categories" ADD CONSTRAINT "user_categories_price_type_id_fkey" FOREIGN KEY ("price_type_id") REFERENCES "public"."price_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_category_history" ADD CONSTRAINT "user_category_history_from_category_id_fkey" FOREIGN KEY ("from_category_id") REFERENCES "public"."user_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_category_history" ADD CONSTRAINT "user_category_history_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."category_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_category_history" ADD CONSTRAINT "user_category_history_to_category_id_fkey" FOREIGN KEY ("to_category_id") REFERENCES "public"."user_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_banners_placement" ON "banners" USING btree ("placement" text_ops);--> statement-breakpoint
CREATE INDEX "idx_banners_section_id" ON "banners" USING btree ("section_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_category_rules_from_category_id" ON "category_rules" USING btree ("from_category_id");--> statement-breakpoint
CREATE INDEX "idx_category_rules_to_category_id" ON "category_rules" USING btree ("to_category_id");--> statement-breakpoint
CREATE INDEX "idx_comparisons_product_id" ON "comparisons" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_discount_conditions_discount" ON "discount_conditions" USING btree ("discount_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_discount_groups_parent" ON "discount_groups" USING btree ("parent_group_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_discount_targets_discount" ON "discount_targets" USING btree ("discount_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_discounts_group" ON "discounts" USING btree ("group_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_discounts_price_type_id" ON "discounts" USING btree ("price_type_id");--> statement-breakpoint
CREATE INDEX "idx_modification_property_values_mod" ON "modification_property_values" USING btree ("modification_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_modification_property_values_option" ON "modification_property_values" USING btree ("option_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_modification_property_values_property" ON "modification_property_values" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "idx_order_items_order_id" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_order_items_product_id" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_order_items_modification_id" ON "order_items" USING btree ("modification_id");--> statement-breakpoint
CREATE INDEX "idx_order_items_service_id" ON "order_items" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "idx_orders_pickup_point_id" ON "orders" USING btree ("pickup_point_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_orders_shipping_method_id" ON "orders" USING btree ("shipping_method_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_orders_user_id" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_orders_status_id" ON "orders" USING btree ("status_id");--> statement-breakpoint
CREATE INDEX "idx_orders_shipping_rate_id" ON "orders" USING btree ("shipping_rate_id");--> statement-breakpoint
CREATE INDEX "idx_orders_shipping_zone_id" ON "orders" USING btree ("shipping_zone_id");--> statement-breakpoint
CREATE INDEX "idx_orders_saved_address_id" ON "orders" USING btree ("saved_address_id");--> statement-breakpoint
CREATE INDEX "idx_orders_saved_recipient_id" ON "orders" USING btree ("saved_recipient_id");--> statement-breakpoint
CREATE INDEX "idx_orders_access_token" ON "orders" USING btree ("access_token") WHERE access_token is not null;--> statement-breakpoint
CREATE INDEX "idx_pickup_points_city" ON "pickup_points" USING btree ("city" text_ops);--> statement-breakpoint
CREATE INDEX "idx_pickup_points_method_id" ON "pickup_points" USING btree ("method_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_pickup_points_zone_id" ON "pickup_points" USING btree ("zone_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_price_types_single_default" ON "price_types" USING btree ("is_default" bool_ops) WHERE (is_default = true);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_prices_unique" ON "product_prices" USING btree (price_type_id,product_id,COALESCE(modification_id, '00000000-0000-0000-0000-000000000000'::uuid));--> statement-breakpoint
CREATE INDEX "idx_product_prices_product_id" ON "product_prices" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_prices_modification_id" ON "product_prices" USING btree ("modification_id");--> statement-breakpoint
CREATE INDEX "idx_product_property_values_option_id" ON "product_property_values" USING btree ("option_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_product_property_values_property_id" ON "product_property_values" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "idx_product_reviews_user_id" ON "product_reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_products_section_id" ON "products" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "idx_profiles_category_id" ON "profiles" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_profiles_default_pickup_point_id" ON "profiles" USING btree ("default_pickup_point_id");--> statement-breakpoint
CREATE INDEX "idx_profiles_default_shipping_method_id" ON "profiles" USING btree ("default_shipping_method_id");--> statement-breakpoint
CREATE INDEX "idx_property_options_property_id" ON "property_options" USING btree ("property_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_property_options_slug" ON "property_options" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "idx_section_property_assignments_property" ON "section_property_assignments" USING btree ("property_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_section_property_assignments_section" ON "section_property_assignments" USING btree ("section_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_sections_parent_id" ON "sections" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_service_requests_service_id" ON "service_requests" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "idx_service_requests_user_id" ON "service_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_shipping_rates_method_id" ON "shipping_rates" USING btree ("method_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_shipping_rates_zone_id" ON "shipping_rates" USING btree ("zone_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "unique_stock_modification_per_point" ON "stock_by_pickup_point" USING btree ("pickup_point_id" uuid_ops,"modification_id" uuid_ops) WHERE (modification_id IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "unique_stock_product_per_point" ON "stock_by_pickup_point" USING btree ("pickup_point_id" uuid_ops,"product_id" uuid_ops) WHERE ((product_id IS NOT NULL) AND (modification_id IS NULL));--> statement-breakpoint
CREATE INDEX "idx_stock_by_pickup_point_product_id" ON "stock_by_pickup_point" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_stock_by_pickup_point_modification_id" ON "stock_by_pickup_point" USING btree ("modification_id");--> statement-breakpoint
CREATE UNIQUE INDEX "themes_active_idx" ON "themes" USING btree ("is_active" bool_ops) WHERE (is_active = true);--> statement-breakpoint
CREATE INDEX "idx_user_addresses_user_id" ON "user_addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_categories_price_type_id" ON "user_categories" USING btree ("price_type_id");--> statement-breakpoint
CREATE INDEX "idx_user_category_history_user_id" ON "user_category_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_category_history_from_category_id" ON "user_category_history" USING btree ("from_category_id");--> statement-breakpoint
CREATE INDEX "idx_user_category_history_to_category_id" ON "user_category_history" USING btree ("to_category_id");--> statement-breakpoint
CREATE INDEX "idx_user_category_history_rule_id" ON "user_category_history" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "idx_user_recipients_user_id" ON "user_recipients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_wishlists_product_id" ON "wishlists" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_issuer_account_id_key" ON "accounts" USING btree ("issuer","account_id");--> statement-breakpoint
CREATE INDEX "idx_accounts_user_id" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_verifications_identifier" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "idx_media_entity" ON "media" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_media_uploaded_by" ON "media" USING btree ("uploaded_by");--> statement-breakpoint
CREATE POLICY "comparisons_own_all" ON "comparisons" AS PERMISSIVE FOR ALL TO "app_user" USING (user_id = (select app.current_user_id())) WITH CHECK (user_id = (select app.current_user_id()));--> statement-breakpoint
CREATE POLICY "order_items_select_own_or_token" ON "order_items" AS PERMISSIVE FOR SELECT TO "app_user" USING (exists (select 1 from orders where orders.id = order_items.order_id and ((orders.user_id = (select app.current_user_id())) or (orders.access_token is not null and orders.access_token = (select nullif(current_setting('app.order_token', true), ''))))));--> statement-breakpoint
CREATE POLICY "order_items_insert_own" ON "order_items" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK (exists (select 1 from orders where orders.id = order_items.order_id and (orders.user_id = (select app.current_user_id()) or orders.user_id is null)));--> statement-breakpoint
CREATE POLICY "order_items_admin_all" ON "order_items" AS PERMISSIVE FOR ALL TO "app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "orders_select_own_or_token" ON "orders" AS PERMISSIVE FOR SELECT TO "app_user" USING ((user_id = (select app.current_user_id())) or (access_token is not null and access_token = (select nullif(current_setting('app.order_token', true), ''))));--> statement-breakpoint
CREATE POLICY "orders_insert_own" ON "orders" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK ((user_id = (select app.current_user_id())) or (user_id is null));--> statement-breakpoint
CREATE POLICY "orders_admin_all" ON "orders" AS PERMISSIVE FOR ALL TO "app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "product_reviews_select_approved_or_own" ON "product_reviews" AS PERMISSIVE FOR SELECT TO "app_user" USING (status = 'approved' or user_id = (select app.current_user_id()));--> statement-breakpoint
CREATE POLICY "product_reviews_insert_own" ON "product_reviews" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK (user_id = (select app.current_user_id()));--> statement-breakpoint
CREATE POLICY "product_reviews_update_own_pending" ON "product_reviews" AS PERMISSIVE FOR UPDATE TO "app_user" USING (user_id = (select app.current_user_id()) and status = 'pending') WITH CHECK (user_id = (select app.current_user_id()) and status = 'pending');--> statement-breakpoint
CREATE POLICY "product_reviews_delete_own" ON "product_reviews" AS PERMISSIVE FOR DELETE TO "app_user" USING (user_id = (select app.current_user_id()));--> statement-breakpoint
CREATE POLICY "product_reviews_admin_all" ON "product_reviews" AS PERMISSIVE FOR ALL TO "app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "profiles_select_own" ON "profiles" AS PERMISSIVE FOR SELECT TO "app_user" USING (user_id = (select app.current_user_id()));--> statement-breakpoint
CREATE POLICY "profiles_update_own" ON "profiles" AS PERMISSIVE FOR UPDATE TO "app_user" USING (user_id = (select app.current_user_id())) WITH CHECK (user_id = (select app.current_user_id()));--> statement-breakpoint
CREATE POLICY "profiles_admin_all" ON "profiles" AS PERMISSIVE FOR ALL TO "app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_requests_insert_any" ON "service_requests" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_requests_select_own" ON "service_requests" AS PERMISSIVE FOR SELECT TO "app_user" USING (user_id is not null and user_id = (select app.current_user_id()));--> statement-breakpoint
CREATE POLICY "service_requests_admin_all" ON "service_requests" AS PERMISSIVE FOR ALL TO "app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "user_addresses_own_all" ON "user_addresses" AS PERMISSIVE FOR ALL TO "app_user" USING (user_id = (select app.current_user_id())) WITH CHECK (user_id = (select app.current_user_id()));--> statement-breakpoint
CREATE POLICY "user_addresses_admin_select" ON "user_addresses" AS PERMISSIVE FOR SELECT TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "user_category_history_select_own" ON "user_category_history" AS PERMISSIVE FOR SELECT TO "app_user" USING (user_id = (select app.current_user_id()));--> statement-breakpoint
CREATE POLICY "user_category_history_admin_all" ON "user_category_history" AS PERMISSIVE FOR ALL TO "app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "user_recipients_own_all" ON "user_recipients" AS PERMISSIVE FOR ALL TO "app_user" USING (user_id = (select app.current_user_id())) WITH CHECK (user_id = (select app.current_user_id()));--> statement-breakpoint
CREATE POLICY "user_recipients_admin_select" ON "user_recipients" AS PERMISSIVE FOR SELECT TO "app_admin" USING (true);--> statement-breakpoint
CREATE POLICY "user_roles_select_own" ON "user_roles" AS PERMISSIVE FOR SELECT TO "app_user" USING (user_id = (select app.current_user_id()));--> statement-breakpoint
CREATE POLICY "user_roles_admin_all" ON "user_roles" AS PERMISSIVE FOR ALL TO "app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "wishlists_own_all" ON "wishlists" AS PERMISSIVE FOR ALL TO "app_user" USING (user_id = (select app.current_user_id())) WITH CHECK (user_id = (select app.current_user_id()));