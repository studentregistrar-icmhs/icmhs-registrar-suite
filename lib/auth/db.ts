import { neon } from "@neondatabase/serverless";

/**
 * Same database the deferments module already uses (DATABASE_URL) — no new
 * infrastructure needed, just a new table in it. Lazily initialized so a
 * missing env var can't crash the build step itself, same pattern as
 * lib/deferments/db.js.
 */
let _sql: ReturnType<typeof neon> | null = null;

function getSql() {
  if (_sql) return _sql;
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("No database connection string found. Set DATABASE_URL (or POSTGRES_URL) in your environment.");
  }
  _sql = neon(connectionString);
  return _sql;
}

export const sql: ReturnType<typeof neon> = ((...args: Parameters<ReturnType<typeof neon>>) =>
  getSql()(...args)) as ReturnType<typeof neon>;
