# Development Guide

## Quick Start
- Docker (recommended full stack):
  - `docker compose up --build`
  - Web: `http://localhost:8000/`
  - API: `http://localhost:3000/` (diagnostics at `/db`), proxied at `http://localhost:8000/api/`

- Local (single command):
  - `bash dev.sh`
  - Web: `http://localhost:8000/`
  - API: `http://localhost:3000/`

## Services & Ports
- `web` (Nginx): serves static PWA on `:8000`, proxies `/api/*` to API.
- `api` (FastAPI/Uvicorn): app on `:3000`, runs migrations on startup.
- `db` (Postgres): `:5432`, volume `pgdata` for persistence.

## Frontend Build
- Build tool: `esbuild` (via `npm run build`) bundles `app.jsx` → `dist/app.js`.
- Dev script runs `npm ci`/`npm install` if needed and builds automatically.
- `index.html` loads `dist/app.js`. The in‑browser Babel transformer is no longer used.

## Service Worker
- Cache name: `tg-cache-v5`. Bump the version when cached assets change.
- For updates to take effect, hard refresh or unregister/reload.

## API Integration
- The app fetches the OpenAPI spec from `${API_BASE}/openapi.json` and shows the version in the footer.
- When behind Nginx (Docker), `API_BASE = '/api'`.
- In local dev (`dev.sh`), served at `http://localhost:8000`, the app uses `http://localhost:3000` directly.
- CORS is enabled on the API for `http://localhost:8000`.

## Database & Migrations
- Default `DATABASE_URL`: `postgresql+psycopg2://postgres:postgres@localhost/trailguard`.
- On startup, `init_db()` applies `migrations/001_init.sql` (Postgres only) and seeds a demo user `11111111-1111-1111-1111-111111111111`.
- Dev script will start a Docker Postgres if none is reachable.

## Scripts
- `bash dev.sh`: orchestrates DB readiness, migrations, API on `:3000`, PWA on `:8000` (builds frontend first).
- `npm run build`: bundles frontend.

## Troubleshooting
- Service worker loops/old assets: hard refresh, or DevTools → Application → Service Workers → Unregister, then reload.
- `/api/*` 404 in local dev: use `http://localhost:3000` (handled automatically by the app).
- CORS errors: ensure API is on `:3000` and `dev.sh` was used (CORS enabled), or run via Docker with Nginx proxy.
- Geolocation timeouts: allow permissions; the initial timeout is 15s. Indoor environments may time out.

