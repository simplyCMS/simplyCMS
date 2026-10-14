-- 15_equivalence.sql — перевірка, що всі моделі повертають ОДНАКОВИЙ результат на тих самих
-- параметрах (інакше порівняння швидкодії нечесне). Порівнюється md5 від рядків результату.
CREATE TABLE IF NOT EXISTS bench.equiv (scale int, test text, variant text, models text[], distinct_results int, detail jsonb,
  PRIMARY KEY (scale, test, variant));
DROP FUNCTION IF EXISTS bench.check_equiv(int, text[]);
CREATE OR REPLACE FUNCTION bench.check_equiv(p_scale int, p_models text[], p_tests text[] DEFAULT NULL, p_prefix text DEFAULT '') RETURNS void LANGUAGE plpgsql AS $$
DECLARE t text; v record; m text; sql text; h text; res jsonb; proj text; lv record;
BEGIN
  FOR v IN
    SELECT 'pdp' AS test, 'pdp/' || locale || '/' || CASE WHEN translated THEN 'tr' ELSE 'fb' END || rn AS variant, jsonb_build_array(locale, slug) AS params
      FROM bench.p_pdp WHERE locale IN ('en', 'de') AND rn <= 4
    UNION ALL SELECT tt, 'L' || l.level || '/' || fv || '/' || loc,
      jsonb_build_array(loc, l.subtree::text, CASE WHEN fv <> 'f0' THEN l.o1::text END, CASE WHEN fv = 'f3' THEN l.o2::text END,
                        CASE WHEN fv = 'f3' THEN l.o3::text END, l.p1::text, l.p2::text, l.p3::text, l.facet_props::text)
      FROM bench.p_list l, unnest(ARRAY['list_price', 'list_name', 'facets']) tt, unnest(ARRAY['f0', 'f1', 'f3']) fv, unnest(ARRAY['de', 'en']) loc
    UNION ALL SELECT 'search', kind || '/' || locale || '/' || rn, jsonb_build_array(locale, tsq, raw) FROM bench.p_search WHERE locale IN ('de', 'en') AND rn <= 3
    UNION ALL SELECT 'sitemap', 'de', jsonb_build_array('de')
  LOOP
    CONTINUE WHEN p_tests IS NOT NULL AND NOT v.test = ANY(p_tests);
    res := '{}';
    FOREACH m IN ARRAY p_models LOOP
      SELECT q.sql INTO sql FROM bench.q q WHERE q.model = m AND q.test = v.test;
      CONTINUE WHEN sql IS NULL;
      proj := CASE v.test
        WHEN 'search' THEN 'SELECT md5(string_agg(concat_ws('','', r.kind, r.id, round(r.v::numeric, 6)), ''|'' ORDER BY concat_ws('','', r.kind, r.id, round(r.v::numeric, 6)))) FROM (%s) r'
        WHEN 'sitemap' THEN 'SELECT md5(string_agg(r.x, ''|'' ORDER BY r.x)) FROM (SELECT concat_ws('','', r0.' || CASE WHEN m IN ('R', 'R2') THEN 'product_id' ELSE 'id' END || ', r0.slug) AS x FROM (%s) r0) r'
        ELSE 'SELECT md5(string_agg(r::text, ''|'')) FROM (%s) r' END;
      EXECUTE format(proj, format(sql, VARIADIC ARRAY(SELECT jsonb_array_elements_text(v.params)))) INTO h;
      res := res || jsonb_build_object(m, h);
    END LOOP;
    INSERT INTO bench.equiv VALUES (p_scale, v.test, p_prefix || v.variant, p_models, (SELECT count(DISTINCT x) FROM jsonb_each_text(res) e(k, x)), res)
    ON CONFLICT (scale, test, variant) DO UPDATE SET models = EXCLUDED.models, distinct_results = EXCLUDED.distinct_results, detail = EXCLUDED.detail;
  END LOOP;
END $$;
