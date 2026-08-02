#!/usr/bin/env bash
# Восстановление локального дампа БД + MinIO на Timeweb demo-стеке.
# Файлы должны лежать в /root/:
#   /root/mandarin_pp.dump
#   /root/minio-data.tgz
#
# Запуск на сервере из корня проекта:
#   bash infra/scripts/restore-local-demo.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DUMP="${DUMP:-/root/mandarin_pp.dump}"
MINIO_TGZ="${MINIO_TGZ:-/root/minio-data.tgz}"
COMPOSE=(docker compose -f docker-compose.demo.yml --env-file .env.demo)

if [ ! -f "$DUMP" ]; then
  echo "Нет дампа: $DUMP"
  exit 1
fi
if [ ! -f "$MINIO_TGZ" ]; then
  echo "Нет архива MinIO: $MINIO_TGZ"
  exit 1
fi

echo "==> Отключаем seed"
sed -i 's/\r$//' .env.demo || true
if grep -q '^RUN_SEED_ON_START=' .env.demo; then
  sed -i 's/^RUN_SEED_ON_START=.*/RUN_SEED_ON_START=false/' .env.demo
else
  echo 'RUN_SEED_ON_START=false' >> .env.demo
fi

echo "==> Останавливаем app-сервисы"
"${COMPOSE[@]}" stop api worker web nginx || true

echo "==> Восстанавливаем Postgres (photoprotocol)"
"${COMPOSE[@]}" up -d postgres
"${COMPOSE[@]}" exec -T postgres pg_isready -U photoprotocol -d photoprotocol
docker cp "$DUMP" "$( "${COMPOSE[@]}" ps -q postgres ):/tmp/mandarin_pp.dump"
# --clean может ругаться на отсутствующие объекты — это нормально
"${COMPOSE[@]}" exec -T postgres \
  pg_restore -U photoprotocol -d photoprotocol --clean --if-exists --no-owner --no-acl /tmp/mandarin_pp.dump \
  || true

echo "==> Восстанавливаем MinIO volume"
"${COMPOSE[@]}" stop minio || true
VOL="$(docker volume ls -q | grep -E '_minio_data$' | head -n1 || true)"
if [ -z "$VOL" ]; then
  echo "Не найден docker volume *minio_data"
  exit 1
fi
echo "volume=$VOL"
docker run --rm -v "${VOL}:/data" -v "$(dirname "$MINIO_TGZ"):/backup:ro" alpine:3.20 \
  sh -c "rm -rf /data/*; tar -xzf /backup/$(basename "$MINIO_TGZ") -C /data"

echo "==> Запускаем стек"
"${COMPOSE[@]}" up -d

echo "==> Ждём API"
for i in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1/api/v1/health" >/dev/null 2>&1; then
    echo "API OK"
    break
  fi
  sleep 3
  if [ "$i" -eq 40 ]; then
    echo "API не ответил. Смотрите: ${COMPOSE[*]} logs api"
    exit 1
  fi
done

echo ""
echo "Готово. Логины — как в вашей локальной БД (часто ChangeMe123!)."
echo "Проверка: http://\${PUBLIC_HOST:-IP}"
