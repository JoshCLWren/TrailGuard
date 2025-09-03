-- TrailGuard initial schema (PostgreSQL)
-- Creates core resources aligned with /v1 API: users, devices, breadcrumbs,
-- check-ins, SOS sessions, family members, settings, and messages.

BEGIN;

-- UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  display_name TEXT,
  create_time TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Devices owned by users
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  battery_percent INT CHECK (battery_percent BETWEEN 0 AND 100),
  solar BOOLEAN NOT NULL DEFAULT FALSE,
  connection_state TEXT CHECK (connection_state IN ('ONLINE','OFFLINE','DEGRADED')) DEFAULT 'OFFLINE',
  firmware_version TEXT,
  last_seen_time TIMESTAMPTZ,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  accuracy_meters DOUBLE PRECISION,
  pairing_code TEXT UNIQUE,
  paired_at TIMESTAMPTZ,
  create_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  update_time TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

-- Breadcrumbs per device
CREATE TABLE IF NOT EXISTS breadcrumbs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy_meters DOUBLE PRECISION,
  create_time TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_breadcrumbs_device_time ON breadcrumbs(device_id, recorded_at DESC);

-- Check-ins by user (optional device context)
CREATE TABLE IF NOT EXISTS check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('ok','delayed','custom')),
  message TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  accuracy_meters DOUBLE PRECISION,
  create_time TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_check_ins_user_time ON check_ins(user_id, create_time DESC);

-- SOS sessions (active if cancel_time IS NULL)
CREATE TABLE IF NOT EXISTS sos_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancel_time TIMESTAMPTZ,
  last_lat DOUBLE PRECISION,
  last_lng DOUBLE PRECISION,
  last_accuracy_meters DOUBLE PRECISION,
  create_time TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sos_sessions_user_time ON sos_sessions(user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_sos_sessions_active ON sos_sessions(user_id) WHERE cancel_time IS NULL;

-- Family members managed by user
CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  status TEXT,
  last_seen_time TIMESTAMPTZ,
  create_time TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_family_members_user ON family_members(user_id);

-- Per-user settings
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  auto_alerts BOOLEAN NOT NULL DEFAULT FALSE,
  notify_contacts BOOLEAN NOT NULL DEFAULT FALSE,
  sos_auto_call BOOLEAN NOT NULL DEFAULT FALSE,
  geofence_radius_meters INT NOT NULL DEFAULT 0,
  update_time TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages created by user (optional device context)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  accuracy_meters DOUBLE PRECISION,
  create_time TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_user_time ON messages(user_id, create_time DESC);

COMMIT;

