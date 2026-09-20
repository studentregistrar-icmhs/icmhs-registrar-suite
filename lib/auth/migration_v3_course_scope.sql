-- Run this ONCE in Neon's SQL editor, after migration_v2_scopes.sql.
--
-- Adds course-level scope, one step finer than department scope — for a
-- registrar who oversees a single programme within a larger school rather
-- than the whole school. NULL/'{}' (the default for every existing
-- account) means "no restriction" — same as department_scope's NULL.
--
-- Course scope and department scope compose with AND, same as every other
-- scoping dimension: if both are set, a student must match BOTH to be
-- visible. In practice you'd normally set one or the other, not both, but
-- nothing stops you from doing so if that's ever genuinely what you want.

ALTER TABLE registrar_users
  ADD COLUMN IF NOT EXISTS course_scope TEXT[];
