import type { TermData } from "@/lib/loadTermData";

/**
 * Server-side removal of student contact details. Everything that leaves
 * the server for a user without the right goes through one of these, so
 * the numbers never reach the browser at all (not merely hidden by the UI —
 * they'd otherwise still be visible in the page source / network tab).
 *
 * All helpers return copies and never mutate their input.
 */

/** Dashboard + conflict list for a term: blanks `contacts` on every student. */
export function redactTermData<T extends TermData | null>(data: T, allowed: boolean): T {
  if (allowed || !data) return data;
  const studentsByStatus: Record<string, any[]> = {};
  for (const [status, list] of Object.entries(data.dashboard.studentsByStatus ?? {})) {
    studentsByStatus[status] = (list as any[]).map((s) => ({ ...s, contacts: "" }));
  }
  return {
    ...data,
    dashboard: { ...data.dashboard, studentsByStatus },
    conflicts: (data.conflicts ?? []).map((c) => ({ ...c, contacts: "" })),
  } as T;
}

/** A single student profile. */
export function redactProfile<T extends { contacts: string }>(profile: T, allowed: boolean): T {
  return allowed ? profile : { ...profile, contacts: "" };
}

/** Deferment request rows (student-submitted email + phone). */
export function redactDefermentRows<T extends { email?: string; phone?: string }>(rows: T[], allowed: boolean): T[] {
  return allowed ? rows : rows.map((r) => ({ ...r, email: "", phone: "" }));
}
