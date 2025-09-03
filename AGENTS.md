# Repository Guidelines

## Project Structure & Module Organization
- Root contains a static PWA: `index.html`, `styles.css`, `app.jsx`, `service-worker.js`, `manifest.json`, and `icon-*.png` assets.
- `index.html`: boots the app, loads `styles.css`/`app.jsx`, registers the service worker.
- `app.jsx`: React-based routing, state, and UI handlers; persists breadcrumbs in `localStorage` under `tg_breadcrumbs`.
- `service-worker.js`: caches app shell (`tg-cache-v4`) for offline use. Bump the cache name when changing cached assets.

## Build, Test, and Development Commands
- Run locally (no build step):
  - Python: `python -m http.server 8000` then open `http://localhost:8000/`.
  - Node (optional): `npx http-server -p 8000`.
- Reload to test service worker updates; after cache changes, hard refresh or unregister/reload.

## Coding Style & Naming Conventions
- JavaScript: 2-space indent, semicolons, single quotes. `camelCase` for variables/functions, `PascalCase` for classes, `UPPER_SNAKE_CASE` for constants.
- HTML: use semantic tags; keep inline scripts minimal (logic lives in `app.jsx`).
- CSS: 2-space indent; prefer utility-like, readable class names (BEM-style acceptable). Keep styles cohesive in `styles.css`.
- Filenames: lowercase with hyphens (`service-worker.js`, `manifest.json`).

## Testing Guidelines
- No test harness yet. Validate manually in a browser (routing, offline cache, localStorage breadcrumbs, UI flows).
- If adding logic, include lightweight unit tests (e.g., Jest + JSDOM). Name tests `*.test.js` and colocate or place under `tests/`.
- Aim for clear, deterministic UI behavior; add guards for offline/online events.

## Commit & Pull Request Guidelines
- Commits: concise, imperative subject (e.g., "Add SOS view", "Fix cache bust"). Conventional Commits welcomed (`feat:`, `fix:`, `docs:`).
- PRs: include summary, linked issues, before/after screenshots for UI changes, and notes on service worker cache/version changes.
- Keep changes focused; update `manifest.json`/icons when altering PWA branding.

## Security & Configuration Tips
- Do not commit secrets. This app is static; any future API keys should be server-side.
- Service worker: avoid caching sensitive endpoints; prefer cache-first for static assets, network-first where freshness matters.
- PWA: verify installability (manifest + icons) and test offline behavior after updates.

## Backend API (/db)
- Overview: A lightweight FastAPI app lives under `trailguard_api/` with an internal diagnostic endpoint at `GET /db`.
- Purpose: Dev-only database health and configuration check; returns masked DB URL, backend/driver, and connectivity status.
- Example response:
  - `{ "url": "postgresql+psycopg2://postgres:***@localhost/trailguard", "backend": "postgresql", "driver": "psycopg2", "ok": true, "error": null }`
- Run locally:
  - `uvicorn trailguard_api.main:app --reload --port 3000`
  - Open `http://localhost:3000/db` to verify DB connectivity (defaults to `DATABASE_URL` or in-memory SQLite for tests).
- Configuration:
  - `DATABASE_URL` (optional): SQLAlchemy URL. Default is `postgresql+psycopg2://postgres:postgres@localhost/trailguard`.
  - Migrations: On startup, `init_db()` applies `migrations/001_init.sql` when using PostgreSQL.
- Security:
  - Do not expose `/db` publicly; restrict to local/dev environments. It reveals connection metadata (passwords are masked).
