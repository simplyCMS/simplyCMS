#!/usr/bin/env bash
# Повний прогін для одного масштабу: ./run_all.sh 50000  (потім ./run_all.sh 5000)
# Ф1: A, B, D → читання (крім пошуку), записи, колізії, міграції.  Ф2: B, D геть; пошукові документи + R2.
# Ф3: search_documents геть; широка R. Фази — через ліміт tmpfs (БД ≤ 3 ГБ).
set -euo pipefail
cd "$(dirname "$0")"; S="${1:-50000}"; mkdir -p logs
PSQL="docker exec -i ml-exp-pg psql -U postgres -X -q -v ON_ERROR_STOP=1 -v scale=$S -P pager=off"
FROM="${2:-}"; ON=0; [ -z "$FROM" ] && ON=1
# step <мітка>: друкує мітку; якщо задано FROM — пропускає кроки до першої мітки, що містить FROM
step() { if [ "$ON" = 0 ] && [[ "$*" == *"$FROM"* ]]; then ON=1; fi; [ "$ON" = 1 ] && echo "[$(date +%T)] $*"; [ "$ON" = 1 ]; }
if step "схема + генерація ($S товарів)"; then
  ./run.sh 00_schema.sql "$S" 2>/dev/null
  node gen.mjs "$S" | $PSQL
  ./run.sh 01_index_a.sql "$S" > "logs/01_index_$S.log"
fi
if step "B і D з A"; then
  ./run.sh 02_build_b_d.sql "$S" > "logs/02_build_$S.log" 2>&1
  ./run.sh 10_harness.sql "$S" 2>/dev/null; ./run.sh 13_run_reads.sql "$S" 2>/dev/null; ./run.sh 15_equivalence.sql "$S" 2>/dev/null
  ./run.sh 20_writes_lib.sql "$S" 2>/dev/null; ./run.sh 22_collisions.sql "$S" > /dev/null 2>&1
  # core.locales потрібна параметрам; представлення core.v_* — у 03a, тому параметри пошуку беремо з A напряму
  ./run.sh 11_params.sql "$S" > "logs/11_params_$S.log" 2>&1
  python3 gen_queries.py >/dev/null; ./run.sh 12_queries.sql "$S" 2>/dev/null
  ./run.sh 30_sizes.sql "$S" > "logs/30_sizes_p1_$S.log"
fi
P1T="ARRAY['pdp','list_price','list_name','facets','hydrate','sitemap']"
if step "Ф1 еквівалентність"; then
  $PSQL -c "SELECT bench.check_equiv($S, ARRAY['A','B','D','D-gin'], $P1T)"
fi
if step "Ф1 читання (A, B, D)"; then
  $PSQL -c "SELECT bench.run_reads($S, ARRAY['A','B','D','D-gin'], ARRAY['uk','en','de'], $P1T)"
fi
if step "Ф1 EXPLAIN"; then
  $PSQL -v models='A,B,D,D-gin' -f - < 40_explain.sql > "logs/40_explain_p1_$S.log"
  $PSQL -f - < 41_d_generic.sql > "logs/41_d_generic_$S.log" 2>&1
fi
if step "Ф1 записи"; then
  ./run.sh 21_writes_p1.sql "$S" > "logs/21_writes_p1_$S.log" 2>&1
fi
if step "Ф1 колізії"; then
  ./run.sh 23_collisions_p1.sql "$S" > "logs/23_collisions_p1_$S.log" 2>&1
fi
if step "Ф1 міграції"; then
  ./run.sh 24_migration.sql "$S" > "logs/24_migration_$S.log" 2>&1
  ./50_export.sh "$S" > /dev/null
fi
if step "Ф2: прибрати B і D; пошукові документи; R2"; then
  $PSQL -c "DROP SCHEMA IF EXISTS b CASCADE" -c "DROP SCHEMA IF EXISTS d CASCADE" -c "VACUUM" -c "CHECKPOINT"
  ./run.sh 03a_search.sql "$S" > "logs/03a_search_$S.log" 2>&1
  ./run.sh 03b_build_r2.sql "$S" > "logs/03b_build_r2_$S.log" 2>&1
  ./run.sh 30_sizes.sql "$S" > "logs/30_sizes_p2_$S.log"
  $PSQL -c "INSERT INTO bench.q SELECT 'A(ф2)', test, sql FROM bench.q WHERE model = 'A' ON CONFLICT DO NOTHING"
fi
if step "Ф2 еквівалентність"; then
  $PSQL -c "SELECT bench.check_equiv($S, ARRAY['A(ф2)','R2','A+slugreg'])"
fi
if step "Ф2 читання (A-контроль, R2, A+slugreg; пошук A)"; then
  $PSQL -c "SELECT bench.run_reads($S, ARRAY['A(ф2)','R2','A+slugreg'], ARRAY['uk','en','de'])"
  $PSQL -c "SELECT bench.run_reads($S, ARRAY['A'], ARRAY['uk','en','de'], ARRAY['search'])"
fi
if step "Ф2 EXPLAIN"; then
  $PSQL -v models='A,R2,A+slugreg' -f - < 40_explain.sql > "logs/40_explain_p2_$S.log"
fi
if step "Ф2 записи"; then
  ./run.sh 21b_writes_sd.sql "$S" > "logs/21b_writes_sd_$S.log" 2>&1
  ./run.sh 31_writes_r2.sql "$S" > "logs/31_writes_r2_$S.log" 2>&1
  ./run.sh 32_collisions_r2.sql "$S" > "logs/32_collisions_r2_$S.log" 2>&1
  ./50_export.sh "$S" > /dev/null
fi
if step "Ф3: прибрати search_documents; R"; then
  $PSQL -c "DROP TABLE core.search_documents" -c "VACUUM" -c "CHECKPOINT"
  ./run.sh 03c_build_r.sql "$S" > "logs/03c_build_r_$S.log" 2>&1
  ./run.sh 30_sizes.sql "$S" > "logs/30_sizes_p3_$S.log"
fi
if step "Ф3 еквівалентність"; then
  $PSQL -c "SELECT bench.check_equiv($S, ARRAY['A(ф2)','R'], ARRAY['pdp','list_price','list_name','facets','sitemap'], 'p3:')"
  $PSQL -c "SELECT bench.check_equiv($S, ARRAY['R'], ARRAY['search'], 'p3:')"
fi
if step "Ф3 читання (R)"; then
  $PSQL -c "SELECT bench.run_reads($S, ARRAY['R'], ARRAY['uk','en','de'])"
fi
if step "Ф3 EXPLAIN"; then
  $PSQL -v models='R' -f - < 40_explain.sql > "logs/40_explain_p3_$S.log"
fi
if step "Ф3 записи"; then
  ./run.sh 34_collisions_r.sql "$S" > "logs/34_collisions_r_$S.log" 2>&1
  ./run.sh 33_writes_r.sql "$S" > "logs/33_writes_r_$S.log" 2>&1
fi
if step "експорт"; then
  ./50_export.sh "$S"
  $PSQL -c "SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size"
fi
step "готово" || true
