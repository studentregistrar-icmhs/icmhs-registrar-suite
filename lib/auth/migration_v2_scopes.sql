-- Run this ONCE in Neon's SQL editor against your existing registrar_users
-- table, before deploying department/term-scoped and deferments-toggle
-- accounts (e.g. for HODs).
--
-- Safe to run on a table with existing rows: every existing account gets
-- department_scope = NULL and term_scope = NULL (both mean "no
-- restriction" — same access they have today) and can_view_deferments =
-- true (same as today, where every logged-in account could reach it).
-- Nobody's access changes just from running this.

ALTER TABLE registrar_users
  ADD COLUMN IF NOT EXISTS department_scope TEXT[],
  ADD COLUMN IF NOT EXISTS term_scope TEXT[],
  ADD COLUMN IF NOT EXISTS can_view_deferments BOOLEAN NOT NULL DEFAULT true;
