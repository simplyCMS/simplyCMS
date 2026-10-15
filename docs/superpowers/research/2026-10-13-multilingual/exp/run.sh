#!/usr/bin/env bash
# Запуск SQL-файлу в експериментальному контейнері ml-exp-pg.
# Використання: ./run.sh <file.sql> [scale]   (scale — кількість товарів, дефолт 50000)
set -euo pipefail
cd "$(dirname "$0")"
SCALE="${2:-50000}"
docker exec -i ml-exp-pg psql -U postgres -X -q -v ON_ERROR_STOP=1 -v scale="$SCALE" -P pager=off < "$1"
