-- 31_writes_r2.sql — записи для R2 і контроль A (фаза 2). Джерело — A; проєкція
-- оновлюється в тій самій транзакції (синхронно) — це верхня межа вартості; асинхронна
-- черга (як у спеці пошуку) переносить її з критичного шляху, але не зменшує.
\set retail '''00000000-0000-4000-8000-000000000001'''
\set r_upsert 'ON CONFLICT (product_id, locale) DO UPDATE SET section_id = EXCLUDED.section_id, is_active = EXCLUDED.is_active, stock_status = EXCLUDED.stock_status, name = EXCLUDED.name, slug = EXCLUDED.slug, image = EXCLUDED.image, price_min = EXCLUDED.price_min, price_max = EXCLUDED.price_max, option_ids = EXCLUDED.option_ids, tsv = EXCLUDED.tsv, title_norm = EXCLUDED.title_norm'
\set sd_insert 'INSERT INTO core.search_documents (entity_type, entity_id, locale, title_lex, attrs_lex, body_lex, exact_tokens, title_norm, source_updated_at) SELECT ''product'', pt.product_id, pt.locale, lower(pt.name), lower(pa.attrs), lower(coalesce(pt.short_description, '''') || '' '' || regexp_replace(coalesce(pt.description, ''''), ''<[^>]+>'', '' '', ''g'')), lower(coalesce(pt.sku, '''')), lower(pt.name), pt.updated_at FROM core.v_product_text pt JOIN core.v_product_attrs pa USING (product_id, locale) WHERE pt.is_active'
\set sd_upsert 'ON CONFLICT (entity_type, entity_id, locale) DO UPDATE SET title_lex = EXCLUDED.title_lex, attrs_lex = EXCLUDED.attrs_lex, body_lex = EXCLUDED.body_lex, exact_tokens = EXCLUDED.exact_tokens, title_norm = EXCLUDED.title_norm, source_updated_at = EXCLUDED.source_updated_at, indexed_at = now()'

-- контроль: A у фазі 2 (те саме, що у фазі 1)
SELECT bench.wseries(:scale, 'A(ф2)', 'upd_tr_en', $s$
  UPDATE a.product_translations SET name = name || ' y', description = description || ' y' WHERE product_id = %1$L AND locale = 'en';;
  UPDATE a.products SET updated_at = now() WHERE id = %1$L $s$, (SELECT ids FROM bench.w_ids));
SELECT bench.wseries(:scale, 'R2', 'upd_tr_en', $s$
  UPDATE a.product_translations SET name = name || ' y', description = description || ' y' WHERE product_id = %1$L AND locale = 'en';;
  UPDATE a.products SET updated_at = now() WHERE id = %1$L;;
  INSERT INTO r2.cat_text SELECT product_id, locale, name, slug FROM core.v_product_text WHERE product_id = %1$L AND locale = 'en'
    ON CONFLICT (product_id, locale) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug;; $s$
  || :'sd_insert' || $s$ AND pt.product_id = %1$L AND pt.locale = 'en' $s$ || :'sd_upsert', (SELECT ids FROM bench.w_ids));
SELECT bench.wseries(:scale, 'R2', 'upd_base_uk', $s$
  UPDATE a.products SET name = name || ' y', description = description || ' y', updated_at = now() WHERE id = %1$L;;
  INSERT INTO r2.cat_text SELECT product_id, locale, name, slug FROM core.v_product_text WHERE product_id = %1$L
    ON CONFLICT (product_id, locale) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug;; $s$
  || :'sd_insert' || $s$ AND pt.product_id = %1$L $s$ || :'sd_upsert', (SELECT ids FROM bench.w_ids));
SELECT bench.wseries(:scale, 'R2', 'upd_stock_1', $s$
  UPDATE a.products SET stock_status = CASE WHEN stock_status = 'in_stock' THEN 'out_of_stock' ELSE 'in_stock' END, updated_at = now() WHERE id = %1$L;;
  UPDATE r2.cat_facts cf SET stock_status = p.stock_status FROM a.products p WHERE p.id = cf.product_id AND cf.product_id = %1$L $s$, (SELECT ids FROM bench.w_ids));
CHECKPOINT;
SELECT 'R2 add_locale' t, * FROM bench.wbulk(:scale, 'R2', 'add_locale_10k', $s$
  INSERT INTO a.product_translations (product_id, locale, name, slug, short_description, description, meta_title, meta_description)
  SELECT product_id, 'cs', name, slug, short_description, description, meta_title, meta_description FROM bench.import_cs;;
  INSERT INTO core.locales VALUES ('cs', false);;
  INSERT INTO r2.cat_text SELECT product_id, locale, name, slug FROM core.v_product_text WHERE locale = 'cs';;
  INSERT INTO r.facet_labels SELECT 'cs', option_id, property_id, option_name, option_slug, option_sort, property_name, property_slug, property_sort, is_filterable FROM r.facet_labels WHERE locale = 'uk';; $s$
  || :'sd_insert' || ' AND pt.locale = ''cs''',
  'A-імпорт 10k + cat_text і пошукові документи на кожен товар');
VACUUM a.product_translations; VACUUM core.search_documents; VACUUM r2.cat_text;
CHECKPOINT;
SELECT 'R2 price_mass' t, * FROM bench.wbulk(:scale, 'R2', 'price_mass', format($s$
  UPDATE core.product_prices SET price = round(price * 1.05), updated_at = now() WHERE price_type_id = %1$L;;
  UPDATE r2.cat_facts cf SET price_min = x.mn, price_max = x.mx
  FROM (SELECT product_id, min(price) mn, max(price) mx FROM core.product_prices WHERE price_type_id = %1$L GROUP BY product_id) x
  WHERE cf.product_id = x.product_id AND (cf.price_min, cf.price_max) IS DISTINCT FROM (x.mn, x.mx) $s$, :retail),
  'ціни живуть у мовонезалежних фактах — 1 вузький рядок на товар');
CHECKPOINT;
SELECT 'R2 stock_mass' t, * FROM bench.wbulk(:scale, 'R2', 'stock_mass', $s$
  UPDATE a.products SET stock_status = CASE WHEN stock_status = 'in_stock' THEN 'out_of_stock' ELSE 'in_stock' END, updated_at = now();;
  UPDATE r2.cat_facts cf SET stock_status = p.stock_status FROM a.products p WHERE p.id = cf.product_id $s$);
CHECKPOINT;
SELECT 'R2 full_rebuild' t, * FROM bench.wbulk(:scale, 'R2', 'full_rebuild', $s$
  TRUNCATE r2.cat_facts, r2.cat_text;; INSERT INTO r2.cat_facts SELECT * FROM r.v_product_facts;;
  INSERT INTO r2.cat_text SELECT product_id, locale, name, slug FROM core.v_product_text $s$, 'без пошукових документів');
-- повна перебудова search_documents тут НЕ міряється: TRUNCATE у субтранзакції з відкатом
-- тримає дві копії таблиці (~1.4 ГБ на 50k) і переповнює tmpfs. Час повної побудови — з логу 03a.
SELECT model, test, n, round(ms_median::numeric, 2) ms_median, round(ms_total::numeric, 1) ms_total,
       round(wal_bytes_median / 1024, 1) wal_kb_median, round(wal_bytes_total / 1048576, 2) wal_mb_total
FROM bench.writes WHERE scale = :scale ORDER BY test, model;
