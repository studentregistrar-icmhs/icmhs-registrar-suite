import { fetchSheetRows } from "./googleSheets";
import { parseCampusRows } from "./parse";
import { getDepartment } from "./departments";

export type CourseInfo = { code: string; name: string; department: string };

/**
 * Every distinct course code currently on the roster, with its display
 * name and department. Unlike departments (lib/departments.ts) and terms
 * (lib/terms.ts), there's no static list of courses anywhere in this
 * codebase — only a code-to-department map with no human-readable names.
 * Course names DO exist, but only as data on each student's own row, so
 * this builds the list live from the current roster rather than from a
 * config file. Used for the course-scope checklist in Manage Accounts —
 * not on any student-facing hot path, so a live fetch here (rather than a
 * maintained static list) is the right tradeoff: always accurate, never
 * needs updating by hand when a course is added or renamed.
 */
export async function listKnownCourses(): Promise<CourseInfo[]> {
  const [mainRows, nakuruRows] = await Promise.all([
    fetchSheetRows("MAIN CAMPUS!A:AD"),
    fetchSheetRows("NAKURU CAMPUS!A:AD"),
  ]);
  const students = [...parseCampusRows(mainRows, "MAIN"), ...parseCampusRows(nakuruRows, "NAKURU")];

  const byCode = new Map<string, CourseInfo>();
  for (const s of students) {
    if (!s.courseCode) continue;
    if (!byCode.has(s.courseCode)) {
      byCode.set(s.courseCode, {
        code: s.courseCode,
        name: s.courseName || s.courseCode,
        department: getDepartment(s.courseCode),
      });
    }
  }
  return Array.from(byCode.values()).sort(
    (a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name)
  );
}
