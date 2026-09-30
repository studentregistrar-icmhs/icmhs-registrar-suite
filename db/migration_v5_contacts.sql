-- Run this ONCE in Neon's SQL editor, against the same database as
-- registrar_users. Safe to re-run (idempotent).
--
-- Adds registrar_users.can_view_contacts — who may see student contact
-- details (phone numbers on the dashboards, student lists, conflict list,
-- CSV exports and student profiles; email + phone in the Deferments
-- review area).
--
-- Defaults to FALSE for everyone, existing accounts included: after this
-- runs, non-admin accounts stop seeing contacts until an admin ticks
-- "Can view student contacts" on their row in Manage accounts. Admins
-- always have access in code regardless of this column.

ALTER TABLE registrar_users
  ADD COLUMN IF NOT EXISTS can_view_contacts BOOLEAN NOT NULL DEFAULT false;

-- OPTIONAL — uncomment ONLY if you want every current account to keep
-- seeing contacts today, and then switch people off one by one instead:
-- UPDATE registrar_users SET can_view_contacts = true WHERE active = true;
