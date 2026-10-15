#!/usr/bin/env bash
# Чисті розміри A/B/D/core одразу після побудови (у run_all.sh розміри «a» і «core» з фази 3
# включають роздуття від відкочених масових тестів). Затирає БД експерименту!
set -euo pipefail
cd "$(dirname "$0")"; S="${1:-50000}"
PSQL="docker exec -i ml-exp-pg psql -U postgres -X -q -v ON_ERROR_STOP=1 -v scale=$S -P pager=off"
./run.sh 00_schema.sql "$S" 2>/dev/null
node gen.mjs "$S" | $PSQL
./run.sh 01_index_a.sql "$S" > /dev/null
./run.sh 02_build_b_d.sql "$S" > /dev/null 2>&1
./run.sh 30_sizes.sql "$S"
docker exec ml-exp-pg psql -U postgres -X -q -c "\copy (SELECT * FROM bench.sizes WHERE scale = $S) TO STDOUT WITH CSV HEADER" > "results/$S/sizes_p1_clean.csv"
