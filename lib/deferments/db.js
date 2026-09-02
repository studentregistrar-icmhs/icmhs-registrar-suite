import { neon } from "@neondatabase/serverless";

// Vercel's Postgres integration (Neon-backed) injects DATABASE_URL.
// Some older setups use POSTGRES_URL instead, so we fall back to that.
// Lazily initialized so a missing var can't crash the build step itself —
// it only surfaces when a request actually tries to hit the database.
let _sql = null;

function getSql() {
  if (_sql) return _sql;
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error(
      "No database connection string found. Set DATABASE_URL (or POSTGRES_URL) in your environment."
    );
  }
  _sql = neon(connectionString);
  return _sql;
}

// sql`...` returns an array of rows directly (not wrapped in { rows }).
export const sql = (...args) => getSql()(...args);
