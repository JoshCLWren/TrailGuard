#!/usr/bin/env bash
set -euo pipefail

# TrailGuard dev/build script
# - Ensures a DB is available (starts Docker Postgres if needed)
# - Applies migrations
# - Starts FastAPI (uvicorn) on :3000
# - Serves the PWA on :8000

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Config
export DATABASE_URL="${DATABASE_URL:-postgresql+psycopg2://postgres:postgres@localhost/trailguard}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
UVICORN_HOST="${UVICORN_HOST:-0.0.0.0}"
UVICORN_PORT="${UVICORN_PORT:-3000}"
PWA_PORT="${PWA_PORT:-8000}"

# Helpers
has_cmd() { command -v "$1" >/dev/null 2>&1; }

log() { echo "[dev] $*"; }

die() { echo "[dev] ERROR: $*" >&2; exit 1; }

venv_setup() {
  if [[ ! -d .venv ]]; then
    log "Creating virtualenv (.venv)"
    "$PYTHON_BIN" -m venv .venv || die "Failed to create venv"
  fi
  # shellcheck disable=SC1091
  source .venv/bin/activate
  pip install --upgrade pip >/dev/null
  log "Installing Python deps (requirements.txt)"
  pip install -r requirements.txt >/dev/null || die "pip install failed"
}

db_backend_is_postgres() {
  # crude check is fine: our default uses postgresql+psycopg2
  [[ "$DATABASE_URL" == postgresql* ]]
}

wait_for_db() {
  local attempts=30
  local delay=1
  log "Waiting for DB to accept connections..."
  "$PYTHON_BIN" - "$DATABASE_URL" <<'PY' && return 0
import sys, time
from sqlalchemy import create_engine
url = sys.argv[1]
engine = create_engine(url, future=True)
for i in range(30):
    try:
        with engine.connect() as conn:
            conn.exec_driver_sql('SELECT 1')
        print('ok')
        sys.exit(0)
    except Exception as e:
        time.sleep(1)
print('timeout')
sys.exit(1)
PY
}

ensure_postgres() {
  if wait_for_db; then
    log "DB is up"
    return 0
  fi

  if has_cmd docker; then
    if has_cmd docker compose; then
      log "Starting PostgreSQL via docker compose"
      docker compose up -d db || die "Failed to start docker compose db"
    else
      log "Starting PostgreSQL via docker-compose"
      docker-compose up -d db || die "Failed to start docker-compose db"
    fi
    wait_for_db || die "DB did not become ready"
  else
    die "PostgreSQL not reachable and Docker not available. Set DATABASE_URL to a reachable DB or install Docker."
  fi
}

apply_migrations() {
  log "Applying migrations (init_db)"
  "$PYTHON_BIN" - <<'PY'
from trailguard_api.database import init_db
init_db()
print('migrations applied')
PY
}

start_backend() {
  log "Starting FastAPI on :$UVICORN_PORT"
  # Use module string for reload support
  uvicorn trailguard_api.main:app --host "$UVICORN_HOST" --port "$UVICORN_PORT" --reload &
  BACK_PID=$!
}

start_pwa() {
  log "Serving PWA on :$PWA_PORT"
  # Prefer Node http-server if available, else use Python http.server
  if has_cmd npx; then
    npx --yes http-server -p "$PWA_PORT" -c-1 >/dev/null 2>&1 &
  else
    "$PYTHON_BIN" -m http.server "$PWA_PORT" >/dev/null 2>&1 &
  fi
  PWA_PID=$!
}

cleanup() {
  log "Shutting down dev servers..."
  [[ -n "${BACK_PID:-}" ]] && kill "$BACK_PID" 2>/dev/null || true
  [[ -n "${PWA_PID:-}" ]] && kill "$PWA_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

# Main
venv_setup

if db_backend_is_postgres; then
  ensure_postgres
  apply_migrations
else
  log "DATABASE_URL is not PostgreSQL; skipping DB bootstrap/migrations"
fi

start_backend
start_pwa

log "Ready!"
log "API: http://localhost:$UVICORN_PORT/db (diagnostics)"
log "PWA: http://localhost:$PWA_PORT/"

# Keep script alive while background processes run
wait

