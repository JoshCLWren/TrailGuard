# TrailGuard

TrailGuard is a lightweight PWA paired with a FastAPI backend.

Frontend features
- React single‑page app (no framework runtime), bundled with esbuild
- Map views with Leaflet + OpenStreetMap tiles
- Local breadcrumbs stored in `localStorage`
- Check‑ins sent to the backend, with optional geolocation
- Installable PWA with offline support via a service worker

Backend features
- FastAPI app serving a resource‑oriented API (see `openapi.yaml`)
- PostgreSQL via SQLAlchemy; migrations applied on startup
- Dev diagnostics at `GET /db` (local only)

## Quick Start

Docker (full stack)
- `docker compose up --build`
- Web: `http://localhost:8000/`
- API: `http://localhost:3000/` (proxied at `/api/*` from the web)

Local dev script
- `bash dev.sh`
- Web: `http://localhost:8000/`
- API: `http://localhost:3000/`

## Project Structure
- `index.html`, `styles.css`: static shell
- `app.jsx`: React app source; built to `dist/app.js`
- `service-worker.js`: cache‑first PWA shell (cache `tg-cache-v5`)
- `trailguard_api/`: FastAPI app, models, routers
- `migrations/`: SQL schema (applied on startup)
- `openapi.yaml`: API specification (also served at `/api/openapi.json` in Docker)
- `Dockerfile.api`, `Dockerfile.web`, `docker-compose.yml`, `nginx.conf`
- `DEV.md`: development workflow and troubleshooting
- `AGENTS.md`: repository guidelines and conventions

## Scripts
- `bash dev.sh`: ensure DB, run migrations, start API + PWA, build frontend
- `npm run build`: bundle frontend (`dist/app.js`)

## Configuration
- `DATABASE_URL` (API): defaults to `postgresql+psycopg2://postgres:postgres@localhost/trailguard`
- `UVICORN_HOST`, `UVICORN_PORT` (API): default `0.0.0.0:3000`
- `PWA_PORT` (web when using dev.sh): default `8000`

## Contributing
- Follow the coding conventions in `AGENTS.md`
- Prefer focused PRs; include notes for service worker cache bumps

