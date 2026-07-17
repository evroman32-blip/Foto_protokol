#!/usr/bin/env bash
# seed-and-migrate.sh — миграции и seed для локальной/Docker среды
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR"

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-120}"

echo "=== Mandarin PhotoProtocol: migrate + seed ==="

if [ -f "$SCRIPT_DIR/wait-for-it.sh" ]; then
  bash "$SCRIPT_DIR/wait-for-it.sh" "$DB_HOST" "$DB_PORT" "$WAIT_TIMEOUT"
fi

echo "Генерация Prisma Client..."
npm run db:generate

echo "Применение миграций..."
npm run db:migrate:deploy 2>/dev/null || npm run db:migrate

echo "Загрузка seed-данных..."
npm run db:seed

echo "=== Готово ==="
