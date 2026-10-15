-- 02_build_b_d.sql — моделі B (усі тексти лише в *_translations) і D (JSONB-мапа на поле),
-- побудовані з A, щоб дані були ідентичні. Час побудови B з A — це й оцінка міграції A→B.
\timing on
DROP SCHEMA IF EXISTS b CASCADE; DROP SCHEMA IF EXISTS d CASCADE;
CREATE SCHEMA b; CREATE SCHEMA d;

-- ======================= B =======================
-- default_locale + відкладений FK (id, default_locale) → translations гарантує на рівні БД,
-- що в кожної сутності є рядок основної мови (інакше в B «товар без назви» можливий).
CREATE TABLE b.sections (
  id uuid PRIMARY KEY, image_url text, parent_id uuid, sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  default_locale varchar(10) NOT NULL DEFAULT 'uk' CHECK (default_locale = 'uk')
);
CREATE TABLE b.section_translations (
  section_id uuid NOT NULL REFERENCES b.sections(id) ON DELETE CASCADE, locale varchar(10) NOT NULL,
  name text, slug varchar(255), description text, meta_title text, meta_description text,
  PRIMARY KEY (section_id, locale), CHECK (locale <> 'uk' OR (name IS NOT NULL AND slug IS NOT NULL))
);
CREATE TABLE b.section_properties (
  id uuid PRIMARY KEY, section_id uuid, property_type text NOT NULL DEFAULT 'text',
  is_required boolean NOT NULL DEFAULT false, is_filterable boolean NOT NULL DEFAULT false,
  has_page boolean NOT NULL DEFAULT false, sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  default_locale varchar(10) NOT NULL DEFAULT 'uk' CHECK (default_locale = 'uk')
);
CREATE TABLE b.section_property_translations (
  property_id uuid NOT NULL REFERENCES b.section_properties(id) ON DELETE CASCADE, locale varchar(10) NOT NULL,
  name text, slug varchar(100), PRIMARY KEY (property_id, locale),
  CHECK (locale <> 'uk' OR (name IS NOT NULL AND slug IS NOT NULL))
);
CREATE TABLE b.property_options (
  id uuid PRIMARY KEY, property_id uuid NOT NULL, sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), image_url text,
  default_locale varchar(10) NOT NULL DEFAULT 'uk' CHECK (default_locale = 'uk')
);
CREATE TABLE b.property_option_translations (
  option_id uuid NOT NULL REFERENCES b.property_options(id) ON DELETE CASCADE, locale varchar(10) NOT NULL,
  property_id uuid NOT NULL, name text, slug varchar(255), description text, meta_title text, meta_description text,
  PRIMARY KEY (option_id, locale), CHECK (locale <> 'uk' OR (name IS NOT NULL AND slug IS NOT NULL))
);
CREATE TABLE b.products (
  id uuid PRIMARY KEY, section_id uuid, is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), images jsonb DEFAULT '[]'::jsonb,
  has_modifications boolean DEFAULT true, sku varchar, stock_status text NOT NULL DEFAULT 'in_stock',
  return_policy jsonb, shipping_details jsonb,
  default_locale varchar(10) NOT NULL DEFAULT 'uk' CHECK (default_locale = 'uk')
);
CREATE TABLE b.product_translations (
  product_id uuid NOT NULL REFERENCES b.products(id) ON DELETE CASCADE, locale varchar(10) NOT NULL,
  name text, slug varchar(255), short_description text, description text, meta_title text, meta_description text,
  PRIMARY KEY (product_id, locale), CHECK (locale <> 'uk' OR (name IS NOT NULL AND slug IS NOT NULL))
);
CREATE TABLE b.product_modifications (
  id uuid PRIMARY KEY, product_id uuid NOT NULL REFERENCES b.products(id) ON DELETE CASCADE,
  slug varchar(255) NOT NULL, sku varchar(100), is_default boolean NOT NULL DEFAULT false,
  images jsonb DEFAULT '[]'::jsonb, sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  stock_status text NOT NULL DEFAULT 'in_stock',
  default_locale varchar(10) NOT NULL DEFAULT 'uk' CHECK (default_locale = 'uk')
);
CREATE TABLE b.product_modification_translations (
  modification_id uuid NOT NULL REFERENCES b.product_modifications(id) ON DELETE CASCADE,
  locale varchar(10) NOT NULL, name text, PRIMARY KEY (modification_id, locale),
  CHECK (locale <> 'uk' OR name IS NOT NULL)
);

