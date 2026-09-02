-- Run this once against a NEW Vercel/Neon Postgres database before first use.
-- If you already have a live deferment_requests table from before, do NOT run
-- this — run db/migration_v2.sql instead, which updates it in place.

CREATE TABLE IF NOT EXISTS deferment_requests (
  id                 TEXT PRIMARY KEY,
  full_name          TEXT NOT NULL,
  admission_number   TEXT,
  email              TEXT NOT NULL,
  phone              TEXT NOT NULL,
  application_date   TEXT,
  program            TEXT NOT NULL,
  campus             TEXT NOT NULL,
  type_of_deferment  TEXT,
  semester_deferring TEXT,
  defer_year         TEXT,
  resumption_date    TEXT,
  reason_category    TEXT NOT NULL,
  reason_details     TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending',
  reviewer_notes     TEXT DEFAULT '',
  submitted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deferment_status ON deferment_requests (status);
CREATE INDEX IF NOT EXISTS idx_deferment_submitted_at ON deferment_requests (submitted_at DESC);
