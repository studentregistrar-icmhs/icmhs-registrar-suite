import { fetchSheetRows } from "./googleSheets";
import { findStudentRow } from "./rosterLookup";
import { readFlagsAt, LAYOUT_FOR_WRITE } from "./parse";
import { reconcile, STATUS_LABEL, TERMINAL_STATUSES } from "./reconcile";
import { TERMS, getCurrentTermSlug } from "./terms";
import { columnIndex } from "./columns";
import { GRADUATION_COHORT_COLUMN } from "./graduationCohort";
import { normalizeSheetDate } from "./sheetDates";

export type TimelineEntry = {
  termSlug: string;
  termLabel: string;
  status: string;
  editable: boolean; // false for static historical terms, AND for any term other than the one being viewed — see viewingTermSlug below
  /** Lecture card validity date, as "YYYY-MM-DD". Only ever set for a
   * live-column term whose status is "In Session" (that's the only case
   * the sheet stores one for — see lib/terms.ts validityColumn). "" or
   * absent otherwise. */
  validityDate?: string;
  /** When the "In Session" entry was recorded, as "YYYY-MM-DD" — stamped
   * automatically at write time, never typed by the registrar. Same
   * conditions as validityDate above. */
  dateReported?: string;
};

export type StudentProfile = {
  admissionNo: string;
  name: string;
  courseCode: string;
  courseName: string;
  gender: string;
  contacts: string;
  intakeYear: string;
  campus: "MAIN" | "NAKURU";
  /** Only ever meaningful for Graduated students — see lib/graduationCohort.ts. */
  graduationCohort: string;
  /** The term this profile is being viewed "as of" — defaults to the
   * current calendar term when the caller doesn't specify one. Only this
   * term's entry in `timeline` is editable, and no term after it is
   * included at all (see getStudentTimeline's viewingTermSlug param). */
  viewingTermSlug: string;
  timeline: TimelineEntry[];
};

/**
 * @param viewingTermSlug Which term this profile is being viewed "as of" —
 * normally passed straight through from wherever the person navigated from
 * (a term's dashboard, a search result, etc). Terms after this one are
 * dropped from the timeline entirely (view a Jan-Apr dashboard, and you
 * can't see or edit May-Aug/Sept-Dec for that student), and terms before
 * it are included but forced read-only — only the viewing term itself can
 * be edited. Falls back to the current calendar term for an unrecognized
 * or omitted value, so navigating here without term context (e.g. the
 * generic /students search) still can't be used to bypass the restriction
 * and edit an arbitrary term.
 * @param termScope A term-scoped account's allowed term slugs (null/omitted
 * = unrestricted). Terms outside this set never appear in the timeline at
 * all, regardless of viewingTermSlug or chronological order — an account
 * scoped to only Sept-Dec 2026 won't see Jan-Apr/May-Aug entries even as
 * read-only history. If viewingTermSlug itself isn't in scope, falls back
 * to the most recent term that is.
 */
