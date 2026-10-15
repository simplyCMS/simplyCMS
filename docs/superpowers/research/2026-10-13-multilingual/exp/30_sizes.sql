-- 30_sizes.sql — розміри таблиць/TOAST/індексів по схемах (після VACUUM ANALYZE)
CREATE TABLE IF NOT EXISTS bench.sizes (scale int, schema text, rel text, rows bigint, heap bigint, toast bigint, idx bigint, total bigint, n_idx int,
  PRIMARY KEY (scale, schema, rel));
INSERT INTO bench.sizes
SELECT :scale, n.nspname, c.relname, c.reltuples::bigint, pg_relation_size(c.oid),
       coalesce(pg_total_relation_size(c.reltoastrelid), 0), pg_indexes_size(c.oid), pg_total_relation_size(c.oid),
       (SELECT count(*) FROM pg_index i WHERE i.indrelid = c.oid)
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'm') AND n.nspname IN ('core', 'a', 'b', 'd', 'r', 'r2')
ON CONFLICT (scale, schema, rel) DO UPDATE SET rows = EXCLUDED.rows, heap = EXCLUDED.heap, toast = EXCLUDED.toast, idx = EXCLUDED.idx, total = EXCLUDED.total, n_idx = EXCLUDED.n_idx;
SELECT schema, pg_size_pretty(sum(total)) total, pg_size_pretty(sum(heap)) heap, pg_size_pretty(sum(toast)) toast, pg_size_pretty(sum(idx)) idx, sum(n_idx) n_idx
FROM bench.sizes WHERE scale = :scale GROUP BY schema ORDER BY schema;
