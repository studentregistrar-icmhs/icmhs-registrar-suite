import { NextRequest, NextResponse } from "next/server";
import { fetchSheetRows } from "@/lib/googleSheets";
import { parseCampusRows } from "@/lib/parse";
import { getCurrentUserFromRequest, canAccessCampus, canAccessDepartment, canAccessCourse } from "@/lib/auth/currentUser";

export async function GET(req: NextRequest) {
  const me = getCurrentUserFromRequest(req);
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const [mainRows, nakuruRows] = await Promise.all([
    fetchSheetRows("MAIN CAMPUS!A:AD"),
    fetchSheetRows("NAKURU CAMPUS!A:AD"),
  ]);
  const students = [
    ...parseCampusRows(mainRows, "MAIN"),
    ...parseCampusRows(nakuruRows, "NAKURU"),
  ];

  const results = students
    .filter(
      (s) =>
        (s.admissionNo.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)) &&
        canAccessCampus(me, s.campus) &&
        canAccessDepartment(me, s.courseCode) &&
        canAccessCourse(me, s.courseCode)
    )
    .slice(0, 25)
    .map((s) => ({
      admissionNo: s.admissionNo,
      name: s.name,
      courseCode: s.courseCode,
      courseName: s.courseName,
      campus: s.campus,
    }));

  return NextResponse.json({ results });
}
