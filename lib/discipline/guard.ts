import { NextResponse } from "next/server";
import { findStudentRow } from "@/lib/rosterLookup";
import { LAYOUT_FOR_WRITE } from "@/lib/parse";
import {
  canAccessCampus, canAccessDepartment, canAccessCourse, canAccessTerm,
  type CurrentUser,
} from "@/lib/auth/currentUser";
import { canViewDisciplinary, canManageDisciplinary } from "./access";

export type StudentContext = {
  admissionNo: string;
  name: string;
  courseCode: string;
  courseName: string;
  campus: "MAIN" | "NAKURU";
};

/**
 * One gate for every disciplinary route: right permission, then the same
 * campus / department / course scoping the status editor enforces. An
 * out-of-scope student gets the same 404 as a nonexistent one.
 */
export async function guardStudent(
  me: CurrentUser | null,
  admissionNo: string,
  mode: "read" | "write"
): Promise<{ ok: true; student: StudentContext } | { ok: false; res: NextResponse }> {
  const fail = (reason: string, status: number) => ({
    ok: false as const,
    res: NextResponse.json({ ok: false, reason }, { status }),
  });

  if (!me) return fail("Not logged in.", 401);
  const allowed = mode === "write" ? await canManageDisciplinary(me) : await canViewDisciplinary(me);
  if (!allowed) return fail("You don't have access to disciplinary records.", 403);

  const loc = await findStudentRow(admissionNo);
  if (!loc) return fail("Student not found.", 404);
  const layout = LAYOUT_FOR_WRITE[loc.campus];
  const courseCode = String(loc.rawRow[layout.courseCode] ?? "").trim();
  if (!canAccessCampus(me, loc.campus) || !canAccessDepartment(me, courseCode) || !canAccessCourse(me, courseCode)) {
    return fail("Student not found.", 404);
  }

  return {
    ok: true,
    student: {
      admissionNo,
      name: String(loc.rawRow[layout.name] ?? "").trim(),
      courseCode,
      courseName: String(loc.rawRow[layout.courseName] ?? "").trim(),
      campus: loc.campus,
    },
  };
}

/** Same campus / school / course / term scoping the rest of the app applies,
 * for cases listed in bulk (the per-student routes use guardStudent instead). */
export function scopeCases<T extends { campus: "MAIN" | "NAKURU"; course_code: string | null; term_slug: string }>(
  me: CurrentUser,
  rows: T[]
): T[] {
  return rows.filter(
    (c) =>
      canAccessCampus(me, c.campus) &&
      canAccessDepartment(me, c.course_code ?? "") &&
      canAccessCourse(me, c.course_code ?? "") &&
      canAccessTerm(me, c.term_slug)
  );
}
