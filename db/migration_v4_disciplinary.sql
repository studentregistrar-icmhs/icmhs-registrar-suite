-- Run this ONCE in Neon's SQL editor, against the same database as
-- registrar_users and deferment_requests. Safe to re-run (idempotent).
--
-- Adds:
--   1. disciplinary_cases  — one row per case (the description, dates,
--      hearing, outcome, suspension period, reinstatement).
--   2. registrar_users.can_view_disciplinary — who may see case records.
--      Defaults to FALSE for everyone; admins always have access in code
--      regardless of this column.
--
-- Dates are stored as ISO text ('YYYY-MM-DD'), same convention as
-- deferment_requests, so they round-trip without timezone shifts.

CREATE SEQUENCE IF NOT EXISTS disciplinary_case_seq;

CREATE TABLE IF NOT EXISTS disciplinary_cases (
  id                    BIGSERIAL PRIMARY KEY,
  -- e.g. DC-2026-0007 — quoted on letters and in the audit log instead of
  -- any detail of the case itself.
  case_ref              TEXT NOT NULL UNIQUE DEFAULT (
                          'DC-' || to_char(now(), 'YYYY') || '-' ||
                          lpad(nextval('disciplinary_case_seq')::text, 4, '0')
                        ),

  -- Snapshot of the student at the time the case was opened, so the record
  -- stays readable even if the roster row is later edited.
  admission_no          TEXT NOT NULL,
  student_name          TEXT NOT NULL,
  course_code           TEXT,
  campus                TEXT NOT NULL CHECK (campus IN ('MAIN', 'NAKURU')),
  -- The term whose status column gets set to Suspended/Dropped.
  term_slug             TEXT NOT NULL,

  incident_date         TEXT NOT NULL CHECK (incident_date ~ '^\d{4}-\d{2}-\d{2}$'),
  reported_by           TEXT,
  category              TEXT NOT NULL,
  description           TEXT NOT NULL,

  case_status           TEXT NOT NULL DEFAULT 'open'
                          CHECK (case_status IN ('open', 'hearing', 'decided', 'appealed', 'closed')),
  hearing_date          TEXT CHECK (hearing_date IS NULL OR hearing_date ~ '^\d{4}-\d{2}-\d{2}$'),

  outcome               TEXT CHECK (outcome IS NULL OR outcome IN
                          ('warning', 'final_warning', 'suspension', 'expulsion', 'no_action')),
  outcome_notes         TEXT,
  decision_date         TEXT CHECK (decision_date IS NULL OR decision_date ~ '^\d{4}-\d{2}-\d{2}$'),
  decided_by            TEXT,
  letter_ref            TEXT,
  appeal_notes          TEXT,

  -- Suspension period. Fixed-term: start + end. Indefinite: start only,
  -- suspension_indefinite = true, until a committee reinstates the student.
  suspension_start      TEXT CHECK (suspension_start IS NULL OR suspension_start ~ '^\d{4}-\d{2}-\d{2}$'),
  suspension_end        TEXT CHECK (suspension_end IS NULL OR suspension_end ~ '^\d{4}-\d{2}-\d{2}$'),
  suspension_indefinite BOOLEAN NOT NULL DEFAULT false,

  reinstated_on         TEXT CHECK (reinstated_on IS NULL OR reinstated_on ~ '^\d{4}-\d{2}-\d{2}$'),
  reinstated_by         TEXT,
  reinstatement_notes   TEXT,

  created_by_id         INTEGER,
  created_by_name       TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A suspension must say when it starts, and either when it ends or that
  -- it's indefinite. Nothing else about a case is forced.
  CONSTRAINT suspension_has_period CHECK (
    outcome IS DISTINCT FROM 'suspension'
    OR (suspension_start IS NOT NULL AND (suspension_indefinite OR suspension_end IS NOT NULL))
  )
);

CREATE INDEX IF NOT EXISTS idx_disc_admission ON disciplinary_cases (admission_no);
CREATE INDEX IF NOT EXISTS idx_disc_status ON disciplinary_cases (case_status);
CREATE INDEX IF NOT EXISTS idx_disc_outcome ON disciplinary_cases (outcome);

ALTER TABLE registrar_users
  ADD COLUMN IF NOT EXISTS can_view_disciplinary BOOLEAN NOT NULL DEFAULT false;
