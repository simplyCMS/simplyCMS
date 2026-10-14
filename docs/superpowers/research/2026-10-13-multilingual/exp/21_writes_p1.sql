-- 21_writes_p1.sql — записи для A, B, D (фаза 1). Запуск: ./run.sh 21_writes_p1.sql <scale>
\set retail '''00000000-0000-4000-8000-000000000001'''
DROP TABLE IF EXISTS bench.w_ids, bench.import_cs;
-- 30 товарів із повним en-перекладом — для поодиноких оновлень
CREATE TABLE bench.w_ids AS
SELECT array_agg(product_id) AS ids FROM (
  SELECT product_id FROM a.product_translations WHERE locale = 'en' AND description IS NOT NULL ORDER BY md5(product_id::text) LIMIT 30) x;
-- «імпорт з 1С»: нова мова cs для 10 000 товарів (тексти — з en, slug із суфіксом)
CREATE TABLE bench.import_cs AS
SELECT product_id, name || ' cs' AS name, slug || '-cs' AS slug, short_description, description, meta_title, meta_description
FROM a.product_translations WHERE locale = 'en' ORDER BY md5(product_id::text || 'cs') LIMIT 10000;

-- ---------- W1: оновити один переклад (en) одного товару + торкнутися products.updated_at ----------
SELECT bench.wseries(:scale, 'A', 'upd_tr_en', $s$
  UPDATE a.product_translations SET name = name || ' x', description = description || ' x' WHERE product_id = %1$L AND locale = 'en';;
  UPDATE a.products SET updated_at = now() WHERE id = %1$L $s$, (SELECT ids FROM bench.w_ids));
SELECT bench.wseries(:scale, 'B', 'upd_tr_en', $s$
  UPDATE b.product_translations SET name = name || ' x', description = description || ' x' WHERE product_id = %1$L AND locale = 'en';;
  UPDATE b.products SET updated_at = now() WHERE id = %1$L $s$, (SELECT ids FROM bench.w_ids));
SELECT bench.wseries(:scale, 'D', 'upd_tr_en', $s$
  UPDATE d.products SET name = jsonb_set(name, '{en}', to_jsonb((name->>'en') || ' x')),
    description = jsonb_set(description, '{en}', to_jsonb((description->>'en') || ' x')), updated_at = now() WHERE id = %1$L $s$, (SELECT ids FROM bench.w_ids));

-- ---------- W1b: оновити текст основної мови (uk) ----------
SELECT bench.wseries(:scale, 'A', 'upd_base_uk', $s$
  UPDATE a.products SET name = name || ' x', description = description || ' x', updated_at = now() WHERE id = %1$L $s$, (SELECT ids FROM bench.w_ids));
SELECT bench.wseries(:scale, 'B', 'upd_base_uk', $s$
  UPDATE b.product_translations SET name = name || ' x', description = description || ' x' WHERE product_id = %1$L AND locale = 'uk';;
  UPDATE b.products SET updated_at = now() WHERE id = %1$L $s$, (SELECT ids FROM bench.w_ids));
SELECT bench.wseries(:scale, 'D', 'upd_base_uk', $s$
  UPDATE d.products SET name = jsonb_set(name, '{uk}', to_jsonb((name->>'uk') || ' x')),
    description = jsonb_set(description, '{uk}', to_jsonb((description->>'uk') || ' x')), updated_at = now() WHERE id = %1$L $s$, (SELECT ids FROM bench.w_ids));

-- ---------- W1c: нетекстове поле одного товару (залишок/статус) ----------
SELECT bench.wseries(:scale, m, 'upd_stock_1', format($s$UPDATE %s.products SET stock_status = CASE WHEN stock_status = 'in_stock' THEN 'out_of_stock' ELSE 'in_stock' END, updated_at = now() WHERE id = %%1$L$s$, lower(m)), (SELECT ids FROM bench.w_ids))
FROM unnest(ARRAY['A','B','D']) m;

-- ---------- W2: нова мова для 10 000 товарів (bulk upsert, як імпорт з 1С) ----------
CHECKPOINT;
SELECT 'A add_locale_10k' t, * FROM bench.wbulk(:scale, 'A', 'add_locale_10k', $s$
  INSERT INTO a.product_translations (product_id, locale, name, slug, short_description, description, meta_title, meta_description)
  SELECT product_id, 'cs', name, slug, short_description, description, meta_title, meta_description FROM bench.import_cs
  ON CONFLICT (product_id, locale) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, short_description = EXCLUDED.short_description,
    description = EXCLUDED.description, meta_title = EXCLUDED.meta_title, meta_description = EXCLUDED.meta_description $s$);
