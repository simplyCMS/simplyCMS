#!/usr/bin/env bash
# Додатковий експеримент (після run_all.sh): індекси пошуку з локаллю в ключі.
# У спеці search_documents має один GIN(tsv) і один GiST(title_norm) на ВСІ локалі; KNN по триграмах
# тоді перебирає документи чужих мов. Тут: btree_gin/btree_gist-композити (locale, …) і повтор пошуку.
set -euo pipefail
cd "$(dirname "$0")"; S="${1:-50000}"
PSQL="docker exec -i ml-exp-pg psql -U postgres -X -q -v ON_ERROR_STOP=1 -v scale=$S -P pager=off"
$PSQL -c "DROP VIEW IF EXISTS r.v_catalog_entries" -c "DROP TABLE IF EXISTS r.catalog_entries CASCADE" -c "VACUUM" -c "CHECKPOINT"
./run.sh 03a_search.sql "$S" > "logs/35_search_rebuild_$S.log" 2>&1
$PSQL -c "INSERT INTO bench.q SELECT 'A+locidx', test, sql FROM bench.q WHERE model = 'A' AND test = 'search' ON CONFLICT DO NOTHING" \
      -c "INSERT INTO bench.q SELECT 'R2+locidx', test, sql FROM bench.q WHERE model = 'R2' AND test = 'search' ON CONFLICT DO NOTHING"
# контроль: той самий пошук на щойно перебудованій таблиці зі спековими індексами
$PSQL -c "INSERT INTO bench.q SELECT 'A(sd-rebuilt)', test, sql FROM bench.q WHERE model = 'A' AND test = 'search' ON CONFLICT DO NOTHING"
$PSQL -c "SELECT bench.run_reads($S, ARRAY['A(sd-rebuilt)'], ARRAY['uk','en','de'], ARRAY['search'])"
{
  echo '\timing on'
  echo 'CREATE EXTENSION IF NOT EXISTS btree_gin; CREATE EXTENSION IF NOT EXISTS btree_gist;'
  echo 'CREATE INDEX sd_loc_tsv_gin ON core.search_documents USING gin (locale, tsv);'
  echo 'CREATE INDEX sd_loc_trgm_gin ON core.search_documents USING gin (locale, title_norm gin_trgm_ops);'
  echo 'CREATE INDEX sd_loc_trgm_gist ON core.search_documents USING gist (locale, title_norm gist_trgm_ops);'
  echo 'DROP INDEX core.search_documents_tsv_idx, core.search_documents_title_trgm_gin_idx, core.search_documents_title_trgm_gist_idx;'
  echo 'VACUUM ANALYZE core.search_documents;'
  echo "SELECT pg_size_pretty(pg_indexes_size('core.search_documents')) AS sd_indexes;"
} | $PSQL -f - > "logs/35_locidx_build_$S.log" 2>&1
$PSQL -c "SELECT bench.run_reads($S, ARRAY['A+locidx','R2+locidx'], ARRAY['uk','en','de'], ARRAY['search'])"
$PSQL -v models='A+locidx' -f - < 40_explain.sql > "logs/35_explain_$S.log"
./50_export.sh "$S" > /dev/null
