-- 33_writes_r.sql — записи для широкої R (фаза 3). Джерело — A; проєкція
-- оновлюється в тій самій транзакції (синхронно) — це верхня межа вартості; асинхронна
-- черга (як у спеці пошуку) переносить її з критичного шляху, але не зменшує.
\set retail '''00000000-0000-4000-8000-000000000001'''
\set r_upsert 'ON CONFLICT (product_id, locale) DO UPDATE SET section_id = EXCLUDED.section_id, is_active = EXCLUDED.is_active, stock_status = EXCLUDED.stock_status, name = EXCLUDED.name, slug = EXCLUDED.slug, image = EXCLUDED.image, price_min = EXCLUDED.price_min, price_max = EXCLUDED.price_max, option_ids = EXCLUDED.option_ids, tsv = EXCLUDED.tsv, title_norm = EXCLUDED.title_norm'
\set sd_insert 'INSERT INTO core.search_documents (entity_type, entity_id, locale, title_lex, attrs_lex, body_lex, exact_tokens, title_norm, source_updated_at) SELECT ''product'', pt.product_id, pt.locale, lower(pt.name), lower(pa.attrs), lower(coalesce(pt.short_description, '''') || '' '' || regexp_replace(coalesce(pt.description, ''''), ''<[^>]+>'', '' '', ''g'')), lower(coalesce(pt.sku, '''')), lower(pt.name), pt.updated_at FROM core.v_product_text pt JOIN core.v_product_attrs pa USING (product_id, locale) WHERE pt.is_active'
\set sd_upsert 'ON CONFLICT (entity_type, entity_id, locale) DO UPDATE SET title_lex = EXCLUDED.title_lex, attrs_lex = EXCLUDED.attrs_lex, body_lex = EXCLUDED.body_lex, exact_tokens = EXCLUDED.exact_tokens, title_norm = EXCLUDED.title_norm, source_updated_at = EXCLUDED.source_updated_at, indexed_at = now()'


-- W1: en-переклад змінився → R: перебудувати рядок (товар, en); R2: cat_text(en) + пошуковий документ(en)
SELECT bench.wseries(:scale, 'R', 'upd_tr_en', $s$
  UPDATE a.product_translations SET name = name || ' y', description = description || ' y' WHERE product_id = %1$L AND locale = 'en';;
  UPDATE a.products SET updated_at = now() WHERE id = %1$L;;
  INSERT INTO r.catalog_entries SELECT * FROM r.v_catalog_entries WHERE product_id = %1$L AND locale = 'en' $s$ || ' ' || :'r_upsert', (SELECT ids FROM bench.w_ids));
-- W1b: змінився uk-текст → fallback зачіпає всі локалі без перекладу: перебудова всіх 5 рядків
SELECT bench.wseries(:scale, 'R', 'upd_base_uk', $s$
  UPDATE a.products SET name = name || ' y', description = description || ' y', updated_at = now() WHERE id = %1$L;;
  INSERT INTO r.catalog_entries SELECT * FROM r.v_catalog_entries WHERE product_id = %1$L $s$ || ' ' || :'r_upsert', (SELECT ids FROM bench.w_ids));
-- W1c: нетекстове поле одного товару
SELECT bench.wseries(:scale, 'R', 'upd_stock_1', $s$
  UPDATE a.products SET stock_status = CASE WHEN stock_status = 'in_stock' THEN 'out_of_stock' ELSE 'in_stock' END, updated_at = now() WHERE id = %1$L;;
  UPDATE r.catalog_entries ce SET stock_status = p.stock_status FROM a.products p WHERE p.id = ce.product_id AND ce.product_id = %1$L $s$, (SELECT ids FROM bench.w_ids));

-- W2: нова мова cs (10k перекладів) → R: +N рядків на ВСІ товари (fallback), R2: cat_text + пошукові документи
CHECKPOINT;
SELECT 'R add_locale' t, * FROM bench.wbulk(:scale, 'R', 'add_locale_10k', $s$
  INSERT INTO a.product_translations (product_id, locale, name, slug, short_description, description, meta_title, meta_description)
  SELECT product_id, 'cs', name, slug, short_description, description, meta_title, meta_description FROM bench.import_cs;;
  INSERT INTO core.locales VALUES ('cs', false);;
  INSERT INTO r.catalog_entries SELECT * FROM r.v_catalog_entries WHERE locale = 'cs';;
  INSERT INTO r.facet_labels SELECT 'cs', option_id, property_id, option_name, option_slug, option_sort, property_name, property_slug, property_sort, is_filterable FROM r.facet_labels WHERE locale = 'uk' $s$,
  'A-імпорт 10k + рядок R на кожен товар у новій мові');
VACUUM a.product_translations; VACUUM r.catalog_entries; VACUUM r.facet_labels;

-- W3: масове оновлення цін → перерахувати price_min/max у проєкції
CHECKPOINT;
SELECT 'R price_mass' t, * FROM bench.wbulk(:scale, 'R', 'price_mass', format($s$
  UPDATE core.product_prices SET price = round(price * 1.05), updated_at = now() WHERE price_type_id = %1$L;;
  UPDATE r.catalog_entries ce SET price_min = x.mn, price_max = x.mx
  FROM (SELECT product_id, min(price) mn, max(price) mx FROM core.product_prices WHERE price_type_id = %1$L GROUP BY product_id) x
  WHERE ce.product_id = x.product_id AND (ce.price_min, ce.price_max) IS DISTINCT FROM (x.mn, x.mx) $s$, :retail),
  'ціни × 5 локалей: кожен рядок R (з tsv) переписується');
VACUUM core.product_prices; VACUUM r.catalog_entries;
-- W4: масова синхронізація залишків
CHECKPOINT;
SELECT 'R stock_mass' t, * FROM bench.wbulk(:scale, 'R', 'stock_mass', $s$
  UPDATE a.products SET stock_status = CASE WHEN stock_status = 'in_stock' THEN 'out_of_stock' ELSE 'in_stock' END, updated_at = now();;
  UPDATE r.catalog_entries ce SET stock_status = p.stock_status FROM a.products p WHERE p.id = ce.product_id $s$);
-- W5 (повна перебудова R) — з логу 03c: TRUNCATE+INSERT у субтранзакції з відкатом тримає дві копії R у tmpfs.
SELECT model, test, n, round(ms_median::numeric, 2) ms_median, round(ms_total::numeric, 1) ms_total,
       round(wal_bytes_median / 1024, 1) wal_kb_median, round(wal_bytes_total / 1048576, 2) wal_mb_total
FROM bench.writes WHERE scale = :scale ORDER BY test, model;

-- W4′: та сама синхронізація залишків, але R з fillfactor=70 — місце на сторінці дає HOT-оновлення
-- (stock_status не індексований), і GIN-індекси (tsv, trgm, option_ids) не отримують нових записів
VACUUM a.products; VACUUM r.catalog_entries;
-- перебудова з fillfactor=70 без VACUUM FULL (той тримав би дві копії): TRUNCATE комітиться й звільняє місце
TRUNCATE r.catalog_entries;
ALTER TABLE r.catalog_entries SET (fillfactor = 70);
\timing on
INSERT INTO r.catalog_entries SELECT * FROM r.v_catalog_entries;
\timing off
VACUUM ANALYZE r.catalog_entries;
SELECT 'R(ff70) size' AS what, pg_size_pretty(pg_total_relation_size('r.catalog_entries')) AS size, pg_size_pretty(pg_relation_size('r.catalog_entries')) AS heap;
CHECKPOINT;
SELECT 'R(ff70) stock_mass' t, * FROM bench.wbulk(:scale, 'R(ff70)', 'stock_mass', $s$
  UPDATE a.products SET stock_status = CASE WHEN stock_status = 'in_stock' THEN 'out_of_stock' ELSE 'in_stock' END, updated_at = now();;
  UPDATE r.catalog_entries ce SET stock_status = p.stock_status FROM a.products p WHERE p.id = ce.product_id $s$, 'fillfactor=70 → HOT');
CHECKPOINT;
SELECT 'R(ff70) price_mass' t, * FROM bench.wbulk(:scale, 'R(ff70)', 'price_mass', format($s$
  UPDATE core.product_prices SET price = round(price * 1.05), updated_at = now() WHERE price_type_id = %1$L;;
  UPDATE r.catalog_entries ce SET price_min = x.mn, price_max = x.mx
  FROM (SELECT product_id, min(price) mn, max(price) mx FROM core.product_prices WHERE price_type_id = %1$L GROUP BY product_id) x
  WHERE ce.product_id = x.product_id AND (ce.price_min, ce.price_max) IS DISTINCT FROM (x.mn, x.mx) $s$, :retail),
  'price_min індексований (сортування) → HOT неможливий навіть із fillfactor');
SELECT model, test, round(ms_median::numeric, 1) ms, round(wal_bytes_median / 1048576, 1) wal_mb, touched FROM bench.writes WHERE scale = :scale AND model LIKE 'R%' ORDER BY test, model;
