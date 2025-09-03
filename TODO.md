# TrailGuard TODO — Mocked Features and Gaps

- Scope: Items currently mocked or partially implemented, with architectural and quality concerns to address next.

## Mocked Features
- SOS flow: UI text is static; no calls to `/v1/users/{userId}/sos`, `:activate`, `:cancel`. Needs a real state machine, background location streaming while active, and cancel/confirm UX.
- Devices & pairing: Settings has a "Pair New Device" alert. Implement device list, pairing via `/v1/users/{userId}/devices` (POST with `pairingCode`), device detail, and firmware check via `:checkFirmware`.
- Family: In‑memory list on the client. Hook to `/v1/users/{userId}/familyMembers` (list/create/delete) and display status/last seen from the backend.
- Settings: Dark mode toggles body styles only (not persisted). Implement `/v1/users/{userId}/settings` (GET/PATCH), persist locally and server‑side, add field masks.
- Breadcrumbs/waypoints: Stored only in `localStorage` (`tg_breadcrumbs`). Implement `/v1/users/{userId}/devices/{deviceId}/breadcrumbs` (+ `:batchCreate`), sync on network restore, and display server history.
- Messages: No UI yet; spec supports `/v1/users/{userId}/messages` (POST). Add compose UI and history view if listing is added.
- Telemetry on Home: "Location — Trail Ridge (mock)", battery/connection are placeholders. Replace with device telemetry (batteryPercent, connectionState, solar, lastSeenTime) from `/devices`.

## API/Backend Gaps
- Routers implemented: Check‑ins only. Missing routers for devices, breadcrumbs, family, settings, messages, and SOS.
- Spec vs models mismatch:
  - OpenAPI `Location` uses `{ latLng: { latitude, longitude }, accuracyMeters }`, while the backend uses `{ lat, lng, accuracyMeters }` and Pydantic aliases. Decide single source of truth: update OpenAPI or align models/JSON shape to the spec.
  - Several schemas (e.g., Device, Settings) exist in `openapi.yaml` but no corresponding Pydantic models/routers.
- OpenAPI serving: `main.py` overrides `app.openapi()` with static `openapi.yaml`. Ensure handlers and response models stay in sync (consider generating spec from code, or validating routes against the YAML in CI).
- Migrations: Only `001_init.sql` applied on PostgreSQL. SQLite is used in tests; ensure parity or gate features to Postgres only. Consider Alembic for future migrations.

## PWA/Offline Architecture
- Outbox/queue: POSTs (check‑ins, breadcrumbs, SOS, messages) do not queue offline. Add a service‑worker backed outbox with retry and backoff.
- Cache policy: SW caches CDN React and OSM tiles. Prefer vendoring pinned assets (SRI if CDN), and avoid caching API responses that may include sensitive data.
- Updates UX: SW auto‑activates; consider a toast/banner to prompt reload on new version instead of forced reload.
- Tile cache size: Add LRU/limit for `tg-tiles-v1` to avoid unbounded growth.

## Frontend Code Quality
- React patterns: Mixed direct DOM access (`document.getElementById`) and global vars (`map`, markers). Refactor to React state/refs and effect cleanup per view.
- Routing: Hand‑rolled hash routing. Consider a tiny router or centralize route constants and guards.
- Error/loading states: Add consistent toasts/inline errors for API failures (specifically in Check‑ins list/load, OpenAPI spec load failures) and skeletons while loading.
- Config: Heuristic `API_BASE` detection in `app.jsx`. Move to a single config surface (e.g., `window.__CONFIG__` injected by index.html or build‑time env), and keep Docker/Nginx path in sync.
- Type safety: Introduce lightweight runtime validation for API payloads (Zod or io‑ts) or add TS types if adopting TypeScript later.

## Usability & UX
- Map: Unify follow/recenter UX; show accuracy ring on main map; show breadcrumb count and last sync time; add clear/path reset with confirm.
- Check‑ins: Add optimistic UI + retry offline; paginate or lazy‑load if list grows; show location snippet when available.
- Family: Display presence (status/last seen), avatars/initials, and remove confirmation; persist changes.
- Settings: Persist dark mode; expose meaningful settings from the spec (autoAlerts, notifyContacts, sosAutoCall, geofenceRadiusMeters).
- Footer: When OpenAPI spec fails to load, display a clearer offline/diagnostic hint.

## Security & Ops
- `/db` endpoint: Keep dev‑only. Ensure it is never exposed in production images.
- CORS: Currently wide for local dev. Tighten in production, align with proxy domain.
- Secrets: None today; if added, never persist client‑side.
- Logging: Standardize client logging and suppress verbose logs in production builds.

## Testing
- Current tests: `tests/test_checkins.py` only. Add API tests for each new router (devices, breadcrumbs, family, settings, sos, messages).
- Contract checks: Validate JSON shapes against `openapi.yaml` (e.g., via schemathesis or pydantic‑openapi checks) to prevent drift.
- Frontend: Add minimal unit tests for utility logic; rely on manual browser validation for map/geo until e2e is added.

## Quick Next Steps
- Implement SOS router and wire the SOS UI.
- Add devices router + basic list in Settings; replace mocked pairing.
- Introduce breadcrumbs sync endpoint + background outbox in SW.
- Resolve Location schema mismatch between OpenAPI and backend.
- Refactor map globals to React refs with proper cleanup.
