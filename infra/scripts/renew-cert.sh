#!/usr/bin/env bash
# renew-cert.sh — продление сертификата Let's Encrypt (срок жизни 90 дней).
# Ручной запуск:  bash infra/scripts/renew-cert.sh msi-fotoprotocol.ru
# Автоматически:  добавить в cron (см. docs/TIMEWEB_DEMO.md)
set -euo pipefail

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  echo "Использование: bash infra/scripts/renew-cert.sh <домен>"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

COMPOSE="docker compose -f docker-compose.demo.yml --env-file .env.demo"

$COMPOSE stop nginx || true
certbot renew --standalone --quiet || true

if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  cp -L "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" infra/nginx/certs/fullchain.pem
  cp -L "/etc/letsencrypt/live/$DOMAIN/privkey.pem" infra/nginx/certs/privkey.pem
fi

$COMPOSE up -d --force-recreate nginx
echo "Сертификат проверен, nginx перезапущен"
