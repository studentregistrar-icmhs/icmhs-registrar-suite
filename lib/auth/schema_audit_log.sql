-- Run this ONCE in Neon's SQL editor, in the same database as
-- registrar_users. Records who did what, when — every status edit, bulk
-- upload, carry-forward run, conflict resolution, and cohort tag.
--
-- Deliberately generic (one row shape for every action type) rather than a
-- table per action — `action` + `detail` carry what's specific to each one,
-- so adding a new instrumented action later never needs a migration.

CREATE TABLE IF NOT EXISTS registrar_audit_log (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id INTEGER,                  -- registrar_users.id — nullable so a deleted account doesn't break old rows
  actor_name TEXT NOT NULL,          -- captured at write time, so it survives even if the account is later renamed/deactivated
  action TEXT NOT NULL,              -- e.g. 'status_edit', 'bulk_upload', 'carry_forward', 'conflict_resolve', 'cohort_tag'
  admission_no TEXT,                 -- the student affected, where applicable (null for whole-term actions like carry-forward)
  term_slug TEXT,
  detail TEXT NOT NULL               -- short human-readable summary, e.g. "Set status to In Session (was Unmarked)"
);

CREATE INDEX IF NOT EXISTS registrar_audit_log_at_idx ON registrar_audit_log (at DESC);
CREATE INDEX IF NOT EXISTS registrar_audit_log_admission_idx ON registrar_audit_log (admission_no);
CREATE INDEX IF NOT EXISTS registrar_audit_log_actor_idx ON registrar_audit_log (actor_id);
