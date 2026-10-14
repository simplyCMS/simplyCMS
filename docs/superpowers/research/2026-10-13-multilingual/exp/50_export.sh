#!/usr/bin/env bash
# Вивантаження результатів у CSV (exp/results/<scale>/)
set -euo pipefail
cd "$(dirname "$0")"; S="$1"; mkdir -p "results/$S"
for t in summary writes sizes collisions equiv results; do
  docker exec ml-exp-pg psql -U postgres -X -q -c "\copy (SELECT * FROM bench.$t WHERE scale = $S) TO STDOUT WITH CSV HEADER" > "results/$S/$t.csv"
done
docker exec ml-exp-pg psql -U postgres -X -q -c "\copy (SELECT model, test, sql FROM bench.q) TO STDOUT WITH CSV HEADER" > "results/$S/queries.csv"
ls -la "results/$S"