export async function getStudentTimeline(
  admissionNo: string,
  viewingTermSlug?: string,
  termScope?: string[] | null
): Promise<StudentProfile | null> {
  const loc = await findStudentRow(admissionNo);
  if (!loc) return null;

  const layout = LAYOUT_FOR_WRITE[loc.campus];
  const nameCol = layout.name;
  const courseCodeCol = layout.courseCode;
  const courseNameCol = layout.courseName;

  const timeline: TimelineEntry[] = [];
  // Most recent legacy terminal status found, checked in TERMS order so a
  // later term's Graduated/Dropped overrides an earlier one if somehow both
  // are set — carries forward into Status Log terms below, same as
  // buildFromStatusLog() does for the main dashboard.
  let inheritedTerminal: string | null = null;

  for (const term of TERMS) {
    if (term.source.kind === "live-legacy") {
      const flags = readFlagsAt(loc.rawRow, loc.campus, term.source.block);
      const r = reconcile(flags);
      const status = r.canonicalStatus === "UNMARKED" ? "Unmarked" : STATUS_LABEL[r.canonicalStatus];
      timeline.push({ termSlug: term.slug, termLabel: term.label, status, editable: true });
      if (r.canonicalStatus !== "UNMARKED" && TERMINAL_STATUSES.includes(r.canonicalStatus)) {
        inheritedTerminal = status;
      }
    }
  }

  const statusLogTerm = TERMS.find((t) => t.source.kind === "live-statuslog");
  if (statusLogTerm) {
    let latestStatus: string | null = null;
    if (inheritedTerminal) {
      // Terminal is final everywhere else in this app — it carries forward
      // even over a conflicting log row, since a terminal status shouldn't
      // have been logged over in the first place.
      latestStatus = inheritedTerminal;
    } else {
      const logRows = await fetchSheetRows("STATUS LOG!A:D").catch(() => []);
      for (let i = 1; i < logRows.length; i++) {
        const [rowAdmission, term, status] = logRows[i] ?? [];
        if (String(rowAdmission) === admissionNo) latestStatus = String(status ?? "");
      }
    }
    if (latestStatus !== null) {
      timeline.push({
        termSlug: statusLogTerm.slug,
        termLabel: statusLogTerm.label,
        status: latestStatus || "Unmarked",
        editable: true,
      });
    }
  }

  // "live-column" terms (e.g. Sept-Dec 2026 onward) keep their status right
  // on the student's own roster row instead of a separate log — same idea
  // as buildFromColumn() does for the main dashboard. Handled as its own
  // loop (rather than folded into the live-legacy loop above) since it
  // needs no sheet write/flag reconciliation, just a direct column read.
  for (const term of TERMS) {
    if (term.source.kind !== "live-column") continue;
    const status = inheritedTerminal
      ? inheritedTerminal
      : String(loc.rawRow[columnIndex(term.source.column)] ?? "").trim() || "Unmarked";

    // The validity / date-reported columns are only meaningful alongside an
    // "In Session" status — that's the only status the sheet ever writes
    // them for. Reading them regardless of status would surface a stale
    // date left over from a previous term's entry after someone's status
    // changed to something else, which would be actively misleading.
    let validityDate = "";
    let dateReported = "";
    if (status === STATUS_LABEL.reported) {
      if (term.source.validityColumn) {
        validityDate = normalizeSheetDate(loc.rawRow[columnIndex(term.source.validityColumn)]);
      }
      if (term.source.dateReportedColumn) {
        dateReported = normalizeSheetDate(loc.rawRow[columnIndex(term.source.dateReportedColumn)]);
      }
    }

    timeline.push({ termSlug: term.slug, termLabel: term.label, status, editable: true, validityDate, dateReported });
  }

  // Static historical terms would be added here once their JSON snapshots
  // include a per-student index — skipped for now (see data/historical/README.md).

  // Restrict to the viewing term: drop everything after it, and force
  // everything before it to read-only. TERMS is in chronological order, so
  // its index doubles as a timeline for this comparison.
  const allowedSlugs = termScope && termScope.length > 0 ? new Set(termScope) : null;

  let resolvedViewingSlug = viewingTermSlug && TERMS.some((t) => t.slug === viewingTermSlug)
    ? viewingTermSlug
    : getCurrentTermSlug();
  if (allowedSlugs && !allowedSlugs.has(resolvedViewingSlug)) {
    // The default/requested viewing term isn't one this account can see —
    // fall back to the most recent term it IS allowed to see, same idea as
    // the unrecognized-slug fallback above just scoped further.
    const fallback = [...TERMS].reverse().find((t) => allowedSlugs.has(t.slug));
    if (!fallback) return null; // scoped to term(s) that don't exist in TERMS at all
    resolvedViewingSlug = fallback.slug;
  }
  const viewingIndex = TERMS.findIndex((t) => t.slug === resolvedViewingSlug);

  const scopedTimeline = timeline
    .filter((entry) => TERMS.findIndex((t) => t.slug === entry.termSlug) <= viewingIndex)
    .filter((entry) => !allowedSlugs || allowedSlugs.has(entry.termSlug))
    .map((entry) =>
      entry.termSlug === resolvedViewingSlug ? entry : { ...entry, editable: false }
    );

  return {
    admissionNo,
    name: String(loc.rawRow[nameCol] ?? "").trim(),
    courseCode: String(loc.rawRow[courseCodeCol] ?? "").trim(),
    courseName: String(loc.rawRow[courseNameCol] ?? "").trim(),
    gender: String(loc.rawRow[layout.gender] ?? "").trim(),
    contacts: String(loc.rawRow[layout.contacts] ?? "").trim(),
    intakeYear: layout.intake !== undefined ? String(loc.rawRow[layout.intake] ?? "").trim() : "",
    campus: loc.campus,
    graduationCohort: String(loc.rawRow[columnIndex(GRADUATION_COHORT_COLUMN)] ?? "").trim(),
    viewingTermSlug: resolvedViewingSlug,
    timeline: scopedTimeline,
  };
}
