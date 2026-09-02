-- Run this ONCE in Neon's SQL editor to update your EXISTING deferment_requests
-- table to match the redesigned form. Safe to run even with existing rows —
-- it only renames/adds/drops columns, it does not delete any rows.

-- Drop columns no longer used by the new form.
ALTER TABLE deferment_requests
  DROP COLUMN IF EXISTS original_intake,
  DROP COLUMN IF EXISTS original_year,
  DROP COLUMN IF EXISTS deferred_intake,
  DROP COLUMN IF EXISTS deferred_year,
  DROP COLUMN IF EXISTS supporting_notes,
  DROP COLUMN IF EXISTS signed_name;

-- Rename the old "student_id" column to match the new "Admission Number" field.
ALTER TABLE deferment_requests RENAME COLUMN student_id TO admission_number;

-- Add the new columns the redesigned form collects.
ALTER TABLE deferment_requests
  ADD COLUMN IF NOT EXISTS application_date TEXT,
  ADD COLUMN IF NOT EXISTS type_of_deferment TEXT,
  ADD COLUMN IF NOT EXISTS semester_deferring TEXT,
  ADD COLUMN IF NOT EXISTS defer_year TEXT,
  ADD COLUMN IF NOT EXISTS resumption_date TEXT;
