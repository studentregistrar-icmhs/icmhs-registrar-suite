import fs from "fs/promises";
import path from "path";
import { getTerm, getTermPeriod } from "./terms";
import { fetchSheetRows } from "./googleSheets";
import { parseCampusRows, toReconcilable, Student } from "./parse";
import { buildFromStatusLog, buildFromColumn, extractColumnStatus } from "./statusLog";
import { buildDashboardData, DashboardData } from "./aggregate";
import { buildConflictReport, ConflictRow } from "./reconcile";
import { isFutureIntake } from "./intake";
import { columnIndex } from "./columns";
import { GRADUATION_COHORT_COLUMN } from "./graduationCohort";
import { getDepartment } from "./departments";

// Every roster fetch must reach at least as far as the Graduation Cohort
// column (see lib/graduationCohort.ts) — it's read into every Student
// regardless of which term is being loaded, so parseCampusRows always has
// it available. Widened per term-kind below to whichever is further right:
// this column, or (for a live-column term) that term's own status column.
function rosterRangeEnd(colLetterOfThisTerm?: string): string {
  if (!colLetterOfThisTerm) return GRADUATION_COHORT_COLUMN;
  return columnIndex(colLetterOfThisTerm) > columnIndex(GRADUATION_COHORT_COLUMN)
    ? colLetterOfThisTerm
    : GRADUATION_COHORT_COLUMN;
}

export type TermData = {
  dashboard: DashboardData;
  conflicts: ConflictRow[];
  isLive: boolean;
  /** Set when this term's data source isn't ready yet (e.g. a tab that
   * hasn't been created). The page renders a friendly notice instead of
   * a build-breaking crash when this is present. */
  error?: string;
};

const EMPTY_DASHBOARD: DashboardData = {
  generatedAt: new Date().toISOString(),
  totals: { main: 0, nakuru: 0, all: 0 },
  statusCounts: { all: {}, main: {}, nakuru: {} },
  genders: { all: {}, main: {}, nakuru: {} },
  programs: [],
  departments: [],
  studentsByStatus: {},
  conflictCount: 0,
};

