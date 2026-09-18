-- Run this ONCE in Neon's SQL editor against your existing deferment
-- database, before deploying the version of the apply form that asks
-- "Did you defer the previous semester?".
--
-- Safe to run on a table with existing rows: it only adds a column, and
-- existing requests simply get NULL (they were submitted before the
-- question existed, so there's no answer to backfill).

ALTER TABLE deferment_requests
  ADD COLUMN IF NOT EXISTS deferred_previous_semester TEXT;
