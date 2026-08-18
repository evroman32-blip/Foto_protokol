#!/usr/bin/env bash
# enable-https.sh — выпуск сертификата Let's Encrypt и перевод демо-стенда на HTTPS.
# Запускать на сервере из корня проекта:
#   bash infra/scripts/enable-https.sh msi-fotoprotocol.ru admin@example.com
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [ -z "$DOMAIN" ]; then
  echo "Использование: bash infra/scripts/enable-https.sh <домен> [email]"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

COMPOSE="docker compose -f docker-compose.demo.yml --env-file .env.demo"

if [ ! -f .env.demo ]; then
  echo "Нет .env.demo — сначала разверните стенд по docs/TIMEWEB_DEMO.md"
  exit 1
fi

if ! command -v certbot >/dev/null 2>&1; then
  echo "==> Ставим certbot"
  apt-get update
  apt-get install -y certbot
fi

echo "==> Освобождаем порт 80 на время проверки домена"
$COMPOSE stop nginx || true

CERTBOT_ARGS=(certonly --standalone -d "$DOMAIN" --agree-tos --non-interactive)
if [ -n "$EMAIL" ]; then
  CERTBOT_ARGS+=(-m "$EMAIL")
else
  CERTBOT_ARGS+=(--register-unsafely-without-email)
fi

echo "==> Выпускаем сертификат для $DOMAIN"
certbot "${CERTBOT_ARGS[@]}"

mkdir -p infra/nginx/certs infra/nginx/certbot-webroot
cp -L "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" infra/nginx/certs/fullchain.pem
cp -L "/etc/letsencrypt/live/$DOMAIN/privkey.pem" infra/nginx/certs/privkey.pem

echo "==> Переключаем адреса в .env.demo на https"
sed -i "s|^PUBLIC_HOST=.*|PUBLIC_HOST=$DOMAIN|" .env.demo
sed -i "s|^WEB_URL=.*|WEB_URL=https://$DOMAIN|" .env.demo
sed -i "s|^API_URL=.*|API_URL=https://$DOMAIN|" .env.demo
sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=https://$DOMAIN|" .env.demo

if grep -q '^NGINX_CONF=' .env.demo; then
  sed -i "s|^NGINX_CONF=.*|NGINX_CONF=./infra/nginx/demo-ssl.conf|" .env.demo
else
  printf '\nNGINX_CONF=./infra/nginx/demo-ssl.conf\n' >> .env.demo
fi

if grep -q '^AUTH_COOKIE_SECURE=' .env.demo; then
  sed -i "s|^AUTH_COOKIE_SECURE=.*|AUTH_COOKIE_SECURE=true|" .env.demo
else
  printf 'AUTH_COOKIE_SECURE=true\n' >> .env.demo
fi

echo "==> Перезапускаем api, web и nginx"
$COMPOSE up -d api web
$COMPOSE up -d --force-recreate nginx

echo ""
echo "========================================"
echo " Сайт: https://$DOMAIN"
echo " Продление: bash infra/scripts/renew-cert.sh $DOMAIN"
echo "========================================"
