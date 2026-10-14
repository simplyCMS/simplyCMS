-- 03c_build_r.sql — read-model R: широка проєкція (товар, локаль) з tsv усередині (поверх A)
\timing on
DROP TABLE IF EXISTS r.catalog_entries CASCADE;
-- ---------- R: широка проєкція (product_id, locale) ----------
CREATE TABLE r.catalog_entries (
  product_id uuid NOT NULL, locale varchar(10) NOT NULL, section_id uuid, is_active boolean NOT NULL,
  stock_status text NOT NULL, name text NOT NULL, slug varchar(255) NOT NULL, image text,
  price_min numeric, price_max numeric, option_ids uuid[] NOT NULL, tsv tsvector NOT NULL,
  title_norm text NOT NULL, created_at timestamptz NOT NULL,
  PRIMARY KEY (product_id, locale)
);
CREATE VIEW r.v_catalog_entries AS
SELECT f.product_id, pt.locale, f.section_id, f.is_active, f.stock_status, pt.name, pt.slug, f.image,
       f.price_min, f.price_max, f.option_ids,
       setweight(to_tsvector('simple', lower(pt.name)), 'A') || setweight(to_tsvector('simple', lower(coalesce(pt.sku, ''))), 'A') ||
       setweight(to_tsvector('simple', lower(pa.attrs)), 'B') ||
       setweight(to_tsvector('simple', lower(coalesce(pt.short_description, '') || ' ' || regexp_replace(coalesce(pt.description, ''), '<[^>]+>', ' ', 'g'))), 'C') AS tsv,
       lower(pt.name) AS title_norm, f.created_at
FROM r.v_product_facts f JOIN core.v_product_text pt USING (product_id) JOIN core.v_product_attrs pa USING (product_id, locale);
\echo '== R full rebuild (INSERT ... SELECT з view)'
INSERT INTO r.catalog_entries SELECT * FROM r.v_catalog_entries;
\echo '== R indexes'
ALTER TABLE r.catalog_entries ADD CONSTRAINT ce_locale_slug_key UNIQUE (locale, slug);
CREATE INDEX ce_listing_price ON r.catalog_entries (locale, section_id, price_min) WHERE is_active;
CREATE INDEX ce_listing_name ON r.catalog_entries (locale, section_id, name) WHERE is_active;
CREATE INDEX ce_options_gin ON r.catalog_entries USING gin (option_ids);
CREATE INDEX ce_tsv_gin ON r.catalog_entries USING gin (tsv);
CREATE INDEX ce_trgm_gin ON r.catalog_entries USING gin (title_norm gin_trgm_ops);

VACUUM ANALYZE r.catalog_entries;