INSERT INTO b.sections SELECT id, image_url, parent_id, sort_order, is_active, created_at, updated_at FROM a.sections;
INSERT INTO b.section_translations
  SELECT id, 'uk', name, slug, description, meta_title, meta_description FROM a.sections
  UNION ALL SELECT section_id, locale, name, slug, description, meta_title, meta_description FROM a.section_translations;
INSERT INTO b.section_properties SELECT id, section_id, property_type, is_required, is_filterable, has_page, sort_order, created_at FROM a.section_properties;
INSERT INTO b.section_property_translations
  SELECT id, 'uk', name, slug FROM a.section_properties UNION ALL SELECT property_id, locale, name, slug FROM a.section_property_translations;
INSERT INTO b.property_options SELECT id, property_id, sort_order, created_at, image_url FROM a.property_options;
INSERT INTO b.property_option_translations
  SELECT id, 'uk', property_id, name, slug, description, meta_title, meta_description FROM a.property_options
  UNION ALL SELECT option_id, locale, property_id, name, slug, NULL, NULL, NULL FROM a.property_option_translations;
-- Міграція A→B на даних (тексти товарів): час цих трьох операторів = вартість переносу
INSERT INTO b.products SELECT id, section_id, is_active, is_featured, created_at, updated_at, images, has_modifications, sku, stock_status, return_policy, shipping_details FROM a.products;
INSERT INTO b.product_translations
  SELECT id, 'uk', name, slug, short_description, description, meta_title, meta_description FROM a.products
  UNION ALL SELECT product_id, locale, name, slug, short_description, description, meta_title, meta_description FROM a.product_translations;
INSERT INTO b.product_modifications SELECT id, product_id, slug, sku, is_default, images, sort_order, created_at, updated_at, stock_status FROM a.product_modifications;
INSERT INTO b.product_modification_translations
  SELECT id, 'uk', name FROM a.product_modifications UNION ALL SELECT modification_id, locale, name FROM a.product_modification_translations;

ALTER TABLE b.products ADD CONSTRAINT products_default_tr_fk FOREIGN KEY (id, default_locale) REFERENCES b.product_translations(product_id, locale) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE b.product_modifications ADD CONSTRAINT pm_default_tr_fk FOREIGN KEY (id, default_locale) REFERENCES b.product_modification_translations(modification_id, locale) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE b.sections ADD CONSTRAINT sections_default_tr_fk FOREIGN KEY (id, default_locale) REFERENCES b.section_translations(section_id, locale) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE b.section_properties ADD CONSTRAINT sp_default_tr_fk FOREIGN KEY (id, default_locale) REFERENCES b.section_property_translations(property_id, locale) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE b.property_options ADD CONSTRAINT po_default_tr_fk FOREIGN KEY (id, default_locale) REFERENCES b.property_option_translations(option_id, locale) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE b.product_translations ADD CONSTRAINT bpt_locale_slug_key UNIQUE (locale, slug);
ALTER TABLE b.section_translations ADD CONSTRAINT bst_locale_slug_key UNIQUE (locale, slug);
ALTER TABLE b.section_property_translations ADD CONSTRAINT bspt_locale_slug_key UNIQUE (locale, slug);
ALTER TABLE b.property_option_translations ADD CONSTRAINT bpot_prop_locale_slug_key UNIQUE (property_id, locale, slug);
CREATE INDEX ON b.products (section_id);
ALTER TABLE b.product_modifications ADD CONSTRAINT bpm_product_slug_key UNIQUE (product_id, slug);
CREATE INDEX ON b.sections (parent_id);
CREATE INDEX ON b.property_options (property_id);