CHECKPOINT;
SELECT 'B add_locale_10k' t, * FROM bench.wbulk(:scale, 'B', 'add_locale_10k', $s$
  INSERT INTO b.product_translations (product_id, locale, name, slug, short_description, description, meta_title, meta_description)
  SELECT product_id, 'cs', name, slug, short_description, description, meta_title, meta_description FROM bench.import_cs
  ON CONFLICT (product_id, locale) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, short_description = EXCLUDED.short_description,
    description = EXCLUDED.description, meta_title = EXCLUDED.meta_title, meta_description = EXCLUDED.meta_description $s$);
CHECKPOINT;
SELECT 'D add_locale_10k' t, * FROM bench.wbulk(:scale, 'D', 'add_locale_10k', $s$
  UPDATE d.products p SET name = p.name || jsonb_build_object('cs', s.name), slug = p.slug || jsonb_build_object('cs', s.slug),
    short_description = p.short_description || jsonb_strip_nulls(jsonb_build_object('cs', s.short_description)),
    description = p.description || jsonb_strip_nulls(jsonb_build_object('cs', s.description)),
    meta_title = p.meta_title || jsonb_strip_nulls(jsonb_build_object('cs', s.meta_title)),
    meta_description = p.meta_description || jsonb_strip_nulls(jsonb_build_object('cs', s.meta_description)), updated_at = now()
  FROM bench.import_cs s WHERE p.id = s.product_id;;
  CREATE UNIQUE INDEX d_products_slug_cs ON d.products ((slug->>'cs')) WHERE slug ? 'cs' $s$,
  'UPDATE + 1 новий expression-індекс (для повноти ще 3: sections, properties, options)');
-- ціна самих нових індексів D на мову (sections/properties/options — малі таблиці)
CHECKPOINT;
SELECT 'D add_locale_indexes_only' t, * FROM bench.wbulk(:scale, 'D', 'add_locale_idx4', $s$
  CREATE UNIQUE INDEX d_products_slug_cs ON d.products ((slug->>'cs')) WHERE slug ? 'cs';;
  CREATE UNIQUE INDEX d_sections_slug_cs ON d.sections ((slug->>'cs')) WHERE slug ? 'cs';;
  CREATE UNIQUE INDEX d_props_slug_cs ON d.section_properties ((slug->>'cs')) WHERE slug ? 'cs';;
  CREATE UNIQUE INDEX d_opts_slug_cs ON d.property_options (property_id, (slug->>'cs')) WHERE slug ? 'cs' $s$,
  '4 expression-індекси на нову мову при ще порожньому ключі cs');

-- ---------- W3: масове оновлення цін (усі роздрібні ціни +5%) ----------
CHECKPOINT;
SELECT 'core price_mass' t, * FROM bench.wbulk(:scale, 'A/B/D', 'price_mass', format($s$
  UPDATE core.product_prices SET price = round(price * 1.05), updated_at = now() WHERE price_type_id = %L $s$, :retail),
  'ціни в окремій таблиці — тексти жодної моделі не переписуються (див. touched)');

-- ---------- W4: масове нетекстове оновлення products (синхронізація залишків з 1С) ----------
CHECKPOINT;
SELECT 'A stock_mass' t, * FROM bench.wbulk(:scale, 'A', 'stock_mass', $s$UPDATE a.products SET stock_status = CASE WHEN stock_status = 'in_stock' THEN 'out_of_stock' ELSE 'in_stock' END, updated_at = now()$s$);
CHECKPOINT;
SELECT 'B stock_mass' t, * FROM bench.wbulk(:scale, 'B', 'stock_mass', $s$UPDATE b.products SET stock_status = CASE WHEN stock_status = 'in_stock' THEN 'out_of_stock' ELSE 'in_stock' END, updated_at = now()$s$);
CHECKPOINT;
SELECT 'D stock_mass' t, * FROM bench.wbulk(:scale, 'D', 'stock_mass', $s$UPDATE d.products SET stock_status = CASE WHEN stock_status = 'in_stock' THEN 'out_of_stock' ELSE 'in_stock' END, updated_at = now()$s$);

SELECT model, test, n, round(ms_median::numeric, 2) ms_median, round(ms_total::numeric, 1) ms_total,
       round(wal_bytes_median / 1024, 1) wal_kb_median, round(wal_bytes_total / 1048576, 2) wal_mb_total, touched
FROM bench.writes WHERE scale = :scale ORDER BY test, model;
