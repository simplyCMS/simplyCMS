-- 10_harness.sql — вимірювальний харнес усередині Postgres.
-- Кожен прогін: EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, SERIALIZE TEXT, FORMAT JSON) —
-- TIMING OFF прибирає накладні clock_gettime на вузол; SERIALIZE (PG17) змушує
-- реально сформувати текстовий вивід, як для клієнта (інакше detoast великих полів
-- може не відбутися й PDP виглядатиме дешевшим, ніж є).
-- Run 0 — «холодний»: перед ним усі shared_buffers витісняються pg_buffercache_evict().
-- Дані лежать у tmpfs, тож «холодний» = промах shared_buffers, читання з page cache ОС;
-- справжнього дискового I/O тут немає — цифри лише для ВІДНОСНОГО порівняння.
CREATE SCHEMA IF NOT EXISTS bench;
CREATE TABLE IF NOT EXISTS bench.results (
  scale int, model text, test text, variant text, run int, cold boolean,
  exec_ms float8, plan_ms float8, shared_hit bigint, shared_read bigint, rows bigint,
  ts timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION bench.evict() RETURNS int LANGUAGE sql AS $$
  SELECT count(*)::int FROM (SELECT pg_buffercache_evict(bufferid) FROM pg_buffercache WHERE relfilenode IS NOT NULL) x;
$$;

-- p_params: jsonb-масив масивів рядків; run i бере params[i mod len]; шаблон — format() з %1$L…
CREATE OR REPLACE FUNCTION bench.run(p_scale int, p_model text, p_test text, p_variant text,
                                     p_sql text, p_params jsonb, p_n int DEFAULT 15)
RETURNS TABLE (cold_ms float8, warm_median_ms float8, warm_p90_ms float8, plan_ms float8, hit_median float8, read_cold bigint, rows_out bigint)
LANGUAGE plpgsql AS $$
DECLARE
  i int; j json; args text[]; q text; len int := jsonb_array_length(p_params);
BEGIN
  DELETE FROM bench.results r WHERE r.scale = p_scale AND r.model = p_model AND r.test = p_test AND r.variant = p_variant;
  FOR i IN 0..p_n LOOP
    args := ARRAY(SELECT jsonb_array_elements_text(p_params -> (i % len)));
    q := format(p_sql, VARIADIC args);
    IF i = 0 THEN PERFORM bench.evict(); END IF;
    EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, SERIALIZE TEXT, FORMAT JSON) ' || q INTO j;
    INSERT INTO bench.results (scale, model, test, variant, run, cold, exec_ms, plan_ms, shared_hit, shared_read, rows)
    VALUES (p_scale, p_model, p_test, p_variant, i, i = 0,
            (j->0->>'Execution Time')::float8, (j->0->>'Planning Time')::float8,
            coalesce((j->0->'Plan'->>'Shared Hit Blocks')::bigint, 0) + coalesce((j->0->'Planning'->>'Shared Hit Blocks')::bigint, 0),
            coalesce((j->0->'Plan'->>'Shared Read Blocks')::bigint, 0) + coalesce((j->0->'Planning'->>'Shared Read Blocks')::bigint, 0),
            (j->0->'Plan'->>'Actual Rows')::bigint);
  END LOOP;
  RETURN QUERY
  SELECT max(r.exec_ms + r.plan_ms) FILTER (WHERE r.cold),
         percentile_cont(0.5) WITHIN GROUP (ORDER BY r.exec_ms + r.plan_ms) FILTER (WHERE NOT r.cold),
         percentile_cont(0.9) WITHIN GROUP (ORDER BY r.exec_ms + r.plan_ms) FILTER (WHERE NOT r.cold),
         percentile_cont(0.5) WITHIN GROUP (ORDER BY r.plan_ms) FILTER (WHERE NOT r.cold),
         percentile_cont(0.5) WITHIN GROUP (ORDER BY r.shared_hit) FILTER (WHERE NOT r.cold),
         max(r.shared_read) FILTER (WHERE r.cold),
         max(r.rows) FILTER (WHERE r.run = 1)
  FROM bench.results r WHERE r.scale = p_scale AND r.model = p_model AND r.test = p_test AND r.variant = p_variant;
END $$;

-- Повний EXPLAIN (з таймінгом) для звіту
CREATE OR REPLACE FUNCTION bench.explain(p_sql text, p_params jsonb) RETURNS SETOF text LANGUAGE plpgsql AS $$
DECLARE args text[] := ARRAY(SELECT jsonb_array_elements_text(p_params -> 0)); r record;
BEGIN
  FOR r IN EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, SUMMARY ON) ' || format(p_sql, VARIADIC args) LOOP
    RETURN NEXT r."QUERY PLAN";
  END LOOP;
END $$;