-- ======================= D =======================
CREATE TABLE d.sections (
  id uuid PRIMARY KEY, slug jsonb NOT NULL, name jsonb NOT NULL, description jsonb, image_url text,
  parent_id uuid, sort_order int NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true,
  meta_title jsonb, meta_description jsonb, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), CHECK (name ? 'uk' AND slug ? 'uk')
);
CREATE TABLE d.section_properties (
  id uuid PRIMARY KEY, section_id uuid, name jsonb NOT NULL, slug jsonb NOT NULL,
  property_type text NOT NULL DEFAULT 'text', is_required boolean NOT NULL DEFAULT false,
  is_filterable boolean NOT NULL DEFAULT false, has_page boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (name ? 'uk' AND slug ? 'uk')
);
CREATE TABLE d.property_options (
  id uuid PRIMARY KEY, property_id uuid NOT NULL, name jsonb NOT NULL, slug jsonb NOT NULL,
  sort_order int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(),
  description jsonb, image_url text, meta_title jsonb, meta_description jsonb,
  CHECK (name ? 'uk' AND slug ? 'uk')
);
CREATE TABLE d.products (
  id uuid PRIMARY KEY, section_id uuid, slug jsonb NOT NULL, name jsonb NOT NULL,
  short_description jsonb, description jsonb, is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false, meta_title jsonb, meta_description jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  images jsonb DEFAULT '[]'::jsonb, has_modifications boolean DEFAULT true, sku varchar,
  stock_status text NOT NULL DEFAULT 'in_stock', return_policy jsonb, shipping_details jsonb,
  CHECK (name ? 'uk' AND slug ? 'uk')
);
CREATE TABLE d.product_modifications (
  id uuid PRIMARY KEY, product_id uuid NOT NULL REFERENCES d.products(id) ON DELETE CASCADE,
  slug varchar(255) NOT NULL, name jsonb NOT NULL, sku varchar(100), is_default boolean NOT NULL DEFAULT false,
  images jsonb DEFAULT '[]'::jsonb, sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  stock_status text NOT NULL DEFAULT 'in_stock'
);

-- jsonb_strip_nulls: відсутній переклад поля = відсутній ключ (а не null) — так працює ->> + COALESCE
INSERT INTO d.sections
SELECT s.id, jsonb_build_object('uk', s.slug) || coalesce(t.slug, '{}'), jsonb_build_object('uk', s.name) || coalesce(t.name, '{}'),
       jsonb_strip_nulls(jsonb_build_object('uk', s.description) || coalesce(t.description, '{}')), s.image_url, s.parent_id, s.sort_order, s.is_active,
       jsonb_strip_nulls(jsonb_build_object('uk', s.meta_title) || coalesce(t.meta_title, '{}')),
       jsonb_strip_nulls(jsonb_build_object('uk', s.meta_description) || coalesce(t.meta_description, '{}')), s.created_at, s.updated_at
FROM a.sections s LEFT JOIN LATERAL (
  SELECT jsonb_object_agg(locale, slug) FILTER (WHERE slug IS NOT NULL) slug, jsonb_object_agg(locale, name) FILTER (WHERE name IS NOT NULL) name,
         jsonb_object_agg(locale, description) FILTER (WHERE description IS NOT NULL) description,
         jsonb_object_agg(locale, meta_title) FILTER (WHERE meta_title IS NOT NULL) meta_title,
         jsonb_object_agg(locale, meta_description) FILTER (WHERE meta_description IS NOT NULL) meta_description
  FROM a.section_translations WHERE section_id = s.id) t ON true;
INSERT INTO d.section_properties
SELECT p.id, p.section_id, jsonb_build_object('uk', p.name) || coalesce(t.name, '{}'), jsonb_build_object('uk', p.slug) || coalesce(t.slug, '{}'),
       p.property_type, p.is_required, p.is_filterable, p.has_page, p.sort_order, p.created_at
FROM a.section_properties p LEFT JOIN LATERAL (
  SELECT jsonb_object_agg(locale, name) FILTER (WHERE name IS NOT NULL) name, jsonb_object_agg(locale, slug) FILTER (WHERE slug IS NOT NULL) slug
  FROM a.section_property_translations WHERE property_id = p.id) t ON true;
INSERT INTO d.property_options
SELECT o.id, o.property_id, jsonb_build_object('uk', o.name) || coalesce(t.name, '{}'), jsonb_build_object('uk', o.slug) || coalesce(t.slug, '{}'),
       o.sort_order, o.created_at, NULL, o.image_url, NULL, NULL
FROM a.property_options o LEFT JOIN LATERAL (
  SELECT jsonb_object_agg(locale, name) FILTER (WHERE name IS NOT NULL) name, jsonb_object_agg(locale, slug) FILTER (WHERE slug IS NOT NULL) slug
  FROM a.property_option_translations WHERE option_id = o.id) t ON true;
INSERT INTO d.products
SELECT p.id, p.section_id, jsonb_build_object('uk', p.slug) || coalesce(t.slug, '{}'), jsonb_build_object('uk', p.name) || coalesce(t.name, '{}'),
       jsonb_build_object('uk', p.short_description) || coalesce(t.sd, '{}'), jsonb_build_object('uk', p.description) || coalesce(t.d, '{}'),
       p.is_active, p.is_featured, jsonb_build_object('uk', p.meta_title) || coalesce(t.mt, '{}'), jsonb_build_object('uk', p.meta_description) || coalesce(t.md, '{}'),
       p.created_at, p.updated_at, p.images, p.has_modifications, p.sku, p.stock_status, p.return_policy, p.shipping_details
