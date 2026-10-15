-- 14_smoke.sql — кожен шаблон виконується один раз (перевірка синтаксису й непорожнього результату)
DO $$
DECLARE q record; params jsonb; j json; lv record;
BEGIN
  SELECT * INTO lv FROM bench.p_list WHERE level = 2;
  FOR q IN SELECT * FROM bench.q WHERE model = ANY(string_to_array(current_setting('bench.models'), ',')) ORDER BY test, model LOOP
    params := CASE q.test
      WHEN 'pdp' THEN (SELECT jsonb_build_array(locale, slug) FROM bench.p_pdp WHERE locale = 'de' AND NOT translated LIMIT 1)
      WHEN 'search' THEN (SELECT jsonb_build_array(locale, tsq, raw) FROM bench.p_search WHERE locale = 'en' AND kind = 'narrow' LIMIT 1)
      WHEN 'hydrate' THEN (SELECT jsonb_build_array('de', ids::text) FROM bench.p_hydrate LIMIT 1)
      WHEN 'sitemap' THEN jsonb_build_array('de')
      ELSE jsonb_build_array('de', lv.subtree::text, lv.o1::text, lv.o2::text, lv.o3::text, lv.p1::text, lv.p2::text, lv.p3::text, lv.facet_props::text) END;
    BEGIN
      EXECUTE 'EXPLAIN (ANALYZE, TIMING OFF, FORMAT JSON) ' || format(q.sql, VARIADIC ARRAY(SELECT jsonb_array_elements_text(params))) INTO j;
      RAISE NOTICE '% % rows=% ms=%', rpad(q.model, 10), rpad(q.test, 10), j->0->'Plan'->>'Actual Rows', j->0->>'Execution Time';
    EXCEPTION WHEN others THEN RAISE NOTICE '% % ERROR %', q.model, q.test, SQLERRM;
    END;
  END LOOP;
END $$;
