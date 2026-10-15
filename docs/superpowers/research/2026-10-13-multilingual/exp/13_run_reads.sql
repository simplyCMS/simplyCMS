-- 13_run_reads.sql — прогін усіх читальних тестів для моделей, що існують у БД.
-- Використання: ./run.sh 13_run_reads.sql <scale>; змінна :models — список моделей.
CREATE TABLE IF NOT EXISTS bench.summary (
  scale int, model text, test text, variant text, locale text,
  cold_ms float8, warm_median_ms float8, warm_p90_ms float8, plan_ms float8, hit_median float8, read_cold bigint, rows_out bigint,
  PRIMARY KEY (scale, model, test, variant, locale)
);
DROP FUNCTION IF EXISTS bench.run_reads(int, text[], text[]);
CREATE OR REPLACE FUNCTION bench.run_reads(p_scale int, p_models text[], p_locales text[], p_tests text[] DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
DECLARE q record; loc text; lv record; v_kind text; params jsonb; fv text; n int; res record;
BEGIN
  FOR q IN SELECT * FROM bench.q WHERE model = ANY(p_models) AND (p_tests IS NULL OR test = ANY(p_tests)) ORDER BY test, model LOOP
    FOREACH loc IN ARRAY p_locales LOOP
      IF q.test = 'pdp' THEN
        SELECT jsonb_agg(jsonb_build_array(locale, slug) ORDER BY rn) INTO params FROM bench.p_pdp WHERE locale = loc;
        SELECT * INTO res FROM bench.run(p_scale, q.model, q.test, 'pdp/' || loc, q.sql, params, 15);
        INSERT INTO bench.summary VALUES (p_scale, q.model, q.test, '-', loc, res.cold_ms, res.warm_median_ms, res.warm_p90_ms, res.plan_ms, res.hit_median, res.read_cold, res.rows_out)
          ON CONFLICT (scale, model, test, variant, locale) DO UPDATE SET cold_ms = EXCLUDED.cold_ms, warm_median_ms = EXCLUDED.warm_median_ms, warm_p90_ms = EXCLUDED.warm_p90_ms, plan_ms = EXCLUDED.plan_ms, hit_median = EXCLUDED.hit_median, read_cold = EXCLUDED.read_cold, rows_out = EXCLUDED.rows_out;
      ELSIF q.test IN ('list_price', 'list_name', 'facets') THEN
        FOR lv IN SELECT * FROM bench.p_list ORDER BY level LOOP
          FOREACH fv IN ARRAY CASE WHEN q.test = 'facets' THEN ARRAY['f0','f1','f3'] ELSE ARRAY['f0','f3'] END LOOP
            params := jsonb_build_array(jsonb_build_array(loc, lv.subtree::text,
                        CASE WHEN fv IN ('f1','f3') THEN lv.o1::text END, CASE WHEN fv = 'f3' THEN lv.o2::text END, CASE WHEN fv = 'f3' THEN lv.o3::text END,
                        lv.p1::text, lv.p2::text, lv.p3::text, lv.facet_props::text));
            SELECT * INTO res FROM bench.run(p_scale, q.model, q.test, 'L' || lv.level || '/' || fv || '/' || loc, q.sql, params, 15);
            INSERT INTO bench.summary VALUES (p_scale, q.model, q.test, 'L' || lv.level || '/' || fv, loc, res.cold_ms, res.warm_median_ms, res.warm_p90_ms, res.plan_ms, res.hit_median, res.read_cold, res.rows_out)
              ON CONFLICT (scale, model, test, variant, locale) DO UPDATE SET cold_ms = EXCLUDED.cold_ms, warm_median_ms = EXCLUDED.warm_median_ms, warm_p90_ms = EXCLUDED.warm_p90_ms, plan_ms = EXCLUDED.plan_ms, hit_median = EXCLUDED.hit_median, read_cold = EXCLUDED.read_cold, rows_out = EXCLUDED.rows_out;
          END LOOP;
        END LOOP;
      ELSIF q.test = 'search' THEN
        FOREACH v_kind IN ARRAY ARRAY['narrow', 'broad'] LOOP
          SELECT jsonb_agg(jsonb_build_array(locale, tsq, raw) ORDER BY rn) INTO params FROM bench.p_search WHERE locale = loc AND p_search.kind = v_kind;
          SELECT * INTO res FROM bench.run(p_scale, q.model, q.test, v_kind || '/' || loc, q.sql, params, 15);
          INSERT INTO bench.summary VALUES (p_scale, q.model, q.test, v_kind, loc, res.cold_ms, res.warm_median_ms, res.warm_p90_ms, res.plan_ms, res.hit_median, res.read_cold, res.rows_out)
            ON CONFLICT (scale, model, test, variant, locale) DO UPDATE SET cold_ms = EXCLUDED.cold_ms, warm_median_ms = EXCLUDED.warm_median_ms, warm_p90_ms = EXCLUDED.warm_p90_ms, plan_ms = EXCLUDED.plan_ms, hit_median = EXCLUDED.hit_median, read_cold = EXCLUDED.read_cold, rows_out = EXCLUDED.rows_out;
        END LOOP;
      ELSIF q.test = 'hydrate' THEN
        SELECT jsonb_agg(jsonb_build_array(loc, ids::text) ORDER BY rn) INTO params FROM bench.p_hydrate;
        SELECT * INTO res FROM bench.run(p_scale, q.model, q.test, 'hydrate/' || loc, q.sql, params, 15);
        INSERT INTO bench.summary VALUES (p_scale, q.model, q.test, '-', loc, res.cold_ms, res.warm_median_ms, res.warm_p90_ms, res.plan_ms, res.hit_median, res.read_cold, res.rows_out)
          ON CONFLICT (scale, model, test, variant, locale) DO UPDATE SET cold_ms = EXCLUDED.cold_ms, warm_median_ms = EXCLUDED.warm_median_ms, warm_p90_ms = EXCLUDED.warm_p90_ms, plan_ms = EXCLUDED.plan_ms, hit_median = EXCLUDED.hit_median, read_cold = EXCLUDED.read_cold, rows_out = EXCLUDED.rows_out;
      ELSIF q.test = 'sitemap' THEN
        SELECT * INTO res FROM bench.run(p_scale, q.model, q.test, 'sitemap/' || loc, q.sql, jsonb_build_array(jsonb_build_array(loc)), 5);
        INSERT INTO bench.summary VALUES (p_scale, q.model, q.test, '-', loc, res.cold_ms, res.warm_median_ms, res.warm_p90_ms, res.plan_ms, res.hit_median, res.read_cold, res.rows_out)
          ON CONFLICT (scale, model, test, variant, locale) DO UPDATE SET cold_ms = EXCLUDED.cold_ms, warm_median_ms = EXCLUDED.warm_median_ms, warm_p90_ms = EXCLUDED.warm_p90_ms, plan_ms = EXCLUDED.plan_ms, hit_median = EXCLUDED.hit_median, read_cold = EXCLUDED.read_cold, rows_out = EXCLUDED.rows_out;
      END IF;
    END LOOP;
  END LOOP;
END $$;
