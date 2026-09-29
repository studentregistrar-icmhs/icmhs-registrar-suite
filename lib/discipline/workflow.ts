import { getTerm } from "@/lib/terms";
import { findStudentRow } from "@/lib/rosterLookup";
import { columnIndex } from "@/lib/columns";
import { updateStudentStatus, type WriteResult } from "@/lib/writeStatus";
import { STATUS_LABEL, SUSPENDED_LABEL } from "@/lib/reconcile";
import type { DisciplinaryCase } from "./constants";

/**
 * Keeps the student's status in the sheet in step with their case. The case
 * is always saved first; anything that can't be reflected in the sheet comes
 * back as a plain-English warning for the registrar rather than an error,
 * because "the record is saved but the status needs a manual look" is a
 * much better failure than losing the record.
 */

function warningFor(r: WriteResult, action: string, termSlug: string): string | null {
  if (r.ok) return null;
  switch (r.reason) {
    case "terminal-lock":
      return `The case was saved, but the student's status wasn't changed to ${action}: they're already ${r.blockingStatus} (${r.blockingTerm}).`;
    case "unsupported-term":
      return `The case was saved, but the status wasn't updated: ${termSlug} has no single status column to write "${action}" into. Set the status manually if needed.`;
    case "not-found":
      return `The case was saved, but the student's row couldn't be found in the sheet, so their status wasn't updated.`;
    default:
      return `The case was saved, but the student's status couldn't be set to ${action} (${r.reason}).`;
  }
}

async function readCell(admissionNo: string, termSlug: string): Promise<string | null> {
  const term = getTerm(termSlug);
  if (!term || term.source.kind !== "live-column") return null;
  const loc = await findStudentRow(admissionNo);
  if (!loc) return null;
  return String(loc.rawRow[columnIndex(term.source.column)] ?? "").trim();
}

/** Sets the term's status cell to Suspended. */
export async function applySuspension(c: DisciplinaryCase): Promise<string | null> {
  const r = await updateStudentStatus({
    admissionNo: c.admission_no,
    termSlug: c.term_slug,
    newStatusLabel: SUSPENDED_LABEL,
    viaDisciplinaryCase: true,
  });
  return warningFor(r, "Suspended", c.term_slug);
}

/**
 * Puts a suspended student back to "Not Yet Reported" — deliberately not
 * "In Session": on return they must report again (fresh lecture card and
 * validity date). Only touches the cell if it still says Suspended, so it
 * can never clobber a status someone set for a different reason.
 */
export async function liftSuspension(c: DisciplinaryCase): Promise<string | null> {
  const current = await readCell(c.admission_no, c.term_slug);
  if (current !== SUSPENDED_LABEL) return null;
  const r = await updateStudentStatus({
    admissionNo: c.admission_no,
    termSlug: c.term_slug,
    newStatusLabel: STATUS_LABEL.nyr,
    viaDisciplinaryCase: true,
  });
  return warningFor(r, STATUS_LABEL.nyr, c.term_slug);
}

/** Expulsion → Dropped (which is terminal everywhere else in the app). */
export async function applyExpulsion(c: DisciplinaryCase): Promise<string | null> {
  const r = await updateStudentStatus({
    admissionNo: c.admission_no,
    termSlug: c.term_slug,
    newStatusLabel: STATUS_LABEL.dropped,
    viaDisciplinaryCase: true,
  });
  // Already Dropped is exactly the state we wanted.
  if (!r.ok && r.reason === "terminal-lock" && r.blockingStatus === STATUS_LABEL.dropped) return null;
  return warningFor(r, "Dropped", c.term_slug);
}

export const EXPULSION_REVERSED_WARNING =
  "The outcome is no longer Expulsion, but the student's status is still Dropped (that status is locked). If they are being restored, change it on the profile using the terminal-lock override.";
