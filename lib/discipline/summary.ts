import { sql } from "@/lib/auth/db";
import {
  canAccessCampus, canAccessDepartment, canAccessCourse, canAccessTerm,
  type CurrentUser,
} from "@/lib/auth/currentUser";
import { canViewDisciplinary } from "./access";
import { isSuspensionActive, isReinstatementOverdue, type DisciplinaryCase } from "./constants";
import { todayIso } from "./cases";

/** Deliberately narrow: no description, no notes — a dashboard only needs who, which case, and dates. */
export type SummaryCase = Pick<
  DisciplinaryCase,
  | "id" | "case_ref" | "admission_no" | "student_name" | "course_code" | "campus" | "term_slug"
  | "category" | "case_status" | "outcome" | "suspension_start" | "suspension_end"
  | "suspension_indefinite" | "reinstated_on" | "incident_date" | "hearing_date"
>;

export type DisciplineSummaryData = {
  activeSuspensions: (SummaryCase & { overdue: boolean })[];
  openCases: SummaryCase[];
  overdueCount: number;
};

/**
 * Counts for the term dashboard. Returns null — and the dashboard simply
 * shows nothing — when the account has no disciplinary access, or when the
 * table isn't there yet (migration_v4 not run). Never throws: a problem
 * here must not take the whole dashboard down.
 *
 * Scoped exactly like everything else: campus, school, course and term
 * limits on the account apply to which cases are counted and named.
 */
export async function loadDisciplineSummary(me: CurrentUser): Promise<DisciplineSummaryData | null> {
  try {
    if (!(await canViewDisciplinary(me))) return null;
    const rows = (await sql`
      SELECT id, case_ref, admission_no, student_name, course_code, campus, term_slug,
             category, case_status, outcome, suspension_start, suspension_end,
             suspension_indefinite, reinstated_on, incident_date, hearing_date
      FROM disciplinary_cases
      WHERE (outcome = 'suspension' AND reinstated_on IS NULL)
         OR case_status IN ('open', 'hearing', 'appealed')
      ORDER BY incident_date DESC, id DESC
    `) as SummaryCase[];

    return summarise(rows, me, todayIso());
  } catch (err) {
    console.error("Discipline summary unavailable:", err);
    return null;
  }
}

/** Pure (no database) so the scoping and ordering rules can be tested directly. */
export function summarise(rows: SummaryCase[], me: CurrentUser, today: string): DisciplineSummaryData {
  {
    const visible = rows.filter(
      (c) =>
        canAccessCampus(me, c.campus) &&
        canAccessDepartment(me, c.course_code ?? "") &&
        canAccessCourse(me, c.course_code ?? "") &&
        canAccessTerm(me, c.term_slug)
    );

    const activeSuspensions = visible
      .filter(isSuspensionActive)
      .map((c) => ({ ...c, overdue: isReinstatementOverdue(c, today) }))
      // overdue first, then soonest end date, indefinite last
      .sort((a, b) =>
        Number(b.overdue) - Number(a.overdue) ||
        (a.suspension_indefinite ? 1 : 0) - (b.suspension_indefinite ? 1 : 0) ||
        String(a.suspension_end ?? "").localeCompare(String(b.suspension_end ?? ""))
      );
    // "Open" = still being worked on. A decided case with a suspension is
    // counted under suspensions instead, not twice.
    const openCases = visible.filter((c) => ["open", "hearing", "appealed"].includes(c.case_status));

    return { activeSuspensions, openCases, overdueCount: activeSuspensions.filter((c) => c.overdue).length };
  }
}
