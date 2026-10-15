-- 03b_build_r2.sql — read-model R2 поверх A (розщеплена: мовонезалежні факти на товар +
-- вузький текст на (товар, локаль); пошук — core.search_documents) і спільні для R/R2
-- мітки фасетів. Fallback застосовано під час побудови.
\timing on
\set retail '''00000000-0000-4000-8000-000000000001'''
DROP SCHEMA IF EXISTS r CASCADE; DROP SCHEMA IF EXISTS r2 CASCADE;
CREATE SCHEMA r; CREATE SCHEMA r2;

-- ---------- мовонезалежні факти товару (ціни, опції) — спільні для R і R2 ----------
CREATE VIEW r.v_product_facts AS
SELECT p.id AS product_id, p.section_id, p.is_active, p.stock_status, p.images->>0 AS image, p.created_at,
       pr.price_min, pr.price_max, coalesce(op.option_ids, '{}') AS option_ids
FROM a.products p
LEFT JOIN LATERAL (SELECT min(price) AS price_min, max(price) AS price_max FROM core.product_prices
                   WHERE product_id = p.id AND price_type_id = :retail) pr ON true
LEFT JOIN LATERAL (SELECT array_agg(DISTINCT o ORDER BY o) AS option_ids FROM (
                     SELECT option_id AS o FROM core.product_property_values WHERE product_id = p.id AND option_id IS NOT NULL
                     UNION ALL
                     SELECT v.option_id FROM a.product_modifications m JOIN core.modification_property_values v ON v.modification_id = m.id
                     WHERE m.product_id = p.id AND v.option_id IS NOT NULL) x) op ON true;

-- мітки фасетів у кожній мові (fallback застосовано); спільні для R і R2
CREATE TABLE r.facet_labels AS
SELECT l.code AS locale, o.id AS option_id, o.property_id, coalesce(ot.name, o.name) AS option_name,
       coalesce(ot.slug, o.slug) AS option_slug, o.sort_order AS option_sort,
       coalesce(pt.name, p.name) AS property_name, coalesce(pt.slug, p.slug) AS property_slug, p.sort_order AS property_sort, p.is_filterable
FROM a.property_options o JOIN a.section_properties p ON p.id = o.property_id CROSS JOIN core.locales l
LEFT JOIN a.property_option_translations ot ON ot.option_id = o.id AND ot.locale = l.code
LEFT JOIN a.section_property_translations pt ON pt.property_id = p.id AND pt.locale = l.code;
ALTER TABLE r.facet_labels ADD PRIMARY KEY (locale, option_id);

-- ---------- R2: розщеплена проєкція ----------
CREATE TABLE r2.cat_facts (
  product_id uuid PRIMARY KEY, section_id uuid, is_active boolean NOT NULL, stock_status text NOT NULL,
  image text, created_at timestamptz NOT NULL, price_min numeric, price_max numeric, option_ids uuid[] NOT NULL
);
CREATE TABLE r2.cat_text (
  product_id uuid NOT NULL, locale varchar(10) NOT NULL, name text NOT NULL, slug varchar(255) NOT NULL,
  PRIMARY KEY (product_id, locale)
);
\echo '== R2 full rebuild: facts'
INSERT INTO r2.cat_facts SELECT * FROM r.v_product_facts;
\echo '== R2 full rebuild: text'
INSERT INTO r2.cat_text SELECT product_id, locale, name, slug FROM core.v_product_text;
\echo '== R2 indexes'
CREATE INDEX cf_section_price ON r2.cat_facts (section_id, price_min) WHERE is_active;
CREATE INDEX cf_options_gin ON r2.cat_facts USING gin (option_ids);
ALTER TABLE r2.cat_text ADD CONSTRAINT ct_locale_slug_key UNIQUE (locale, slug);
CREATE INDEX ct_locale_name ON r2.cat_text (locale, name);
VACUUM ANALYZE;
SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size;