FROM a.products p LEFT JOIN LATERAL (
  SELECT jsonb_object_agg(locale, slug) FILTER (WHERE slug IS NOT NULL) slug, jsonb_object_agg(locale, name) FILTER (WHERE name IS NOT NULL) name,
         jsonb_object_agg(locale, short_description) FILTER (WHERE short_description IS NOT NULL) sd,
         jsonb_object_agg(locale, description) FILTER (WHERE description IS NOT NULL) d,
         jsonb_object_agg(locale, meta_title) FILTER (WHERE meta_title IS NOT NULL) mt,
         jsonb_object_agg(locale, meta_description) FILTER (WHERE meta_description IS NOT NULL) md
  FROM a.product_translations WHERE product_id = p.id) t ON true;
INSERT INTO d.product_modifications
SELECT m.id, m.product_id, m.slug, jsonb_build_object('uk', m.name) || coalesce(t.name, '{}'), m.sku, m.is_default, m.images, m.sort_order, m.created_at, m.updated_at, m.stock_status
FROM a.product_modifications m LEFT JOIN LATERAL (
  SELECT jsonb_object_agg(locale, name) FILTER (WHERE name IS NOT NULL) name FROM a.product_modification_translations WHERE modification_id = m.id) t ON true;

-- D: унікальність slug — expression-індекс НА КОЖНУ мову (нова мова = нові індекси)
CREATE UNIQUE INDEX d_products_slug_uk ON d.products ((slug->>'uk'));
CREATE UNIQUE INDEX d_products_slug_en ON d.products ((slug->>'en')) WHERE slug ? 'en';
CREATE UNIQUE INDEX d_products_slug_pl ON d.products ((slug->>'pl')) WHERE slug ? 'pl';
CREATE UNIQUE INDEX d_products_slug_de ON d.products ((slug->>'de')) WHERE slug ? 'de';
CREATE UNIQUE INDEX d_products_slug_ro ON d.products ((slug->>'ro')) WHERE slug ? 'ro';
-- альтернатива: один GIN для пошуку за slug з параметром-локаллю (унікальності НЕ дає)
CREATE INDEX d_products_slug_gin ON d.products USING gin (slug jsonb_path_ops);
CREATE INDEX ON d.products (section_id);
CREATE UNIQUE INDEX d_sections_slug_uk ON d.sections ((slug->>'uk'));
CREATE UNIQUE INDEX d_sections_slug_en ON d.sections ((slug->>'en')) WHERE slug ? 'en';
CREATE UNIQUE INDEX d_sections_slug_pl ON d.sections ((slug->>'pl')) WHERE slug ? 'pl';
CREATE UNIQUE INDEX d_sections_slug_de ON d.sections ((slug->>'de')) WHERE slug ? 'de';
CREATE UNIQUE INDEX d_sections_slug_ro ON d.sections ((slug->>'ro')) WHERE slug ? 'ro';
CREATE INDEX ON d.sections (parent_id);
CREATE UNIQUE INDEX d_props_slug_uk ON d.section_properties ((slug->>'uk'));
CREATE UNIQUE INDEX d_props_slug_en ON d.section_properties ((slug->>'en')) WHERE slug ? 'en';
CREATE UNIQUE INDEX d_props_slug_pl ON d.section_properties ((slug->>'pl')) WHERE slug ? 'pl';
CREATE UNIQUE INDEX d_props_slug_de ON d.section_properties ((slug->>'de')) WHERE slug ? 'de';
CREATE UNIQUE INDEX d_props_slug_ro ON d.section_properties ((slug->>'ro')) WHERE slug ? 'ro';
CREATE UNIQUE INDEX d_opts_slug_uk ON d.property_options (property_id, (slug->>'uk'));
CREATE UNIQUE INDEX d_opts_slug_en ON d.property_options (property_id, (slug->>'en')) WHERE slug ? 'en';
CREATE UNIQUE INDEX d_opts_slug_pl ON d.property_options (property_id, (slug->>'pl')) WHERE slug ? 'pl';
CREATE UNIQUE INDEX d_opts_slug_de ON d.property_options (property_id, (slug->>'de')) WHERE slug ? 'de';
CREATE UNIQUE INDEX d_opts_slug_ro ON d.property_options (property_id, (slug->>'ro')) WHERE slug ? 'ro';
CREATE UNIQUE INDEX ON d.product_modifications (product_id, slug);
VACUUM ANALYZE;
