import { sql } from "./db";

export type AuditAction =
  | "status_edit"
  | "unmarked_mark"
  | "unmarked_mark_bulk"
  | "bulk_upload"
  | "carry_forward"
  | "conflict_resolve"
  | "conflict_resolve_bulk"
  | "cohort_tag";

/**
 * Records one audit entry. Best-effort and never throws — a logging
 * failure (e.g. the audit table doesn't exist yet on a deployment that
 * hasn't run schema_audit_log.sql) must never block or fail the actual
 * write it's describing. Call this AFTER a write has already succeeded.
 */
export async function logAudit(entry: {
  actorId: number;
  actorName: string;
  action: AuditAction;
  admissionNo?: string | null;
  termSlug?: string | null;
  detail: string;
}): Promise<void> {
  try {
    await sql`
      INSERT INTO registrar_audit_log (actor_id, actor_name, action, admission_no, term_slug, detail)
      VALUES (${entry.actorId}, ${entry.actorName}, ${entry.action}, ${entry.admissionNo ?? null}, ${entry.termSlug ?? null}, ${entry.detail})
    `;
  } catch (err) {
    console.error("Audit log write failed (non-fatal):", err);
  }
}

export type AuditLogRow = {
  id: number;
  at: string;
  actor_id: number | null;
  actor_name: string;
  action: AuditAction;
  admission_no: string | null;
  term_slug: string | null;
  detail: string;
};

/** Newest-first, optionally filtered. Every filter is optional and combines
 * with AND. `admissionNo` and `actorName` match anywhere in the field
 * (case-insensitive) so a partial admission number or name still finds
 * matches. Capped at 500 rows per query — this is a browsing tool, not a
 * full export; add date-range filters here first if that ever isn't enough. */
export async function listAuditLog(filters: {
  admissionNo?: string;
  actorName?: string;
  action?: AuditAction;
  termSlug?: string;
  limit?: number;
}): Promise<AuditLogRow[]> {
  const limit = Math.min(filters.limit ?? 200, 500);
  const admissionPattern = filters.admissionNo ? `%${filters.admissionNo}%` : null;
  const actorPattern = filters.actorName ? `%${filters.actorName}%` : null;

  const rows = (await sql`
    SELECT * FROM registrar_audit_log
    WHERE
      (${admissionPattern}::text IS NULL OR admission_no ILIKE ${admissionPattern})
      AND (${actorPattern}::text IS NULL OR actor_name ILIKE ${actorPattern})
      AND (${filters.action ?? null}::text IS NULL OR action = ${filters.action ?? null})
      AND (${filters.termSlug ?? null}::text IS NULL OR term_slug = ${filters.termSlug ?? null})
    ORDER BY at DESC
    LIMIT ${limit}
  `) as AuditLogRow[];
  return rows;
}
