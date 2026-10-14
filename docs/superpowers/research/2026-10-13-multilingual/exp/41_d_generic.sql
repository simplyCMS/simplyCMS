-- 41_d_generic.sql — D: чи працює expression-індекс, коли локаль — bind-параметр (як у Drizzle sql`${col}->>${locale}`)
SELECT slug AS s FROM bench.p_pdp WHERE locale = 'de' AND translated ORDER BY rn LIMIT 1 \gset
SET plan_cache_mode = force_generic_plan;
PREPARE d_expr(text, text) AS SELECT id FROM d.products WHERE (slug->>$1) = $2 AND slug ? $1;
PREPARE d_gin(text, text) AS SELECT id FROM d.products WHERE slug @> jsonb_build_object($1, $2);
PREPARE a_tr(text, text) AS SELECT product_id FROM a.product_translations WHERE locale = $1 AND slug = $2;
\echo '--- D: expression-індекс, локаль параметром, generic plan'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) EXECUTE d_expr('de', :'s');
\echo '--- D: GIN jsonb_path_ops, локаль параметром, generic plan'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) EXECUTE d_gin('de', :'s');
\echo '--- A: переклади, generic plan'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) EXECUTE a_tr('de', :'s');
SET plan_cache_mode = auto;
\echo '--- D: expression-індекс, локаль ЛІТЕРАЛОМ (custom plan)'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT id FROM d.products WHERE (slug->>'de') = :'s' AND slug ? 'de';
