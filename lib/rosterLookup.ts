import { fetchSheetRows } from "./googleSheets";
import { Campus, LAYOUT_FOR_WRITE } from "./parse";

export type RowLocation = { campus: Campus; sheetRowNumber: number; rawRow: any[] };

// Ranges must reach column AD: AA/AB/AC hold the Sept-Dec 2026 "live-column"
// term's status/validity/date-reported (see lib/terms.ts), and AD holds the
// standalone Graduation Cohort tag (see lib/graduationCohort.ts) — neither
// would be readable from rawRow if the range stopped short of them, which is
// exactly why the Sept-Dec status couldn't be read/edited before AA/AB/AC
// were added here, and would be the same problem for cohort tagging if AD
// isn't included too. Write calls in lib/writeStatus.ts already address
// columns by letter, not by rawRow index, so they aren't affected by this.
const TABS: { campus: Campus; range: string; admissionCol: number }[] = [
  { campus: "MAIN", range: "MAIN CAMPUS!A:AD", admissionCol: 1 },
  { campus: "NAKURU", range: "NAKURU CAMPUS!A:AD", admissionCol: 1 },
];

/**
 * Locates a student's row by admission number. Returns the 1-indexed
 * sheet row number (for A1-notation writes) and which campus tab they're on.
 */
export async function findStudentRow(admissionNo: string): Promise<RowLocation | null> {
  for (const tab of TABS) {
    const rows = await fetchSheetRows(tab.range);
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (row && String(row[tab.admissionCol]) === admissionNo) {
        return { campus: tab.campus, sheetRowNumber: i + 1, rawRow: row };
      }
    }
  }
  return null;
}

/**
 * Bulk campus lookup for a list of admission numbers — one fetch per
 * campus tab regardless of list size, rather than one findStudentRow
 * round-trip per student. Used to enforce campus-scoped permissions on
 * batch write routes (e.g. bulk-marking several Unmarked students at
 * once) without an expensive per-student lookup.
 */
export async function campusForAdmissionNumbers(admissionNos: string[]): Promise<Map<string, Campus>> {
  const wanted = new Set(admissionNos);
  const result = new Map<string, Campus>();
  for (const tab of TABS) {
    const rows = await fetchSheetRows(tab.range);
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      const adm = row ? String(row[tab.admissionCol]) : "";
      if (adm && wanted.has(adm)) result.set(adm, tab.campus);
    }
  }
  return result;
}

/**
 * Same idea as campusForAdmissionNumbers, but also returns each student's
 * course code — needed to enforce department-scoped permissions (e.g. an
 * HOD account) on batch write routes without an expensive per-student
 * findStudentRow round-trip. Department itself is derived from courseCode
 * by the caller (via lib/departments.ts's getDepartment), same as
 * everywhere else in the app that needs a student's department.
 */
export async function campusAndCourseForAdmissionNumbers(
  admissionNos: string[]
): Promise<Map<string, { campus: Campus; courseCode: string }>> {
  const wanted = new Set(admissionNos);
  const result = new Map<string, { campus: Campus; courseCode: string }>();
  for (const tab of TABS) {
    const rows = await fetchSheetRows(tab.range);
    const courseCodeCol = LAYOUT_FOR_WRITE[tab.campus].courseCode;
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      const adm = row ? String(row[tab.admissionCol]) : "";
      if (adm && wanted.has(adm)) {
        result.set(adm, { campus: tab.campus, courseCode: String(row[courseCodeCol] ?? "").trim() });
      }
    }
  }
  return result;
}
