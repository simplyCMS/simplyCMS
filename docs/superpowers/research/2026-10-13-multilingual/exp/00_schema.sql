-- 00_schema.sql — каркас експерименту: розширення, схеми, спільні (нетекстові) таблиці
-- і модель A (базова таблиця = основна мова uk + *_translations). Індекси — після
-- завантаження даних (01_index_a.sql), щоб COPY не платив за них.
--
-- Спільна схема core тримає те, що НЕ залежить від моделі зберігання текстів:
-- значення властивостей, ціни, призначення властивостей розділам. Усі моделі
-- читають ті самі core-таблиці — порівняння чесне, бо відрізняються лише тексти.

DROP SCHEMA IF EXISTS core, a, b, d, r, r2, bench CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_buffercache;
CREATE SCHEMA core; CREATE SCHEMA a; CREATE SCHEMA bench;

-- ---------- core ----------
CREATE TABLE core.locales (code varchar(10) PRIMARY KEY, is_default boolean NOT NULL DEFAULT false);
INSERT INTO core.locales VALUES ('uk', true), ('en', false), ('pl', false), ('de', false), ('ro', false);
CREATE TABLE core.price_types (
  id uuid PRIMARY KEY, code varchar NOT NULL UNIQUE, name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false, sort_order int NOT NULL DEFAULT 0
);
CREATE TABLE core.section_property_assignments (
  id uuid PRIMARY KEY, section_id uuid NOT NULL, property_id uuid NOT NULL,
  sort_order int NOT NULL DEFAULT 0, applies_to text NOT NULL DEFAULT 'product',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE core.product_property_values (
  id uuid PRIMARY KEY, product_id uuid NOT NULL, property_id uuid NOT NULL,
  value text, numeric_value numeric(15,4), option_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE core.modification_property_values (
  id uuid PRIMARY KEY, modification_id uuid NOT NULL, property_id uuid NOT NULL,
  value text, numeric_value numeric, option_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE core.product_prices (
  id uuid PRIMARY KEY, price_type_id uuid NOT NULL, product_id uuid NOT NULL,
  modification_id uuid, price numeric NOT NULL, old_price numeric,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- модель A ----------
CREATE TABLE a.sections (
  id uuid PRIMARY KEY, slug varchar(255) NOT NULL, name text NOT NULL, description text,
  image_url text, parent_id uuid, sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true, meta_title text, meta_description text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE a.section_translations (
  section_id uuid NOT NULL, locale varchar(10) NOT NULL,
  name text, slug varchar(255), description text, meta_title text, meta_description text,
  PRIMARY KEY (section_id, locale)
);
CREATE TABLE a.section_properties (
  id uuid PRIMARY KEY, section_id uuid, name text NOT NULL, slug varchar(100) NOT NULL,
  property_type text NOT NULL DEFAULT 'text', is_required boolean NOT NULL DEFAULT false,
  is_filterable boolean NOT NULL DEFAULT false, has_page boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE a.section_property_translations (
  property_id uuid NOT NULL, locale varchar(10) NOT NULL, name text, slug varchar(100),
  PRIMARY KEY (property_id, locale)
);
CREATE TABLE a.property_options (
  id uuid PRIMARY KEY, property_id uuid NOT NULL, name text NOT NULL, slug varchar(255) NOT NULL,
  sort_order int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(),
  description text, image_url text, meta_title text, meta_description text
);
-- property_id продубльовано в перекладі: інакше UNIQUE(property_id, locale, slug)
-- не виразити декларативно (slug опції унікальний у межах властивості).
CREATE TABLE a.property_option_translations (
  option_id uuid NOT NULL, locale varchar(10) NOT NULL, property_id uuid NOT NULL,
  name text, slug varchar(255),
  PRIMARY KEY (option_id, locale)
);
CREATE TABLE a.products (
  id uuid PRIMARY KEY, section_id uuid, slug varchar(255) NOT NULL, name text NOT NULL,
  short_description text, description text, is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false, meta_title text, meta_description text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  images jsonb DEFAULT '[]'::jsonb, has_modifications boolean DEFAULT true, sku varchar,
  stock_status text NOT NULL DEFAULT 'in_stock', return_policy jsonb, shipping_details jsonb
);
CREATE TABLE a.product_translations (
  product_id uuid NOT NULL, locale varchar(10) NOT NULL,
  name text, slug varchar(255), short_description text, description text,
  meta_title text, meta_description text,
  PRIMARY KEY (product_id, locale)
);
CREATE TABLE a.product_modifications (
  id uuid PRIMARY KEY, product_id uuid NOT NULL, slug varchar(255) NOT NULL, name text NOT NULL,
  sku varchar(100), is_default boolean NOT NULL DEFAULT false, images jsonb DEFAULT '[]'::jsonb,
  sort_order int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), stock_status text NOT NULL DEFAULT 'in_stock'
);
CREATE TABLE a.product_modification_translations (
  modification_id uuid NOT NULL, locale varchar(10) NOT NULL, name text,
  PRIMARY KEY (modification_id, locale)
);
