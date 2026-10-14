-- 21b_writes_sd.sql — пошукові документи (спільні для A/B/D): оновлення одного й нова мова
-- ---------- пошуковий документ (спільний для A/B/D; за спекою — асинхронно з черги) ----------
SELECT bench.wseries(:scale, 'search_doc', 'sd_refresh_en', $s$
  INSERT INTO core.search_documents (entity_type, entity_id, locale, title_lex, attrs_lex, body_lex, exact_tokens, title_norm, source_updated_at)
  SELECT 'product', pt.product_id, pt.locale, lower(pt.name), lower(pa.attrs),
         lower(coalesce(pt.short_description, '') || ' ' || regexp_replace(coalesce(pt.description, ''), '<[^>]+>', ' ', 'g')),
         lower(coalesce(pt.sku, '')), lower(pt.name), pt.updated_at
  FROM core.v_product_text pt JOIN core.v_product_attrs pa USING (product_id, locale) WHERE pt.is_active AND pt.product_id = %1$L AND pt.locale = 'en'
  ON CONFLICT (entity_type, entity_id, locale) DO UPDATE SET title_lex = EXCLUDED.title_lex, attrs_lex = EXCLUDED.attrs_lex,
    body_lex = EXCLUDED.body_lex, exact_tokens = EXCLUDED.exact_tokens, title_norm = EXCLUDED.title_norm,
    source_updated_at = EXCLUDED.source_updated_at, indexed_at = now() $s$, (SELECT ids FROM bench.w_ids));
CHECKPOINT;
SELECT 'search_doc add_locale' t, * FROM bench.wbulk(:scale, 'search_doc', 'sd_add_locale_cs', $s$
  INSERT INTO a.product_translations (product_id, locale, name, slug, short_description, description, meta_title, meta_description)
  SELECT product_id, 'cs', name, slug, short_description, description, meta_title, meta_description FROM bench.import_cs;;
  INSERT INTO core.locales VALUES ('cs', false);;
  INSERT INTO core.search_documents (entity_type, entity_id, locale, title_lex, attrs_lex, body_lex, exact_tokens, title_norm, source_updated_at)
  SELECT 'product', pt.product_id, pt.locale, lower(pt.name), lower(pa.attrs),
         lower(coalesce(pt.short_description, '') || ' ' || regexp_replace(coalesce(pt.description, ''), '<[^>]+>', ' ', 'g')),
         lower(coalesce(pt.sku, '')), lower(pt.name), pt.updated_at
  FROM core.v_product_text pt JOIN core.v_product_attrs pa USING (product_id, locale) WHERE pt.is_active AND pt.locale = 'cs' $s$,
  'A-імпорт cs + 50k нових пошукових документів (усі товари: 10k перекладених + 40k fallback)');


VACUUM a.product_translations; VACUUM core.search_documents;
