#!/usr/bin/env bash
# Dev loop for the API without a local .NET SDK: everything runs inside the
# `snapclaim-sdk` container (mcr.microsoft.com/dotnet/sdk:9.0) with the repo
# mounted at /src and the dev Postgres reachable as snapclaim-db-dev.
#
#   api/dev.sh up        create network + postgres + sdk containers (idempotent)
#   api/dev.sh build     compile
#   api/dev.sh start     (re)start the API on http://localhost:8097
#   api/dev.sh restart   build + start
#   api/dev.sh logs      tail API log
#   api/dev.sh errors    show failed requests from the log
#   api/dev.sh smoke     run api/smoke.mjs against the dev API
#   api/dev.sh psql      open psql on the dev database
#   api/dev.sh reset-db  drop and recreate the dev database (re-seeds on next start)
#   api/dev.sh fresh     reset-db + build + start
#
# Receipt OCR runs in the snapclaim-ocr-dev container (built from ocr/ by `up`).
set -euo pipefail
export MSYS_NO_PATHCONV=1
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WIN_ROOT="$(cd "$ROOT" && pwd -W 2>/dev/null || echo "$ROOT")"
PORT="${SNAPCLAIM_DEV_PORT:-8097}"

ENV_ARGS='SNAPCLAIM_DB_CONNECTION="Host=snapclaim-db-dev;Database=snapclaim;Username=snapclaim;Password=snapclaim" SNAPCLAIM_JWT_SIGNING_KEY="dev-only-signing-key-change-me-0123456789abcdef" SNAPCLAIM_SQL_DIR=/src/db/sql SNAPCLAIM_SEED_DIR=/src/db/seed SNAPCLAIM_SEED_DEV=true SNAPCLAIM_OCR_URL=http://snapclaim-ocr-dev:8080 ASPNETCORE_ENVIRONMENT=Development'
if [ -f "$ROOT/api/.env.dev" ]; then
  # KEY=value lines only; quotes optional.
  while IFS='=' read -r k v; do
    [ -z "$k" ] && continue; case "$k" in \#*) continue;; esac
    v="${v%\"}"; v="${v#\"}"
    ENV_ARGS="$ENV_ARGS $k=\"$v\""
  done < "$ROOT/api/.env.dev"
fi

up() {
  docker network create snapclaim-dev >/dev/null 2>&1 || true
  docker ps -a --format '{{.Names}}' | grep -qx snapclaim-db-dev || \
    docker run -d --name snapclaim-db-dev --network snapclaim-dev -p 5497:5432 -e POSTGRES_DB=snapclaim -e POSTGRES_USER=snapclaim -e POSTGRES_PASSWORD=snapclaim -e TZ=Asia/Kolkata postgres:16-alpine >/dev/null
  docker ps -a --format '{{.Names}}' | grep -qx snapclaim-sdk || \
    docker run -d --name snapclaim-sdk --network snapclaim-dev -p "$PORT:8080" -v "$WIN_ROOT:/src" -w /src/api -e DOTNET_CLI_TELEMETRY_OPTOUT=1 -e DOTNET_NOLOGO=1 -e NUGET_PACKAGES=/nuget mcr.microsoft.com/dotnet/sdk:9.0 sleep infinity >/dev/null
  docker image inspect snapclaim-ocr:dev >/dev/null 2>&1 || docker build -q -t snapclaim-ocr:dev "$WIN_ROOT/ocr" >/dev/null
  docker ps -a --format '{{.Names}}' | grep -qx snapclaim-ocr-dev || \
    docker run -d --name snapclaim-ocr-dev --network snapclaim-dev snapclaim-ocr:dev >/dev/null
  docker start snapclaim-db-dev snapclaim-sdk snapclaim-ocr-dev >/dev/null
  echo "dev containers up (api on :$PORT, postgres on :5497, ocr on the dev network)"
}

build() {
  docker exec snapclaim-sdk dotnet build /src/api/src/SnapClaim.Api/SnapClaim.Api.csproj -c Debug --nologo -v q 2>&1 | grep -E "error|warning CS|Build succeeded" | sort -u
}

start() {
  docker restart snapclaim-sdk >/dev/null
  docker exec -d snapclaim-sdk sh -c "cd /src/api/src/SnapClaim.Api && $ENV_ARGS dotnet run --no-build --urls http://0.0.0.0:8080 > /tmp/api.log 2>&1"
  for _ in $(seq 1 120); do
    if curl -s -m 2 "http://localhost:$PORT/health" 2>/dev/null | grep -q '"ok"'; then echo "api up on http://localhost:$PORT"; return 0; fi
    sleep 1
  done
  echo "api did not come up; log:"; docker exec snapclaim-sdk tail -40 /tmp/api.log; return 1
}

case "${1:-}" in
  up) up ;;
  build) build ;;
  start) start ;;
  restart) build && start ;;
  logs) docker exec snapclaim-sdk tail -n "${2:-80}" /tmp/api.log ;;
  errors) docker exec snapclaim-sdk grep -a -B2 -A14 "fail:" /tmp/api.log | tail -n "${2:-80}" ;;
  smoke) node "$WIN_ROOT/api/smoke.mjs" "http://localhost:$PORT" ;;
  psql) docker exec -it snapclaim-db-dev psql -U snapclaim -d snapclaim ;;
  reset-db) docker restart snapclaim-sdk >/dev/null; docker exec snapclaim-db-dev psql -U snapclaim -d postgres -q -c "DROP DATABASE IF EXISTS snapclaim" -c "CREATE DATABASE snapclaim" ;;
  fresh) "$0" reset-db && "$0" build && "$0" start ;;
  *) sed -n 2,16p "$0" ;;
esac
