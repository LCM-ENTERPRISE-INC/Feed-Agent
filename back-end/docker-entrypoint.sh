#!/bin/sh
# BusinessZap backend container entrypoint.
# Never runs prisma with --accept-data-loss.
set -e

log() {
  echo "[entrypoint] $*"
}

require_env() {
  name="$1"
  val=$(printenv "$name" || true)
  if [ -z "$val" ]; then
    log "ERROR: required environment variable '$name' is missing"
    exit 1
  fi
}

require_env DATABASE_URL
require_env JWT_SECRET

MODE="${DATABASE_SCHEMA_MODE:-push}"
log "schema mode=${MODE}"

log "waiting for PostgreSQL..."
i=0
until node -e "const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); p.\$connect().then(()=>p.\$disconnect()).then(()=>process.exit(0)).catch(()=>process.exit(1))" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    log "ERROR: PostgreSQL not reachable after retries"
    exit 1
  fi
  sleep 2
done
log "PostgreSQL reachable"

case "$MODE" in
  push)
    log "applying schema via prisma db push (temporary; NEVER accept-data-loss)"
    npx prisma db push
    ;;
  migrate)
    if [ ! -d prisma/migrations ] || [ -z "$(ls -A prisma/migrations 2>/dev/null || true)" ]; then
      log "ERROR: DATABASE_SCHEMA_MODE=migrate but prisma/migrations is missing or empty"
      log "HINT: create versioned migrations before enabling migrate mode"
      exit 1
    fi
    log "applying schema via prisma migrate deploy"
    npx prisma migrate deploy
    ;;
  none)
    log "skipping schema sync (DATABASE_SCHEMA_MODE=none)"
    ;;
  *)
    log "ERROR: invalid DATABASE_SCHEMA_MODE='${MODE}' (allowed: push | migrate | none)"
    exit 1
    ;;
esac

log "starting Node server"
exec node dist/index.js