export async function loadTermData(
  slug: string,
  campusFilter?: "MAIN" | "NAKURU",
  departmentFilter?: string[],
  courseFilter?: string[]
): Promise<TermData | null> {
  const term = getTerm(slug);
  if (!term) return null;

  // Drop students whose Intake/Year is after this term's period — they
  // hadn't joined ICMHS yet, so they shouldn't appear in its roster at all
  // (this is what was inflating "Unmarked" — a blank status because a
  // student wasn't enrolled yet looks identical to a blank status because
  // someone forgot to mark it). Only affects students with a parseable
  // Intake value — currently MAIN campus only, since Nakuru doesn't have
  // an Intake/Year column yet.
  function excludeFutureIntakes(students: Student[]): Student[] {
    const period = getTermPeriod(term!);
    if (!period) return students;
    return students.filter((s) => !isFutureIntake(s.intakeYear, period));
  }

  // Campus-scoped accounts (see lib/auth) never see the other campus's
  // data at all — not filtered client-side, filtered here, before the KPIs,
  // department breakdown, and conflict report are even computed, so every
  // number a scoped user sees is already correct for just their campus
  // rather than a full combined figure with the UI just hiding a toggle.
  function scopeToCampus<T extends { campus: "MAIN" | "NAKURU" }>(rows: T[]): T[] {
    return campusFilter ? rows.filter((r) => r.campus === campusFilter) : rows;
  }

  // Department-scoped accounts (e.g. an HOD) never see students outside
  // their own school(s) — same enforcement philosophy as campus scoping:
  // filtered here, before KPIs/breakdowns/conflicts are computed, not just
  // hidden client-side. Composes with campus scoping (an account can be
  // restricted on both, either, or neither) since scopeStudents below
  // applies them one after another.
  function scopeToDepartment<T extends { courseCode: string }>(rows: T[]): T[] {
    if (!departmentFilter || departmentFilter.length === 0) return rows;
    const allowed = new Set(departmentFilter);
    return rows.filter((r) => allowed.has(getDepartment(r.courseCode)));
  }

  // Course-scoped accounts — one level finer than department scope, for a
  // registrar restricted to a single programme rather than a whole school.
  // Same enforcement philosophy, and composes via AND with both campus and
  // department scoping in scopeStudents below.
  function scopeToCourse<T extends { courseCode: string }>(rows: T[]): T[] {
    if (!courseFilter || courseFilter.length === 0) return rows;
    const allowed = new Set(courseFilter);
    return rows.filter((r) => allowed.has(r.courseCode));
  }

  function scopeStudents<T extends { campus: "MAIN" | "NAKURU"; courseCode: string }>(rows: T[]): T[] {
    return scopeToCourse(scopeToDepartment(scopeToCampus(rows)));
  }

  try {
    if (term.source.kind === "live-legacy") {
      const [mainRows, nakuruRows] = await Promise.all([
        fetchSheetRows(`MAIN CAMPUS!A:${rosterRangeEnd()}`),
        fetchSheetRows(`NAKURU CAMPUS!A:${rosterRangeEnd()}`),
      ]);
      const students = [
        ...parseCampusRows(mainRows, "MAIN"),
        ...parseCampusRows(nakuruRows, "NAKURU"),
      ];
      const reconcilable = scopeStudents(toReconcilable(excludeFutureIntakes(students), term.source.block));
      return {
        dashboard: buildDashboardData(reconcilable),
        conflicts: buildConflictReport(reconcilable),
        isLive: true,
      };
    }

    if (term.source.kind === "live-statuslog") {
      const [mainRows, nakuruRows, logRows] = await Promise.all([
        fetchSheetRows(`MAIN CAMPUS!A:${rosterRangeEnd()}`),
        fetchSheetRows(`NAKURU CAMPUS!A:${rosterRangeEnd()}`),
        fetchSheetRows("STATUS LOG!A:D"),
      ]);
      const roster = [
        ...parseCampusRows(mainRows, "MAIN"),
        ...parseCampusRows(nakuruRows, "NAKURU"),
      ];
      const reconcilable = scopeStudents(buildFromStatusLog(excludeFutureIntakes(roster), logRows, term.source.termLabel));
      return {
        dashboard: buildDashboardData(reconcilable),
        conflicts: buildConflictReport(reconcilable),
        isLive: true,
      };
    }

    if (term.source.kind === "live-column") {
      const col = term.source.column;
      const fetchEnd = rosterRangeEnd(col);
      const [mainRows, nakuruRows] = await Promise.all([
        fetchSheetRows(`MAIN CAMPUS!A:${fetchEnd}`),
        fetchSheetRows(`NAKURU CAMPUS!A:${fetchEnd}`),
      ]);
      const roster = [
        ...parseCampusRows(mainRows, "MAIN"),
        ...parseCampusRows(nakuruRows, "NAKURU"),
      ];
      const colIdx = columnIndex(col);
      const statusByAdmission = new Map([
        ...extractColumnStatus(mainRows, colIdx),
        ...extractColumnStatus(nakuruRows, colIdx),
      ]);
      const reconcilable = scopeStudents(buildFromColumn(excludeFutureIntakes(roster), statusByAdmission));
      return {
        dashboard: buildDashboardData(reconcilable),
        conflicts: buildConflictReport(reconcilable),
        isLive: true,
      };
    }

    // static historical snapshot — pre-parsed JSON, no live fetch. Known
    // gap: a campus- or department-scoped account viewing one of these
    // still sees the combined totals/department breakdown as originally
    // snapshotted (these are frozen past-year figures with no live edit
    // capability, so there's no write-side risk) — only studentsByStatus
    // (individual records) is filtered, so no out-of-scope student-level
    // data leaks.
    const filePath = path.join(process.cwd(), "data", "historical", term.source.file);
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const dashboard: DashboardData = parsed.dashboard;
    if (campusFilter || (departmentFilter && departmentFilter.length > 0) || (courseFilter && courseFilter.length > 0)) {
      const deptAllowed = departmentFilter && departmentFilter.length > 0 ? new Set(departmentFilter) : null;
      const courseAllowed = courseFilter && courseFilter.length > 0 ? new Set(courseFilter) : null;
      const scopedStudentsByStatus: DashboardData["studentsByStatus"] = {};
      for (const [status, list] of Object.entries(dashboard.studentsByStatus ?? {})) {
        scopedStudentsByStatus[status] = (list as any[]).filter(
          (s) =>
            (!campusFilter || s.campus === campusFilter) &&
            (!deptAllowed || deptAllowed.has(getDepartment(s.courseCode))) &&
            (!courseAllowed || courseAllowed.has(s.courseCode))
        );
      }
      dashboard.studentsByStatus = scopedStudentsByStatus;
    }
    const conflicts: ConflictRow[] = campusFilter
      ? (parsed.conflicts ?? []).filter((c: ConflictRow) => (c as any).campus === campusFilter)
      : parsed.conflicts ?? [];
    return { dashboard, conflicts, isLive: false };
  } catch (err: any) {
    // Common cause: a sheet tab this term depends on (e.g. "STATUS LOG")
    // doesn't exist yet. Don't crash the build/page — surface it instead.
    return {
      dashboard: EMPTY_DASHBOARD,
      conflicts: [],
      isLive: term.source.kind !== "static",
      error: err?.message ?? "Failed to load data for this term.",
    };
  }
}
