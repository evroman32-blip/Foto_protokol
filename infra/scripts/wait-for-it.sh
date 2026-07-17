#!/usr/bin/env bash
# wait-for-it.sh — ожидание готовности TCP-хоста (используется в seed-and-migrate)
set -e

host="$1"
shift
port="$1"
shift
timeout="${1:-60}"
shift || true

if [ -z "$host" ] || [ -z "$port" ]; then
  echo "Usage: wait-for-it.sh host port [timeout] [-- command...]"
  exit 1
fi

if echo "$timeout" | grep -qE '^[0-9]+$'; then
  :
else
  timeout=60
fi

echo "Ожидание $host:$port (таймаут ${timeout}s)..."
start=$(date +%s)

while ! (echo > /dev/tcp/"$host"/"$port") >/dev/null 2>&1; do
  now=$(date +%s)
  if [ $((now - start)) -ge "$timeout" ]; then
    echo "Таймаут ожидания $host:$port"
    exit 1
  fi
  sleep 1
done

echo "$host:$port доступен"
if [ "$#" -gt 0 ]; then
  exec "$@"
fi
