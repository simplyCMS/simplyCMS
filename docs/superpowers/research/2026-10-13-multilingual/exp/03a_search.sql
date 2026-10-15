-- 03a_search.sql — документи пошуку за спекою 2026-08-25 (core.search_documents) і
-- представлення «текст товару з fallback» поверх A (потрібні й індексатору, і read-model).
\timing on
\set retail '''00000000-0000-4000-8000-000000000001'''
DROP TABLE IF EXISTS core.search_documents;
DROP VIEW IF EXISTS core.v_product_attrs, core.v_product_text;


-- ---------- спільні «джерельні» представлення поверх A (fallback уже застосовано) ----------
-- Що вітрина/індексатор вважає текстом товару в локалі L. Лематизацію імітує lower():
-- за спекою (П2) її робить Node, у Postgres приходить уже нормалізований текст.
CREATE VIEW core.v_product_text AS
SELECT p.id AS product_id, l.code AS locale,
       coalesce(t.name, p.name) AS name, coalesce(t.slug, p.slug) AS slug,
       coalesce(t.short_description, p.short_description) AS short_description,
       coalesce(t.description, p.description) AS description, p.sku, p.updated_at, p.is_active
FROM a.products p CROSS JOIN core.locales l
LEFT JOIN a.product_translations t ON t.product_id = p.id AND t.locale = l.code;

CREATE VIEW core.v_product_attrs AS
SELECT pt.product_id, pt.locale,
       (SELECT coalesce(st.name, s.name) FROM a.products p JOIN a.sections s ON s.id = p.section_id
          LEFT JOIN a.section_translations st ON st.section_id = s.id AND st.locale = pt.locale WHERE p.id = pt.product_id)
       || ' ' || coalesce((SELECT string_agg(coalesce(ot.name, o.name), ' ')
          FROM core.product_property_values v JOIN a.property_options o ON o.id = v.option_id
          LEFT JOIN a.property_option_translations ot ON ot.option_id = o.id AND ot.locale = pt.locale
          WHERE v.product_id = pt.product_id), '') AS attrs
FROM core.v_product_text pt;

-- ---------- core.search_documents — дослівно за §4.1 спеки (без embedding: pgvector в образі немає) ----------
CREATE TABLE core.search_documents (
  entity_type text NOT NULL, entity_id uuid NOT NULL, locale varchar(10) NOT NULL,
  title_lex text NOT NULL DEFAULT '', attrs_lex text NOT NULL DEFAULT '', body_lex text NOT NULL DEFAULT '',
  exact_tokens text NOT NULL DEFAULT '', title_norm text NOT NULL DEFAULT '',
  tsv tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', title_lex), 'A') || setweight(to_tsvector('simple', exact_tokens), 'A') ||
    setweight(to_tsvector('simple', attrs_lex), 'B') || setweight(to_tsvector('simple', body_lex), 'C')) STORED,
  lang_pack varchar(32) NOT NULL DEFAULT 'sim', lang_pack_version varchar(32) NOT NULL DEFAULT '1',
  source_updated_at timestamptz, indexed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type, entity_id, locale)
);
\echo '== build search_documents (5 локалей × товари, з fallback)'
INSERT INTO core.search_documents (entity_type, entity_id, locale, title_lex, attrs_lex, body_lex, exact_tokens, title_norm, source_updated_at)
SELECT 'product', pt.product_id, pt.locale, lower(pt.name), lower(pa.attrs),
       lower(coalesce(pt.short_description, '') || ' ' || regexp_replace(coalesce(pt.description, ''), '<[^>]+>', ' ', 'g')),
       lower(coalesce(pt.sku, '')), lower(pt.name), pt.updated_at
FROM core.v_product_text pt JOIN core.v_product_attrs pa USING (product_id, locale)
-- індекс тримає лише видимі товари (деактивація = видалення документа через чергу)
WHERE pt.is_active;
\echo '== search_documents indexes'
CREATE INDEX search_documents_tsv_idx ON core.search_documents USING gin (tsv);
CREATE INDEX search_documents_title_trgm_gin_idx ON core.search_documents USING gin (title_norm gin_trgm_ops);
CREATE INDEX search_documents_title_trgm_gist_idx ON core.search_documents USING gist (title_norm gist_trgm_ops);

VACUUM ANALYZE core.search_documents;
SELECT pg_size_pretty(pg_total_relation_size('core.search_documents')) AS search_documents_size;
