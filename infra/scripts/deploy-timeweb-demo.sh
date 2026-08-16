#!/usr/bin/env bash
# deploy-timeweb-demo.sh — запуск демо-стека на Ubuntu (Timeweb VPS)
# Запускать из корня репозитория на сервере:
#   bash infra/scripts/deploy-timeweb-demo.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [ ! -f .env.demo ]; then
  echo "Нет файла .env.demo"
  echo "Сделайте: cp .env.demo.example .env.demo && nano .env.demo"
  exit 1
fi

# Windows CRLF → LF (архив с Windows часто ломает source/bash)
sed -i 's/\r$//' .env.demo "$0" infra/docker/api-entrypoint.sh 2>/dev/null || true

# shellcheck disable=SC1091
set -a
source .env.demo
set +a

if [ "${PUBLIC_HOST:-YOUR_DOMAIN}" = "YOUR_DOMAIN" ] || [ -z "${PUBLIC_HOST:-}" ]; then
  echo "Укажите PUBLIC_HOST в .env.demo (IP или домен сервера)"
  exit 1
fi

# Подставляем PUBLIC_HOST в URL, если остались плейсхолдеры
sed -i "s|YOUR_DOMAIN|${PUBLIC_HOST}|g" .env.demo
set -a
source .env.demo
set +a

echo "==> Docker compose build & up"
docker compose -f docker-compose.demo.yml --env-file .env.demo up -d --build

echo "==> Ждём API health..."
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1/api/v1/health" >/dev/null 2>&1; then
    echo "API OK"
    break
  fi
  sleep 5
  if [ "$i" -eq 60 ]; then
    echo "API не ответил. Смотрите: docker compose -f docker-compose.demo.yml logs api"
    exit 1
  fi
done

# Досинхрон положений JAW_RELATION (на случай если entrypoint пропустил)
docker compose -f docker-compose.demo.yml --env-file .env.demo exec -T api \
  npx tsx /app/tools/sync-jaw-relation-requirements.ts || true

echo ""
echo "========================================"
echo " Сервис:  http://${PUBLIC_HOST}"
if [ -n "${BOOTSTRAP_ADMIN_EMAIL:-}" ]; then
  echo " Модератор: ${BOOTSTRAP_ADMIN_EMAIL}"
  echo " Пароль:    из .env.demo (BOOTSTRAP_ADMIN_PASSWORD)"
else
  echo " Зарегистрируйтесь на главной, затем подтвердите первого модератора в БД."
fi
echo "========================================"
echo " Логи: docker compose -f docker-compose.demo.yml --env-file .env.demo logs -f"
