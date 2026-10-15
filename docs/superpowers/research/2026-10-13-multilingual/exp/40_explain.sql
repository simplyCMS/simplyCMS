-- 40_explain.sql — EXPLAIN (ANALYZE, BUFFERS) ключових запитів (2-й прогін — теплий кеш).
-- Змінна :models — список моделей через кому (фаза 1: A,B,D,D-gin; фаза 2: R,R2,A+slugreg)
\pset tuples_only on
\pset format unaligned
CREATE OR REPLACE FUNCTION bench.explain_case(p_model text, p_test text, p_level int, p_fv text, p_locale text, p_kind text DEFAULT 'narrow')
RETURNS SETOF text LANGUAGE plpgsql AS $$
DECLARE sql text; params jsonb; lv record;
BEGIN
  SELECT q.sql INTO sql FROM bench.q q WHERE q.model = p_model AND q.test = p_test;
  IF sql IS NULL THEN RETURN; END IF;
  SELECT * INTO lv FROM bench.p_list WHERE level = p_level;
  params := CASE
    WHEN p_test = 'pdp' THEN (SELECT jsonb_build_array(jsonb_build_array(locale, slug)) FROM bench.p_pdp WHERE locale = p_locale AND NOT translated ORDER BY rn LIMIT 1)
    WHEN p_test = 'search' THEN (SELECT jsonb_build_array(jsonb_build_array(locale, tsq, raw)) FROM bench.p_search WHERE locale = p_locale AND kind = p_kind ORDER BY rn LIMIT 1)
    WHEN p_test = 'sitemap' THEN jsonb_build_array(jsonb_build_array(p_locale))
    ELSE jsonb_build_array(jsonb_build_array(p_locale, lv.subtree::text, CASE WHEN p_fv <> 'f0' THEN lv.o1::text END, CASE WHEN p_fv = 'f3' THEN lv.o2::text END,
                        CASE WHEN p_fv = 'f3' THEN lv.o3::text END, lv.p1::text, lv.p2::text, lv.p3::text, lv.facet_props::text)) END;
  BEGIN
    PERFORM bench.explain(sql, params);  -- прогрів
  EXCEPTION WHEN others THEN RETURN; END;   -- таблиці цієї фази немає (напр., пошук без search_documents)
  RETURN NEXT format('==================== %s / %s / L%s %s / %s %s ====================', p_model, p_test, p_level, p_fv, p_locale, CASE WHEN p_test = 'search' THEN p_kind ELSE '' END);
  RETURN QUERY SELECT bench.explain(sql, params);
END $$;
SELECT bench.explain_case(m, 'pdp', 1, 'f0', 'de') FROM unnest(string_to_array(:'models', ',')) m;
SELECT bench.explain_case(m, 'list_name', 1, 'f0', 'de') FROM unnest(string_to_array(:'models', ',')) m;
SELECT bench.explain_case(m, 'list_price', 1, 'f3', 'de') FROM unnest(string_to_array(:'models', ',')) m;
SELECT bench.explain_case(m, 'facets', 1, 'f3', 'de') FROM unnest(string_to_array(:'models', ',')) m;
SELECT bench.explain_case(m, 'search', 1, 'f0', 'en', 'broad') FROM unnest(string_to_array(:'models', ',')) m;
SELECT bench.explain_case(m, 'sitemap', 1, 'f0', 'de') FROM unnest(string_to_array(:'models', ',')) m;
