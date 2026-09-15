-- Run this once against the same Neon database the deferments module
-- already uses (DATABASE_URL). Safe to re-run — every statement is
-- idempotent (IF NOT EXISTS / ON CONFLICT).
--
-- After this exists, bootstrap the first admin account with:
--   node scripts/create-admin.mjs
-- (see that script for details — there's a chicken-and-egg problem where
-- no one can log in to create the first user via the Manage Users page,
-- since that page itself requires being logged in as an admin).

CREATE TABLE IF NOT EXISTS registrar_users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  -- 'ALL' for admins (always full access regardless of this column) and for
  -- any editor/viewer who should see both campuses. 'MAIN' or 'NAKURU'
  -- restricts an editor/viewer to just that campus, enforced server-side
  -- on every read and write, not just hidden in the UI.
  campus_scope TEXT NOT NULL DEFAULT 'ALL' CHECK (campus_scope IN ('ALL', 'MAIN', 'NAKURU')),
  active BOOLEAN NOT NULL DEFAULT true,
  -- Set whenever an admin creates the account or resets its password (the
  -- temp password is shown once, so the person must pick their own on
  -- first login). Cleared once they successfully change it.
  must_reset_password BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS registrar_users_username_idx ON registrar_users (lower(username));
